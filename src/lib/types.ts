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
