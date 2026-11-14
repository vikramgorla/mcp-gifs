# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-14

### Changed
- The public instance now runs on Vercel Hobby (free) at
  `https://gifs.vikram-gorla.com/mcp`. Hobby pauses when included usage is
  exhausted instead of billing; the previous Cloudflare Workers host was on
  an account-wide paid plan. Cloudflare Workers remains a supported
  self-host option (`wrangler deploy`).
- Rate limiting on the public instance is a best-effort in-memory limiter
  (25 requests / 60 s server-wide per isolate, 60 / 60 s per IP) plus one
  Vercel Firewall rate-limit rule (free on Hobby: 1 rule and 1 million
  allowed requests/month included). Search results stay cached in memory
  for 10 minutes; `/` and `/health` send CDN cache headers.

### Added
- Vercel Edge Function entry (`api/index.ts` / `src/vercel.ts`) serving the
  same `/mcp`, `/` and `/health` routes from the shared HTTP core.
- GitHub Actions: CI on pull requests, preview deploys on PRs, and
  production deploys on pushes to `main` and on version tags, using the
  Vercel CLI (Vercel's own Git auto-deploy is left off to avoid double
  deploys).

[0.2.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.2.0

### Fixed
- Safety filter no longer blocks harmless medical and food phrases that
  contain a denylisted word (for example "breast cancer", "breastfeeding",
  "chicken breast"). Word-boundary matching is unchanged, and the same words
  used alone or next to other blocked terms are still refused, so the safe
  default is not weakened.
- Commons previews for GIFs narrower than 320 px now use a real reduced
  `/thumb/` rendition (for example 240 px for a 270 px original) instead of
  the full original, which could be many megabytes.
- In `source=auto`, the Openverse fallback times out after 2 s instead of 8 s
  so a slow or hanging Openverse does not delay Commons results. The circuit
  breaker still trips on that timeout. Explicit `source=openverse` keeps the
  8 s budget.

### Added
- Server-wide MCP rate cap (`GLOBAL_RATE_LIMITER`, 25 requests per 60 s on a
  constant `global` key, checked before the per-IP limiter) so this Worker
  stays within the included 10 million requests/month on Workers Paid.
  Binding counts are per Cloudflare location; 25 is a conservative value
  for that. No account spending limits were changed.

### Changed
- README: public endpoint is now live at
  `https://mcp-gifs.vikram-gorla.workers.dev/mcp` (Cloudflare Workers free plan).

## [0.1.0] - 2026-11-14

### Added
- `search_gifs` tool: keyword search for openly licensed **animated** GIFs with
  direct URL, preview URL, dimensions, file size, frame count, source, landing
  page, author, license (+ URL) and a ready-made attribution line. Returns both
  `structuredContent` and readable markdown.
- `get_gif` tool: re-fetch one GIF by the id returned from `search_gifs`.
- Wikimedia Commons as primary source (no key), animation verified through
  `imageinfo` `frameCount` metadata.
- Openverse as fallback source (no key), mature results never requested and
  always dropped; Commons-hosted Openverse hits are re-checked for animation.
- Best-effort `safety` filter (`safe` default, `moderate`), applied to queries
  and to result titles, descriptions and categories.
- `max_size_mb` cap (default 10 MB).
- Stateless Streamable HTTP endpoint at `/mcp` for Cloudflare Workers, plus a
  landing page at `/` and `/health`.
- stdio entry point (`mcp-gifs` bin) for local clients.
- Per-IP rate limiting (Workers Rate Limiting binding), Cache API caching of
  upstream results (10 min), polite upstream handling (User-Agent, timeouts,
  `Retry-After`, Openverse cool-down after failures).
- Unit tests with mocked upstreams, live smoke script, GitHub Actions CI.

[0.2.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.2.0
[0.1.1]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.1.1
[0.1.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.1.0
