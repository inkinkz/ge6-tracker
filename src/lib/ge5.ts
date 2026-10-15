import "server-only";
import { cacheLife } from "next/cache";
import ge5 from "@/data/ge5-top.json";
import { getVoterSummaries } from "./tracker";
import type { Ge5Comparison, Ge5Row, VoterSummaries } from "./types";

/**
 * GE5's top wallets (top 200) joined with their GE6 votes so far.
 * GE5 data is static (src/data/ge5-top.json, from `npm run data:ge5`); the GE6 side comes
 * from the live tracker. Cached like the home page: regenerated in the background at most every
 * 2 minutes, with no client polling, so the page costs one CDN request per view.
 */
export async function getGe5Comparison(): Promise<Ge5Comparison> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });

  let ge6: VoterSummaries | null = null;
  try {
    ge6 = await getVoterSummaries(ge5.top.map((r) => r.address));
  } catch (err) {
    // Still show the GE5 side if Token X Scan is down.
    console.error("[ge6] GE5 comparison: GE6 data unavailable:", err);
  }

  const rows: Ge5Row[] = ge5.top.map((r) => ({ ...r, ge6: ge6?.voters[r.address] ?? null }));

  const picks = new Map<string, number>();
  for (const r of rows) picks.set(r.members[0].name, (picks.get(r.members[0].name) ?? 0) + 1);
  const members = [...picks.entries()]
    .map(([name, wallets]) => ({ name, wallets }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    ge5: { wallets: ge5.totals.wallets, members: ge5.totals.members },
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
