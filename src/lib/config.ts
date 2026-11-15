// On-chain facts about the GE6 vote, verified against scan.tokenx.finance (Oct–Nov 2026).
// Voting closed on 12 Nov 2026 at 21:00 (Bangkok); results come from the official export, not the chain.

/** Voting contract — fans called `vote(bytes32 _message, uint256 _amount)` here and GE6 tokens moved into it. */
export const VOTE_CONTRACT = '0x86a1F49e1b1Cbd69971e99B66123264c75Ac2c8F';

/** GE6 ERC-20 token (18 decimals) that was spent as votes. */
export const GE6_TOKEN = '0x2f5c60bdE7A5ebD2b116BB03cB5232fA1Ea55F1C';
export const GE6_DECIMALS = 18;

/**
 * Every GE6 token was minted in a single transaction (block 48,783,515) to this wallet: 5,000,027 GE6.
 * It handed tokens to fans directly and funded the distribution wallets.
 */
export const GE6_TREASURY = '0x88dE4a0c186efe75fd359F4EBf36E5C4144E1255';

/** BNK48's "BNK Governance token" (BNK, 18 decimals); shown next to GE6 holdings on /wallet and /compare. */
export const BNK_TOKEN = '0xA992ad80Fa6136702382123Ae717890Bc587491d';
export const BNK_DECIMALS = 18;

export const EXPLORER_URL = 'https://scan.tokenx.finance';
/** Public node RPC: used for wallet balances only. */
export const NODE_RPC_URL = 'https://api.tokenx.finance/rpc/v1';

/** The explorer's WAF rejects bare tool user agents; identify ourselves honestly instead. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; GE6VoteTracker/1.0)';

export const explorerAddressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const explorerTxUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerTransfersUrl = `${EXPLORER_URL}/address/${VOTE_CONTRACT}?tab=token_transfers`;
