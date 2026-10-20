import "server-only";
import { cacheLife } from "next/cache";
import ge3 from "@/data/ge3-summary.json";
import ge4 from "@/data/ge4-summary.json";
import ge5 from "@/data/ge5-summary.json";
import ge3Top from "@/data/ge3-top.json";
import ge4Top from "@/data/ge4-top.json";
import ge5Top from "@/data/ge5-top.json";
import { getGe6TopAddresses, getGe6VoterIndex, getStats, getVoterSummaries } from "./tracker";
import type { GeCompare, GeEditionStats, GeMemberHistory, GePastResult, GeWalletRow } from "./types";

/** The combined wallet table takes each election's top this-many wallets (GE3–GE5 and GE6). */
const TOP_PER_EDITION = 300;

type PastId = "ge3" | "ge4" | "ge5";
/** Shape of src/data/<edition>-summary.json (see scripts/build-past-ge-data.mjs). */
type Summary = {
  stats: Omit<GeEditionStats, "id" | "label" | "live" | "topMember" | "members"> & { members: number };
  members: { name: string; tokens: number; wallets: number }[];
  /** Concatenated 40-hex addresses, sorted; `amounts[i]` is the total of the i-th address. */
  wallets: string;
  amounts: number[];
};
type TopFile = { top: { address: string; tokens: number; members: { name: string; tokens: number }[] }[] };
const PAST: { id: PastId; label: string; summary: Summary; top: TopFile }[] = [
  { id: "ge3", label: "GE3", summary: ge3, top: ge3Top },
  { id: "ge4", label: "GE4", summary: ge4, top: ge4Top },
  { id: "ge5", label: "GE5", summary: ge5, top: ge5Top },
];

// Every past wallet's total and rank, plus top members for each election's top wallets. Parsed
// once per server instance; the summaries never change at runtime.
type PastIndex = Map<string, GePastResult>;
let pastIndexes: Record<PastId, PastIndex> | null = null;
function pastIndex(): Record<PastId, PastIndex> {
  if (!pastIndexes) {
    const build = ({ summary, top }: (typeof PAST)[number]): PastIndex => {
      const { wallets, amounts } = summary;
      // Competition ranking over all wallets, matching the ranks in <edition>-top.json.
      const order = amounts.map((tokens, i) => ({ tokens, i })).sort((a, b) => b.tokens - a.tokens);
      const rankAt: number[] = new Array(order.length);
      order.forEach((o, k) => {
        rankAt[o.i] = k > 0 && order[k - 1].tokens === o.tokens ? rankAt[order[k - 1].i] : k + 1;
      });
      const topMember = new Map(
        top.top.map((r) => [r.address, { name: r.members[0].name, share: r.tokens > 0 ? r.members[0].tokens / r.tokens : 0 }]),
      );
      const index: PastIndex = new Map();
      for (let i = 0; i < amounts.length; i++) {
        const address = `0x${wallets.slice(i * 40, i * 40 + 40)}`;
        index.set(address, { tokens: amounts[i], rank: rankAt[i], top: topMember.get(address) ?? null });
      }
      return index;
    };
    pastIndexes = { ge3: build(PAST[0]), ge4: build(PAST[1]), ge5: build(PAST[2]) };
  }
  return pastIndexes;
}

const countIn = (a: Iterable<string>, ...others: { has: (x: string) => boolean }[]) => {
  let n = 0;
  for (const x of a) if (others.every((o) => o.has(x))) n++;
  return n;
};
const countNotIn = (a: Iterable<string>, ...others: { has: (x: string) => boolean }[]) => {
  let n = 0;
  for (const x of a) if (!others.some((o) => o.has(x))) n++;
  return n;
};

/** "Nenie CGM48" / "Pim (BNK48)" / "Paeyah" → nickname + group (if the export gives one). */
function parseMember(name: string): { nick: string; group: string | null } {
  const m = /^(.*?)\s*\((BNK48|CGM48)\)$/.exec(name) ?? /^(.*?)\s+(BNK48|CGM48)$/.exec(name);
  return m ? { nick: m[1].trim(), group: m[2] } : { nick: name.trim(), group: null };
}

/**
 * Join members across elections by nickname. A nickname used by members of both groups (Pim)
 * is keyed by group too; an entry that doesn't say which group (GE4's "Pim") stays separate
 * rather than being guessed. Differently spelled names are not merged.
 */
function memberHistory(): GeMemberHistory[] {
  const entries = PAST.flatMap(({ id, summary }) => {
    let prev: { tokens: number; rank: number } | null = null;
    return summary.members.map((m, i) => {
      const rank = prev && prev.tokens === m.tokens ? prev.rank : i + 1;
      prev = { tokens: m.tokens, rank };
      return { id, ...parseMember(m.name), rank, tokens: m.tokens, wallets: m.wallets };
    });
  });

  const groupsByNick = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = groupsByNick.get(e.nick.toLowerCase()) ?? new Set();
    if (e.group) set.add(e.group);
    groupsByNick.set(e.nick.toLowerCase(), set);
  }

  const byKey = new Map<string, GeMemberHistory>();
  for (const e of entries) {
    const nick = e.nick.toLowerCase();
    const ambiguous = (groupsByNick.get(nick)?.size ?? 0) > 1;
    const key = ambiguous ? `${nick}|${e.group ?? "?"}` : nick;
    const h = byKey.get(key) ?? {
      key,
      nick: e.nick,
      group: null,
      groupUnknown: ambiguous && !e.group,
      results: { ge3: null, ge4: null, ge5: null },
    };
    h.group ??= e.group;
    h.results[e.id] = { rank: e.rank, tokens: e.tokens, wallets: e.wallets };
    byKey.set(key, h);
  }

  // Most recent election first: GE5 rank, then GE4, then GE3.
  const order = (h: GeMemberHistory) => [h.results.ge5?.rank, h.results.ge4?.rank, h.results.ge3?.rank].map((r) => r ?? 999);
  return [...byKey.values()].sort((a, b) => {
    const [x, y] = [order(a), order(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.nick.localeCompare(b.nick);
  });
}

/** Each election's top wallets (GE3–GE5 from the top files, GE6 live) with all four results. */
async function walletRows(index: Record<PastId, PastIndex>): Promise<GeWalletRow[]> {
  const addresses = new Set<string>();
  for (const { top } of PAST) for (const r of top.top.slice(0, TOP_PER_EDITION)) addresses.add(r.address);
  let ge6: Awaited<ReturnType<typeof getVoterSummaries>> | null = null;
  try {
    for (const a of await getGe6TopAddresses(TOP_PER_EDITION)) addresses.add(a);
    ge6 = await getVoterSummaries([...addresses]);
  } catch {
    // GE6 unavailable: the past columns still work; GE6 shows 0.
  }
  return [...addresses].map((address) => {
    const g6 = ge6?.voters[address];
    return {
      address,
      ge6: g6 ? { tokens: g6.tokens, votes: g6.votes, rank: g6.rank } : null,
      ge5: index.ge5.get(address) ?? null,
      ge4: index.ge4.get(address) ?? null,
      ge3: index.ge3.get(address) ?? null,
    };
  });
}

/**
 * GE3–GE6 side by side: headline numbers, the top wallets of every election with all four
 * results, wallets returning between elections, and member ranks. Past elections come from the static summaries (`npm run data:all`); GE6 from the
 * live tracker. Cached like the other pages: regenerated at most every 2 minutes, no polling.
 */
export async function getGeCompare(): Promise<GeCompare> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });

  const sets = pastIndex();
  let live: { snapshot: Awaited<ReturnType<typeof getStats>>["snapshot"]; index: Awaited<ReturnType<typeof getGe6VoterIndex>> } | null =
    null;
  try {
    live = { snapshot: (await getStats()).snapshot, index: await getGe6VoterIndex() };
  } catch (err) {
    console.error("[ge6] compare: GE6 data unavailable:", err);
  }

  const editions: GeEditionStats[] = PAST.map(({ id, label, summary: { stats, members } }) => ({
    id,
    label,
    live: false,
    tokens: stats.tokens,
    wallets: stats.wallets,
    members: stats.members,
    votes: stats.votes,
    avgPerWallet: stats.avgPerWallet,
    medianPerWallet: stats.medianPerWallet,
    top10Share: stats.top10Share,
    walletsForHalf: stats.walletsForHalf,
    topMember: members[0] ? { name: parseMember(members[0].name).nick, tokens: members[0].tokens } : null,
  }));
  if (live) {
    const { totals, concentration } = live.snapshot;
    editions.push({
      id: "ge6",
      label: "GE6",
      live: true,
      tokens: totals.tokens,
      wallets: totals.voters,
      members: null,
      votes: totals.votes,
      avgPerWallet: totals.avgPerVoter,
      medianPerWallet: totals.medianPerVoter,
      top10Share: concentration.top10Share,
      walletsForHalf: concentration.walletsForHalf,
      topMember: null,
    });
  }

  const { ge3: s3, ge4: s4, ge5: s5 } = sets;
  const flows = [
    { from: "GE3", to: "GE4", fromWallets: s3.size, returning: countIn(s3.keys(), s4), live: false },
    { from: "GE4", to: "GE5", fromWallets: s4.size, returning: countIn(s4.keys(), s5), live: false },
  ];
  const newWallets = [
    { label: "GE4", wallets: s4.size, newWallets: countNotIn(s4.keys(), s3), live: false },
    { label: "GE5", wallets: s5.size, newWallets: countNotIn(s5.keys(), s3, s4), live: false },
  ];
  if (live) {
    flows.push({ from: "GE5", to: "GE6", fromWallets: s5.size, returning: countIn(s5.keys(), live.index), live: true });
    newWallets.push({
      label: "GE6",
      wallets: live.index.size,
      newWallets: countNotIn(live.index.addresses(), s3, s4, s5),
      live: true,
    });
  }

  return {
    ge6Available: Boolean(live),
    updatedAt: live?.snapshot.updatedAt ?? null,
    editions,
    flows,
    newWallets,
    loyal: {
      ge3to5: countIn(s3.keys(), s4, s5),
      ge3to6: live ? countIn(s3.keys(), s4, s5, live.index) : null,
    },
    members: memberHistory(),
    topPerEdition: TOP_PER_EDITION,
    wallets: await walletRows(sets),
  };
}
