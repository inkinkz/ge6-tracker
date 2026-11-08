import "server-only";
import {
  BLOCK_TIME_SEC,
  CONFIRMATIONS,
  GE6_DECIMALS,
  GE6_DISTRIBUTORS,
  GE6_MINT_BLOCK,
  HOURLY_WINDOW_HOURS,
  ORG_WINDOW_BLOCKS,
  ORGANIZER_WALLETS,
  RECENT_VOTES_LIMIT,
  START_BLOCK,
  SYNC_MIN_INTERVAL_MS,
  TOP_VOTERS_LIMIT,
  TZ_OFFSET_SEC,
  WINDOW_BLOCKS,
  WINDOW_SAFETY_BLOCKS,
  getPollPolicy,
} from "./config";
import {
  fetchChainHead,
  fetchIndexedHead,
  fetchSupply,
  fetchTransfersFrom,
  fetchVotes,
  unpackRow,
  unpackTransfer,
  type OrgTransfer,
  type SupplyRead,
  type VoteRow,
} from "./chain";
import { getWindowOrgTransfers, getWindowVotes } from "./windows";
import type {
  DistributorWallet,
  DistributionBucket,
  FlowDay,
  RecentVote,
  SeriesPoint,
  StatsSnapshot,
  SupplySnapshot,
  TokenFlow,
  VoterEntry,
  VoterSummaries,
  WalletInfo,
  WindowStats,
} from "./types";

/*
 * In-memory vote index for one server instance.
 *
 * Cold start: load completed block windows from the remote cache (or Blockscout on a miss),
 * then scan the open tail. Warm: only scan blocks after `syncedBlock` — usually a single
 * eth_getLogs call. Fluid compute keeps instances warm between requests, so most syncs are cheap.
 */

type VoterAgg = { wei: bigint; votes: number; firstBlock: number; lastBlock: number };

type State = {
  rows: VoteRow[];
  seen: Set<number>;
  needsSort: boolean;
  voters: Map<string, VoterAgg>;
  totalWei: bigint;
  /** Every vote at or below this block is in `rows`. */
  syncedBlock: number;
  /** Known (block, timestamp) pair; other timestamps are derived from the 3s block period. */
  anchor: { block: number; timestamp: number };
  /** Token supply split, read at `syncedBlock` on each sync (kept from the last good read on failure). */
  supply: SupplyRead | null;
  /** Transfers out of the organizer wallets; null until the full history has loaded once. */
  org: OrgIndex | null;
  lastSyncAt: number;
  lastRepairAt: number;
  dirty: boolean;
  built: Built | null;
};

type OrgIndex = {
  rows: OrgTransfer[];
  seen: Set<string>;
  /** Every organizer transfer at or below this block is in `rows`. */
  syncedBlock: number;
};

type LiveFields = "updatedAt" | "policy" | "syncedBlock" | "syncedBlockAt";

/** Aggregates are rebuilt only when votes arrive (or every 30s for the rolling windows). */
type Built = {
  body: Omit<StatsSnapshot, LiveFields>;
  bodyJson: string;
  rankByVoter: Map<string, number>;
  builtAt: number;
};

export type Served = { snapshot: StatsSnapshot; json: string; rankByVoter: Map<string, number> };

type Store = { state: State | null; inflight: Promise<void> | null; lastAttemptAt: number };

// Kept on globalThis so dev-mode module reloads don't drop the index.
const g = globalThis as typeof globalThis & { __ge6Store?: Store };
const store: Store = (g.__ge6Store ??= { state: null, inflight: null, lastAttemptAt: 0 });

const REBUILD_EVERY_MS = 30_000;
const REPAIR_EVERY_MS = 5 * 60_000;
const WEI_PER_MICRO = 10n ** BigInt(GE6_DECIMALS - 6);

/**
 * Sums are done in integer micro-GE6 (1e-6) so they stay exact; converted to GE6 only for output.
 * Safe up to ~9 billion GE6 (Number.MAX_SAFE_INTEGER micro-units).
 */
const toMicro = (wei: bigint) => Number(wei / WEI_PER_MICRO);
const fromMicro = (micro: number) => micro / 1e6;
const toTokens = (wei: bigint) => fromMicro(toMicro(wei));

const tsOf = (s: State, block: number) => s.anchor.timestamp - (s.anchor.block - block) * BLOCK_TIME_SEC;

function emptyState(anchor: State["anchor"]): State {
  return {
    rows: [],
    seen: new Set(),
    needsSort: false,
    voters: new Map(),
    totalWei: 0n,
    syncedBlock: START_BLOCK - 1,
    anchor,
    supply: null,
    org: null,
    lastSyncAt: 0,
    lastRepairAt: 0,
    dirty: true,
    built: null,
  };
}

function addRow(s: State, row: VoteRow) {
  if (s.seen.has(row.index)) return;
  s.seen.add(row.index);
  const last = s.rows[s.rows.length - 1];
  if (last && row.index < last.index) s.needsSort = true;
  s.rows.push(row);
  s.totalWei += row.wei;
  const agg = s.voters.get(row.voter);
  if (agg) {
    agg.wei += row.wei;
    agg.votes += 1;
    agg.firstBlock = Math.min(agg.firstBlock, row.block);
    agg.lastBlock = Math.max(agg.lastBlock, row.block);
  } else {
    s.voters.set(row.voter, { wei: row.wei, votes: 1, firstBlock: row.block, lastBlock: row.block });
  }
  s.dirty = true;
}

function sortRows(s: State) {
  if (!s.needsSort) return;
  s.rows.sort((a, b) => a.index - b.index);
  s.needsSort = false;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function readHeads() {
  const [indexed, chain] = await Promise.all([fetchIndexedHead(), fetchChainHead().catch(() => null)]);
  const head = Math.min(indexed, chain?.block ?? indexed) - CONFIRMATIONS;
  return { head, chain };
}

async function coldLoad(): Promise<State> {
  const { head, chain } = await readHeads();
  const s = emptyState(chain ?? { block: head, timestamp: Math.floor(Date.now() / 1000) });

  const windows: number[] = [];
  for (let start = START_BLOCK; start + WINDOW_BLOCKS - 1 <= head - WINDOW_SAFETY_BLOCKS; start += WINDOW_BLOCKS) {
    windows.push(start);
  }
  const packed = await mapLimit(windows, 6, (start) => getWindowVotes(start));
  for (const rows of packed) for (const p of rows) addRow(s, unpackRow(p));

  const tailFrom = windows.length ? windows[windows.length - 1] + WINDOW_BLOCKS : START_BLOCK;
  for (const row of await fetchVotes(tailFrom, head)) addRow(s, row);
  s.syncedBlock = head;
  return s;
}

async function incremental(s: State) {
  const { head, chain } = await readHeads();
  if (head > s.syncedBlock) {
    const rows = await fetchVotes(s.syncedBlock + 1, head);
    for (const row of rows) addRow(s, row);
    s.syncedBlock = head;
  }
  if (chain) s.anchor = chain;
}

/**
 * Vote indexes are gap-free on-chain. If we hold #10 and #12 but not #11, Blockscout was
 * behind when we scanned that range, so rescan just the blocks between the neighbours.
 */
async function repairGaps(s: State) {
  sortRows(s);
  const expected = s.rows.length ? s.rows[s.rows.length - 1].index + 1 : 0;
  if (s.rows.length === expected || Date.now() - s.lastRepairAt < REPAIR_EVERY_MS) return;
  s.lastRepairAt = Date.now();

  const ranges: [number, number][] = [];
  if (s.rows[0].index !== 0) ranges.push([START_BLOCK, s.rows[0].block]);
  for (let i = 1; i < s.rows.length && ranges.length < 5; i++) {
    if (s.rows[i].index !== s.rows[i - 1].index + 1) ranges.push([s.rows[i - 1].block, s.rows[i].block]);
  }
  for (const [from, to] of ranges) {
    for (const row of await fetchVotes(from, to)) addRow(s, row);
  }
  sortRows(s);
}

/**
 * Read the supply split at the block the votes are synced to, so "voted" matches the vote total.
 * One batched request; a failure only leaves the previous reading in place.
 */
async function refreshSupply(s: State) {
  if (s.supply?.block === s.syncedBlock) return;
  try {
    const next = await fetchSupply(s.syncedBlock);
    const prev = s.supply;
    s.supply = next;
    const changed =
      !prev ||
      prev.totalWei !== next.totalWei ||
      prev.treasuryWei !== next.treasuryWei ||
      next.distributorWei.some((w, i) => w !== prev.distributorWei?.[i]) ||
      prev.votedWei !== next.votedWei;
    if (changed) s.dirty = true;
  } catch (err) {
    console.error("[ge6] supply read failed, keeping the last one:", err);
  }
}

const ORG_SENDERS = ORGANIZER_WALLETS.join(",");

function addOrgRow(org: OrgIndex, row: OrgTransfer): boolean {
  if (org.seen.has(row.key)) return false;
  org.seen.add(row.key);
  org.rows.push(row);
  return true;
}

/**
 * Bring the organizer transfer index up to the vote index's block. The first load reads the cached
 * completed windows plus the open tail; later syncs only read the new blocks. A failure keeps
 * whatever was loaded and retries from there on the next sync.
 */
async function syncOrg(s: State) {
  const target = s.syncedBlock;
  try {
    if (!s.org) {
      const org: OrgIndex = { rows: [], seen: new Set(), syncedBlock: GE6_MINT_BLOCK - 1 };
      const windows: number[] = [];
      for (let start = GE6_MINT_BLOCK; start + ORG_WINDOW_BLOCKS - 1 <= target - WINDOW_SAFETY_BLOCKS; start += ORG_WINDOW_BLOCKS) {
        windows.push(start);
      }
      const packed = await mapLimit(windows, 6, (start) => getWindowOrgTransfers(start, ORG_SENDERS));
      for (const rows of packed) for (const p of rows) addOrgRow(org, unpackTransfer(p));
      const tailFrom = windows.length ? windows[windows.length - 1] + ORG_WINDOW_BLOCKS : GE6_MINT_BLOCK;
      for (const row of await fetchTransfersFrom(ORGANIZER_WALLETS, tailFrom, target)) addOrgRow(org, row);
      org.syncedBlock = target;
      s.org = org;
      s.dirty = true;
    } else if (target > s.org.syncedBlock) {
      const rows = await fetchTransfersFrom(ORGANIZER_WALLETS, s.org.syncedBlock + 1, target);
      for (const row of rows) if (addOrgRow(s.org, row)) s.dirty = true;
      s.org.syncedBlock = target;
    }
  } catch (err) {
    console.error("[ge6] organizer transfer sync failed:", err);
  }
}

async function runSync() {
  store.lastAttemptAt = Date.now();
  if (!store.state) {
    store.state = await coldLoad();
  } else {
    await incremental(store.state);
  }
  await Promise.all([repairGaps(store.state), refreshSupply(store.state), syncOrg(store.state)]);
  store.state.lastSyncAt = Date.now();
}

async function ensureFresh(): Promise<State> {
  const fresh = store.state && Date.now() - store.state.lastSyncAt < SYNC_MIN_INTERVAL_MS;
  const backingOff = store.state && Date.now() - store.lastAttemptAt < SYNC_MIN_INTERVAL_MS;
  if (!fresh && !backingOff && !store.inflight) {
    store.inflight = runSync().finally(() => {
      store.inflight = null;
    });
  }
  if (store.inflight) {
    try {
      await store.inflight;
    } catch (err) {
      // Upstream hiccup: keep serving the last good data if we have any.
      if (!store.state) throw err;
      console.error("[ge6] sync failed, serving stale data:", err);
    }
  }
  if (!store.state) throw new Error("no vote data available");
  return store.state;
}

// ---------------------------------------------------------------------------
// Snapshot

/**
 * Trim float noise before serializing: every byte is multiplied by every poll of every viewer.
 * Shares keep 3 significant digits (so "<0.01%" still works); other fractions keep 2 decimals,
 * which is what the UI displays. Integers (counts, timestamps, blocks) are untouched.
 */
function compactNumbers<T>(value: T, key = ""): T {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value;
    const rounded = /share$/i.test(key) ? Number(value.toPrecision(3)) : Math.round(value * 100) / 100;
    return rounded as T;
  }
  if (Array.isArray(value)) return value.map((v) => compactNumbers(v, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compactNumbers(v, k)])) as T;
  }
  return value;
}

const emptyWindow = (): WindowStats => ({ tokens: 0, votes: 0, activeVoters: 0, newVoters: 0 });

const DISTRIBUTION: { label: string; min: number; max: number }[] = [
  { label: "น้อยกว่า 1", min: 0, max: 1 },
  { label: "1 – 9", min: 1, max: 10 },
  { label: "10 – 99", min: 10, max: 100 },
  { label: "100 – 999", min: 100, max: 1_000 },
  { label: "1,000 – 9,999", min: 1_000, max: 10_000 },
  { label: "10,000 ขึ้นไป", min: 10_000, max: Infinity },
];

function build(s: State): Built {
  sortRows(s);
  const now = Math.floor(Date.now() / 1000);
  const at = (block: number) => tsOf(s, block);
  const totalTokens = toTokens(s.totalWei);
  const toRecent = (r: VoteRow): RecentVote => ({
    index: r.index,
    tx: r.tx,
    voter: r.voter,
    tokens: toTokens(r.wei),
    at: at(r.block),
  });

  // Leaderboard (competition ranking: equal totals share a rank).
  const ranked = [...s.voters.entries()]
    .map(([address, a]) => ({ address, micro: toMicro(a.wei), tokens: toTokens(a.wei), agg: a }))
    .sort((a, b) => b.micro - a.micro);
  const rankByVoter = new Map<string, number>();
  ranked.forEach((v, i) => {
    const prev = ranked[i - 1];
    rankByVoter.set(v.address, prev && prev.micro === v.micro ? rankByVoter.get(prev.address)! : i + 1);
  });
  const share = (t: number) => (totalTokens > 0 ? t / totalTokens : 0);
  const topVoters: VoterEntry[] = ranked.slice(0, TOP_VOTERS_LIMIT).map((v) => ({
    rank: rankByVoter.get(v.address)!,
    address: v.address,
    tokens: v.tokens,
    votes: v.agg.votes,
    share: share(v.tokens),
    lastVoteAt: at(v.agg.lastBlock),
  }));

  const totalMicro = toMicro(s.totalWei);
  const sumTop = (n: number) => fromMicro(ranked.slice(0, n).reduce((acc, v) => acc + v.micro, 0));
  let walletsForHalf = 0;
  for (let acc = 0; walletsForHalf < ranked.length && acc * 2 < totalMicro; walletsForHalf++) {
    acc += ranked[walletsForHalf].micro;
  }
  const median = ranked.length
    ? ranked.length % 2
      ? ranked[(ranked.length - 1) / 2].tokens
      : (ranked[ranked.length / 2 - 1].tokens + ranked[ranked.length / 2].tokens) / 2
    : 0;

  const distribution: DistributionBucket[] = DISTRIBUTION.map((b) => ({ label: b.label, voters: 0, tokens: 0, share: 0 }));
  for (const v of ranked) {
    const i = DISTRIBUTION.findIndex((b) => v.tokens >= b.min && v.tokens < b.max);
    distribution[i].voters += 1;
    distribution[i].tokens += v.micro;
  }
  for (const d of distribution) {
    d.tokens = fromMicro(d.tokens);
    d.share = share(d.tokens);
  }

  // Time series in Bangkok days / clock hours, plus rolling 1h / 24h windows.
  const dayKey = (ts: number) => Math.floor((ts + TZ_OFFSET_SEC) / 86400);
  const hourKey = (ts: number) => Math.floor(ts / 3600);
  const nowHour = hourKey(now);
  const firstHour = nowHour - HOURLY_WINDOW_HOURS + 1;
  const firstVoteAt = s.rows.length ? at(s.rows[0].block) : null;
  const firstDay = dayKey(firstVoteAt ?? now);
  const nowDay = dayKey(now);

  const point = (t: number): SeriesPoint => ({ t, tokens: 0, votes: 0, newVoters: 0, cumulativeTokens: 0 });
  const daily = Array.from({ length: Math.max(nowDay - firstDay + 1, 1) }, (_, i) =>
    point((firstDay + i) * 86400 - TZ_OFFSET_SEC),
  );
  const hourly = Array.from({ length: HOURLY_WINDOW_HOURS }, (_, i) => point((firstHour + i) * 3600));

  const last1h = emptyWindow();
  const last24h = emptyWindow();
  const active1h = new Set<string>();
  const active24h = new Set<string>();
  const seenVoters = new Set<string>();
  let largest: VoteRow | null = null;
  let cumulative = 0;
  let cumulativeBeforeHourly = 0;

  for (const r of s.rows) {
    const ts = at(r.block);
    const tokens = toMicro(r.wei);
    const isNew = !seenVoters.has(r.voter);
    if (isNew) seenVoters.add(r.voter);
    if (!largest || r.wei > largest.wei) largest = r;
    cumulative += tokens;

    const d = daily[dayKey(ts) - firstDay];
    if (d) {
      d.tokens += tokens;
      d.votes += 1;
      if (isNew) d.newVoters += 1;
    }
    const h = hourly[hourKey(ts) - firstHour];
    if (h) {
      h.tokens += tokens;
      h.votes += 1;
      if (isNew) h.newVoters += 1;
    } else if (hourKey(ts) < firstHour) {
      cumulativeBeforeHourly = cumulative;
    }

    for (const [win, set, span] of [
      [last1h, active1h, 3600],
      [last24h, active24h, 86400],
    ] as const) {
      if (ts > now - span) {
        win.tokens += tokens;
        win.votes += 1;
        set.add(r.voter);
        if (isNew) win.newVoters += 1;
      }
    }
  }
  last1h.activeVoters = active1h.size;
  last24h.activeVoters = active24h.size;
  last1h.tokens = fromMicro(last1h.tokens);
  last24h.tokens = fromMicro(last24h.tokens);

  let run = 0;
  for (const d of daily) {
    d.cumulativeTokens = fromMicro((run += d.tokens));
    d.tokens = fromMicro(d.tokens);
  }
  run = cumulativeBeforeHourly;
  for (const h of hourly) {
    h.cumulativeTokens = fromMicro((run += h.tokens));
    h.tokens = fromMicro(h.tokens);
  }

  // Supply split, in exact micro-GE6 so created = organizer + voted + inWallets to the last digit.
  let supply: SupplySnapshot | null = null;
  if (s.supply) {
    const created = toMicro(s.supply.totalWei);
    const treasury = toMicro(s.supply.treasuryWei);
    const distributors = toMicro(s.supply.distributorsWei);
    const voted = toMicro(s.supply.votedWei);
    const organizer = treasury + distributors;
    supply = {
      block: s.supply.block,
      created: fromMicro(created),
      organizer: fromMicro(organizer),
      treasury: fromMicro(treasury),
      distributors: fromMicro(distributors),
      distributorWallets: GE6_DISTRIBUTORS.length,
      distributed: fromMicro(created - organizer),
      voted: fromMicro(voted),
      inWallets: fromMicro(created - organizer - voted),
    };
  }

  const flow = s.org ? buildFlow(s, s.org, dayKey, nowDay) : null;

  const lastIndex = s.rows.length ? s.rows[s.rows.length - 1].index : -1;
  const body: Built["body"] = {
    firstVoteAt,
    totals: {
      tokens: totalTokens,
      votes: s.rows.length,
      voters: s.voters.size,
      avgPerVote: s.rows.length ? totalTokens / s.rows.length : 0,
      avgPerVoter: s.voters.size ? totalTokens / s.voters.size : 0,
      medianPerVoter: median,
      largestVote: largest ? toRecent(largest) : null,
    },
    last1h,
    last24h,
    concentration: {
      top1Share: share(sumTop(1)),
      top10Share: share(sumTop(10)),
      top100Share: share(sumTop(100)),
      walletsForHalf,
    },
    supply,
    flow,
    topVoters,
    distribution,
    daily,
    hourly,
    recent: s.rows.slice(-RECENT_VOTES_LIMIT).reverse().map(toRecent),
    integrity: { expectedVotes: lastIndex + 1, missingVotes: lastIndex + 1 - s.rows.length },
  };
  const compact = compactNumbers(body);
  return { body: compact, bodyJson: JSON.stringify(compact), rankByVoter, builtAt: Date.now() };
}

/** Per-wallet totals and a daily organizer → fan / vote series, from the organizer transfer index. */
function buildFlow(s: State, org: OrgIndex, dayKey: (ts: number) => number, nowDay: number): TokenFlow {
  const at = (block: number) => tsOf(s, block);
  type Agg = { allocated: bigint; sent: bigint; recipients: Set<string>; lastBlock: number };
  const per = new Map<string, Agg>(
    ORGANIZER_WALLETS.map((a) => [a, { allocated: 0n, sent: 0n, recipients: new Set<string>(), lastBlock: 0 }]),
  );
  const fans = new Set<string>();
  const distributedByDay = new Map<number, number>();
  for (const r of org.rows) {
    const from = per.get(r.from);
    if (!from) continue;
    const to = per.get(r.to);
    if (to) {
      // Organizer → organizer: an allocation (or a return), not a distribution.
      to.allocated += r.wei;
      from.allocated -= r.wei;
      continue;
    }
    from.sent += r.wei;
    from.recipients.add(r.to);
    if (r.block > from.lastBlock) from.lastBlock = r.block;
    fans.add(r.to);
    const day = dayKey(at(r.block));
    distributedByDay.set(day, (distributedByDay.get(day) ?? 0) + toMicro(r.wei));
  }

  const votedByDay = new Map<number, number>();
  for (const r of s.rows) {
    const day = dayKey(at(r.block));
    votedByDay.set(day, (votedByDay.get(day) ?? 0) + toMicro(r.wei));
  }
  const days = [...distributedByDay.keys(), ...votedByDay.keys()];
  const firstDay = days.length ? Math.min(...days) : nowDay;
  const daily: FlowDay[] = Array.from({ length: Math.max(nowDay - firstDay + 1, 1) }, (_, i) => {
    const day = firstDay + i;
    return {
      t: day * 86400 - TZ_OFFSET_SEC,
      distributed: fromMicro(distributedByDay.get(day) ?? 0),
      voted: fromMicro(votedByDay.get(day) ?? 0),
    };
  });

  const wallets: DistributorWallet[] = GE6_DISTRIBUTORS.map((address, i) => {
    const a = per.get(address.toLowerCase())!;
    const balance = s.supply?.distributorWei?.[i];
    return {
      address,
      allocated: toTokens(a.allocated),
      sent: toTokens(a.sent),
      balance: balance === undefined ? null : toTokens(balance),
      recipients: a.recipients.size,
      lastSentAt: a.lastBlock ? at(a.lastBlock) : null,
    };
  }).sort((x, y) => y.allocated - x.allocated);

  const treasury = per.get(ORGANIZER_WALLETS[0])!;
  return {
    recipients: fans.size,
    direct: { sent: toTokens(treasury.sent), recipients: treasury.recipients.size },
    wallets,
    daily,
  };
}

/** Fresh-enough stats (syncs with Blockscout at most every SYNC_MIN_INTERVAL_MS per instance). */
export async function getStats(): Promise<Served> {
  const s = await ensureFresh();
  if (!s.built || s.dirty || Date.now() - s.built.builtAt > REBUILD_EVERY_MS) {
    s.built = build(s);
    s.dirty = false;
  }
  const live: Pick<StatsSnapshot, LiveFields> = {
    updatedAt: s.lastSyncAt,
    policy: getPollPolicy(),
    syncedBlock: s.syncedBlock,
    syncedBlockAt: tsOf(s, s.syncedBlock),
  };
  return {
    snapshot: { ...live, ...s.built.body },
    // Splice the live fields into the cached body JSON instead of re-serializing everything.
    json: `${JSON.stringify(live).slice(0, -1)},${s.built.bodyJson.slice(1)}`,
    rankByVoter: s.built.rankByVoter,
  };
}

export async function getWallet(address: string): Promise<WalletInfo> {
  const built = await getStats();
  const s = store.state!;
  const addr = address.toLowerCase();
  const agg = s.voters.get(addr);
  const at = (block: number) => tsOf(s, block);
  const tokens = agg ? toTokens(agg.wei) : 0;
  const total = built.snapshot.totals.tokens;
  const recent: RecentVote[] = [];
  if (agg) {
    for (let i = s.rows.length - 1; i >= 0 && recent.length < 20; i--) {
      const r = s.rows[i];
      if (r.voter === addr) {
        recent.push({ index: r.index, tx: r.tx, voter: r.voter, tokens: toTokens(r.wei), at: at(r.block) });
      }
    }
  }
  return {
    address: addr,
    found: Boolean(agg),
    rank: built.rankByVoter.get(addr) ?? null,
    totalVoters: s.voters.size,
    tokens,
    votes: agg?.votes ?? 0,
    share: total > 0 ? tokens / total : 0,
    firstVoteAt: agg ? at(agg.firstBlock) : null,
    lastVoteAt: agg ? at(agg.lastBlock) : null,
    recent,
    updatedAt: built.snapshot.updatedAt,
  };
}

/** GE6 totals for many wallets at once (used by the GE5 comparison page). */
export async function getVoterSummaries(addresses: string[]): Promise<VoterSummaries> {
  const built = await getStats();
  const s = store.state!;
  const voters: VoterSummaries["voters"] = {};
  for (const address of addresses) {
    const addr = address.toLowerCase();
    const agg = s.voters.get(addr);
    if (!agg) continue;
    voters[addr] = {
      tokens: toTokens(agg.wei),
      votes: agg.votes,
      rank: built.rankByVoter.get(addr) ?? 0,
      lastVoteAt: tsOf(s, agg.lastBlock),
    };
  }
  return {
    updatedAt: built.snapshot.updatedAt,
    totalTokens: built.snapshot.totals.tokens,
    totalVoters: built.snapshot.totals.voters,
    voters,
  };
}

/** Read-only view of every wallet that has voted in GE6 (for cross-election overlaps). */
export async function getGe6VoterIndex(): Promise<{
  updatedAt: number;
  size: number;
  has: (address: string) => boolean;
  addresses: () => IterableIterator<string>;
}> {
  const built = await getStats();
  const voters = store.state!.voters;
  return {
    updatedAt: built.snapshot.updatedAt,
    size: voters.size,
    has: (address) => voters.has(address),
    addresses: () => voters.keys(),
  };
}

/** Addresses of GE6's top `n` wallets by tokens (ties at the cutoff included). */
export async function getGe6TopAddresses(n: number): Promise<string[]> {
  const { rankByVoter } = await getStats();
  const out: string[] = [];
  for (const [address, rank] of rankByVoter) if (rank <= n) out.push(address);
  return out;
}
