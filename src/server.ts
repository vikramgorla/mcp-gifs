import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { gifToMarkdown, searchToMarkdown } from './format.js';
import { getGif, searchGifs, type SearchDeps } from './search.js';
import { VERSION } from './version.js';

const safetySchema = z
  .enum(['safe', 'moderate'])
  .default('safe')
  .describe("Content filter. 'safe' (default) also removes violence/gore/drug terms; 'moderate' only removes sexual/explicit and hate content. There is no unfiltered mode.");

const gifSchema = z.object({
  id: z.string().describe('Pass to get_gif to re-fetch this GIF.'),
  title: z.string(),
  url: z.string().describe('Direct URL of the original animated GIF.'),
  previewUrl: z.string().describe('Smaller preview thumbnail (about 320px wide, or a reduced Commons thumb when the original is already narrower).'),
  width: z.number(),
  height: z.number(),
  fileSizeBytes: z.number().nullable(),
  animated: z.boolean().nullable().describe('true = verified frameCount > 1; null = not verifiable for this source.'),
  frameCount: z.number().nullable(),
  source: z.enum(['wikimedia-commons', 'openverse']),
  pageUrl: z.string().describe('Landing/file page with full license details.'),
  author: z.string().nullable(),
  authorUrl: z.string().nullable(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  attributionRequired: z.boolean(),
  attribution: z.string().describe('Ready-made attribution line to show next to the GIF.'),
  description: z.string().nullable(),
});

const searchOutput = z.object({
  query: z.string(),
  safety: z.enum(['safe', 'moderate']),
  count: z.number(),
  results: z.array(gifSchema),
  sourcesQueried: z.array(z.enum(['wikimedia-commons', 'openverse'])),
  notes: z.array(z.string()),
});

export function createServer(deps: SearchDeps = {}): McpServer {
  const server = new McpServer(
    { name: 'mcp-gifs', version: VERSION, title: 'GIF finder (Wikimedia Commons + Openverse)' },
    {
      instructions:
        'Find openly licensed animated GIFs by keyword. Results come from Wikimedia Commons (primary) and Openverse (fallback); they skew documentary/educational rather than meme-style. Always show the attribution line with any GIF you display.',
    },
  );

  server.registerTool(
    'search_gifs',
    {
      title: 'Search GIFs',
      description:
        'Search openly licensed animated GIFs by keywords (e.g. "cat", "rocket launch", "dancing"). Returns direct GIF URLs, preview URLs, dimensions, license and a ready-made attribution string. English keywords work best.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).describe('Keywords describing the GIF you want.'),
        limit: z.number().int().min(1).max(25).default(8).describe('Max results (1-25, default 8).'),
        safety: safetySchema,
        source: z
          .enum(['auto', 'wikimedia', 'openverse'])
          .default('auto')
          .describe("'auto' (default): Wikimedia Commons first, Openverse to fill gaps. Or force one source."),
        max_size_mb: z
          .number()
          .min(0.1)
          .max(100)
          .default(10)
          .describe('Skip GIFs whose file is larger than this many MB (default 10). Commons GIFs range from a few KB to 50+ MB.'),
      }),
      outputSchema: searchOutput,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async ({ query, limit, safety, source, max_size_mb }) => {
      try {
        const result = await searchGifs({ query, limit, safety, source, maxBytes: Math.round(max_size_mb * 1024 * 1024) }, deps);
        return { content: [{ type: 'text', text: searchToMarkdown(result) }], structuredContent: { ...result } };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `search_gifs failed: ${(err as Error).message}` }] };
      }
    },
  );

  server.registerTool(
    'get_gif',
    {
      title: 'Get GIF',
      description: 'Fetch full details for one GIF by the id returned from search_gifs (e.g. "wikimedia:File:Foo.gif" or "openverse:<uuid>").',
      inputSchema: z.object({
        id: z.string().min(3).max(300).describe('GIF id from search_gifs.'),
        safety: safetySchema,
      }),
      outputSchema: z.object({ found: z.boolean(), gif: gifSchema.nullable() }),
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async ({ id, safety }) => {
      try {
        const gif = await getGif(id, safety, deps);
        if (!gif) {
          return { content: [{ type: 'text', text: `No GIF found for id ${id} (unknown id, not a GIF, or removed by the safety filter).` }], structuredContent: { found: false, gif: null } };
        }
        return { content: [{ type: 'text', text: gifToMarkdown(gif) }], structuredContent: { found: true, gif: { ...gif } } };
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: `get_gif failed: ${(err as Error).message}` }] };
      }
    },
  );

  return server;
}
