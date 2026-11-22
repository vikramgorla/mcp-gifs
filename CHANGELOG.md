# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-11-22

### Changed
- Tool results (`structuredContent`) carry each GIF as a schema.org
  `ImageObject`: `identifier`, `name`, `description`, `contentUrl`,
  `encodingFormat`, `thumbnailUrl`, `encoding` (MP4 and WebP renditions as
  `MediaObject`s), `width`, `height`, `contentSize`, `url` (the provider's
  page), `creator`, `creditText`, `copyrightNotice`, `license` (a
  `CreativeWork` with name and link), `acquireLicensePage`, `provider` and
  `isAccessibleForFree`, plus `animated` and `frameCount`. Replaces `id`,
  `title`, `url`, `previewUrl`, `mp4Url`, `webpUrl`, `fileSizeBytes`,
  `source`, `pageUrl`, `author`, `authorUrl`, `licenseUrl`, the plain-text
  `license`, `attributionRequired` and `attribution` (`creditText` is the
  credit to show; absent means none is required). Breaking for structured
  clients; the text content is unchanged.

## [0.4.0] - 2026-11-22

### Added
- Every result has `creditText` (schema.org, the IPTC "Credit Line"): the
  credit without the GIF's title or link. KLIPY results: "Powered by KLIPY";
  openly licensed files: author and license when attribution is required,
  empty otherwise. Clients such as chat bots can show the credit in their own
  UI instead of in every message, and tell a platform credit (the same for
  every result) from a work's own credit. `attribution` is unchanged.

## [0.3.1] - 2026-11-16

### Changed
- Following KLIPY's feedback, caching of KLIPY responses now follows KLIPY's
  response headers (`Cache-Control` `s-maxage`/`max-age` minus `Age`, else
  `Expires`) instead of a fixed 10-minute (search) / 5-minute (trending)
  cache. `no-store`, `no-cache`, `private` or no freshness headers mean no
  caching. An open-licence fallback after a KLIPY miss is cached no longer
  than KLIPY's response allows. `CACHE_TTL_SECONDS` now applies only to
  open-licence results.
- The text summary agents read now ends with "show Powered by KLIPY, keep
  this order and load each GIF from the URL given" for KLIPY results.
- `docs/KLIPY.md` records KLIPY's feedback and how each point is met.
- README redesigned to match the homepage: sticker-style banner (light and
  dark), badges, a homepage screenshot, quick setup per client, a tools
  overview, and friendlier section names. Reference details moved into
  expandable sections.
- Docs, decision record and package keywords present KLIPY as the primary
  GIF search provider. The KLIPY key is held only by the server operator;
  end users still need no auth. If no key is set, search uses Wikimedia
  Commons and Openverse only. Decision 9 notes that written approval for
  server-side use and a production key have been requested from KLIPY
  (2026-11-16).

## [0.3.0] - 2026-11-16

### Changed
- GIF search is powered by KLIPY on the public instance (`KLIPY_API_KEY` is
  set through a GitHub Actions secret).
- KLIPY results are no longer filtered or trimmed locally, to follow KLIPY's
  integration requirements: they keep KLIPY's order and composition, the
  keyword denylist no longer runs on KLIPY titles/tags (it still runs on the
  query), and a size cap picks a smaller rendition instead of dropping a GIF.
  Content filtering for KLIPY is its `rating` parameter and Partner Panel.
- KLIPY attribution line is now `"<title>" · Powered by KLIPY · <page>`, and
  every KLIPY response's `notes` spell out KLIPY's display rules for agents.
- New playful landing page in a sticker-sheet style: a live GIF picker with
  a "Search KLIPY" box and "Powered by KLIPY" under it, example-search
  stickers, client setup tabs, tool cards and source credits. Light and dark
  themes, mobile first (no sideways scrolling down to 320 px wide), keyboard
  accessible, honours reduced motion. Uses the self-hosted Bricolage
  Grotesque font (SIL OFL), served at `/assets/bricolage-v1.woff2`.
- Docs: README rewritten around KLIPY; new `docs/KLIPY.md` maps each KLIPY
  requirement to code and tests and drafts the approval request.

### Fixed
- KLIPY test keys are limited to 100 calls per hour (docs said per minute).

### Added (merged in #6)
- Optional KLIPY provider for the reaction/meme GIFs chat apps show. Enabled
  by setting `KLIPY_API_KEY` (stdio env, Vercel env var or Workers secret);
  without it nothing changes.
  - `search_gifs` `source: auto` tries KLIPY first and returns only KLIPY
    results when it has matches, falling back to Commons/Openverse otherwise.
    New `source: klipy` and `locale` arguments.
  - New `trending_gifs` tool, registered only when KLIPY is configured.
  - `get_gif` accepts `klipy:<slug>` ids.
  - Results may include `mp4Url` and `webpUrl`.
  - `safety` maps to KLIPY's rating (`safe` → G, `moderate` → PG-13) on top
    of the keyword filter; KLIPY ads are filtered out and no `customer_id`
    is sent.

## [0.2.1] - 2026-11-14

### Changed
- In-memory rate limits on the Vercel entry are off by default. Set
  `RATE_LIMIT_PER_IP` and/or `RATE_LIMIT_GLOBAL` (requests per 60 s) to
  opt in; unset or 0 disables them. The public Vercel deployment does not
  set these variables. The only limit there is the Vercel Firewall rule
  `mcp-rate-limit` (path prefix `/mcp`, fixed window of 60 s, 60 requests
  per IP, HTTP 429 when exceeded), which was added in the dashboard after
  0.2.0. Self-hosters on other platforms can enable the env limits.

## [0.2.0] - 2026-11-14

### Changed
- The public instance now runs on Vercel Hobby (free) at
  `https://gifs.vikram-gorla.com/mcp`. Hobby pauses when included usage is
  exhausted instead of billing; the previous Cloudflare Workers host was on
  an account-wide paid plan. Cloudflare Workers remains a supported
  self-host option (`wrangler deploy`).
- Rate limiting on the public instance is a best-effort in-memory limiter
  (25 requests / 60 s server-wide per isolate, 60 / 60 s per IP). A Vercel
  Firewall rate-limit rule was intended but could not be created via the
  API at release time; it was added in the dashboard shortly after as
  `mcp-rate-limit` (see 0.2.1). Search results stay cached in memory for
  10 minutes; `/` and `/health` send CDN cache headers.

### Added
- Vercel Edge Function entry (`api/index.ts` / `src/vercel.ts`) serving the
  same `/mcp`, `/` and `/health` routes from the shared HTTP core.
- GitHub Actions: CI on pull requests, preview deploys on PRs, and
  production deploys on pushes to `main` and on version tags, using the
  Vercel CLI (Vercel's own Git auto-deploy is left off to avoid double
  deploys).

## [0.1.1] - 2026-11-14

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

[0.2.1]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.2.1
[0.2.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.2.0
[0.1.1]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.1.1
[0.1.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.1.0
