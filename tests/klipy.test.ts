import { beforeEach, describe, expect, it } from 'vitest';
import { landingPage } from '../src/landing.js';
import { createServer } from '../src/server.js';
import { getGif, KLIPY_NOT_CONFIGURED, resetOpenverseCooldown, SearchFailedError, searchGifs, trendingGifs } from '../src/search.js';
import { klipyRating, mapKlipy } from '../src/sources/klipy.js';
import { commonsPage, commonsResponse, json, klipyItem, klipyList, mockFetch } from './fixtures.js';

const KEY = 'test-key-123';
const params = (over: Partial<Parameters<typeof searchGifs>[0]> = {}) => ({ query: 'facepalm', limit: 3, safety: 'safe' as const, source: 'auto' as const, ...over });

beforeEach(() => resetOpenverseCooldown());

describe('KLIPY mapping', () => {
  it('maps renditions, MP4/WebP and the Powered by KLIPY attribution', () => {
    const g = mapKlipy(klipyItem('face-palm-abc'))!;
    expect(g).toMatchObject({
      id: 'klipy:face-palm-abc',
      url: 'https://static.klipy.com/face-palm-abc/hd.gif',
      previewUrl: 'https://static.klipy.com/face-palm-abc/sm.gif',
      mp4Url: 'https://static.klipy.com/face-palm-abc/hd.mp4',
      webpUrl: 'https://static.klipy.com/face-palm-abc/hd.webp',
      width: 498,
      fileSizeBytes: 4_000_000,
      source: 'klipy',
      attributionRequired: true,
    });
    expect(g.attribution).toBe('"GIF face-palm-abc" · Powered by KLIPY · https://klipy.com/gifs/face-palm-abc');
  });

  it('picks the largest rendition under the size cap, falls back to the smallest instead of dropping, and skips non-GIF items', () => {
    expect(mapKlipy(klipyItem('a'), 1_000_000)!.url).toBe('https://static.klipy.com/a/sm.gif');
    expect(mapKlipy(klipyItem('a'), 1_000_000)!.mp4Url).toBeNull();
    expect(mapKlipy(klipyItem('a'), 10)!.url).toBe('https://static.klipy.com/a/xs.gif');
    expect(mapKlipy(klipyItem('ad', { type: 'ad' }))).toBeNull();
  });

  it('maps safety to a KLIPY rating', () => {
    expect(klipyRating('safe')).toBe('g');
    expect(klipyRating('moderate')).toBe('pg-13');
  });
});

describe('searchGifs with KLIPY', () => {
  it('uses KLIPY alone when configured and it has results, with the key in the path and a rating', async () => {
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('a'), klipyItem('b'), klipyItem('c'), klipyItem('d')])) });
    const r = await searchGifs(params({ locale: 'fr_FR' }), { fetchImpl: m.fetch, klipyApiKey: KEY });
    expect(r.count).toBe(3);
    expect(r.sourcesQueried).toEqual(['klipy']);
    expect(r.results.every((g) => g.source === 'klipy')).toBe(true);
    expect(m.calls).toHaveLength(1);
    const u = m.calls[0]!;
    expect(u.pathname).toBe(`/api/v1/${KEY}/gifs/search`);
    expect(u.searchParams.get('q')).toBe('facepalm');
    expect(u.searchParams.get('rating')).toBe('g');
    expect(u.searchParams.get('locale')).toBe('fr_FR');
    expect(u.searchParams.has('customer_id')).toBe(false);
  });

  it("keeps KLIPY's order and does not filter its results (filtering is KLIPY's rating + Partner Panel)", async () => {
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('z'), klipyItem('y', { tags: ['gore'] }), klipyItem('x'), klipyItem('w')])) });
    const r = await searchGifs(params(), { fetchImpl: m.fetch, klipyApiKey: KEY, cacheTtlSeconds: 1 });
    expect(r.results.map((g) => g.id)).toEqual(['klipy:z', 'klipy:y', 'klipy:x']);
    expect(m.calls[0]!.searchParams.get('per_page')).toBe('8');
  });

  it('still blocks unsafe queries before calling KLIPY', async () => {
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('a')])) });
    const r = await searchGifs(params({ query: 'nsfw' }), { fetchImpl: m.fetch, klipyApiKey: KEY });
    expect(r.count).toBe(0);
    expect(m.calls).toHaveLength(0);
  });

  it('falls back to Commons when KLIPY has no matches or is down, never mixing', async () => {
    const commons = () => json(commonsResponse([1, 2, 3].map((i) => commonsPage({ title: `File:C${i}.gif`, index: i }))));
    const empty = mockFetch({ klipy: () => json(klipyList([])), commons });
    const r1 = await searchGifs(params(), { fetchImpl: empty.fetch, klipyApiKey: KEY });
    expect(r1.sourcesQueried).toEqual(['klipy', 'wikimedia-commons']);
    expect(r1.results.every((g) => g.source === 'wikimedia-commons')).toBe(true);

    const down = mockFetch({ klipy: () => new Response('x', { status: 503 }), commons });
    const r2 = await searchGifs(params(), { fetchImpl: down.fetch, klipyApiKey: KEY });
    expect(r2.count).toBe(3);
    expect(r2.notes.join(' ')).toMatch(/KLIPY unavailable \(HTTP 503\)/);
    expect(r2.notes.join(' ')).not.toContain(KEY);
  });

  it('does not touch KLIPY without a key, and explains source=klipy', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([commonsPage({ title: 'File:C.gif' })])) });
    await searchGifs(params(), { fetchImpl: m.fetch });
    expect(m.calls.some((c) => c.hostname === 'api.klipy.com')).toBe(false);
    const r = await searchGifs(params({ source: 'klipy' }), { fetchImpl: m.fetch });
    expect(r.notes).toEqual([KLIPY_NOT_CONFIGURED]);
  });

  it('throws when source=klipy and KLIPY fails', async () => {
    const m = mockFetch({ klipy: () => new Response('x', { status: 429 }) });
    await expect(searchGifs(params({ source: 'klipy' }), { fetchImpl: m.fetch, klipyApiKey: KEY })).rejects.toBeInstanceOf(SearchFailedError);
  });
});

describe('trending and get_gif with KLIPY', () => {
  it('returns trending GIFs', async () => {
    const m = mockFetch({ klipy: () => json(klipyList([klipyItem('t1'), klipyItem('t2')])) });
    const r = await trendingGifs({ limit: 5, safety: 'safe' }, { fetchImpl: m.fetch, klipyApiKey: KEY });
    expect(r.results.map((g) => g.id)).toEqual(['klipy:t1', 'klipy:t2']);
    expect(m.calls[0]!.pathname).toBe(`/api/v1/${KEY}/gifs/trending`);
    expect((await trendingGifs({ limit: 5, safety: 'safe' }, {})).notes).toEqual([KLIPY_NOT_CONFIGURED]);
  });

  it('fetches one GIF by slug and rejects odd slugs', async () => {
    const m = mockFetch({ klipy: () => json({ result: true, data: klipyItem('one') }) });
    const g = await getGif('klipy:one', 'safe', { fetchImpl: m.fetch, klipyApiKey: KEY });
    expect(g?.id).toBe('klipy:one');
    expect(await getGif('klipy:../x', 'safe', { fetchImpl: m.fetch, klipyApiKey: KEY })).toBeNull();
    expect(await getGif('klipy:one', 'safe', { fetchImpl: m.fetch })).toBeNull();
  });
});

describe('tool list', () => {
  it('offers trending_gifs only when KLIPY is configured', () => {
    const names = (s: ReturnType<typeof createServer>) => Object.keys((s as unknown as { _registeredTools: Record<string, unknown> })._registeredTools ?? {});
    expect(names(createServer({ klipyApiKey: KEY }))).toEqual(['search_gifs', 'get_gif', 'trending_gifs']);
    expect(names(createServer())).toEqual(['search_gifs', 'get_gif']);
  });
});

describe('landing page attribution', () => {
  it('shows a "Search KLIPY" box with "Powered by KLIPY" when KLIPY is configured', () => {
    const html = landingPage('https://gifs.example', { klipy: true });
    expect(html).toContain('placeholder="Search KLIPY"');
    expect(html).toContain('>Powered by KLIPY</a>');
    expect(html).toContain('GIF search powered by <a href="https://klipy.com"');
  });

  it('does not mention KLIPY when it is not configured', () => {
    const html = landingPage('https://gifs.example', { klipy: false });
    expect(html).not.toContain('Powered by KLIPY');
    expect(html).not.toContain('Search KLIPY');
    expect(html).toContain('placeholder="Search GIFs"');
  });
});

describe('font asset', () => {
  it('serves the self-hosted font with a long cache', async () => {
    const { createHttpApp } = await import('../src/app.js');
    const { FONT_PATH } = await import('../src/landing.js');
    const res = await createHttpApp().fetch(new Request(`https://x.dev${FONT_PATH}`));
    expect(res.headers.get('Content-Type')).toBe('font/woff2');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('wOF2');
  });
});
