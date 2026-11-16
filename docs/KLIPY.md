# KLIPY integration: how mcp-gifs follows KLIPY's requirements

mcp-gifs is an open-source [Model Context Protocol](https://modelcontextprotocol.io)
server. AI assistants (Claude, Cursor, VS Code and other MCP clients) call it
to find GIFs for a conversation. **GIF search is powered by KLIPY.** The public
instance runs at <https://gifs.vikram-gorla.com> (MCP endpoint `/mcp`).

This page maps each KLIPY requirement to where mcp-gifs meets it, so it can be
checked in the code and on the live site. Sources for the requirements:
KLIPY's [API Attribution & Usage Guidelines](https://docs.klipy.com/attribution),
[Integration Requirements](https://docs.klipy.com/integration-requirements),
[API overview](https://klipy.com/api-overview) and
[Terms of Service](https://klipy.com/support/terms-services).

## Requirements and evidence

| KLIPY requirement | How mcp-gifs meets it | Evidence |
|---|---|---|
| GIF search field placeholder reads **"Search KLIPY"** | The search box on the landing page uses the placeholder "Search KLIPY" (and the same text as its accessible label). MCP clients render their own UI, so the server tells agents that any search box for KLIPY results must read "Search KLIPY" (server instructions and every KLIPY result `notes`). | `src/landing.ts` (`placeholder`), `src/search.ts` (`KLIPY_NOTE`), `src/server.ts` (`instructions`) |
| Show **"Powered by KLIPY"** | Directly under the landing-page search box (linked to klipy.com), in the credits section and in the footer. Every KLIPY result's `attribution` field contains "Powered by KLIPY", and the result `notes` and tool descriptions instruct agents to show it with the GIFs. | `src/landing.ts`, `src/sources/klipy.ts` (`mapKlipy`), `tests/klipy.test.ts` |
| Display Search and Trending results in the sequence and composition KLIPY provides; no reordering, inserting, removing, suppressing, replacing or filtering | Results are taken from KLIPY's list in order (first `limit` items). No keyword filter, ranking or deduplication runs on KLIPY results. If a size cap rules out larger renditions, the smallest rendition is used rather than dropping the item. The landing page lays tiles out left to right in the returned order. | `src/sources/klipy.ts` (`collect`, `pickRendition`), test "keeps KLIPY's order and does not filter its results" |
| Filtering only through KLIPY (rating / Partner Panel) | `safety=safe` sends `rating=g`, `safety=moderate` sends `rating=pg-13`. Partner Panel content filters apply on KLIPY's side. The only local check is on the **query**: clearly unsafe queries are refused before any request is made. | `src/sources/klipy.ts` (`klipyRating`), `src/search.ts` |
| Do not blend KLIPY media with another provider's content in the same result set | A response contains KLIPY results only, or (when KLIPY has no match or is unavailable) open-licence results only. Never both. | `src/search.ts` (`searchGifs`), test "falls back to Commons when KLIPY has no matches or is down, never mixing" |
| Load media directly; do not store, mirror, re-host or rewrite KLIPY media | mcp-gifs never downloads media. Results contain KLIPY's own media URLs (GIF, MP4, WebP renditions) and clients load them from KLIPY. The landing page `<img>` tags point straight at KLIPY's URLs. | `src/sources/klipy.ts`, `src/landing.ts` |
| Keep the API key private | The key is read only from the server environment (`KLIPY_API_KEY`: GitHub Actions secret → Vercel env). It is never accepted from clients and never appears in errors, notes or logs (errors carry only the HTTP status). | `src/sources/klipy.ts`, test asserting the key is absent from notes |
| Ads | Ads are not used. No `customer_id` is sent, so KLIPY returns no ad items. | `src/sources/klipy.ts` |
| Do not remove or obscure KLIPY notices; no use of KLIPY marks beyond attribution | KLIPY's name is used only for attribution ("Powered by KLIPY", "Search KLIPY"). mcp-gifs does not frame KLIPY pages or imitate KLIPY's design. | `src/landing.ts` |

## Server-side requests (needs KLIPY's written approval)

KLIPY's integration requirements expect API calls from the end user's device
and ask partners to get **written approval** for server-side requests and
caching. An MCP server is server-side by design: the AI client calls
mcp-gifs, and mcp-gifs calls KLIPY. What it does:

- Calls `api.klipy.com` from Vercel Edge Functions (and from a user's own
  machine when run locally over stdio).
- Caches **API responses** (JSON metadata) in memory for 10 minutes (search)
  and 5 minutes (trending) per server instance to stay within limits.
  **Media is never cached, proxied or re-hosted.**
- Sends no user identifiers, so end users' IP addresses and identities never
  reach KLIPY.

The request for written approval is below. If KLIPY prefers, the response
cache can be shortened or switched off.

## Email to KLIPY (draft)

To: developers@klipy.com
Subject: Written approval request: mcp-gifs (MCP server for AI assistants) using KLIPY server-side

> Hello KLIPY team,
>
> I run mcp-gifs, an open-source MCP (Model Context Protocol) server that lets
> AI assistants such as Claude, Cursor and VS Code search GIFs during a
> conversation. GIF search is powered by KLIPY.
>
> - Live site with a "Search KLIPY" demo: https://gifs.vikram-gorla.com
> - Source: https://github.com/vikramgorla/mcp-gifs
> - How we follow your guidelines: https://github.com/vikramgorla/mcp-gifs/blob/main/docs/KLIPY.md
>
> Because MCP servers are called by AI clients rather than by a phone or
> browser app, our calls to api.klipy.com are server-side. We would like your
> written approval for this setup:
>
> - Results are returned in your order, unfiltered, and never mixed with
>   other providers. Filtering uses your `rating` parameter and the Partner
>   Panel.
> - Media is always loaded directly from your URLs; we never store, proxy or
>   re-host it.
> - We cache API responses (metadata only) for up to 10 minutes to stay
>   within limits, and can shorten or remove this if you prefer.
> - "Powered by KLIPY" is shown on the site and included in every KLIPY
>   result, and agents are told to display it. Our search box reads
>   "Search KLIPY".
> - No user identifiers are sent, and ads are not requested.
>
> I would also like to request a production key for this integration. If you
> need anything changed, I'm happy to do it.
>
> Thank you,
> Vikram Gorla

## Production key request (Partner Panel)

KLIPY's Partner Panel asks for the app category, estimated monthly active
users and a screen recording of the integration.

- **App category:** Developer tools / AI assistant integration (MCP server).
- **Estimated MAU:** fill in from Vercel analytics or `/mcp` request logs;
  traffic is capped at 60 requests per minute per IP by the Vercel Firewall.
- **Screen recording:** record <https://gifs.vikram-gorla.com>: type in the
  "Search KLIPY" box, show "Powered by KLIPY" under it, show the results in
  KLIPY's order, then show an AI client (for example Claude) using
  `search_gifs` and displaying a GIF with "Powered by KLIPY".

## Still to confirm with KLIPY

- The full attribution kit. The site currently uses a text "Powered by KLIPY"
  credit. If KLIPY wants the official logo or a watermark, add the assets
  from KLIPY's kit to `public/` and reference them in `src/landing.ts`; do not
  redraw them.
- The link format for a single GIF page. `pageUrl` assumes
  `https://klipy.com/gifs/<slug>`.
- Whether a share event should be reported. mcp-gifs does not call the
  share-trigger endpoint because a server cannot see whether the user
  actually sent the GIF.
