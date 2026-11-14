# Design decisions (v0.1.0)

Short records of the choices behind the first version, with the reasons.
Research and live checks were done on 2026-11-14.

## 1. GIF sources: Wikimedia Commons first, Openverse as fallback

**Decision.** Use the Wikimedia Commons Action API as the primary source and
Openverse as a fallback. Do not use Tenor, GIPHY or Klipy.

**Why.**
- The server must be public and need **no auth**, so sources must work without
  per-user keys and must allow a server to pass results on to other clients.
- **Wikimedia Commons**: no key, very large pool of freely licensed GIFs, rich
  per-file metadata (author, license, license URL, attribution flag,
  categories) and the actual frame count of each GIF.
- **Openverse**: no key for anonymous use, aggregates openly licensed media
  (many GIFs are themselves from Commons). Anonymous limits are low
  (about 20 requests/minute and 200/day) and uncached queries with
  `extension=gif` frequently returned **HTTP 504 after 8-15 s** during testing,
  so it is only a fallback.
- **Tenor**: its public API was shut down in June 2026.
- **GIPHY / Klipy**: their API terms forbid routing their API through a
  server/proxy like this one and mixing their results with other providers.
  They also require per-integration keys, which conflicts with "no auth".

**Trade-off.** Results are openly licensed and documentary/educational rather
than reaction-meme style. Queries like "facepalm" may return nothing.

## 2. Detecting animated GIFs

**Decision.** Query Commons with
`generator=search&gsrnamespace=6&gsrsearch=filemime:image/gif <words>` and
`prop=imageinfo&iiprop=url|size|mime|extmetadata|metadata&iiurlwidth=320`, then
keep only files whose `metadata.frameCount > 1`.

**Why.** Verified live: Commons' GIF handler reports `frameCount`, `looped` and
`duration` in `imageinfo` metadata. For "cat", 31 of the top 50 GIFs were
animated; for "rocket launch", 30 of 50. Restricting to
`incategory:Animated_GIF_files` gives 100% precision but misses many files that
are not categorised, so the frame count check is the reliable filter.
We fetch 4x the requested limit (20-50 candidates) to have enough after
filtering.

Commons search ANDs all words, so "happy dance" returned only 3 GIFs. When the
strict query yields fewer than `limit` animated results, one relaxed query
`filemime:image/gif (happy OR dance)` is run. User input is reduced to plain
words first so no CirrusSearch operators (e.g. `insource:`) can be injected.

Openverse does not expose animation. Openverse hits that are hosted on
`upload.wikimedia.org` are re-checked with one batched Commons `titles=` query;
single-frame files are dropped and the frame count is filled in. Other
Openverse hits are returned with `animated: null` ("not verified").

## 3. Safety

**Decision.** A `safety` parameter with `safe` (default) and `moderate`. There
is deliberately no unfiltered option.

- Openverse: `mature=true` is never sent (the API default excludes mature
  results), results with `mature: true` are always dropped, and results with
  `unstable__sensitivity` markers are dropped in `safe`.
- Both sources: a word-boundary keyword denylist is applied to the query
  (blocked queries make no upstream call) and to each result's title,
  description, categories (Commons) and tags (Openverse). `moderate` blocks
  sexual/explicit and hate terms; `safe` also blocks violence, gore, self-harm
  and hard-drug terms.

**Honesty note.** Wikimedia Commons has no official content rating, so this is
best effort. A denylist can both miss things and over-block. v0.1.1 allows a
small set of medical and food phrases (for example "breast cancer awareness",
"breastfeeding", "chicken breast") by masking them before the denylist runs;
standalone or sexual uses of the same words stay blocked.

## 4. Transport and SDK

**Decision.** Stateless MCP Streamable HTTP at `/mcp` using `createMcpHandler`
from **`@modelcontextprotocol/server` 2.4.0** (the v2 TypeScript SDK), plus a
stdio entry using `serveStdio` from `@modelcontextprotocol/server/stdio`.

**Why.**
- Checked on npm on 2026-11-14: `@modelcontextprotocol/server@2.4.0`
  (2026-10-23) implements the 2026-07-28 spec and ships `createMcpHandler`,
  a web-standard `{ fetch }` handler with a `workerd` build. It serves modern
  (2026-07-28) per-request traffic and, through its default
  `legacy: 'stateless'` mode, 2025-era clients. This covers today's clients
  (Claude Desktop, Cursor, MCP Inspector) without sessions.
- Cloudflare's `agents` package (0.33.0) also exports `createMcpHandler` from
  `agents/mcp`, built on the same SDK 2.4.0. It brings a much larger dependency
  tree (Durable Objects helpers, AI SDK peers) that a stateless, tool-only
  server does not need, so we use the SDK directly. `McpAgent` (Durable
  Object, stateful) is unnecessary here.
- Stateless means no Durable Objects, no session storage and it fits the
  Workers free plan. One HTTP request = one fresh server instance.
- Tool schemas are zod v4 (Standard Schema), which the SDK uses for both
  validation and the JSON Schema shown in `tools/list`.

## 5. Hosting: Vercel Hobby for the public instance (v0.2.0)

**Decision.** The public instance runs on **Vercel Hobby** (free) as an Edge
Function, at `https://gifs.vikram-gorla.com` (and the default
`*.vercel.app` URL). Cloudflare Workers remains a supported self-host
target (`src/worker.ts`, `wrangler.jsonc`) but is no longer the hosted
copy.

**Why we moved.** The Cloudflare account is on Workers Paid, which is
billed account-wide ($0.30 per extra million requests after the included
allowance). A busy or abused public MCP could have incurred charges on the
whole account. Vercel Hobby never bills: when included usage is exhausted
the project **pauses** until the next period. Hobby also includes a custom
domain (up to 50 per project) and one Firewall rate-limit rule with
1 million allowed requests/month.

**Why Edge, not Node.** The handler is already written against the Web
Fetch API (it ran on workerd). Edge avoids a full Node isolate and keeps
Active CPU use down on a plan that includes only 4 CPU-hours/month.

**What we did not do.** No Pro upgrade, no paid add-on, no extra domains
beyond `gifs.vikram-gorla.com`, and no Vercel Git auto-deploy (GitHub
Actions runs `vercel deploy` so a push is not deployed twice).

Hobby included usage (as documented by Vercel at the time of the move):
1 million function invocations, 1 million CDN requests, 4 CPU-hours,
360 GB-hours provisioned memory, 100 GB Fast Data Transfer, 10 GB Fast
Origin Transfer, 100 deployments/day, 1 concurrent build. Exceeding a
limit pauses that feature rather than starting a bill.

## 5a. Cloudflare Workers as a self-host option

The original Workers target is unchanged for people who want to deploy
their own copy to `workers.dev`. Worker name `mcp-gifs`,
`workers_dev: true`, no custom domain required.

## 6. Rate limiting and caching

- **Public instance (Vercel, v0.2.1):** the authoritative per-IP limit is
  the Vercel Firewall rule `mcp-rate-limit` (path prefix `/mcp`, fixed
  window of 60 s, 60 requests per IP, HTTP 429 when exceeded). It is
  included on Hobby (1 rule per project, 1 million allowed requests/month;
  counters are per region) and was added in the dashboard after the 0.2.0
  release. The Edge Function also has a best-effort in-memory safety net
  that is per isolate only (a global 600 / 60 s cap, configurable with
  `GLOBAL_RATE_LIMIT_PER_MINUTE`, then 60 / 60 s per IP, on POST `/mcp`).
  That in-memory global cap is **not** a cost control: Vercel Hobby cannot
  bill and pauses instead, so the Cloudflare-era 25 / 60 s Workers Paid
  allowance math does not apply here. 600 is high enough that many clients
  can each use their 60 / IP Firewall allowance on one isolate, and low
  enough to stop a single instance running away. Landing and `/health` are
  not capped. Over the limit: HTTP 429, JSON-RPC error, `Retry-After: 60`.
- **Self-host (Workers):** `RATE_LIMITER` (60 MCP POSTs / 60 s / IP) and
  `GLOBAL_RATE_LIMITER` (25 / 60 s, key `global`), both per Cloudflare
  location, as in v0.1.1.
- **Caching**: successful search results are cached for 10 minutes, keyed
  by normalised words, source, safety, limit and size cap. On Vercel this
  is an in-memory map (per isolate); on Workers it is the Cache API.
  `/` and `/health` also send `Cache-Control` so the CDN can reuse them.
  Partial results are not cached. stdio uses the in-memory cache.
- **Upstream politeness**: Wikimedia User-Agent policy
  `mcp-gifs/<version> (https://github.com/vikramgorla/mcp-gifs)`, sequential
  requests (no fan-out), 8 s Commons timeouts, one retry on 429/503 only when
  `Retry-After` is 2 s or less. Openverse is 2 s in `source=auto` (so a hang
  does not delay Commons results) and 8 s when requested explicitly. After an
  Openverse failure the fallback is skipped for 60 s (or the 429
  `Retry-After`, up to 10 min) per isolate.

## 7. Output shape

Each result has `url` (original GIF), `previewUrl` (a Commons `/thumb/`
rendition: 320 px when the original is wider, otherwise a strictly smaller
thumb so a narrow but long animation is not served as a multi-megabyte
preview), `width`, `height`, `fileSizeBytes`,
`animated`, `frameCount`, `source`, `pageUrl`, `author`, `authorUrl`,
`license`, `licenseUrl`, `attributionRequired`, `attribution` and
`description`. `utm_*` tracking parameters added by Commons are stripped.
A `max_size_mb` cap (default 10) exists because Commons GIFs range from 1 KB to
over 40 MB.

## 8. Distribution

The package has a `bin` for local stdio use but is `private` and **not
published** to npm or any MCP registry in v0.1.0; that needs the owner's
explicit go-ahead.
