// On-chain facts about the GE6 vote, verified against scan.tokenx.finance (Oct 2026).

/** Voting contract — fans call `vote(bytes32 _message, uint256 _amount)` here and GE6 tokens move into it. */
export const VOTE_CONTRACT = '0x86a1F49e1b1Cbd69971e99B66123264c75Ac2c8F';

/** GE6 ERC-20 token (18 decimals) that is spent as votes. */
export const GE6_TOKEN = '0x2f5c60bdE7A5ebD2b116BB03cB5232fA1Ea55F1C';
export const GE6_DECIMALS = 18;

/** BNK48's "BNK Governance token" (BNK, 18 decimals); shown next to GE6 holdings on /compare. */
export const BNK_TOKEN = "0xA992ad80Fa6136702382123Ae717890Bc587491d";
export const BNK_DECIMALS = 18;

/**
 * keccak256("Voted(address,uint256,uint256,bytes32)")
 * topics: [sig, voter, index]  data: [amount, hash]
 * `index` is a global, gap-free vote counter starting at 0 — we use it to dedupe and detect missed logs.
 */
export const VOTED_TOPIC = '0xf851f974bf070e5929a90c01a09d3c8a0bcbc807f1b3abafbd5bf9d4855547c4';

/** Block of vote #0. Nothing before this needs scanning (contract was deployed at 49110941). */
export const START_BLOCK = 49_475_837;

/** Token X is a QBFT chain with a fixed 3s block period, so block → time is linear. */
export const BLOCK_TIME_SEC = 3;

export const EXPLORER_URL = 'https://scan.tokenx.finance';
/** Blockscout's JSON-RPC shim: supports eth_getLogs (1,000 logs/response) and is POST, so the explorer CDN never serves it stale. */
export const BLOCKSCOUT_RPC_URL = `${EXPLORER_URL}/api/eth-rpc`;
/** Public node RPC: used only for the latest block's timestamp (it rejects eth_getLogs). */
export const NODE_RPC_URL = 'https://api.tokenx.finance/rpc/v1';

/** The explorer's WAF rejects bare tool user agents; identify ourselves honestly instead. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; GE6VoteTracker/1.0)';

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

/**
 * CDN cache for /api/stats. Every viewer in a CDN region shares one response, so the function
 * runs at most ~2×/min per region no matter how many people are polling.
 */
export const STATS_CDN_MAX_AGE_SEC = 30;
export const STATS_CDN_SWR_SEC = 90;
/** Browsers may reuse a response this long (dedupes reloads and multiple tabs). */
export const STATS_BROWSER_MAX_AGE_SEC = 10;

export const TOP_VOTERS_LIMIT = 100;
export const RECENT_VOTES_LIMIT = 30;
export const HOURLY_WINDOW_HOURS = 48;

/** Asia/Bangkok has no DST. */
export const TZ_OFFSET_SEC = 7 * 3600;

export const explorerAddressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const explorerTxUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerTransfersUrl = `${EXPLORER_URL}/address/${VOTE_CONTRACT}?tab=token_transfers`;

/*
 * How hard open tabs poll. Each poll is one Vercel CDN request (Hobby includes 1M/month), so this
 * is the main cost lever. The policy travels inside every /api/stats response, which means
 * changing TRAFFIC_MODE and redeploying also slows down tabs that are already open.
 *
 * Auto-refresh only runs for `autoMin` minutes after the page opens (or after the viewer taps
 * the status pill to continue), so a forgotten tab stops costing requests on its own.
 *
 *   normal — poll every 120s, for 6 minutes per session
 *   busy   — poll every 240s, for 8 minutes per session
 *   surge  — no automatic polling; viewers tap the status pill to refresh
 *
 * POLL_INTERVAL_SEC / AUTO_REFRESH_MIN override the preset (POLL_INTERVAL_SEC=0 means manual only).
 */
export type TrafficMode = 'normal' | 'busy' | 'surge';
export type PollPolicy = { mode: TrafficMode; pollSec: number; autoMin: number };

const POLICY_PRESETS: Record<TrafficMode, PollPolicy> = {
  normal: { mode: 'normal', pollSec: 120, autoMin: 6 },
  busy: { mode: 'busy', pollSec: 240, autoMin: 8 },
  surge: { mode: 'surge', pollSec: 0, autoMin: 0 },
};

export function getPollPolicy(): PollPolicy {
  const mode = (process.env.TRAFFIC_MODE ?? 'normal').trim().toLowerCase() as TrafficMode;
  const preset = POLICY_PRESETS[mode] ?? POLICY_PRESETS.normal;
  const num = (v: string | undefined) =>
    v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  const pollSec = num(process.env.POLL_INTERVAL_SEC);
  const autoMin = num(process.env.AUTO_REFRESH_MIN);
  return {
    mode: preset.mode,
    // Never poll faster than the CDN refreshes; 0 stays 0 (manual only).
    pollSec:
      pollSec === null
        ? preset.pollSec
        : pollSec <= 0
          ? 0
          : Math.max(STATS_CDN_MAX_AGE_SEC, pollSec),
    autoMin: autoMin === null ? preset.autoMin : Math.max(1, autoMin),
  };
}
