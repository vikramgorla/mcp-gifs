import { createMcpHandler } from '@modelcontextprotocol/server';
import { landingPage } from './landing.js';
import { createServer } from './server.js';
import type { ResultCache } from './types.js';
import { VERSION } from './version.js';

/** Minimal shape of a rate limiter (Workers binding or in-memory). */
export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface HttpAppOptions {
  cache?: ResultCache;
  cacheTtlSeconds?: number;
  /** KLIPY API key from the operator's environment; enables KLIPY results. */
  klipyApiKey?: string;
  rateLimiter?: RateLimiter;
  globalRateLimiter?: RateLimiter;
  /** Client IP used as the per-IP rate-limit key. */
  clientIp?: (request: Request) => string;
}

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

function rateLimitResponse(kind: 'server-wide' | 'per IP'): Response {
  return withCors(
    json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: `Rate limit exceeded (${kind}). Please retry in a minute.` } }, 429, { 'Retry-After': '60' }),
  );
}

let handler: ReturnType<typeof createMcpHandler> | undefined;
function getHandler(opts: HttpAppOptions) {
  if (!handler) {
    const ttl = opts.cacheTtlSeconds ?? 600;
    const { cache, klipyApiKey } = opts;
    handler = createMcpHandler(() => createServer({ cache, cacheTtlSeconds: ttl, klipyApiKey }), {
      legacy: 'stateless',
      onerror: (err) => console.error('[mcp-gifs]', err.message),
    });
  }
  return handler;
}

/** Shared HTTP surface for the Workers and Vercel entry points. */
export function createHttpApp(opts: HttpAppOptions = {}) {
  const clientIp = opts.clientIp ?? ((request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown');
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

      if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
        if (opts.globalRateLimiter) {
          const { success } = await opts.globalRateLimiter.limit({ key: 'global' });
          if (!success) return rateLimitResponse('server-wide');
        }
        if (opts.rateLimiter && request.method === 'POST') {
          const ip = clientIp(request);
          const { success } = await opts.rateLimiter.limit({ key: `mcp:${ip}` });
          if (!success) return rateLimitResponse('per IP');
        }
        const res = withCors(await getHandler(opts).fetch(request));
        res.headers.set('Cache-Control', 'no-store');
        return res;
      }
      if (url.pathname === '/health') {
        return withCors(json({ status: 'ok', name: 'mcp-gifs', version: VERSION }, 200, { 'Cache-Control': 'public, max-age=60' }));
      }
      if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
        return new Response(landingPage(url.origin), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
      }
      return withCors(json({ error: 'Not found', mcp: `${url.origin}/mcp` }, 404));
    },
  };
}
