import "server-only";
import ge3 from "@/data/ge3-wallets.json";
import ge4 from "@/data/ge4-wallets.json";
import ge5 from "@/data/ge5-wallets.json";
import thaiJapan from "@/data/thai-japan-wallets.json";
import ge3Summary from "@/data/ge3-summary.json";
import ge4Summary from "@/data/ge4-summary.json";
import ge5Summary from "@/data/ge5-summary.json";
import thaiJapanSummary from "@/data/thai-japan-summary.json";
import type { PastGeMember, PastVoteId, PastWalletResult, WalletHistory } from "./types";

/** Shape of src/data/<id>-wallets.json (see scripts/build-past-ge-data.mjs). */
type Breakdown = { wallets: number; members: string[]; rows: number[][] };
/** The parts of src/data/<id>-summary.json used here. */
type Summary = { wallets: string; amounts: number[] };
type Source = { id: PastVoteId; label: string; breakdown: Breakdown; summary: Summary };

const ELECTIONS: Source[] = [
  { id: "ge3", label: "GE3", breakdown: ge3, summary: ge3Summary },
  { id: "ge4", label: "GE4", breakdown: ge4, summary: ge4Summary },
  { id: "ge5", label: "GE5", breakdown: ge5, summary: ge5Summary },
];
const OTHERS: Source[] = [{ id: "thai-japan", label: "Thai-Japan", breakdown: thaiJapan, summary: thaiJapanSummary }];

type Entry = { tokens: number; rank: number; members: PastGeMember[] };

// address → total, rank and member breakdown, per vote. Built once per server instance; the data is static.
const indexes = new Map<PastVoteId, Map<string, Entry>>();
function indexOf({ id, breakdown, summary }: Source): Map<string, Entry> {
  let index = indexes.get(id);
  if (index) return index;
  const { wallets, amounts } = summary;
  const { members, rows } = breakdown;
  // The breakdown rows follow the summary's address order; a mismatch means the data files
  // came from different runs of the build script.
  if (rows.length !== amounts.length || wallets.length !== amounts.length * 40) {
    throw new Error(`${id}-wallets.json doesn't match ${id}-summary.json`);
  }
  // Competition ranking over all wallets (equal totals share a rank), as on /compare and /ge3–/ge5.
  const order = amounts.map((tokens, i) => ({ tokens, i })).sort((a, b) => b.tokens - a.tokens);
  const rankAt: number[] = new Array(order.length);
  order.forEach((o, k) => {
    rankAt[o.i] = k > 0 && order[k - 1].tokens === o.tokens ? rankAt[order[k - 1].i] : k + 1;
  });
  index = new Map();
  rows.forEach((row, i) => {
    const list: PastGeMember[] = [];
    for (let k = 0; k < row.length; k += 2) list.push({ name: members[row[k]], tokens: row[k + 1] });
    index!.set(`0x${wallets.slice(i * 40, i * 40 + 40)}`, { tokens: amounts[i], rank: rankAt[i], members: list });
  });
  indexes.set(id, index);
  return index;
}

const resultFor = (source: Source, address: string): PastWalletResult => ({
  id: source.id,
  label: source.label,
  totalWallets: source.breakdown.wallets,
  votes: indexOf(source).get(address) ?? null,
});

/** One wallet's past votes: total, rank, and every member it voted for, in GE3–GE5 and Thai-Japan. */
export function getWalletHistory(address: string): WalletHistory {
  const addr = address.toLowerCase();
  return {
    address: addr,
    elections: ELECTIONS.map((s) => resultFor(s, addr)),
    others: OTHERS.map((s) => resultFor(s, addr)),
  };
}
