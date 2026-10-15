import "server-only";
import { cacheLife } from "next/cache";
import { getStats } from "./tracker";
import type { StatsSnapshot } from "./types";

/**
 * Data baked into the page HTML so the first paint already has numbers.
 * The page is regenerated in the background at most every 2 minutes; the client then
 * polls /api/stats for live updates, so the HTML never needs to be fresher than that.
 */
export async function getInitialSnapshot(): Promise<StatsSnapshot | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 86_400 });
  try {
    return (await getStats()).snapshot;
  } catch (err) {
    console.error("[ge6] initial snapshot failed:", err);
    return null;
  }
}
