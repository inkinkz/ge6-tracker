// Builds src/data/ge5-top.json (GE5's top wallets) from the GE5 export (ge5_voters.csv).
//
//   npm run data:ge5 [-- path/to/ge5_voters.csv]
//
// CSV columns: <row id>, Answer (member), Wallet code, Wallet address, Token — one row per
// wallet × member. Only what the /ge5 page needs is kept: wallet address, GE5 total, and the
// members it voted for. The app-internal "Wallet code" column is deliberately dropped.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, process.argv[2] ?? "ge5_voters.csv");
const output = resolve(root, "src/data/ge5-top.json");
const TOP_N = 200;
const MEMBERS_PER_WALLET = 3;

const round2 = (n) => Math.round(n * 100) / 100;

const lines = readFileSync(input, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`missing column "${name}" in ${input}`);
  return i;
};
const iMember = col("answer");
const iAddress = col("wallet address");
const iTokens = col("token");

const wallets = new Map(); // address -> Map(member -> tokens)
const memberNames = new Set();
let grandTotal = 0;

for (const [n, line] of lines.slice(1).entries()) {
  const cells = line.split(",");
  const member = cells[iMember]?.trim();
  const address = cells[iAddress]?.trim().toLowerCase();
  const tokens = Number(cells[iTokens]);
  if (!member || !/^0x[0-9a-f]{40}$/.test(address ?? "") || !Number.isFinite(tokens)) {
    throw new Error(`bad row ${n + 2}: ${line}`);
  }
  memberNames.add(member);
  grandTotal += tokens;
  const byMember = wallets.get(address) ?? new Map();
  byMember.set(member, (byMember.get(member) ?? 0) + tokens);
  wallets.set(address, byMember);
}

const ranked = [...wallets.entries()]
  .map(([address, byMember]) => {
    const members = [...byMember.entries()]
      .map(([name, tokens]) => ({ name, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    return { address, tokens: members.reduce((s, m) => s + m.tokens, 0), members };
  })
  .sort((a, b) => b.tokens - a.tokens);

// Take the top N, plus anyone tied with the last place so a tie is never split.
let cut = Math.min(TOP_N, ranked.length);
while (cut < ranked.length && round2(ranked[cut].tokens) === round2(ranked[cut - 1].tokens)) cut++;

const top = [];
for (const [i, w] of ranked.slice(0, cut).entries()) {
  // Competition ranking: equal totals share a rank.
  const prev = top[i - 1];
  const rank = prev && prev.tokens === round2(w.tokens) ? prev.rank : i + 1;
  top.push({
    rank,
    address: w.address,
    tokens: round2(w.tokens),
    memberCount: w.members.length,
    members: w.members.slice(0, MEMBERS_PER_WALLET).map((m) => ({ name: m.name, tokens: round2(m.tokens) })),
  });
}

const data = {
  source: "GE5 voter export (wallet × member totals)",
  totals: { tokens: round2(grandTotal), wallets: wallets.size, members: memberNames.size },
  top,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 1)}\n`);
console.log(
  `wrote ${output}: top ${top.length} of ${wallets.size} wallets, ${memberNames.size} members, ${round2(grandTotal)} tokens`,
);
