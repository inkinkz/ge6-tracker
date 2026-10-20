// Builds two files per past election from its vote export:
//   src/data/<edition>-top.json      top wallets (for /ge3, /ge4, /ge5)
//   src/data/<edition>-summary.json  election-wide stats, member totals, and every voting wallet
//                                    with its total (for /compare)
//
//   npm run data:ge3 [-- path/to/ge3_result.csv]
//   npm run data:ge4 [-- path/to/ge4_result.csv]
//   npm run data:ge5 [-- path/to/ge5_voters.csv]
//
// Two export formats are supported (detected from the header):
//   GE3/GE4: one row per vote (GE4 quoted) — "Wallet address", "Answer" (member), "Vote amount" in wei
//   GE5:     one row per wallet × member — "Wallet address", "Answer" (member), "Token" in tokens
// Only addresses, totals, and member names are kept. App-internal columns (wallet code, vote
// keys/hashes) are deliberately dropped.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EDITIONS = {
  ge3: { csv: "ge3_result.csv" },
  ge4: { csv: "ge4_result.csv" },
  ge5: { csv: "ge5_voters.csv" },
};
const TOP_N = 300;
const MEMBERS_PER_WALLET = 3;
const DECIMALS = 18;
const UNIT = 10n ** BigInt(DECIMALS);

const edition = process.argv[2];
if (!EDITIONS[edition]) {
  console.error(`usage: node scripts/build-past-ge-data.mjs <${Object.keys(EDITIONS).join("|")}> [csv]`);
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, process.argv[3] ?? EDITIONS[edition].csv);
const output = resolve(root, `src/data/${edition}-top.json`);
const summaryOutput = resolve(root, `src/data/${edition}-summary.json`);

/** Minimal RFC 4180 line parser: handles quoted fields and "" escapes (no embedded newlines). */
function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** Decimal string ("397.5153302") or wei string → exact integer amount in 1e-18 units. */
function toAtto(value, isWei) {
  if (isWei) {
    if (!/^\d+$/.test(value)) throw new Error(`bad wei amount "${value}"`);
    return BigInt(value);
  }
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) throw new Error(`bad token amount "${value}"`);
  const frac = (m[2] ?? "").slice(0, DECIMALS).padEnd(DECIMALS, "0");
  return BigInt(m[1]) * UNIT + BigInt(frac);
}

/** 1e-18 units → GE tokens rounded to 2 decimals (what the UI shows). */
const toTokens = (atto) => Number((atto + UNIT / 200n) / (UNIT / 100n)) / 100;

const lines = readFileSync(input, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const header = parseLine(lines[0]).map((h) => h.toLowerCase());
const col = (...names) => {
  const i = header.findIndex((h) => names.includes(h));
  if (i < 0) throw new Error(`missing column ${names.join(" / ")} in ${input}`);
  return i;
};
const iMember = col("answer");
const iAddress = col("wallet address");
const isWei = header.includes("vote amount");
const iAmount = isWei ? col("vote amount") : col("token");

const wallets = new Map(); // address -> Map(member -> atto)
const memberNames = new Set();
let grandTotal = 0n;

for (const [n, line] of lines.slice(1).entries()) {
  const cells = parseLine(line);
  const member = cells[iMember];
  const address = cells[iAddress]?.toLowerCase();
  if (!member || !/^0x[0-9a-f]{40}$/.test(address ?? "")) throw new Error(`bad row ${n + 2}: ${line}`);
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

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 1)}\n`);
writeFileSync(summaryOutput, `${JSON.stringify(summary)}\n`);
console.log(
  `wrote ${output} + ${summaryOutput}: top ${top.length} of ${wallets.size} wallets, ${memberNames.size} members, ${data.totals.tokens} tokens`,
);
