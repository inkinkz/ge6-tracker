# GE6 Vote Tracker

A real-time, Thai-language, mobile-first dashboard for the **BNK48 & CGM48 General Election 6** token vote on the Token X chain.

It counts every GE6 token sent to the voting contract
[`0x86a1F49e1b1Cbd69971e99B66123264c75Ac2c8F`](https://scan.tokenx.finance/address/0x86a1F49e1b1Cbd69971e99B66123264c75Ac2c8F?tab=token_transfers) and shows:

- Total GE6 tokens voted, number of vote transactions, and unique voter wallets, each with 1h and 24h deltas.
- Average and median tokens per wallet, average tokens per vote, and the largest single vote.
- Top 10 / 25 / 50 / 100 wallets by tokens voted, with share, vote count, and last vote time.
- Concentration: how many wallets make up half of all tokens, and the Top 10 and Top 100 shares.
- Wallet distribution by total voted (<1, 1–9, 10–99, …, 10,000+).
- Daily, hourly (48h) and cumulative charts, each with a table view.
- A live feed of the latest votes.
- Wallet lookup: rank, total, and vote history for any address. A wallet can be remembered on the device so it gets highlighted.

## What the chain exposes (API exploration)

| Source | Works? | Notes |
| --- | --- | --- |
| `https://scan.tokenx.finance/api/v2/...` (Blockscout REST) | Partly | The explorer is Blockscout. Its CloudFront WAF blocks bare tool user agents such as `curl` and `node`, so send a descriptive UA. The CDN cache key ignores `block_number`/`index`, so **pagination returns stale or duplicate pages**. Not safe for full history. |
| `https://scan.tokenx.finance/api?module=...` (Etherscan-style) | No | CloudFront ignores the query string on `/api`, so every query returns the same cached body. |
| `POST https://scan.tokenx.finance/api/eth-rpc` (Blockscout JSON-RPC) | **Yes, primary** | `eth_getLogs` returns up to 1,000 logs per call. POST bypasses the CDN cache, so results are always fresh. The full history today is about 12 calls (~4s). |
| `https://api.tokenx.finance/rpc/v1` (node RPC, chain id 7777) | Partly | `eth_getLogs` is blocked. `eth_blockNumber` and `eth_getBlockByNumber` work and are used for the latest block timestamp. |

What the contract tells us:

- Voters call `vote(bytes32 _message, uint256 _amount)`, which pulls GE6 (ERC-20, 18 decimals, [`0x2f5c…5F1C`](https://scan.tokenx.finance/address/0x2f5c60bdE7A5ebD2b116BB03cB5232fA1Ea55F1C)) into the contract and emits:
  `Voted(address indexed _voter, uint256 indexed _index, uint256 _amount, bytes32 _hash)`
- `_index` is a **global, gap-free vote counter starting at 0**. The app uses it to dedupe, and to detect and refetch any vote that was missed.
- `_hash` is unique on every vote (a salted commitment). **The chain does not reveal which member a vote is for**, so only totals can be tracked. The UI says this explicitly.
- Token X is QBFT with an exact 3-second block time, so vote timestamps are derived from block numbers anchored to the latest block. This avoids one RPC call per block.
- Amounts can be fractional (e.g. 0.1 GE6).

## Architecture

```
Browser (polls every 30s while visible + active)
   │  GET /api/stats   ← Vercel CDN caches 20s (+60s stale-while-revalidate)
   ▼
Route handler (Fluid compute, region sin1)
   │  in-memory vote index per instance, synced at most every 10s:
   │    • warm: eth_blockNumber + eth_getBlockByNumber + eth_getLogs(since last block)
   │    • cold: completed 20k-block windows from `'use cache: remote'` + scan the open tail
   ▼
Blockscout /api/eth-rpc  +  Token X node RPC
```

- `src/lib/chain.ts`: RPC client, `Voted` log decoding, and pagination past the 1,000-log cap.
- `src/lib/tracker.ts`: sync engine (single-flight, stale-on-error), gap repair using `_index`, and snapshot aggregation in exact integer micro-GE6.
- `src/lib/windows.ts`: immutable history windows cached with `'use cache: remote'`, so a cold instance doesn't rescan the whole chain.
- `src/lib/initial.ts`: snapshot baked into the page HTML (ISR, regenerated at most every 2 minutes), so the first paint already has numbers.
- `src/app/api/stats`, `src/app/api/wallet/[address]`: JSON endpoints with `Vercel-CDN-Cache-Control`.
- `src/components/*`: the Thai UI. Charts are hand-rolled HTML/SVG, with no chart library.

## Update frequency vs. Vercel cost

The defaults are tuned so a busy election still fits the free tier for function usage. The thing to watch is **Edge Requests**.

| Cost driver | What drives it | Default | Rough monthly volume |
| --- | --- | --- | --- |
| Function invocations | CDN misses on `/api/stats` and page regeneration | CDN 20s + SWR 60s; ISR 120s | ≤ ~130k per active CDN region + ≤ ~22k ISR. Hobby includes 1M. |
| Active CPU | Re-aggregating when new votes arrive | Rebuild only on new votes or every 30s | Milliseconds per sync. Network waits aren't billed under Fluid compute. |
| Edge requests | **Every client poll**, even CDN hits | Poll 30s; pause when tab hidden or after 10 min idle | 120 per viewer-hour. ~1M on Hobby ≈ 8k viewer-hours; 10M on Pro ≈ 80k. |
| Data transfer | ~9 KB gzipped per poll; ~23 KB gzipped HTML | – | 1M polls ≈ 9 GB. Hobby includes 100 GB. |
| Upstream (Blockscout) | 2–3 small RPC calls per sync | ≤ 6 syncs/min per instance | Polite; no API key needed. |

If you outgrow the limits:

- **Fewer edge requests:** raise `NEXT_PUBLIC_POLL_INTERVAL_SEC` (60s halves them) or lower `NEXT_PUBLIC_IDLE_PAUSE_MIN`. Votes currently arrive about once a minute, so 60s still feels live.
- **Fresher numbers:** lower `STATS_CDN_MAX_AGE_SEC` in `src/lib/config.ts`. This costs more invocations, not more edge requests.
- Check current allowances in your Vercel dashboard (Usage tab). Hobby is for personal, non-commercial projects; use Pro for anything else.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. No API keys or database are needed.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel. Framework preset: Next.js, no build settings needed.
2. Optional: set `NEXT_PUBLIC_POLL_INTERVAL_SEC` / `NEXT_PUBLIC_IDLE_PAUSE_MIN` (see `.env.example`).
3. `vercel.json` pins functions to `sin1` (Singapore), close to Thai users and to the Token X explorer.
4. After the first deploy, open `/api/stats` once to warm the cache.

Or use the CLI:

```bash
npx vercel --prod
```

## Limitations

- **No per-member results.** Votes are hashed on-chain, so only official announcements can tell who received them.
- Numbers depend on Token X Scan being up. If it fails, the app keeps serving the last good data, and the status pill turns red.
- "Unique wallets" ≠ unique people; one fan can use several wallets.
- If Blockscout misses a block, the `_index` gap check refetches it within ~5 minutes. A warning banner shows while any votes are missing.
