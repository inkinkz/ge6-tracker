// Builds src/data/<edition>-top.json (a past election's top wallets) from its vote export.
//
//   npm run data:ge4 [-- path/to/ge4_result.csv]
//   npm run data:ge5 [-- path/to/ge5_voters.csv]
//
// Two export formats are supported (detected from the header):
//   GE4: one row per vote, quoted CSV — "Wallet address", "Answer" (member), "Vote amount" in wei
//   GE5: one row per wallet × member — "Wallet address", "Answer" (member), "Token" in GE5 tokens
// Only what the page needs is kept: wallet address, totals, and the members it voted for.
// App-internal columns (wallet code, vote keys/hashes) are deliberately dropped.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EDITIONS = {
  ge4: { csv: "ge4_result.csv" },
  ge5: { csv: "ge5_voters.csv" },
};
const TOP_N = 200;
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

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 1)}\n`);
console.log(
  `wrote ${output}: top ${top.length} of ${wallets.size} wallets, ${memberNames.size} members, ${data.totals.tokens} tokens`,
);
