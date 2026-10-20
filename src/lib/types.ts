// JSON shapes shared by the API routes and the client. Token amounts are GE6 (already divided by 1e18).

import type { PollPolicy } from "./config";

export type VoterEntry = {
  rank: number;
  address: string;
  tokens: number;
  votes: number;
  /** Fraction of all voted tokens, 0–1. */
  share: number;
  lastVoteAt: number;
};

export type RecentVote = {
  index: number;
  tx: string;
  voter: string;
  tokens: number;
  at: number;
};

export type SeriesPoint = {
  /** Bucket start, unix seconds. */
  t: number;
  tokens: number;
  votes: number;
  newVoters: number;
  cumulativeTokens: number;
};

export type DistributionBucket = {
  label: string;
  voters: number;
  tokens: number;
  /** Share of all voted tokens, 0–1. */
  share: number;
};

export type WindowStats = {
  tokens: number;
  votes: number;
  activeVoters: number;
  newVoters: number;
};

export type StatsSnapshot = {
  /** Server time of the last successful upstream sync, ms. */
  updatedAt: number;
  /** How often clients should poll (set by TRAFFIC_MODE on the server). */
  policy: PollPolicy;
  syncedBlock: number;
  /** Timestamp of `syncedBlock`, unix seconds. */
  syncedBlockAt: number;
  firstVoteAt: number | null;
  totals: {
    tokens: number;
    votes: number;
    voters: number;
    avgPerVote: number;
    avgPerVoter: number;
    medianPerVoter: number;
    largestVote: RecentVote | null;
  };
  last1h: WindowStats;
  last24h: WindowStats;
  concentration: {
    top1Share: number;
    top10Share: number;
    top100Share: number;
    /** Fewest wallets that together hold half of all voted tokens. */
    walletsForHalf: number;
  };
  topVoters: VoterEntry[];
  distribution: DistributionBucket[];
  daily: SeriesPoint[];
  hourly: SeriesPoint[];
  recent: RecentVote[];
  integrity: {
    /** Highest on-chain vote index + 1. */
    expectedVotes: number;
    missingVotes: number;
  };
};

export type WalletInfo = {
  address: string;
  found: boolean;
  rank: number | null;
  totalVoters: number;
  tokens: number;
  votes: number;
  share: number;
  firstVoteAt: number | null;
  lastVoteAt: number | null;
  recent: RecentVote[];
  updatedAt: number;
};

export type VoterSummaries = {
  /** Server time of the GE6 data, ms. */
  updatedAt: number;
  totalTokens: number;
  totalVoters: number;
  /** Keyed by lowercase address; wallets that haven't voted in GE6 are absent. */
  voters: Record<string, { tokens: number; votes: number; rank: number; lastVoteAt: number }>;
};

/** A past election this app compares GE6 against. */
export type PastEdition = "ge4" | "ge5";

export type PastGeMember = { name: string; tokens: number };

export type PastGeRow = {
  /** Rank among that election's voters by total tokens. */
  rank: number;
  address: string;
  /** Total tokens this wallet voted in that election. */
  tokens: number;
  /** How many members this wallet voted for in that election. */
  memberCount: number;
  /** Members this wallet voted for most (largest first); members[0] is its top pick. */
  members: PastGeMember[];
  /** This wallet's GE6 votes so far, or null if it hasn't voted in GE6 yet. */
  ge6: { tokens: number; votes: number; rank: number; lastVoteAt: number } | null;
};

/** A member that is some listed wallet's top pick (for the member filter). */
export type PastGeMemberOption = { name: string; wallets: number };

export type PastGeComparison = {
  /** e.g. { id: "ge4", label: "GE4", number: 4 } */
  edition: { id: PastEdition; label: string; number: number };
  past: { wallets: number; members: number };
  ge6: {
    available: boolean;
    updatedAt: number | null;
    totalTokens: number;
    totalVoters: number;
    /** GE6 tokens voted so far by the listed wallets. */
    topTokens: number;
    /** How many of the listed wallets have voted in GE6. */
    returning: number;
  };
  rows: PastGeRow[];
  members: PastGeMemberOption[];
};
