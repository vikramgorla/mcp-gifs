import { MemoryCache } from './cache.js';
import { createHttpApp } from './app.js';
import {
  DEFAULT_MEMORY_GLOBAL_LIMIT,
  DEFAULT_MEMORY_PER_IP_LIMIT,
  GLOBAL_RATE_LIMIT_ENV,
  clientIpFromHeaders,
  envInt,
  memoryRateLimiter,
} from './limit.js';

/** Edge runtime keeps this I/O-bound server off a full Node isolate. */
export const config = { runtime: 'edge' as const };

const cache = new MemoryCache();

/**
 * In-memory limits are a per-instance (per Edge isolate) safety net only;
 * counters do not aggregate across instances. The Vercel Firewall rule
 * `mcp-rate-limit` is the real per-IP limit: path prefix `/mcp`, fixed
 * window of 60 s, 60 requests per IP, HTTP 429 when exceeded (created in
 * the dashboard). The global cap defaults to 600 / 60 s so it stays well
 * above that per-IP rule; override with GLOBAL_RATE_LIMIT_PER_MINUTE.
 */
const globalLimit = envInt(GLOBAL_RATE_LIMIT_ENV, DEFAULT_MEMORY_GLOBAL_LIMIT);

const app = createHttpApp({
  cache,
  cacheTtlSeconds: 600,
  globalRateLimiter: memoryRateLimiter(globalLimit, 60_000),
  rateLimiter: memoryRateLimiter(DEFAULT_MEMORY_PER_IP_LIMIT, 60_000),
  clientIp: clientIpFromHeaders,
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
