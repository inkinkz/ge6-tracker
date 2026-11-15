// Builds the GE6 results pages' data from the official per-vote result export:
//   src/data/ge6-results.json  election-wide stats, the member ranking, top wallets, timeline,
//                              overlaps and records (home page)
//   src/data/ge6-members.json  per-member detail keyed by slug (/member/[slug])
//
//   node scripts/build-ge6-results.mjs [path/to/ge6_result.csv]     (or: npm run data:ge6)
//
// The export has one row per vote: "Wallet address", "Answer" (member), "Vote amount" (wei) and
// "Key", whose first 10 digits are the vote's unix time. Only addresses, member names, amounts and
// times aggregated to days/hours are kept; wallet codes, keys and hashes are dropped.
// GE5 fan movement is read from src/data/ge5-summary.json + ge5-wallets.json, so run
// `npm run data:ge5` first if those change.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, toAtto, toTokens } from "./csv.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, process.argv[2] ?? "ge6_result.csv");
const resultsOutput = resolve(root, "src/data/ge6-results.json");
const membersOutput = resolve(root, "src/data/ge6-members.json");
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const TZ = 7 * 3600; // Asia/Bangkok, no DST
const TOP_WALLETS = 100;
const TOP_VOTERS_PER_MEMBER = 50;
const MEMBERS_PER_TOP_WALLET = 5;
const TOP_PAIRS = 15;

// --- Read every vote -------------------------------------------------------------------------

const { col, rows: csvRows, lines } = readCsv(input);
const iAddress = col("wallet address");
const iMember = col("answer");
const iAmount = col("vote amount");
const iKey = col("key");

/** @type {{ address: string, member: string, atto: bigint, at: number }[]} */
const votes = csvRows.map((cells, n) => {
  const address = cells[iAddress]?.toLowerCase();
  const member = cells[iMember];
  const at = Number(cells[iKey]?.slice(0, 10));
  if (!member || !/^0x[0-9a-f]{40}$/.test(address ?? "") || !(at > 1.7e9 && at < 1.9e9)) {
    throw new Error(`bad row ${n + 2}: ${lines[n + 1]}`);
  }
  return { address, member, atto: toAtto(cells[iAmount], true), at };
});
votes.sort((a, b) => a.at - b.at);

const firstVoteAt = votes[0].at;
const lastVoteAt = votes[votes.length - 1].at;
/** Voting closed on the hour after the last vote (21:00 Bangkok time). */
const closeAt = Math.ceil(lastVoteAt / 3600) * 3600;

// --- Helpers -----------------------------------------------------------------------------------

const sum = (list, f = (x) => x) => list.reduce((s, x) => s + f(x), 0n);
const desc = (a, b) => (a === b ? 0 : a > b ? -1 : 1);
const share = (part, whole) => (whole > 0n ? Number((part * 1_000_000n) / whole) / 1_000_000 : 0);
const round2 = (n) => Math.round(n * 100) / 100;
/** "Pancake BNK48" → { nick: "Pancake", group: "BNK48" } */
const parseName = (name) => {
  const m = /^(.*?)\s+(BNK48|CGM48)$/.exec(name);
  return m ? { nick: m[1], group: m[2] } : { nick: name, group: null };
};
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Competition ranking (equal totals share a rank) over a list already sorted largest first. */
function rankBy(list, key) {
  return list.map((x, i) => {
    let j = i;
    while (j > 0 && key(list[j - 1]) === key(x)) j--;
    return j + 1;
  });
}
function median(sortedDesc) {
  const n = sortedDesc.length;
  if (!n) return 0;
  return n % 2 ? toTokens(sortedDesc[(n - 1) / 2]) : round2((toTokens(sortedDesc[n / 2 - 1]) + toTokens(sortedDesc[n / 2])) / 2);
}
/** Fewest of the (largest-first) amounts that together reach half of their total. */
function countForHalf(sortedDesc) {
  const total = sum(sortedDesc);
  let n = 0;
  for (let acc = 0n; n < sortedDesc.length && acc * 2n < total; n++) acc += sortedDesc[n];
  return n;
}

const dayKey = (ts) => Math.floor((ts + TZ) / 86400);
const firstDay = dayKey(firstVoteAt);
const lastDay = dayKey(lastVoteAt);
const dayCount = lastDay - firstDay + 1;
const dayStart = (i) => (firstDay + i) * 86400 - TZ;

const SIZE_BUCKETS = [
  { label: "น้อยกว่า 1", min: 0, max: 1 },
  { label: "1 – 9", min: 1, max: 10 },
  { label: "10 – 99", min: 10, max: 100 },
  { label: "100 – 999", min: 100, max: 1_000 },
  { label: "1,000 – 9,999", min: 1_000, max: 10_000 },
  { label: "10,000 ขึ้นไป", min: 10_000, max: Infinity },
];
/** Wallets bucketed by amount: { label, wallets, tokens, share }. */
function sizeDistribution(amounts) {
  const total = sum(amounts);
  const out = SIZE_BUCKETS.map((b) => ({ label: b.label, wallets: 0, atto: 0n }));
  for (const a of amounts) {
    const t = toTokens(a);
    const i = SIZE_BUCKETS.findIndex((b) => t >= b.min && t < b.max);
    out[i].wallets += 1;
    out[i].atto += a;
  }
  return out.map((b) => ({ label: b.label, wallets: b.wallets, tokens: toTokens(b.atto), share: share(b.atto, total) }));
}

// --- Aggregate --------------------------------------------------------------------------------

const grandTotal = sum(votes, (v) => v.atto);

/** address → { atto, votes, firstAt, lastAt, byMember: Map(name → atto) } */
const wallets = new Map();
/** member → { atto, votes, byWallet: Map(address → atto), daily: bigint[], largest, finalDay } */
const members = new Map();
const daily = Array.from({ length: dayCount }, (_, i) => ({ t: dayStart(i), atto: 0n, votes: 0, active: new Set(), newWallets: 0 }));
const hourOfDay = Array.from({ length: 24 }, (_, hour) => ({ hour, atto: 0n, votes: 0 }));
const finalHours = Array.from({ length: 24 }, (_, i) => ({ t: closeAt - (24 - i) * 3600, atto: 0n, votes: 0 }));
let largestVote = null;

for (const v of votes) {
  let w = wallets.get(v.address);
  const isNew = !w;
  if (!w) wallets.set(v.address, (w = { atto: 0n, votes: 0, firstAt: v.at, lastAt: v.at, byMember: new Map() }));
  w.atto += v.atto;
  w.votes += 1;
  w.lastAt = v.at;
  w.byMember.set(v.member, (w.byMember.get(v.member) ?? 0n) + v.atto);

  let m = members.get(v.member);
  if (!m) {
    members.set(
      v.member,
      (m = { atto: 0n, votes: 0, byWallet: new Map(), daily: new Array(dayCount).fill(0n), largest: null, finalDay: 0n, firstAt: v.at }),
    );
  }
  m.atto += v.atto;
  m.votes += 1;
  m.byWallet.set(v.address, (m.byWallet.get(v.address) ?? 0n) + v.atto);
  const d = dayKey(v.at) - firstDay;
  m.daily[d] += v.atto;
  if (!m.largest || v.atto > m.largest.atto) m.largest = v;
  if (v.at >= closeAt - 86400) m.finalDay += v.atto;

  daily[d].atto += v.atto;
  daily[d].votes += 1;
  daily[d].active.add(v.address);
  if (isNew) daily[d].newWallets += 1;
  const h = Math.floor(((v.at + TZ) % 86400) / 3600);
  hourOfDay[h].atto += v.atto;
  hourOfDay[h].votes += 1;
  const fh = Math.floor((v.at - (closeAt - 86400)) / 3600);
  if (fh >= 0 && fh < 24) {
    finalHours[fh].atto += v.atto;
    finalHours[fh].votes += 1;
  }
  if (!largestVote || v.atto > largestVote.atto) largestVote = v;
}

// Wallet ranking
const rankedWallets = [...wallets.entries()]
  .map(([address, w]) => ({
    address,
    ...w,
    members: [...w.byMember.entries()].map(([name, atto]) => ({ name, atto })).sort((a, b) => desc(a.atto, b.atto) || a.name.localeCompare(b.name)),
  }))
  .sort((a, b) => desc(a.atto, b.atto) || a.address.localeCompare(b.address));
const walletRanks = rankBy(rankedWallets, (w) => w.atto);
const walletRank = new Map(rankedWallets.map((w, i) => [w.address, walletRanks[i]]));
const walletAmounts = rankedWallets.map((w) => w.atto);

// Member ranking
const rankedMembers = [...members.entries()]
  .map(([name, m]) => ({ name, ...m }))
  .sort((a, b) => desc(a.atto, b.atto) || a.name.localeCompare(b.name));
const memberRanks = rankBy(rankedMembers, (m) => m.atto);

// --- GE5 → GE6 --------------------------------------------------------------------------------

const ge5Summary = readJson("src/data/ge5-summary.json");
const ge5Wallets = readJson("src/data/ge5-wallets.json");
/** GE5 address → { top: member name, members: Set(names) } */
const ge5 = new Map();
ge5Wallets.rows.forEach((row, i) => {
  const address = `0x${ge5Summary.wallets.slice(i * 40, i * 40 + 40)}`;
  const names = [];
  for (let k = 0; k < row.length; k += 2) names.push(ge5Wallets.members[row[k]]);
  ge5.set(address, { top: names[0], members: new Set(names) });
});
const ge6Names = new Set(members.keys());
/** GE5 member name → wallets whose top pick it was */
const ge5FansOf = new Map();
for (const [address, w] of ge5) {
  const list = ge5FansOf.get(w.top) ?? [];
  list.push(address);
  ge5FansOf.set(w.top, list);
}
let prevGe5 = null;
const ge5Rank = new Map(
  ge5Summary.members.map((m, i) => {
    const rank = prevGe5 && prevGe5.tokens === m.tokens ? prevGe5.rank : i + 1;
    prevGe5 = { tokens: m.tokens, rank };
    return [m.name, { rank, tokens: m.tokens, wallets: m.wallets }];
  }),
);

/** Where one GE5 member's fans (wallets whose top GE5 pick she was) went in GE6. */
function fanMovement(ge5Name) {
  const fans = ge5FansOf.get(ge5Name) ?? [];
  let votedGe6 = 0;
  let stayed = 0;
  let stayedTop = 0;
  let ge6Atto = 0n;
  const dest = new Map();
  for (const address of fans) {
    const w = wallets.get(address);
    if (!w) continue;
    votedGe6 += 1;
    ge6Atto += w.atto;
    if (w.byMember.has(ge5Name)) stayed += 1;
    const top = [...w.byMember.entries()].sort((a, b) => desc(a[1], b[1]) || a[0].localeCompare(b[0]))[0][0];
    if (top === ge5Name) stayedTop += 1;
    for (const [name, atto] of w.byMember) {
      const d = dest.get(name) ?? { atto: 0n, wallets: 0 };
      d.atto += atto;
      d.wallets += 1;
      dest.set(name, d);
    }
  }
  return { fans: fans.length, votedGe6, stayed, stayedTop, ge6Atto, dest };
}

// --- Members ----------------------------------------------------------------------------------

const slugs = new Set();
const memberList = [];
const memberDetail = {};

for (const [i, m] of rankedMembers.entries()) {
  const { nick, group } = parseName(m.name);
  const slug = slugOf(m.name);
  if (slugs.has(slug)) throw new Error(`duplicate member slug ${slug}`);
  slugs.add(slug);

  const voters = [...m.byWallet.entries()]
    .map(([address, atto]) => ({ address, atto }))
    .sort((a, b) => desc(a.atto, b.atto) || a.address.localeCompare(b.address));
  const amounts = voters.map((v) => v.atto);
  const voterRanks = rankBy(voters, (v) => v.atto);
  const sole = voters.filter((v) => wallets.get(v.address).byMember.size === 1);
  const top = voters[0];

  // Other members the same wallets voted for.
  const also = new Map();
  for (const v of voters) {
    for (const [name, atto] of wallets.get(v.address).byMember) {
      if (name === m.name) continue;
      const a = also.get(name) ?? { wallets: 0, atto: 0n };
      a.wallets += 1;
      a.atto += atto;
      also.set(name, a);
    }
  }

  // GE5: her own GE5 fans, and her GE6 wallets that are new since GE5.
  const fromGe5 = voters.filter((v) => ge5.has(v.address)).length;
  const votedHerInGe5 = voters.filter((v) => ge5.get(v.address)?.members.has(m.name)).length;
  const move = ge5Rank.has(m.name) ? fanMovement(m.name) : null;

  let peak = 0;
  m.daily.forEach((a, d) => {
    if (a > m.daily[peak]) peak = d;
  });

  const summary = {
    rank: memberRanks[i],
    name: m.name,
    nick,
    group,
    slug,
    tokens: toTokens(m.atto),
    share: share(m.atto, grandTotal),
    wallets: voters.length,
    votes: m.votes,
    avgPerWallet: toTokens(m.atto / BigInt(voters.length)),
    medianPerWallet: median(amounts),
    top1Share: share(top.atto, m.atto),
    top10Share: share(sum(amounts.slice(0, 10)), m.atto),
    walletsForHalf: countForHalf(amounts),
    soleWallets: sole.length,
    soleShare: share(sum(sole, (v) => v.atto), m.atto),
    finalDayShare: share(m.finalDay, m.atto),
    newWallets: voters.length - fromGe5,
    topVoter: {
      address: top.address,
      tokens: toTokens(top.atto),
      share: share(top.atto, m.atto),
      rank: walletRank.get(top.address),
      memberCount: wallets.get(top.address).byMember.size,
    },
    ge5: ge5Rank.get(m.name) ?? null,
  };
  memberList.push(summary);

  memberDetail[slug] = {
    ...summary,
    firstVoteAt: m.firstAt,
    largestVote: { address: m.largest.address, tokens: toTokens(m.largest.atto), at: m.largest.at },
    peakDay: { t: dayStart(peak), tokens: toTokens(m.daily[peak]) },
    daily: m.daily.map(toTokens),
    walletSize: sizeDistribution(amounts),
    topVoters: voters.slice(0, TOP_VOTERS_PER_MEMBER).map((v, k) => {
      const w = wallets.get(v.address);
      return {
        rank: voterRanks[k],
        address: v.address,
        tokens: toTokens(v.atto),
        share: share(v.atto, m.atto),
        walletTokens: toTokens(w.atto),
        walletRank: walletRank.get(v.address),
        memberCount: w.byMember.size,
      };
    }),
    alsoVoted: [...also.entries()]
      .sort((a, b) => b[1].wallets - a[1].wallets || desc(a[1].atto, b[1].atto) || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name, a]) => ({ name, slug: slugOf(name), wallets: a.wallets, tokens: toTokens(a.atto) })),
    ge5Wallets: {
      fromGe5,
      votedHerInGe5,
      fans: move
        ? { fans: move.fans, votedGe6: move.votedGe6, stayed: move.stayed, stayedTop: move.stayedTop, ge6Tokens: toTokens(move.ge6Atto) }
        : null,
    },
  };
}

// --- Election-wide ------------------------------------------------------------------------------

const groups = ["BNK48", "CGM48"].map((group) => {
  const list = rankedMembers.filter((m) => parseName(m.name).group === group);
  const groupWallets = new Set();
  for (const m of list) for (const a of m.byWallet.keys()) groupWallets.add(a);
  const atto = sum(list, (m) => m.atto);
  return {
    group,
    members: list.length,
    tokens: toTokens(atto),
    share: share(atto, grandTotal),
    wallets: groupWallets.size,
    votes: list.reduce((s, m) => s + m.votes, 0),
  };
});
let bothGroups = 0;
for (const w of wallets.values()) {
  const gs = new Set([...w.byMember.keys()].map((n) => parseName(n).group));
  if (gs.size > 1) bothGroups += 1;
}

const MEMBER_COUNT_BUCKETS = [
  { label: "1 คน", min: 1, max: 1 },
  { label: "2 คน", min: 2, max: 2 },
  { label: "3 คน", min: 3, max: 3 },
  { label: "4 – 5 คน", min: 4, max: 5 },
  { label: "6 – 10 คน", min: 6, max: 10 },
  { label: "11 – 20 คน", min: 11, max: 20 },
  { label: "21 คนขึ้นไป", min: 21, max: Infinity },
];
const membersPerWallet = MEMBER_COUNT_BUCKETS.map((b) => {
  const list = rankedWallets.filter((w) => w.byMember.size >= b.min && w.byMember.size <= b.max);
  const atto = sum(list, (w) => w.atto);
  return { label: b.label, wallets: list.length, tokens: toTokens(atto), share: share(atto, grandTotal) };
});

// Pairs of members voted for by the same wallets.
const pairCount = new Map();
for (const w of wallets.values()) {
  const names = [...w.byMember.keys()].sort();
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      const key = `${names[a]}\n${names[b]}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }
}
const memberWallets = new Map(rankedMembers.map((m) => [m.name, m.byWallet.size]));
const pairs = [...pairCount.entries()]
  .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  .slice(0, TOP_PAIRS)
  .map(([key, n]) => {
    const [a, b] = key.split("\n");
    // Share of the smaller fan base that also voted for the other member.
    return { a, b, wallets: n, overlap: n / Math.min(memberWallets.get(a), memberWallets.get(b)) };
  });

// GE5 members who aren't in GE6, and where their GE5 fans went.
const departed = ge5Summary.members
  .filter((m) => !ge6Names.has(m.name))
  .map((m) => {
    const move = fanMovement(m.name);
    return {
      name: m.name,
      ge5Rank: ge5Rank.get(m.name).rank,
      ge5Tokens: m.tokens,
      fans: move.fans,
      votedGe6: move.votedGe6,
      ge6Tokens: toTokens(move.ge6Atto),
      to: [...move.dest.entries()]
        .sort((a, b) => desc(a[1].atto, b[1].atto) || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([name, d]) => ({ name, slug: slugOf(name), tokens: toTokens(d.atto), wallets: d.wallets })),
    };
  })
  .filter((d) => d.fans > 0);

const mostVotes = [...rankedWallets].sort((a, b) => b.votes - a.votes || desc(a.atto, b.atto))[0];
const mostMembers = [...rankedWallets].sort((a, b) => b.byMember.size - a.byMember.size || desc(a.atto, b.atto))[0];
const lastVote = votes[votes.length - 1];
const firstVote = votes[0];
const voteAmounts = votes.map((v) => v.atto).sort(desc);
const returning = rankedWallets.filter((w) => ge5.has(w.address)).length;

let cumulative = 0n;
const results = {
  firstVoteAt,
  lastVoteAt,
  closeAt,
  totals: {
    tokens: toTokens(grandTotal),
    wallets: wallets.size,
    votes: votes.length,
    members: members.size,
    avgPerWallet: toTokens(grandTotal / BigInt(wallets.size)),
    medianPerWallet: median(walletAmounts),
    avgPerVote: toTokens(grandTotal / BigInt(votes.length)),
    medianPerVote: median(voteAmounts),
    top1Share: share(walletAmounts[0], grandTotal),
    top10Share: share(sum(walletAmounts.slice(0, 10)), grandTotal),
    top100Share: share(sum(walletAmounts.slice(0, 100)), grandTotal),
    walletsForHalf: countForHalf(walletAmounts),
    singleMemberWallets: membersPerWallet[0].wallets,
    bothGroups,
  },
  groups,
  members: memberList,
  topWallets: rankedWallets.slice(0, TOP_WALLETS).map((w, i) => ({
    rank: walletRanks[i],
    address: w.address,
    tokens: toTokens(w.atto),
    share: share(w.atto, grandTotal),
    votes: w.votes,
    memberCount: w.members.length,
    members: w.members.slice(0, MEMBERS_PER_TOP_WALLET).map((m) => ({ name: m.name, tokens: toTokens(m.atto) })),
    ge5: ge5.has(w.address),
  })),
  daily: daily.map((d) => ({
    t: d.t,
    tokens: toTokens(d.atto),
    votes: d.votes,
    wallets: d.active.size,
    newWallets: d.newWallets,
    cumulativeTokens: toTokens((cumulative += d.atto)),
  })),
  finalHours: finalHours.map((h) => ({ t: h.t, tokens: toTokens(h.atto), votes: h.votes })),
  hourOfDay: hourOfDay.map((h) => ({ hour: h.hour, tokens: toTokens(h.atto), votes: h.votes })),
  walletSize: sizeDistribution(walletAmounts),
  membersPerWallet,
  pairs,
  departed,
  ge5: { ge5Wallets: ge5.size, returning, newWallets: wallets.size - returning },
  records: {
    largestVote: { address: largestVote.address, member: largestVote.member, tokens: toTokens(largestVote.atto), at: largestVote.at },
    mostVotes: { address: mostVotes.address, votes: mostVotes.votes, tokens: toTokens(mostVotes.atto) },
    mostMembers: { address: mostMembers.address, members: mostMembers.byMember.size, tokens: toTokens(mostMembers.atto) },
    firstVote: { address: firstVote.address, member: firstVote.member, tokens: toTokens(firstVote.atto), at: firstVote.at },
    lastVote: { address: lastVote.address, member: lastVote.member, tokens: toTokens(lastVote.atto), at: lastVote.at },
  },
};

writeFileSync(resultsOutput, `${JSON.stringify(results)}\n`);
writeFileSync(membersOutput, `${JSON.stringify(memberDetail)}\n`);
console.log(
  `wrote ${resultsOutput} + ${membersOutput}: ${members.size} members, ${wallets.size} wallets, ${votes.length} votes, ${results.totals.tokens} GE6`,
);
