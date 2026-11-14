# mcp-gifs

A public, **no-auth** [Model Context Protocol](https://modelcontextprotocol.io)
server that lets AI agents find **openly licensed animated GIFs** by keyword.
Agents call `search_gifs` with a few words and get back direct GIF URLs,
previews, dimensions, the license and a ready-made attribution line.

- **Sources:** [Wikimedia Commons](https://commons.wikimedia.org) (primary) and
  [Openverse](https://openverse.org) (fallback). No API keys anywhere.
- **Transports:** stateless Streamable HTTP at `/mcp` (Vercel Edge Function) and
  stdio for local use.
- **Safety filter on by default.** Results are openly licensed, so they skew
  documentary/educational rather than reaction memes.

> **Public endpoint:** `https://gifs.vikram-gorla.com/mcp`
> (no auth, no API key; landing page at <https://gifs.vikram-gorla.com/>,
> health check at `/health`). Hosted on Vercel Hobby. To run your own copy,
> see [Self-host / deploy](#self-host--deploy).

## Connect

### Remote (Streamable HTTP)

**Cursor**: `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "gifs": { "url": "https://gifs.vikram-gorla.com/mcp" }
  }
}
```

**Claude Desktop / claude.ai**: Settings → Connectors → *Add custom connector*,
paste the `/mcp` URL. No OAuth is needed. On older Claude Desktop builds without
custom connectors, bridge through stdio with
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "gifs": { "command": "npx", "args": ["-y", "mcp-remote", "https://gifs.vikram-gorla.com/mcp"] }
  }
}
```

**Claude Code**: `claude mcp add --transport http gifs https://gifs.vikram-gorla.com/mcp`

**VS Code**: `.vscode/mcp.json`:

```json
{ "servers": { "gifs": { "type": "http", "url": "https://gifs.vikram-gorla.com/mcp" } } }
```

**Anything else**: any client that speaks MCP Streamable HTTP. The server is
stateless: no session id, no auth header. Try it with the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):
`npx @modelcontextprotocol/inspector` → transport *Streamable HTTP* → the URL.

### Local (stdio)

The package is not published to npm. Run it from a checkout (Node 20+):

```bash
git clone https://github.com/vikramgorla/mcp-gifs && cd mcp-gifs
npm ci && npm run build
```

```json
{
  "mcpServers": {
    "gifs": { "command": "node", "args": ["/absolute/path/to/mcp-gifs/dist/stdio.js"] }
  }
}
```

This config works in Claude Desktop (`claude_desktop_config.json`), Cursor and
other stdio clients. The stdio server calls Commons/Openverse directly from
your machine.

## Tools

### `search_gifs`

| Argument      | Type                                   | Default  | Notes |
|---------------|----------------------------------------|----------|-------|
| `query`       | string (1-200 chars)                   | required | Keywords, e.g. `cat`, `rocket launch`. English works best. |
| `limit`       | integer 1-25                           | `8`      | Maximum results. |
| `safety`      | `safe` \| `moderate`                   | `safe`   | See [Safety](#safety). No unfiltered mode. |
| `source`      | `auto` \| `wikimedia` \| `openverse`   | `auto`   | `auto` = Commons first, Openverse fills gaps. |
| `max_size_mb` | number 0.1-100                         | `10`     | Skip larger files (Commons GIFs range from 1 KB to 40+ MB). |

Returns `structuredContent` plus a readable markdown summary. Real output for
`{"query": "rocket launch", "limit": 2}` (2026-11-14):

```json
{
  "query": "rocket launch",
  "safety": "safe",
  "count": 2,
  "results": [
    {
      "id": "wikimedia:File:Rocket Launch (2).gif",
      "title": "Rocket Launch (2)",
      "url": "https://upload.wikimedia.org/wikipedia/commons/7/71/Rocket_Launch_%282%29.gif",
      "previewUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rocket_Launch_%282%29.gif/240px-Rocket_Launch_%282%29.gif",
      "width": 270,
      "height": 270,
      "fileSizeBytes": 6264294,
      "animated": true,
      "frameCount": 150,
      "source": "wikimedia-commons",
      "pageUrl": "https://commons.wikimedia.org/wiki/File:Rocket_Launch_(2).gif",
      "author": "Glosome",
      "authorUrl": "https://commons.wikimedia.org/wiki/User:Glosome",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "attributionRequired": true,
      "attribution": "\"Rocket Launch (2)\" by Glosome, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0), via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Rocket_Launch_(2).gif",
      "description": "A model rocket launching in slow-motion."
    },
    {
      "id": "wikimedia:File:Rocket Launch (3).gif",
      "title": "Rocket Launch (3)",
      "url": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Rocket_Launch_%283%29.gif",
      "...": "..."
    }
  ],
  "sourcesQueried": ["wikimedia-commons"],
  "notes": []
}
```

The text content for the same call looks like:

```text
Found 2 GIFs for "rocket launch" (safety: safe; sources: wikimedia-commons).

1. **Rocket Launch (2)**
   - GIF: https://upload.wikimedia.org/wikipedia/commons/7/71/Rocket_Launch_%282%29.gif
   - Preview: https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rocket_Launch_%282%29.gif/240px-Rocket_Launch_%282%29.gif
   - 270×270, 6.0 MB, animated, 150 frames; source: wikimedia-commons
   - License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) (attribution required)
   - Attribution: "Rocket Launch (2)" by Glosome, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0), via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Rocket_Launch_(2).gif
   - id: `wikimedia:File:Rocket Launch (2).gif`
...
```

Field notes:
- `animated: true` means the Commons frame count is above 1. `null` means the
  source cannot tell us (non-Commons Openverse results).
- `previewUrl` is a reduced Commons thumbnail: about 320 px wide when the
  original is larger, or a smaller `/thumb/` rendition (for example 240 px)
  when the original is already narrower than 320 px, so a long animation that
  is only a few hundred pixels wide is not served as a multi-megabyte preview.
- `notes` explains fallbacks, blocked queries and upstream problems.

### `get_gif`

| Argument | Type   | Default  | Notes |
|----------|--------|----------|-------|
| `id`     | string | required | An `id` from `search_gifs`, e.g. `wikimedia:File:Spinning Dancer.gif` or `openverse:<uuid>`. |
| `safety` | `safe` \| `moderate` | `safe` | |

Returns `{ "found": boolean, "gif": <same shape as above> | null }`.

## Attribution and licensing: your responsibility

This server does **not** host or relicense anything. Every GIF stays under its
own license, which is usually Creative Commons (BY, BY-SA), CC0 or public
domain. When you show a GIF:

- Show the `attribution` string (or equivalent: title, author, license with
  link, and source page) next to it. It is pre-built in the
  [TASL](https://wiki.creativecommons.org/wiki/Best_practices_for_attribution)
  style recommended by Creative Commons and Wikimedia.
- Keep the license link. For **BY-SA** files, adaptations must be shared under
  the same license. If you modify a GIF (crop, resize, caption), say so.
- `attributionRequired: false` (e.g. CC0/public domain) means credit is not
  legally required, but it is still good practice.
- Check `pageUrl` for the authoritative license; metadata can be imperfect.
  Some files carry extra restrictions such as trademarks or personality rights.
- See Wikimedia's guide:
  [Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).

**Made with [Openverse](https://openverse.org), not endorsed by Openverse.**
Not affiliated with or endorsed by the Wikimedia Foundation. GIF files are
loaded directly from the original hosts (mostly `upload.wikimedia.org`).

## Safety

- `safe` (default) and `moderate` are the only modes; there is no unfiltered option.
- Queries containing blocked terms are refused before any upstream call.
- Results are dropped when their title, description, categories (Commons) or
  tags (Openverse) contain blocked terms. `moderate` blocks sexual/explicit and
  hate content; `safe` also blocks violence, gore, self-harm and hard drugs.
- Openverse is never asked for mature content, and results flagged
  `mature` (always) or sensitive (`safe` mode) are dropped.
- Medical and food phrases that contain an otherwise blocked word (for
  example "breast cancer", "breastfeeding", "chicken breast") are allowed.
  The same words used alone, or next to other blocked terms, are still
  refused.
- **Best effort only.** Wikimedia Commons has no official content rating, so
  filtering relies on keywords. It can miss things and can over-block. Please
  [open an issue](https://github.com/vikramgorla/mcp-gifs/issues) for misses.

## Rate limits

- Hosted endpoint: a **server-wide cap of 25 MCP requests per minute** (checked
  first, per isolate) and about **60 MCP requests per minute per IP**. The
  public Vercel instance enforces these in memory (best-effort, per instance)
  and with one Vercel Firewall rate-limit rule (free on Hobby: 1 rule and
  1 million allowed requests/month included). Both return HTTP 429 with
  `Retry-After: 60`. A self-hosted Cloudflare Worker can use the
  `RATE_LIMITER` and `GLOBAL_RATE_LIMITER` bindings instead.
- Results are cached for 10 minutes, so repeated searches are cheap.
- Upstream: Commons is queried sequentially with a descriptive User-Agent
  (`mcp-gifs/<version> (https://github.com/vikramgorla/mcp-gifs)`) and
  `Retry-After` is respected. Anonymous Openverse is limited to about 20
  requests/minute and 200/day per server IP and often returns 504s, so it is
  only a fallback: in `source=auto` it is given a 2 s timeout (8 s when
  Openverse is requested explicitly) and pauses for 60 s after a failure.

## Self-host / deploy

The public instance is on **Vercel Hobby**. That plan is free and **pauses**
when included usage is exhausted; it does not start billing. Requirements to
run your own copy: Node 20+, and either a Vercel Hobby account or a
Cloudflare account.

### Vercel (how the public instance is hosted)

```bash
npm ci
npm test
npx vercel login              # once, on a Hobby (free) team
npx vercel                    # preview
npx vercel --prod             # production, default *.vercel.app URL
```

`api/index.ts` is an Edge Function that reuses the shared HTTP core
(`src/app.ts`) and serves `/`, `/health` and `/mcp`. `vercel.json` rewrites
those paths to the function. CI deploys through GitHub Actions with the
Vercel CLI (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repository
secrets). Vercel's own Git auto-deploy is not used, so a push does not
deploy twice.

### Cloudflare Workers (optional self-host)

```bash
npm ci
npm test
npm run dev                   # wrangler dev on http://localhost:8787 (/, /health, /mcp)
npx wrangler login            # once
npm run deploy                # wrangler deploy → https://mcp-gifs.<subdomain>.workers.dev
```

`wrangler.jsonc` deploys only to the default `workers.dev` URL. It uses:

- `RATE_LIMITER`: Workers Rate Limiting binding (60 requests / 60 s / IP).
  Change `namespace_id` if `4711` clashes with another binding in your account,
  or remove the block to disable rate limiting.
- `GLOBAL_RATE_LIMITER`: 25 requests / 60 s on a constant `global` key.
- `CACHE_TTL_SECONDS`: result cache TTL (default `600`).

Quick manual check against a running server:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_gifs","arguments":{"query":"cat","limit":2}}}'
```

## Development

```bash
npm run typecheck && npm run lint && npm test
npm run smoke                                       # live APIs + stdio (not in CI)
MCP_URL=http://localhost:8787/mcp npm run smoke     # also test an HTTP endpoint
npm run stdio                                       # run the stdio server from source
```

Layout: `src/sources/` (Commons and Openverse clients and mapping),
`src/search.ts` (fallback, de-duplication, caching), `src/safety.ts`,
`src/server.ts` (MCP tools), `src/app.ts` (shared HTTP), `src/vercel.ts` /
`api/index.ts` (Vercel Edge entry), `src/worker.ts` (Workers self-host entry), `src/stdio.ts`.
Design rationale: [docs/DECISIONS.md](docs/DECISIONS.md).

## License

[MIT](LICENSE) for the code. GIFs returned by the server keep their own licenses.
