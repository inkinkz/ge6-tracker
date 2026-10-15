// On-chain facts about the GE6 vote, verified against scan.tokenx.finance (Oct 2026).

/** Voting contract — fans call `vote(bytes32 _message, uint256 _amount)` here and GE6 tokens move into it. */
export const VOTE_CONTRACT = "0x86a1F49e1b1Cbd69971e99B66123264c75Ac2c8F";

/** GE6 ERC-20 token (18 decimals) that is spent as votes. */
export const GE6_TOKEN = "0x2f5c60bdE7A5ebD2b116BB03cB5232fA1Ea55F1C";
export const GE6_DECIMALS = 18;

/**
 * keccak256("Voted(address,uint256,uint256,bytes32)")
 * topics: [sig, voter, index]  data: [amount, hash]
 * `index` is a global, gap-free vote counter starting at 0 — we use it to dedupe and detect missed logs.
 */
export const VOTED_TOPIC = "0xf851f974bf070e5929a90c01a09d3c8a0bcbc807f1b3abafbd5bf9d4855547c4";

/** Block of vote #0. Nothing before this needs scanning (contract was deployed at 49110941). */
export const START_BLOCK = 49_475_837;

/** Token X is a QBFT chain with a fixed 3s block period, so block → time is linear. */
export const BLOCK_TIME_SEC = 3;

export const EXPLORER_URL = "https://scan.tokenx.finance";
/** Blockscout's JSON-RPC shim: supports eth_getLogs (1,000 logs/response) and is POST, so the explorer CDN never serves it stale. */
export const BLOCKSCOUT_RPC_URL = `${EXPLORER_URL}/api/eth-rpc`;
/** Public node RPC: used only for the latest block's timestamp (it rejects eth_getLogs). */
export const NODE_RPC_URL = "https://api.tokenx.finance/rpc/v1";

/** The explorer's WAF rejects bare tool user agents; identify ourselves honestly instead. */
export const USER_AGENT = "Mozilla/5.0 (compatible; GE6VoteTracker/1.0)";

/** Ignore the newest blocks so we never read a block Blockscout is still indexing. */
export const CONFIRMATIONS = 2;

/**
 * History is split into fixed block windows. A window that is fully in the past never changes,
 * so it is cached remotely and a cold server instance doesn't have to rescan everything.
 * 20,000 blocks ≈ 16.7 hours.
 */
export const WINDOW_BLOCKS = 20_000;
/** A window is only cached once its end is this far behind the indexed head (~5 min). */
export const WINDOW_SAFETY_BLOCKS = 100;

/** Minimum time between two upstream syncs inside one server instance. */
export const SYNC_MIN_INTERVAL_MS = 10_000;

/** CDN cache for /api/stats. With stale-while-revalidate the function runs at most ~3×/min per region. */
export const STATS_CDN_MAX_AGE_SEC = 20;
export const STATS_CDN_SWR_SEC = 60;

export const TOP_VOTERS_LIMIT = 100;
export const RECENT_VOTES_LIMIT = 30;
export const HOURLY_WINDOW_HOURS = 48;

/** Asia/Bangkok has no DST. */
export const TZ_OFFSET_SEC = 7 * 3600;

export const explorerAddressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const explorerTxUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerTransfersUrl = `${EXPLORER_URL}/address/${VOTE_CONTRACT}?tab=token_transfers`;
