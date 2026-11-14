# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[0.1.0]: https://github.com/vikramgorla/mcp-gifs/releases/tag/v0.1.0
