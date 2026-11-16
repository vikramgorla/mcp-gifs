import { createHttpApp, type RateLimiter } from './app.js';
import { WorkersCache } from './cache.js';
import type { ResultCache } from './types.js';

export interface Env {
  RATE_LIMITER?: RateLimiter;
  GLOBAL_RATE_LIMITER?: RateLimiter;
  CACHE_TTL_SECONDS?: string;
  /** Secret: `wrangler secret put KLIPY_API_KEY`. */
  KLIPY_API_KEY?: string;
}

function workersCache(): ResultCache | undefined {
  const c = (globalThis as unknown as { caches?: { default?: ConstructorParameters<typeof WorkersCache>[0] } }).caches?.default;
  return c ? new WorkersCache(c) : undefined;
}

/** Cloudflare Workers entry. Kept for self-hosters; the public instance runs on Vercel. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createHttpApp({
      cache: workersCache(),
      cacheTtlSeconds: Number(env.CACHE_TTL_SECONDS ?? '600') || 600,
      klipyApiKey: env.KLIPY_API_KEY || undefined,
      globalRateLimiter: env.GLOBAL_RATE_LIMITER,
      rateLimiter: env.RATE_LIMITER,
      clientIp: (req) => req.headers.get('CF-Connecting-IP') ?? 'unknown',
    });
    return app.fetch(request);
  },
};
