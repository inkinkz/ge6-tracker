// Builds three files per past election from its vote export:
//   src/data/<edition>-top.json      top wallets (for /ge3, /ge4, /ge5)
//   src/data/<edition>-summary.json  election-wide stats, member totals, and every voting wallet
//                                    with its total (for /compare)
//   src/data/<edition>-wallets.json  every voting wallet's per-member totals (for /wallet)
//
//   npm run data:ge3 [-- path/to/ge3_result.csv]
//   npm run data:ge4 [-- path/to/ge4_result.csv]
//   npm run data:ge5 [-- path/to/ge5_voters.csv]
//   npm run data:ge6 [-- path/to/ge6_result.csv]
//   npm run data:thai-japan [-- path/to/thai-japan_result.csv]
//
// Two export formats are supported (detected from the header):
//   GE3/GE4/GE6/Thai-Japan: one row per vote (GE4 quoted) — "Wallet address", "Answer" (member), "Vote amount" in wei
//   GE5:     one row per wallet × member — "Wallet address", "Answer" (member), "Token" in tokens
// Only addresses, totals, and member names are kept. App-internal columns (wallet code, vote
// keys/hashes) are deliberately dropped.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCsv, toAtto, toTokens } from "./csv.mjs";

const EDITIONS = {
  ge3: { csv: "ge3_result.csv" },
  ge4: { csv: "ge4_result.csv" },
  ge5: { csv: "ge5_voters.csv" },
  // The final GE6 result export; scripts/build-ge6-results.mjs builds the results pages from the same file.
  ge6: { csv: "ge6_result.csv" },
  // Not a General Election: only used by the wallet page (/wallet), same export format as GE3/GE4.
  "thai-japan": { csv: "thai-japan_result.csv" },
};
const TOP_N = 300;
const MEMBERS_PER_WALLET = 3;

const edition = process.argv[2];
if (!EDITIONS[edition]) {
  console.error(`usage: node scripts/build-past-ge-data.mjs <${Object.keys(EDITIONS).join("|")}> [csv]`);
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, process.argv[3] ?? EDITIONS[edition].csv);
const output = resolve(root, `src/data/${edition}-top.json`);
const summaryOutput = resolve(root, `src/data/${edition}-summary.json`);
const breakdownOutput = resolve(root, `src/data/${edition}-wallets.json`);

const { header, col, rows: csvRows, lines } = readCsv(input);
const iMember = col("answer");
const iAddress = col("wallet address");
const isWei = header.includes("vote amount");
const iAmount = isWei ? col("vote amount") : col("token");

const wallets = new Map(); // address -> Map(member -> atto)
const memberNames = new Set();
let grandTotal = 0n;

for (const [n, cells] of csvRows.entries()) {
  const member = cells[iMember];
  const address = cells[iAddress]?.toLowerCase();
  if (!member || !/^0x[0-9a-f]{40}$/.test(address ?? "")) throw new Error(`bad row ${n + 2}: ${lines[n + 1]}`);
  const amount = toAtto(cells[iAmount], isWei);
  memberNames.add(member);
  grandTotal += amount;
  const byMember = wallets.get(address) ?? new Map();
  byMember.set(member, (byMember.get(member) ?? 0n) + amount);
  wallets.set(address, byMember);
}

const byAmountDesc = (a, b) => (a.atto === b.atto ? 0 : a.atto > b.atto ? -1 : 1);
const ranked = [...wallets.entries()]
  .map(([address, byMember]) => {
    const members = [...byMember.entries()]
      .map(([name, atto]) => ({ name, atto }))
      // Equal amounts fall back to name order so the "top member" is stable.
      .sort((a, b) => byAmountDesc(a, b) || a.name.localeCompare(b.name));
    return { address, atto: members.reduce((s, m) => s + m.atto, 0n), members };
  })
  .sort((a, b) => byAmountDesc(a, b) || a.address.localeCompare(b.address));

// Take the top N, plus anyone tied with the last place so a tie is never split.
let cut = Math.min(TOP_N, ranked.length);
while (cut < ranked.length && toTokens(ranked[cut].atto) === toTokens(ranked[cut - 1].atto)) cut++;

const top = [];
for (const [i, w] of ranked.slice(0, cut).entries()) {
  // Competition ranking: equal totals share a rank.
  const tokens = toTokens(w.atto);
  const prev = top[i - 1];
  top.push({
    rank: prev && prev.tokens === tokens ? prev.rank : i + 1,
    address: w.address,
    tokens,
    memberCount: w.members.length,
    members: w.members.slice(0, MEMBERS_PER_WALLET).map((m) => ({ name: m.name, tokens: toTokens(m.atto) })),
  });
}

const data = {
  edition,
  totals: { tokens: toTokens(grandTotal), wallets: wallets.size, members: memberNames.size },
  top,
};

// --- Election-wide summary (compare page) -------------------------------------------------

const walletTokens = ranked.map((w) => toTokens(w.atto));
const median =
  walletTokens.length % 2
    ? walletTokens[(walletTokens.length - 1) / 2]
    : (walletTokens[walletTokens.length / 2 - 1] + walletTokens[walletTokens.length / 2]) / 2;
const sumAtto = (list) => list.reduce((s, w) => s + w.atto, 0n);
let walletsForHalf = 0;
for (let acc = 0n; walletsForHalf < ranked.length && acc * 2n < grandTotal; walletsForHalf++) {
  acc += ranked[walletsForHalf].atto;
}
const share = (atto) => Number((atto * 1_000_000n) / grandTotal) / 1_000_000;

const memberTotals = new Map(); // name -> { atto, wallets }
for (const w of ranked) {
  for (const m of w.members) {
    const t = memberTotals.get(m.name) ?? { atto: 0n, wallets: 0 };
    t.atto += m.atto;
    t.wallets += 1;
    memberTotals.set(m.name, t);
  }
}
const members = [...memberTotals.entries()]
  .map(([name, t]) => ({ name, atto: t.atto, wallets: t.wallets }))
  .sort((a, b) => byAmountDesc(a, b) || a.name.localeCompare(b.name))
  .map((m) => ({ name: m.name, tokens: toTokens(m.atto), wallets: m.wallets }));

const byAddress = [...ranked].sort((a, b) => a.address.localeCompare(b.address));
const summary = {
  edition,
  stats: {
    tokens: toTokens(grandTotal),
    wallets: wallets.size,
    members: memberNames.size,
    // Per-vote exports (GE3/GE4) have one row per vote; GE5's export is pre-aggregated.
    votes: isWei ? lines.length - 1 : null,
    avgPerWallet: toTokens(grandTotal / BigInt(wallets.size)),
    medianPerWallet: Math.round(median * 100) / 100,
    top10Share: share(sumAtto(ranked.slice(0, 10))),
    top100Share: share(sumAtto(ranked.slice(0, 100))),
    walletsForHalf,
  },
  members,
  // Every voting wallet as one string of 40-hex-char addresses (no 0x), sorted by address, and
  // its total in the same order: compact for the bundle, and enough to rank any wallet.
  wallets: byAddress.map((w) => w.address.slice(2)).join(""),
  amounts: byAddress.map((w) => toTokens(w.atto)),
};

// --- Every wallet's member breakdown (wallet lookup page) ----------------------------------

// Rows line up with `summary.wallets` / `summary.amounts` (same address order). Each row is a flat
// [memberIndex, tokens, memberIndex, tokens, …] list, largest first; indexes point into `members`
// (the summary's member order). Written by the same run as the summary, so they always match.
const memberIndex = new Map(members.map((m, i) => [m.name, i]));
const breakdown = {
  edition,
  wallets: byAddress.length,
  members: members.map((m) => m.name),
  rows: byAddress.map((w) => w.members.flatMap((m) => [memberIndex.get(m.name), toTokens(m.atto)])),
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 1)}\n`);
writeFileSync(summaryOutput, `${JSON.stringify(summary)}\n`);
writeFileSync(breakdownOutput, `${JSON.stringify(breakdown)}\n`);
console.log(
  `wrote ${output} + ${summaryOutput} + ${breakdownOutput}: top ${top.length} of ${wallets.size} wallets, ${memberNames.size} members, ${data.totals.tokens} tokens`,
);
