import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { WINDOW_BLOCKS } from "./config";
import { fetchVotes, packRow, type PackedRow } from "./chain";

/**
 * Votes in one completed block window [start, start + WINDOW_BLOCKS - 1].
 * Past blocks never change (QBFT has instant finality), so the result is cached remotely for
 * as long as the platform allows — every server instance of this deployment shares it.
 * Only call this for windows that are fully behind the indexed head.
 */
export async function getWindowVotes(start: number): Promise<PackedRow[]> {
  "use cache: remote";
  cacheLife("max");
  cacheTag("ge6-window");
  const rows = await fetchVotes(start, start + WINDOW_BLOCKS - 1);
  return rows.map(packRow);
}
