import "server-only";
import { cacheLife } from "next/cache";
import { getStats } from "./tracker";
import type { StatsSnapshot } from "./types";

/**
 * Data baked into the page HTML so the first paint already has numbers.
 * The page is regenerated in the background at most once a minute (one function run, however
 * many visitors). Because the HTML is usually under a minute old, a new visitor's tab can wait
 * for its first scheduled poll instead of fetching /api/stats immediately — one CDN request
 * saved per visit.
 */
export async function getInitialSnapshot(): Promise<StatsSnapshot | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 86_400 });
  try {
    return (await getStats()).snapshot;
  } catch (err) {
    console.error("[ge6] initial snapshot failed:", err);
    return null;
  }
}
