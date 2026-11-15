import "server-only";
import { BNK_DECIMALS, BNK_TOKEN, GE6_DECIMALS, GE6_TOKEN, NODE_RPC_URL, USER_AGENT } from "./config";

/*
 * The only live chain read left after voting closed: a wallet's current GE6 / BNK balance, fetched
 * when someone opens a wallet (never polled). Everything else is static data from the result export.
 */

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

const addressTopic = (a: string) => `0x${a.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
const balanceOfData = (address: string) => `0x70a08231${addressTopic(address).slice(2)}`;
const toBigInt = (raw: string) => BigInt(raw === "0x" ? "0x0" : raw);

/** An ERC-20 balance via balanceOf, in whole tokens. */
async function fetchTokenBalance(token: string, decimals: number, address: string): Promise<number> {
  const raw = await rpc<string>(NODE_RPC_URL, "eth_call", [{ to: token, data: balanceOfData(address) }, "latest"]);
  const units = toBigInt(raw);
  // Keep 6 decimals exactly, then convert (balances are far below 2^53 micro-units).
  return Number(units / 10n ** BigInt(decimals - 6)) / 1e6;
}

/** What a wallet holds right now: GE6 it never voted, and BNK governance tokens. */
export async function fetchHoldings(address: string): Promise<{ ge6: number; bnk: number }> {
  const [ge6, bnk] = await Promise.all([
    fetchTokenBalance(GE6_TOKEN, GE6_DECIMALS, address),
    fetchTokenBalance(BNK_TOKEN, BNK_DECIMALS, address),
  ]);
  return { ge6, bnk };
}
