import { createMcpHandler } from '@modelcontextprotocol/server';
import { WorkersCache } from './cache.js';
import { landingPage } from './landing.js';
import { createServer } from './server.js';
import type { ResultCache } from './types.js';
import { VERSION } from './version.js';

/** Minimal shape of the Workers Rate Limiting binding (optional). */
interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}
export interface Env {
  RATE_LIMITER?: RateLimiter;
  GLOBAL_RATE_LIMITER?: RateLimiter;
  CACHE_TTL_SECONDS?: string;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

function workersCache(): ResultCache | undefined {
  const c = (globalThis as unknown as { caches?: { default?: ConstructorParameters<typeof WorkersCache>[0] } }).caches?.default;
  return c ? new WorkersCache(c) : undefined;
}

let handler: ReturnType<typeof createMcpHandler> | undefined;
function getHandler(env: Env) {
  if (!handler) {
    const cache = workersCache();
    const ttl = Number(env.CACHE_TTL_SECONDS ?? '600') || 600;
    handler = createMcpHandler(() => createServer({ cache, cacheTtlSeconds: ttl }), {
      legacy: 'stateless',
      onerror: (err) => console.error('[mcp-gifs]', err.message),
    });
  }
  return handler;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      // Global cap first so this Worker alone cannot exhaust the account's
      // included Workers Paid request allowance. Then the per-IP limiter.
      if (env.GLOBAL_RATE_LIMITER) {
        const { success } = await env.GLOBAL_RATE_LIMITER.limit({ key: 'global' });
        if (!success) {
          return withCors(
            json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded (server-wide). Please retry in a minute.' } }, 429, { 'Retry-After': '60' }),
          );
        }
      }
      if (env.RATE_LIMITER && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const { success } = await env.RATE_LIMITER.limit({ key: `mcp:${ip}` });
        if (!success) {
          return withCors(
            json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded (per IP). Please retry in a minute.' } }, 429, { 'Retry-After': '60' }),
          );
        }
      }
      return withCors(await getHandler(env).fetch(request));
    }
    if (url.pathname === '/health') {
      return withCors(json({ status: 'ok', name: 'mcp-gifs', version: VERSION }));
    }
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      return new Response(landingPage(url.origin), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return withCors(json({ error: 'Not found', mcp: `${url.origin}/mcp` }, 404));
  },
};
