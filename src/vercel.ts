import { MemoryCache } from './cache.js';
import { createHttpApp } from './app.js';
import { clientIpFromHeaders, memoryRateLimiter } from './limit.js';

/** Edge runtime keeps this I/O-bound server off a full Node isolate. */
export const config = { runtime: 'edge' as const };

const cache = new MemoryCache();
const app = createHttpApp({
  cache,
  cacheTtlSeconds: 600,
  globalRateLimiter: memoryRateLimiter(25, 60_000),
  rateLimiter: memoryRateLimiter(60, 60_000),
  clientIp: clientIpFromHeaders,
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
