import "server-only";
import ge3 from "@/data/ge3-wallets.json";
import ge4 from "@/data/ge4-wallets.json";
import ge5 from "@/data/ge5-wallets.json";
import ge3Summary from "@/data/ge3-summary.json";
import ge4Summary from "@/data/ge4-summary.json";
import ge5Summary from "@/data/ge5-summary.json";
import { pastIndex, type PastId } from "./compare";
import type { PastGeMember, WalletHistory } from "./types";

/** Shape of src/data/<edition>-wallets.json (see scripts/build-past-ge-data.mjs). */
type Breakdown = { wallets: number; members: string[]; rows: number[][] };

const PAST: { id: PastId; label: string; breakdown: Breakdown; addresses: string }[] = [
  { id: "ge3", label: "GE3", breakdown: ge3, addresses: ge3Summary.wallets },
  { id: "ge4", label: "GE4", breakdown: ge4, addresses: ge4Summary.wallets },
  { id: "ge5", label: "GE5", breakdown: ge5, addresses: ge5Summary.wallets },
];

// address → member breakdown, per election. Built once per server instance; the data is static.
let byAddress: Record<PastId, Map<string, PastGeMember[]>> | null = null;
function breakdowns(): Record<PastId, Map<string, PastGeMember[]>> {
  if (!byAddress) {
    const build = ({ id, breakdown, addresses }: (typeof PAST)[number]) => {
      const { members, rows } = breakdown;
      // The breakdown rows follow the summary's address order; a mismatch means the data files
      // came from different runs of the build script.
      if (rows.length * 40 !== addresses.length) throw new Error(`${id}-wallets.json doesn't match ${id}-summary.json`);
      const map = new Map<string, PastGeMember[]>();
      rows.forEach((row, i) => {
        const list: PastGeMember[] = [];
        for (let k = 0; k < row.length; k += 2) list.push({ name: members[row[k]], tokens: row[k + 1] });
        map.set(`0x${addresses.slice(i * 40, i * 40 + 40)}`, list);
      });
      return map;
    };
    byAddress = { ge3: build(PAST[0]), ge4: build(PAST[1]), ge5: build(PAST[2]) };
  }
  return byAddress;
}

/** One wallet's GE3–GE5 votes: total, rank, and every member it voted for. */
export function getWalletHistory(address: string): WalletHistory {
  const addr = address.toLowerCase();
  const totals = pastIndex();
  const members = breakdowns();
  return {
    address: addr,
    past: PAST.map(({ id, label, breakdown }) => {
      const result = totals[id].get(addr);
      return {
        edition: id,
        label,
        totalWallets: breakdown.wallets,
        votes: result ? { tokens: result.tokens, rank: result.rank, members: members[id].get(addr) ?? [] } : null,
      };
    }),
  };
}
