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
best effort. A denylist can both miss things and over-block (for example
"breast cancer awareness" is blocked in every mode).

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

## 5. Hosting: Cloudflare Workers free plan

**Decision.** Worker name `mcp-gifs`, deployed to the default
`https://mcp-gifs.<subdomain>.workers.dev` (`workers_dev: true`); the public
instance is <https://mcp-gifs.vikram-gorla.workers.dev/mcp>. No custom
domain or DNS changes.

**Why.** Free plan (100k requests/day), global, zero ops, and the bundle is
small (about 220 KB gzipped, well under the 3 MB free limit). Each request
makes at most 4 upstream subrequests (free limit: 50).

## 6. Rate limiting and caching

- **Per-IP limit**: Workers Rate Limiting binding `RATE_LIMITER`, 60 MCP POSTs
  per IP per 60 s per Cloudflare location (available on the free plan, counts
  are approximate). Over the limit: HTTP 429 with a JSON-RPC error and
  `Retry-After: 60`. IP is the only key available for a no-auth server.
- **Caching**: successful search results are cached in the Workers Cache API
  for 10 minutes (`CACHE_TTL_SECONDS`), keyed by normalised words, source,
  safety, limit and size cap. Partial results (a source failed or was skipped)
  are not cached. stdio uses an in-memory cache.
- **Upstream politeness**: Wikimedia User-Agent policy
  `mcp-gifs/<version> (https://github.com/vikramgorla/mcp-gifs)`, sequential
  requests (no fan-out), 8 s timeouts, one retry on 429/503 only when
  `Retry-After` is 2 s or less. After an Openverse failure the fallback is
  skipped for 60 s (or the 429 `Retry-After`, up to 10 min) per isolate.

## 7. Output shape

Each result has `url` (original GIF), `previewUrl` (Commons 320 px rendition,
which is the original for small files), `width`, `height`, `fileSizeBytes`,
`animated`, `frameCount`, `source`, `pageUrl`, `author`, `authorUrl`,
`license`, `licenseUrl`, `attributionRequired`, `attribution` and
`description`. `utm_*` tracking parameters added by Commons are stripped.
A `max_size_mb` cap (default 10) exists because Commons GIFs range from 1 KB to
over 40 MB.

## 8. Distribution

The package has a `bin` for local stdio use but is `private` and **not
published** to npm or any MCP registry in v0.1.0; that needs the owner's
explicit go-ahead.
