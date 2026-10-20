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
Browser (polls every 60s for the first 5 min of a visit; rate set by TRAFFIC_MODE)
   │  GET /api/stats   ← Vercel CDN caches 30s (+90s stale-while-revalidate)
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
- `src/lib/initial.ts`: snapshot baked into the page HTML (ISR, regenerated at most once a minute), so the first paint already has numbers.
- `src/app/api/stats`, `src/app/api/wallet/[address]`: JSON endpoints with `Vercel-CDN-Cache-Control`.
- `src/components/*`: the Thai UI. Charts are hand-rolled HTML/SVG, with no chart library.

## Past elections → GE6 (`/ge3`, `/ge4`, `/ge5`, `/compare`)

Each page lists the 300 wallets that voted the most in that election (GE3, GE4 or GE5). Each row
shows the wallet's past total next to its GE6 total so far (0 if it hasn't voted yet), plus the
member it voted for most back then and an expandable top 3. Tap the column headers to sort,
filter by "voted in GE6 yet", or filter by member. A switch at the top moves between GE3, GE4 and
GE5. GE6 votes are hashed on-chain, so GE6 shows token totals only, not who they voted for.

`/compare` puts GE3–GE6 side by side (newest first): total tokens, wallets, votes, average/median
per wallet, concentration (Top 10 share, wallets making up half the tokens), the #1 member; one
wallet table combining every election's top 300 with GE6 / GE5 / GE4 / GE3 amounts in columns
(sortable, filterable, tap a row for each election's rank and top member); how many wallets
came back in the next election (GE5 → GE6 live), new wallets per election, wallets that voted in
every one, and each member's rank in GE3–GE5. Members are matched across elections by exact
nickname; GE4 lists nicknames only, so its "Pim" is kept separate from GE3's two Pims.

- The past data is static, generated by one script from each election's export CSV into
  `src/data/<edition>-top.json` (top 300) and `src/data/<edition>-summary.json` (stats, member
  totals, and every voting wallet with its total, for ranks and overlap counts). Both formats are handled: GE3/GE4's
  raw vote lists (one row per vote, amounts in wei, divided by 10^18) and GE5's wallet × member
  totals (amounts already in tokens). Amounts are summed exactly as 18-decimal integers. Only
  addresses, totals, and member names are kept; wallet codes and vote keys/hashes are dropped,
  and the raw CSVs are git-ignored. Wallets tied at the cutoff are all kept. To regenerate
  (change `TOP_N` in `scripts/build-past-ge-data.mjs` for a different size):

  ```bash
  npm run data:all
  ```

  Or one at a time with a custom path:

  ```bash
  npm run data:ge4 -- path/to/ge4_result.csv
  ```

  ```bash
  npm run data:ge5 -- path/to/ge5_voters.csv
  ```

- The GE6 side is joined on the server from the live tracker. The pages are prerendered and
  regenerated in the background at most every 2 minutes. They have no client polling, so a
  view costs about the same as a static page.

## Staying on the Vercel Hobby (free) plan

Hobby includes per month (as of Sept 2026): **1M CDN requests**, 100 GB Fast Data Transfer,
10 GB Fast Origin Transfer, 1M function invocations, 4 h Active CPU. Sustained overage can get
the project **paused** (unpausing is manual), so the app is built around the scarcest one:
**CDN requests**. Every request to the site counts, even when it's served from cache.

What one viewer costs:

| | CDN requests | Notes |
| --- | --- | --- |
| First visit | ~11 | HTML (data + CSS inlined), 6 JS chunks, 2 font files, illustrations, favicon |
| Returning visit | ~2 | JS/fonts are immutable and stay in the browser cache |
| Auto-refresh, `normal` mode | ≤ 5 | One poll per minute for the first 5 minutes, then it stops |
| Auto-refresh, `busy` mode | ≤ 2 | One poll every 2 minutes for the first 3 minutes |
| Auto-refresh, `surge` mode | 0 | Off; viewers tap the status pill |
| Each "continue" tap | 1 + another window | Tapping the status pill refreshes and restarts the window |

Auto-refresh is a fixed window per visit, not "while active": scrolling doesn't extend it, so a
tab someone forgets to close costs at most ~5 requests. Polling also stops while the tab is hidden.

Rough monthly budget: 1M ÷ (11 + 5 polls) ≈ **60k new visitors** in `normal` mode,
≈ 75k in `busy`, ≈ 85k in `surge` (fewer if many viewers keep tapping to continue). Bandwidth (~8 KB per poll, ~250 KB per
first visit) and function invocations stay far below their limits at those numbers.

### Turning the dial during a traffic spike

Set `TRAFFIC_MODE` in Vercel → Project → Settings → Environment Variables, then redeploy
(Deployments → ⋯ → Redeploy). The poll policy rides inside every `/api/stats` response, so
**tabs that are already open pick it up too**, on their next poll.

| `TRAFFIC_MODE` | Poll | Auto-refresh window | Use when |
| --- | --- | --- | --- |
| `normal` (default) | 60 s | 5 min | Daily CDN requests under ~30k (1M ÷ 30 days) |
| `busy` | 120 s | 3 min | You're trending over budget |
| `surge` | off (tap to refresh) | – | A viral spike / announcement night |

`POLL_INTERVAL_SEC` and `AUTO_REFRESH_MIN` override the preset (`POLL_INTERVAL_SEC=0` = manual only).
Watch **Usage → CDN Requests** in the Vercel dashboard daily while voting is open.

### Where the savings come from

- **The CDN absorbs the crowd.** `/api/stats` is cached at Vercel's CDN for 30 s (+ stale-while-revalidate),
  so the function runs about twice a minute per region no matter how many viewers there are.
  The page HTML is ISR, regenerated at most once a minute.
- **No request on page load.** The HTML already contains a snapshot that's under a minute old,
  so a new tab waits for its first scheduled poll instead of fetching immediately.
- **Fewer files per first visit:** one variable font (2 files instead of 8), CSS inlined into the HTML,
  and the header logo as inline SVG. A first visit went from ~20 requests to ~11.
- **Small payloads:** numbers rounded to what the UI shows, unused fields dropped (~8 KB gzipped per poll).
- **Browser cache:** `/api/stats` may be reused for 10 s, so reloads, double taps, and multiple tabs are free.
- **Cheap compute:** aggregates are rebuilt only when new votes arrive; network waits aren't billed as Active CPU.

### If it's still not enough

Put the site behind **Cloudflare's free plan** on a custom domain with a cache rule for `/` and
`/api/stats` (respecting origin `Cache-Control`). Cloudflare then serves most requests and
Vercel only sees cache misses — typically a >90% cut in Vercel CDN requests, at zero cost.
Hobby is also for non-commercial use only; anything commercial needs Pro.

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
2. Optional: set `TRAFFIC_MODE` (see `.env.example` and the section above).
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
