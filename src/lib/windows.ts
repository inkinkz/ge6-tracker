import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ORG_WINDOW_BLOCKS, WINDOW_BLOCKS } from "./config";
import { fetchTransfersFrom, fetchVotes, packRow, packTransfer, type PackedRow, type PackedTransfer } from "./chain";

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

/**
 * Transfers out of the organizer wallets in one completed window [start, start + ORG_WINDOW_BLOCKS - 1].
 * `senders` is the comma-joined wallet list, so it is part of the cache key: changing the organizer
 * list in config refetches instead of serving windows filtered by the old list.
 */
export async function getWindowOrgTransfers(start: number, senders: string): Promise<PackedTransfer[]> {
  "use cache: remote";
  cacheLife("max");
  cacheTag("ge6-org-window");
  const rows = await fetchTransfersFrom(senders.split(","), start, start + ORG_WINDOW_BLOCKS - 1);
  return rows.map(packTransfer);
}
