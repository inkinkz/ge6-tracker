import "server-only";
import { cacheLife } from "next/cache";
import ge4 from "@/data/ge4-top.json";
import ge5 from "@/data/ge5-top.json";
import { getVoterSummaries } from "./tracker";
import type { PastEdition, PastGeComparison, PastGeRow, VoterSummaries } from "./types";

const EDITIONS: Record<PastEdition, { label: string; number: number; data: typeof ge5 }> = {
  ge4: { label: "GE4", number: 4, data: ge4 },
  ge5: { label: "GE5", number: 5, data: ge5 },
};

/**
 * A past election's top wallets (top 200) joined with their GE6 votes so far.
 * The past data is static (src/data/<edition>-top.json, from `npm run data:ge4` / `data:ge5`);
 * the GE6 side comes from the live tracker. Cached like the home page: regenerated in the
 * background at most every 2 minutes, with no client polling, so a view costs one CDN request.
 */
export async function getPastComparison(edition: PastEdition): Promise<PastGeComparison> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });

  const { label, number, data } = EDITIONS[edition];
  let ge6: VoterSummaries | null = null;
  try {
    ge6 = await getVoterSummaries(data.top.map((r) => r.address));
  } catch (err) {
    // Still show the past election's side if Token X Scan is down.
    console.error(`[ge6] ${label} comparison: GE6 data unavailable:`, err);
  }

  const rows: PastGeRow[] = data.top.map((r) => ({ ...r, ge6: ge6?.voters[r.address] ?? null }));

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
      available: Boolean(ge6),
      updatedAt: ge6?.updatedAt ?? null,
      totalTokens: ge6?.totalTokens ?? 0,
      totalVoters: ge6?.totalVoters ?? 0,
      topTokens: round2(rows.reduce((s, r) => s + (r.ge6?.tokens ?? 0), 0)),
      returning: rows.filter((r) => r.ge6).length,
    },
    rows,
    members,
  };
}
