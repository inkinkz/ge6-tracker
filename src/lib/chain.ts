import "server-only";
import {
  BLOCKSCOUT_RPC_URL,
  BNK_DECIMALS,
  BNK_TOKEN,
  GE6_DECIMALS,
  GE6_DISTRIBUTORS,
  GE6_TOKEN,
  GE6_TREASURY,
  NODE_RPC_URL,
  START_BLOCK,
  USER_AGENT,
  VOTE_CONTRACT,
  VOTED_TOPIC,
} from "./config";

/** One decoded `Voted` event. Compact tuple so it stays small in the remote cache. */
export type VoteRow = {
  /** Global vote counter from the event (unique, gap-free). */
  index: number;
  block: number;
  /** Lowercase 0x address. */
  voter: string;
  /** Amount in wei (1e18 = 1 GE6). */
  wei: bigint;
  tx: string;
};

/** Serializable form of VoteRow: [index, block, voter, weiDecimal, tx]. */
export type PackedRow = [number, number, string, string, string];

export const packRow = (r: VoteRow): PackedRow => [r.index, r.block, r.voter, r.wei.toString(), r.tx];
export const unpackRow = (p: PackedRow): VoteRow => ({
  index: p[0],
  block: p[1],
  voter: p[2],
  wei: BigInt(p[3]),
  tx: p[4],
});

type RpcLog = {
  blockNumber: string;
  data: string;
  topics: (string | null)[];
  transactionHash: string;
};

const MAX_LOGS_PER_RESPONSE = 1000;

async function rpc<T>(url: string, method: string, params: unknown[], attempt = 0): Promise<T> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: { message?: string } | string };
    if (json.error || json.result === undefined) {
      const msg = typeof json.error === "string" ? json.error : json.error?.message;
      throw new Error(`${method}: ${msg ?? "empty result"}`);
    }
    return json.result;
  } catch (err) {
    if (attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return rpc(url, method, params, attempt + 1);
  }
}

// Blockscout returns block numbers as hex, sometimes without the 0x prefix.
const hex = (s: string) => parseInt(s, 16);

function decodeVote(log: RpcLog): VoteRow {
  const voterTopic = log.topics[1] ?? "";
  const indexTopic = log.topics[2] ?? "0x0";
  const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  return {
    index: hex(indexTopic),
    block: hex(log.blockNumber),
    voter: `0x${voterTopic.slice(-40).toLowerCase()}`,
    wei: BigInt(`0x${data.slice(0, 64) || "0"}`),
    tx: log.transactionHash.toLowerCase(),
  };
}

/** All `Voted` events in [fromBlock, toBlock], paging through Blockscout's 1,000-log cap. */
export async function fetchVotes(fromBlock: number, toBlock: number): Promise<VoteRow[]> {
  const out = new Map<number, VoteRow>();
  let from = Math.max(fromBlock, START_BLOCK);
  while (from <= toBlock) {
    const logs = await rpc<RpcLog[]>(BLOCKSCOUT_RPC_URL, "eth_getLogs", [
      {
        address: VOTE_CONTRACT,
        topics: [VOTED_TOPIC],
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`,
      },
    ]);
    let lastBlock = from;
    for (const log of logs) {
      const row = decodeVote(log);
      out.set(row.index, row);
      if (row.block > lastBlock) lastBlock = row.block;
    }
    if (logs.length < MAX_LOGS_PER_RESPONSE) break;
    // Page was full: continue from the last block seen (re-reading it; the Map dedupes by vote index).
    if (lastBlock === from) throw new Error(`more than ${MAX_LOGS_PER_RESPONSE} votes in block ${from}`);
    from = lastBlock;
  }
  return [...out.values()].sort((a, b) => a.index - b.index);
}

/** Latest block Blockscout has indexed (logs are only reliable up to here). */
export async function fetchIndexedHead(): Promise<number> {
  return hex(await rpc<string>(BLOCKSCOUT_RPC_URL, "eth_blockNumber", []));
}

/** Latest chain block + its timestamp, used to convert block numbers into time. */
export async function fetchChainHead(): Promise<{ block: number; timestamp: number }> {
  const b = await rpc<{ number: string; timestamp: string }>(NODE_RPC_URL, "eth_getBlockByNumber", ["latest", false]);
  return { block: hex(b.number), timestamp: hex(b.timestamp) };
}

/** Several JSON-RPC calls in one HTTP request; results come back in call order. */
async function rpcBatch(url: string, calls: { method: string; params: unknown[] }[], attempt = 0): Promise<string[]> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`batch: HTTP ${res.status}`);
    const json = (await res.json()) as { id: number; result?: string; error?: { message?: string } }[];
    if (!Array.isArray(json)) throw new Error("batch: not an array");
    const out: string[] = new Array(calls.length);
    for (const r of json) {
      if (r.error || r.result === undefined) throw new Error(`batch #${r.id}: ${r.error?.message ?? "empty result"}`);
      out[r.id] = r.result;
    }
    if (out.some((r) => r === undefined)) throw new Error("batch: missing results");
    return out;
  } catch (err) {
    if (attempt >= 2) throw err;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return rpcBatch(url, calls, attempt + 1);
  }
}

const balanceOfData = (address: string) => `0x70a08231${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
const toBigInt = (raw: string) => BigInt(raw === "0x" ? "0x0" : raw);

/** Where every GE6 token sits at one block, in wei (1e18 = 1 GE6). */
export type SupplyRead = {
  block: number;
  totalWei: bigint;
  treasuryWei: bigint;
  distributorsWei: bigint;
  /** The vote contract never sends GE6 out, so this is everything voted so far. */
  votedWei: bigint;
};

/**
 * totalSupply plus the organizer wallets' and vote contract's balances, all read at the same block
 * in a single request so the parts always add up.
 */
export async function fetchSupply(block: number): Promise<SupplyRead> {
  const tag = `0x${block.toString(16)}`;
  const call = (data: string) => ({ method: "eth_call", params: [{ to: GE6_TOKEN, data }, tag] });
  const raw = await rpcBatch(NODE_RPC_URL, [
    call("0x18160ddd"), // totalSupply()
    call(balanceOfData(GE6_TREASURY)),
    call(balanceOfData(VOTE_CONTRACT)),
    ...GE6_DISTRIBUTORS.map((a) => call(balanceOfData(a))),
  ]);
  const [total, treasury, voted, ...distributors] = raw.map(toBigInt);
  return {
    block,
    totalWei: total,
    treasuryWei: treasury,
    distributorsWei: distributors.reduce((a, b) => a + b, 0n),
    votedWei: voted,
  };
}

/** An ERC-20 balance via balanceOf, in whole tokens. */
async function fetchTokenBalance(token: string, decimals: number, address: string): Promise<number> {
  const raw = await rpc<string>(NODE_RPC_URL, "eth_call", [{ to: token, data: balanceOfData(address) }, "latest"]);
  const units = toBigInt(raw);
  // Keep 6 decimals exactly, then convert (balances are far below 2^53 micro-units).
  return Number(units / 10n ** BigInt(decimals - 6)) / 1e6;
}

/** What a wallet holds right now: GE6 not yet voted, and BNK governance tokens. */
export async function fetchHoldings(address: string): Promise<{ ge6: number; bnk: number }> {
  const [ge6, bnk] = await Promise.all([
    fetchTokenBalance(GE6_TOKEN, GE6_DECIMALS, address),
    fetchTokenBalance(BNK_TOKEN, BNK_DECIMALS, address),
  ]);
  return { ge6, bnk };
}
