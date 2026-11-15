import "server-only";
import ge3 from "@/data/ge3-top.json";
import ge4 from "@/data/ge4-top.json";
import ge5 from "@/data/ge5-top.json";
import ge6Summary from "@/data/ge6-summary.json";
import { ge6Wallet } from "./wallet-history";
import type { PastEdition, PastGeComparison, PastGeRow } from "./types";

const EDITIONS: Record<PastEdition, { label: string; number: number; data: typeof ge5 }> = {
  ge3: { label: "GE3", number: 3, data: ge3 },
  ge4: { label: "GE4", number: 4, data: ge4 },
  ge5: { label: "GE5", number: 5, data: ge5 },
};

/**
 * A past election's top wallets (top 300) joined with their final GE6 result.
 * All static (src/data/<edition>-top.json and the GE6 files), so the pages are prerendered.
 */
export function getPastComparison(edition: PastEdition): PastGeComparison {
  const { label, number, data } = EDITIONS[edition];

  const rows: PastGeRow[] = data.top.map((r) => {
    const g = ge6Wallet(r.address);
    return {
      ...r,
      ge6: g ? { tokens: g.tokens, rank: g.rank, memberCount: g.members.length, members: g.members.slice(0, 3) } : null,
    };
  });

  const picks = new Map<string, number>();
  for (const r of rows) picks.set(r.members[0].name, (picks.get(r.members[0].name) ?? 0) + 1);
  const members = [...picks.entries()]
    .map(([name, wallets]) => ({ name, wallets }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    edition: { id: edition, label, number },
    past: { wallets: data.totals.wallets, members: data.totals.members },
    ge6: {
      totalTokens: ge6Summary.stats.tokens,
      totalVoters: ge6Summary.stats.wallets,
      topTokens: round2(rows.reduce((s, r) => s + (r.ge6?.tokens ?? 0), 0)),
      returning: rows.filter((r) => r.ge6).length,
    },
    rows,
    members,
  };
}
