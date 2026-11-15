import "server-only";
import results from "@/data/ge6-results.json";
import members from "@/data/ge6-members.json";
import tokens from "@/data/ge6-tokens.json";
import { memberHistory } from "./compare";
import type { FlowDay, GeMemberHistory, Ge6MemberDetail, Ge6Results, SupplySnapshot, TokenFlow } from "./types";

/*
 * Final GE6 results. Everything here is static data built from the official result export
 * (`npm run data:ge6`) plus a token snapshot taken on-chain when voting closed, so every page that
 * uses it is prerendered at build time and nothing polls.
 */

export const getResults = (): Ge6Results => results as Ge6Results;

const details = members as unknown as Record<string, Omit<Ge6MemberDetail, "history">>;

export const memberSlugs = (): string[] => Object.keys(details);

/** One member's detail page data, or null for an unknown slug. */
export function getMember(slug: string): (Ge6MemberDetail & { history: GeMemberHistory | null }) | null {
  const detail = details[slug];
  if (!detail) return null;
  return { ...(detail as Ge6MemberDetail), history: memberHistory().find((h) => h.slug === slug) ?? null };
}

/** Where every GE6 token was when voting closed. */
export function getSupply(): SupplySnapshot {
  const { block, supply } = tokens;
  const organizer = supply.treasury + supply.distributors;
  const distributed = supply.created - organizer;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    block,
    created: supply.created,
    organizer,
    treasury: supply.treasury,
    distributors: supply.distributors,
    distributorWallets: supply.distributorWallets,
    distributed,
    voted: supply.voted,
    inWallets: round(distributed - supply.voted),
  };
}

/** Organizer → fan token movement, with each day's votes from the result export. */
export function getFlow(): TokenFlow {
  const voted = new Map(results.daily.map((d) => [d.t, d.tokens]));
  const daily: FlowDay[] = tokens.flow.daily.map((d) => ({ ...d, voted: voted.get(d.t) ?? 0 }));
  return { ...tokens.flow, daily };
}
