import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { gifToMarkdown, searchToMarkdown } from './format.js';
import { getGif, searchGifs, trendingGifs, type SearchDeps } from './search.js';
import { VERSION } from './version.js';
import { imageObjectSchema, toImageObject } from './schema-org.js';
import type { SearchResult } from './types.js';

/** The structured result: each GIF as a schema.org ImageObject. */
const structured = (r: SearchResult) => ({ ...r, results: r.results.map(toImageObject) });

const safetySchema = z
  .enum(['safe', 'moderate'])
  .default('safe')
  .describe("Content filter. 'safe' (default) also removes violence/gore/drug terms; 'moderate' only removes sexual/explicit and hate content. There is no unfiltered mode.");

const searchOutput = z.object({
  query: z.string(),
  safety: z.enum(['safe', 'moderate']),
  count: z.number(),
  results: z.array(imageObjectSchema).describe('schema.org ImageObjects, in the provider\'s order.'),
  sourcesQueried: z.array(z.enum(['wikimedia-commons', 'openverse', 'klipy'])),
  notes: z.array(z.string()),
});

const localeSchema = z
  .string()
  .regex(/^[a-z]{2}_[A-Z]{2}$/)
  .optional()
  .describe('Optional KLIPY locale such as en_US, fr_FR or hi_IN, for localized results. Ignored by the open-licence sources.');

const maxSizeSchema = z
  .number()
  .min(0.1)
  .max(100)
  .default(10)
  .describe('Skip GIFs whose file is larger than this many MB (default 10). Commons GIFs range from a few KB to 50+ MB.');

export function createServer(deps: SearchDeps = {}): McpServer {
  const klipy = Boolean(deps.klipyApiKey);
  const server = new McpServer(
    { name: 'mcp-gifs', version: VERSION, title: klipy ? 'GIF finder (KLIPY + Wikimedia Commons + Openverse)' : 'GIF finder (Wikimedia Commons + Openverse)' },
    {
      instructions: klipy
        ? 'Find animated GIFs by keyword, including the reaction/meme GIFs chat apps show. GIF search is powered by KLIPY, with openly licensed GIFs from Wikimedia Commons and Openverse as a separate fallback. Use trending_gifs when there is no search text. Always show the attribution line with any GIF you display. For KLIPY results: show "Powered by KLIPY", keep KLIPY\'s order, load media from the returned URLs (never re-host), do not mix KLIPY GIFs with other providers in one set, and label any search box you show "Search KLIPY".'
        : 'Find openly licensed animated GIFs by keyword. Results come from Wikimedia Commons (primary) and Openverse (fallback); they skew documentary/educational rather than meme-style. Always show the attribution line with any GIF you display.',
    },
  );

  server.registerTool(
    'search_gifs',
    {
      title: 'Search GIFs',
      description:
        klipy
          ? 'Search KLIPY for animated GIFs by keywords (e.g. "facepalm", "happy dance", "thank you"). Returns reaction/meme GIFs from KLIPY in KLIPY\'s order, or openly licensed GIFs when KLIPY has nothing (never mixed). Each result is a schema.org ImageObject: the GIF (contentUrl), its MP4/WebP renditions (encoding), a preview (thumbnailUrl), dimensions, creator, license, provider and the credit to show (creditText); KLIPY results must be shown with "Powered by KLIPY".'
          : 'Search openly licensed animated GIFs by keywords (e.g. "cat", "rocket launch", "dancing"). Each result is a schema.org ImageObject: the GIF (contentUrl), a preview (thumbnailUrl), dimensions, creator, license, provider and the credit to show (creditText). English keywords work best.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).describe('Keywords describing the GIF you want.'),
        limit: z.number().int().min(1).max(25).default(8).describe('Max results (1-25, default 8).'),
        safety: safetySchema,
        source: z
          .enum(['auto', 'klipy', 'wikimedia', 'openverse'])
          .default('auto')
          .describe(
            klipy
              ? "'auto' (default): KLIPY first; if it has no match, Wikimedia Commons then Openverse. Or force one source."
              : "'auto' (default): Wikimedia Commons first, Openverse to fill gaps. Or force one source. ('klipy' is not configured on this server.)",
          ),
        max_size_mb: maxSizeSchema,
        locale: localeSchema,
      }),
      outputSchema: searchOutput,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async ({ query, limit, safety, source, max_size_mb, locale }) => {
      try {
        const result = await searchGifs({ query, limit, safety, source, locale, maxBytes: Math.round(max_size_mb * 1024 * 1024) }, deps);
        return { content: [{ type: 'text', text: searchToMarkdown(result) }], structuredContent: structured(result) };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `search_gifs failed: ${(err as Error).message}` }] };
      }
    },
  );

  server.registerTool(
    'get_gif',
    {
      title: 'Get GIF',
      description: 'Fetch full details for one GIF by the id returned from search_gifs (e.g. "klipy:<slug>", "wikimedia:File:Foo.gif" or "openverse:<uuid>").',
      inputSchema: z.object({
        id: z.string().min(3).max(300).describe('GIF id from search_gifs.'),
        safety: safetySchema,
      }),
      outputSchema: z.object({ found: z.boolean(), gif: imageObjectSchema.nullable() }),
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async ({ id, safety }) => {
      try {
        const gif = await getGif(id, safety, deps);
        if (!gif) {
          return { content: [{ type: 'text', text: `No GIF found for id ${id} (unknown id, not a GIF, or removed by the safety filter).` }], structuredContent: { found: false, gif: null } };
        }
        return { content: [{ type: 'text', text: gifToMarkdown(gif) }], structuredContent: { found: true, gif: toImageObject(gif) } };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `get_gif failed: ${(err as Error).message}` }] };
      }
    },
  );

  // Only offered when KLIPY is configured: the open-licence sources have no trending feed.
  if (klipy) {
    server.registerTool(
      'trending_gifs',
      {
        title: 'Trending GIFs',
        description: 'Currently trending reaction GIFs from KLIPY, in KLIPY\'s order, like the default tab of a chat app GIF picker. Use when the user wants a GIF but gave no search words. Show "Powered by KLIPY" with the results.',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(25).default(8).describe('Max results (1-25, default 8).'),
          safety: safetySchema,
          max_size_mb: maxSizeSchema,
          locale: localeSchema,
        }),
        outputSchema: searchOutput,
        annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: false },
      },
      async ({ limit, safety, max_size_mb, locale }) => {
        try {
          const result = await trendingGifs({ limit, safety, locale, maxBytes: Math.round(max_size_mb * 1024 * 1024) }, deps);
          return { content: [{ type: 'text', text: searchToMarkdown(result) }], structuredContent: structured(result) };
        } catch (err) {
          return { isError: true, content: [{ type: 'text', text: `trending_gifs failed: ${(err as Error).message}` }] };
        }
      },
    );

  }

  return server;
}
