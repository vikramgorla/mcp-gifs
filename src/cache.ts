import type { ResultCache } from './types.js';

/** Small in-memory TTL cache (used under Node/stdio and in tests). */
export class MemoryCache implements ResultCache {
  private map = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly maxEntries = 200) {}
  async get(key: string) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }
  async put(key: string, value: unknown, ttlSeconds: number) {
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}

interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}

/** Cloudflare Workers Cache API adapter (per-colo, best effort). */
export class WorkersCache implements ResultCache {
  constructor(private readonly cache: CacheLike, private readonly waitUntil?: (p: Promise<unknown>) => void) {}
  private req(key: string) {
    return new Request(`https://cache.mcp-gifs.invalid/${encodeURIComponent(key)}`);
  }
  async get(key: string) {
    try {
      const res = await this.cache.match(this.req(key));
      return res ? await res.json() : undefined;
    } catch {
      return undefined;
    }
  }
  async put(key: string, value: unknown, ttlSeconds: number) {
    const res = new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSeconds}` },
    });
    const p = this.cache.put(this.req(key), res).catch(() => undefined);
    if (this.waitUntil) this.waitUntil(p);
    else await p;
  }
}
