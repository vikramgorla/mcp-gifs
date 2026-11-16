import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache.js';
import { freshnessSeconds } from '../src/cachePolicy.js';
import { searchToMarkdown } from '../src/format.js';
import { resetOpenverseCooldown, searchGifs, trendingGifs } from '../src/search.js';
import type { ResultCache } from '../src/types.js';
import { commonsPage, commonsResponse, json, klipyItem, klipyList, mockFetch } from './fixtures.js';

const KEY = 'test-key-123';
const h = (o: Record<string, string>) => new Headers(o);

/** MemoryCache that records the TTL of every put. */
class SpyCache extends MemoryCache implements ResultCache {
  puts: Array<{ key: string; ttl: number }> = [];
  override async put(key: string, value: unknown, ttlSeconds: number) {
    this.puts.push({ key, ttl: ttlSeconds });
    return super.put(key, value, ttlSeconds);
  }
}

beforeEach(() => resetOpenverseCooldown());

describe('freshnessSeconds (RFC 9111, shared cache)', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  it('uses max-age, minus Age', () => {
    expect(freshnessSeconds(h({ 'Cache-Control': 'public, max-age=120' }), now)).toBe(120);
    expect(freshnessSeconds(h({ 'Cache-Control': 'max-age=120', Age: '20' }), now)).toBe(100);
    expect(freshnessSeconds(h({ 'Cache-Control': 'max-age=10', Age: '30' }), now)).toBe(0);
  });
  it('prefers s-maxage for a shared cache', () => {
    expect(freshnessSeconds(h({ 'Cache-Control': 'max-age=600, s-maxage=60' }), now)).toBe(60);
  });
  it('never caches no-store, no-cache or private', () => {
    for (const cc of ['no-store', 'no-cache', 'private, max-age=600', 'max-age=600, no-store']) {
      expect(freshnessSeconds(h({ 'Cache-Control': cc }), now)).toBe(0);
    }
  });
  it('falls back to Expires minus Date', () => {
    expect(freshnessSeconds(h({ Date: 'Mon, 16 Nov 2026 12:00:00 GMT', Expires: 'Mon, 16 Nov 2026 12:05:00 GMT' }), now)).toBe(300);
    expect(freshnessSeconds(h({ Expires: 'Mon, 16 Nov 2026 12:01:00 GMT' }), now)).toBe(60);
    expect(freshnessSeconds(h({ Expires: '0' }), now)).toBe(0);
    expect(freshnessSeconds(h({ 'Cache-Control': 'max-age=30', Expires: 'Mon, 16 Nov 2026 13:00:00 GMT' }), now)).toBe(30);
  });
  it('does not cache without freshness information', () => {
    expect(freshnessSeconds(h({}), now)).toBe(0);
    expect(freshnessSeconds(h({ 'Cache-Control': 'public' }), now)).toBe(0);
  });
});

const params = { query: 'facepalm', limit: 3, safety: 'safe' as const, source: 'auto' as const };

describe('KLIPY result caching follows KLIPY response headers', () => {
  it("caches for exactly KLIPY's max-age, not a fixed ten minutes", async () => {
    const cache = new SpyCache();
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('a')]), 200, { 'Cache-Control': 'public, max-age=45' }) });
    await searchGifs(params, { fetchImpl: m.fetch, klipyApiKey: KEY, cache, cacheTtlSeconds: 600 });
    expect(cache.puts).toEqual([{ key: expect.stringContaining('search:'), ttl: 45 }]);
    await searchGifs(params, { fetchImpl: m.fetch, klipyApiKey: KEY, cache, cacheTtlSeconds: 600 });
    expect(m.calls).toHaveLength(1);
  });

  it('does not cache when KLIPY sends no-store or no caching headers', async () => {
    for (const headers of [{ 'Cache-Control': 'no-store' }, {}] as Array<Record<string, string>>) {
      const cache = new SpyCache();
      const m = mockFetch({ klipy: () => json(klipyList([klipyItem('a')]), 200, headers) });
      await searchGifs(params, { fetchImpl: m.fetch, klipyApiKey: KEY, cache });
      await searchGifs(params, { fetchImpl: m.fetch, klipyApiKey: KEY, cache });
      expect(cache.puts).toEqual([]);
      expect(m.calls).toHaveLength(2);
    }
  });

  it("caps the open-licence fallback by KLIPY's cache lifetime", async () => {
    const commons = () => json(commonsResponse([1, 2, 3].map((i) => commonsPage({ title: `File:C${i}.gif`, index: i }))));
    const short = new SpyCache();
    const m1 = mockFetch({ klipy: () => json(klipyList([]), 200, { 'Cache-Control': 'max-age=30' }), commons });
    await searchGifs(params, { fetchImpl: m1.fetch, klipyApiKey: KEY, cache: short, cacheTtlSeconds: 600 });
    expect(short.puts.map((p) => p.ttl)).toEqual([30]);

    const none = new SpyCache();
    const m2 = mockFetch({ klipy: () => json(klipyList([])), commons });
    await searchGifs(params, { fetchImpl: m2.fetch, klipyApiKey: KEY, cache: none, cacheTtlSeconds: 600 });
    expect(none.puts).toEqual([]);
  });

  it('uses the configured TTL only for open-licence searches when KLIPY is not involved', async () => {
    const cache = new SpyCache();
    const m = mockFetch({ commons: () => json(commonsResponse([1, 2, 3].map((i) => commonsPage({ title: `File:C${i}.gif`, index: i })))) });
    await searchGifs(params, { fetchImpl: m.fetch, cache, cacheTtlSeconds: 600 });
    expect(cache.puts.map((p) => p.ttl)).toEqual([600]);
  });

  it('trending follows the headers too', async () => {
    const cache = new SpyCache();
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('t')]), 200, { Date: new Date().toUTCString(), Expires: new Date(Date.now() + 90_000).toUTCString() }) });
    await trendingGifs({ limit: 5, safety: 'safe' }, { fetchImpl: m.fetch, klipyApiKey: KEY, cache });
    expect(cache.puts).toHaveLength(1);
    expect(cache.puts[0]!.ttl).toBeGreaterThanOrEqual(89);
    expect(cache.puts[0]!.ttl).toBeLessThanOrEqual(90);

    const nocache = new SpyCache();
    const m2 = mockFetch({ klipy: () => json(klipyList([klipyItem('t')]), 200, { 'Cache-Control': 'no-cache' }) });
    await trendingGifs({ limit: 5, safety: 'safe' }, { fetchImpl: m2.fetch, klipyApiKey: KEY, cache: nocache });
    expect(nocache.puts).toEqual([]);
  });
});

describe('attribution in the text agents read', () => {
  it('tells agents to show Powered by KLIPY, keep order and load from the given URLs', async () => {
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('a'), klipyItem('b')])) });
    const r = await searchGifs(params, { fetchImpl: m.fetch, klipyApiKey: KEY });
    const md = searchToMarkdown(r);
    expect(md).toContain('Powered by KLIPY');
    expect(md).toContain('keep this order');
    expect(md.indexOf('klipy:a')).toBeLessThan(md.indexOf('klipy:b'));
    expect(md).toContain('https://static.klipy.com/a/hd.gif');
  });
});
