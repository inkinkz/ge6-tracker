// JSON shapes shared by the server and the client. Token amounts are GE6 (already divided by 1e18).
// GE6 data is static: built from the official result export by scripts/build-ge6-results.mjs.

/** Wallets bucketed by how much they voted. */
export type SizeBucket = {
  label: string;
  wallets: number;
  tokens: number;
  /** Share of the tokens in scope, 0–1. */
  share: number;
};

export type Ge6Group = "BNK48" | "CGM48";

/** One member's final GE6 result (src/data/ge6-results.json → members). */
export type Ge6MemberSummary = {
  rank: number;
  /** As in the export, e.g. "Pancake BNK48". */
  name: string;
  nick: string;
  group: Ge6Group | null;
  /** URL segment for /member/[slug], e.g. "pancake-bnk48". */
  slug: string;
  tokens: number;
  /** Share of all GE6 votes, 0–1. */
  share: number;
  wallets: number;
  votes: number;
  avgPerWallet: number;
  medianPerWallet: number;
  /** Share of her tokens from her biggest wallet / her top 10 wallets. */
  top1Share: number;
  top10Share: number;
  /** Fewest of her wallets that make up half her tokens. */
  walletsForHalf: number;
  /** Wallets that voted for her and nobody else, and their share of her tokens. */
  soleWallets: number;
  soleShare: number;
  /** Share of her tokens voted in the final 24 hours. */
  finalDayShare: number;
  /** Her wallets that didn't vote in GE5 at all. */
  newWallets: number;
  topVoter: { address: string; tokens: number; share: number; rank: number; memberCount: number };
  /** Her GE5 result (matched by exact name), null if she wasn't in GE5. */
  ge5: { rank: number; tokens: number; wallets: number } | null;
};

export type Ge6TopWallet = {
  rank: number;
  address: string;
  tokens: number;
  share: number;
  votes: number;
  memberCount: number;
  /** Largest first, up to 5. */
  members: PastGeMember[];
  /** Also voted in GE5. */
  ge5: boolean;
};

export type Ge6Day = { t: number; tokens: number; votes: number; wallets: number; newWallets: number; cumulativeTokens: number };

/** A GE5 member who isn't in GE6, and where the wallets that voted for her most went. */
export type Ge6Departed = {
  name: string;
  ge5Rank: number;
  ge5Tokens: number;
  /** GE5 wallets whose top pick she was. */
  fans: number;
  votedGe6: number;
  ge6Tokens: number;
  to: { name: string; slug: string; tokens: number; wallets: number }[];
};

type RecordVote = { address: string; member: string; tokens: number; at: number };

export type Ge6Results = {
  firstVoteAt: number;
  lastVoteAt: number;
  closeAt: number;
  totals: {
    tokens: number;
    wallets: number;
    votes: number;
    members: number;
    avgPerWallet: number;
    medianPerWallet: number;
    avgPerVote: number;
    medianPerVote: number;
    top1Share: number;
    top10Share: number;
    top100Share: number;
    walletsForHalf: number;
    singleMemberWallets: number;
    /** Wallets that voted for members of both BNK48 and CGM48. */
    bothGroups: number;
  };
  groups: { group: Ge6Group; members: number; tokens: number; share: number; wallets: number; votes: number }[];
  members: Ge6MemberSummary[];
  topWallets: Ge6TopWallet[];
  daily: Ge6Day[];
  /** The last 24 hours before voting closed, by hour. */
  finalHours: { t: number; tokens: number; votes: number }[];
  /** Bangkok hour of day 0–23 across the whole vote. */
  hourOfDay: { hour: number; tokens: number; votes: number }[];
  walletSize: SizeBucket[];
  membersPerWallet: SizeBucket[];
  /** Member pairs voted for by the most wallets; overlap = share of the smaller fan base. */
  pairs: { a: string; b: string; wallets: number; overlap: number }[];
  departed: Ge6Departed[];
  ge5: { ge5Wallets: number; returning: number; newWallets: number };
  records: {
    largestVote: RecordVote;
    mostVotes: { address: string; votes: number; tokens: number };
    mostMembers: { address: string; members: number; tokens: number };
    firstVote: RecordVote;
    lastVote: RecordVote;
  };
};

export type Ge6MemberVoter = {
  /** Rank among her wallets. */
  rank: number;
  address: string;
  /** Tokens this wallet gave her, and their share of her total. */
  tokens: number;
  share: number;
  /** This wallet's whole GE6 total and overall rank. */
  walletTokens: number;
  walletRank: number;
  memberCount: number;
};

/** Everything /member/[slug] shows (src/data/ge6-members.json, plus GE3–GE5 history at runtime). */
export type Ge6MemberDetail = Ge6MemberSummary & {
  firstVoteAt: number;
  largestVote: { address: string; tokens: number; at: number };
  peakDay: { t: number; tokens: number };
  /** Tokens per Bangkok day, aligned with Ge6Results.daily. */
  daily: number[];
  walletSize: SizeBucket[];
  topVoters: Ge6MemberVoter[];
  alsoVoted: { name: string; slug: string; wallets: number; tokens: number }[];
  ge5Wallets: {
    /** Her GE6 wallets that also voted in GE5, and those that voted for her in GE5 too. */
    fromGe5: number;
    votedHerInGe5: number;
    /** GE5 wallets whose top pick she was, and what they did in GE6. */
    fans: { fans: number; votedGe6: number; stayed: number; stayedTop: number; ge6Tokens: number } | null;
  };
};

/**
 * GE6 token supply split by who held it when voting closed (frozen in src/data/ge6-tokens.json):
 * created = organizer + distributed, and distributed = voted + inWallets.
 */
export type SupplySnapshot = {
  block: number;
  /** All GE6 ever minted (totalSupply). */
  created: number;
  /** Still in the minting wallet and the distribution wallets. */
  organizer: number;
  treasury: number;
  distributors: number;
  distributorWallets: number;
  /** Handed out to fans (created − organizer; no token has ever gone back to the organizer). */
  distributed: number;
  /** Held by the vote contract at close: everything voted on-chain. */
  voted: number;
  /** Handed out but never voted: left in fans' wallets. */
  inWallets: number;
};

/** One distribution wallet: what the treasury gave it and how much it has passed on to fans. */
export type DistributorWallet = {
  address: string;
  /** GE6 received from the treasury (net of anything sent back). */
  allocated: number;
  /** GE6 sent on to fans. */
  sent: number;
  /** Balance when voting closed. */
  balance: number | null;
  /** Distinct fan wallets it has sent GE6 to. */
  recipients: number;
  lastSentAt: number | null;
};

/** One Bangkok day of token movement. */
export type FlowDay = {
  /** Day start, unix seconds. */
  t: number;
  /** GE6 sent from organizer wallets to fans that day. */
  distributed: number;
  /** GE6 voted that day. */
  voted: number;
};

/** Built from every transfer out of the organizer wallets. */
export type TokenFlow = {
  /** Distinct fan wallets that have received GE6 straight from an organizer wallet. */
  recipients: number;
  /** What the treasury sent straight to fans, skipping the distribution wallets. */
  direct: { sent: number; recipients: number };
  /** Largest allocation first. */
  wallets: DistributorWallet[];
  /** From the first day tokens reached fans to the day voting closed. */
  daily: FlowDay[];
};

/** A past election this app compares GE6 against. */
export type PastEdition = "ge3" | "ge4" | "ge5";

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
  /** This wallet's GE6 result, or null if it didn't vote in GE6. */
  ge6: { tokens: number; rank: number; memberCount: number; members: PastGeMember[] } | null;
};

/** A member that is some listed wallet's top pick (for the member filter). */
export type PastGeMemberOption = { name: string; wallets: number };

export type PastGeComparison = {
  /** e.g. { id: "ge4", label: "GE4", number: 4 } */
  edition: { id: PastEdition; label: string; number: number };
  past: { wallets: number; members: number };
  ge6: {
    totalTokens: number;
    totalVoters: number;
    /** GE6 tokens voted by the listed wallets. */
    topTokens: number;
    /** How many of the listed wallets voted in GE6. */
    returning: number;
  };
  rows: PastGeRow[];
  members: PastGeMemberOption[];
};

export type GeId = "ge3" | "ge4" | "ge5" | "ge6";

/** One election's headline numbers, null where unknown. */
export type GeEditionStats = {
  id: GeId;
  label: string;
  tokens: number;
  wallets: number;
  /** Members who received votes. */
  members: number;
  /** Vote transactions (unknown for GE5: its export is pre-aggregated). */
  votes: number | null;
  avgPerWallet: number;
  medianPerWallet: number;
  top10Share: number;
  walletsForHalf: number;
  topMember: { name: string; tokens: number } | null;
};

/** Wallets from one election that voted again in the next. */
export type GeFlow = { from: string; to: string; fromWallets: number; returning: number };

/** Wallets in an election that hadn't voted in any earlier one (since GE3). */
export type GeNewWallets = { label: string; wallets: number; newWallets: number };

export type GeMemberHistory = {
  key: string;
  nick: string;
  group: string | null;
  /** True for e.g. GE4's "Pim", which doesn't say which group's Pim it was. */
  groupUnknown: boolean;
  results: Record<GeId, { rank: number; tokens: number; wallets: number } | null>;
  /** GE6 page slug when she's in GE6. */
  slug: string | null;
};

export type GeCompare = {
  editions: GeEditionStats[];
  flows: GeFlow[];
  newWallets: GeNewWallets[];
  loyal: { ge3to5: number; ge3to6: number };
  members: GeMemberHistory[];
  /** Union of each election's top wallets (see TOP_PER_EDITION in lib/compare.ts). */
  topPerEdition: number;
  wallets: GeWalletRow[];
};

/** One wallet's result in a past election, for the combined table on /compare. */
export type GePastResult = {
  tokens: number;
  rank: number;
  /** Top member and its share of this wallet's votes (only known for that election's top wallets). */
  top: { name: string; share: number } | null;
};

/** A wallet that's in the top of any election, with its result in every election. */
export type GeWalletRow = {
  address: string;
  ge6: GePastResult | null;
  ge5: GePastResult | null;
  ge4: GePastResult | null;
  ge3: GePastResult | null;
};

/** A vote the wallet page shows: GE3–GE6, plus the Thai-Japan vote. */
export type PastVoteId = GeId | "thai-japan";

/** One wallet's votes in a past vote (from the full vote export). */
export type PastWalletResult = {
  id: PastVoteId;
  label: string;
  /** Wallets that voted in it. */
  totalWallets: number;
  /** Null when this wallet didn't vote in it. */
  votes: { tokens: number; rank: number; members: PastGeMember[] } | null;
};

/** Everything the /wallet page shows about one address from the vote exports. */
export type WalletHistory = {
  address: string;
  /** GE3, GE4, GE5, GE6 in that order. */
  elections: PastWalletResult[];
  /** Other votes (Thai-Japan). */
  others: PastWalletResult[];
};
