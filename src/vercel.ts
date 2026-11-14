import { MemoryCache } from './cache.js';
import { createHttpApp } from './app.js';
import { clientIpFromHeaders, memoryLimitersFromEnv } from './limit.js';

/** Edge runtime keeps this I/O-bound server off a full Node isolate. */
export const config = { runtime: 'edge' as const };

const cache = new MemoryCache();

/**
 * In-memory per-IP and global limiters are off by default (RATE_LIMIT_PER_IP
 * and RATE_LIMIT_GLOBAL unset or 0). The public Vercel deployment does not
 * set those variables; the only limit there is the Vercel Firewall rule
 * `mcp-rate-limit` (path prefix `/mcp`, fixed window of 60 s, 60 requests
 * per IP, HTTP 429 when exceeded). Self-hosters on other platforms can
 * opt in by setting those env vars to a positive requests-per-60s value.
 */
const app = createHttpApp({
  cache,
  cacheTtlSeconds: 600,
  ...memoryLimitersFromEnv(),
  clientIp: clientIpFromHeaders,
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
