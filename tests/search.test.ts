import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache.js';
import { fetchJson, UpstreamError } from '../src/http.js';
import { getGif, resetOpenverseCooldown, SearchFailedError, searchGifs } from '../src/search.js';
import { commonsPage, commonsResponse, json, mockFetch, ovImage } from './fixtures.js';

const params = (over: Partial<Parameters<typeof searchGifs>[0]> = {}) => ({ query: 'cat', limit: 3, safety: 'safe' as const, source: 'auto' as const, ...over });

beforeEach(() => resetOpenverseCooldown());

describe('searchGifs orchestration', () => {
  it('uses only Commons when it returns enough results', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([1, 2, 3, 4].map((i) => commonsPage({ title: `File:C${i}.gif`, index: i })))) });
    const r = await searchGifs(params(), { fetchImpl: m.fetch });
    expect(r.count).toBe(3);
    expect(r.sourcesQueried).toEqual(['wikimedia-commons']);
    expect(m.calls.every((c) => c.hostname === 'commons.wikimedia.org')).toBe(true);
  });

  it('falls back to Openverse when Commons has few results, de-duplicating by URL and verifying Commons-hosted animation', async () => {
    const dupUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/C1.gif';
    const m = mockFetch({
      commons: (u) => {
        if (u.searchParams.get('titles')) {
          // batched frameCount verification of Openverse results hosted on Commons
          return json(commonsResponse([{ title: 'File:Static one.gif', imageinfo: [{ metadata: [{ name: 'frameCount', value: 1 }] }] }, { title: 'File:Moving one.gif', imageinfo: [{ metadata: [{ name: 'frameCount', value: 9 }] }] }]));
        }
        return json(commonsResponse([commonsPage({ title: 'File:C1.gif' })]));
      },
      openverse: () =>
        json({
          results: [
            ovImage('1', { url: dupUrl }),
            ovImage('2', { url: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Static_one.gif' }),
            ovImage('3', { url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Moving_one.gif' }),
            ovImage('4'),
          ],
        }),
    });
    const r = await searchGifs(params({ limit: 5 }), { fetchImpl: m.fetch });
    expect(r.sourcesQueried).toEqual(['wikimedia-commons', 'openverse']);
    expect(r.results.map((g) => [g.source, g.title])).toEqual([
      ['wikimedia-commons', 'C1'],
      ['openverse', 'Openverse 3'],
      ['openverse', 'Openverse 4'],
    ]);
    expect(r.results[1]).toMatchObject({ animated: true, frameCount: 9 });
    expect(r.results[2]).toMatchObject({ animated: null });
  });

  it('degrades gracefully when Openverse returns 504', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([commonsPage({ title: 'File:C1.gif' })])), openverse: () => new Response('error code: 504', { status: 504 }) });
    const r = await searchGifs(params(), { fetchImpl: m.fetch });
    expect(r.count).toBe(1);
    expect(r.notes.join(' ')).toMatch(/Openverse unavailable: HTTP 504/);
    // second call within the cooldown skips Openverse entirely
    const before = m.calls.filter((c) => c.hostname === 'api.openverse.org').length;
    const r2 = await searchGifs(params({ query: 'dog' }), { fetchImpl: m.fetch });
    expect(m.calls.filter((c) => c.hostname === 'api.openverse.org').length).toBe(before);
    expect(r2.notes.join(' ')).toMatch(/cooling down/);
  });

  it('uses Openverse when Commons is down', async () => {
    const m = mockFetch({ commons: () => new Response('down', { status: 500 }), openverse: () => json({ results: [ovImage('1')] }) });
    const r = await searchGifs(params(), { fetchImpl: m.fetch });
    expect(r.results.map((g) => g.source)).toEqual(['openverse']);
    expect(r.notes.join(' ')).toMatch(/Wikimedia Commons unavailable: HTTP 500/);
  });

  it('throws when every source fails', async () => {
    const m = mockFetch({ commons: () => new Response('x', { status: 500 }), openverse: () => new Response('x', { status: 504 }) });
    await expect(searchGifs(params(), { fetchImpl: m.fetch })).rejects.toBeInstanceOf(SearchFailedError);
  });

  it('honours an explicit source', async () => {
    const m = mockFetch({ openverse: () => json({ results: [ovImage('1')] }) });
    const r = await searchGifs(params({ source: 'openverse' }), { fetchImpl: m.fetch });
    expect(r.sourcesQueried).toEqual(['openverse']);
    expect(m.calls.some((c) => c.hostname === 'commons.wikimedia.org')).toBe(false);
  });

  it('blocks unsafe queries without calling upstream', async () => {
    const m = mockFetch({});
    const r = await searchGifs(params({ query: 'porn' }), { fetchImpl: m.fetch });
    expect(r.count).toBe(0);
    expect(r.notes[0]).toMatch(/blocked/);
    expect(m.calls).toHaveLength(0);
  });

  it('caches successful results', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([1, 2, 3].map((i) => commonsPage({ title: `File:C${i}.gif`, index: i })))) });
    const cache = new MemoryCache();
    await searchGifs(params(), { fetchImpl: m.fetch, cache });
    const n = m.calls.length;
    const r = await searchGifs(params({ query: '  CAT ' }), { fetchImpl: m.fetch, cache });
    expect(m.calls.length).toBe(n);
    expect(r.count).toBe(3);
  });
});

describe('getGif', () => {
  it('fetches a Commons file by id', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([commonsPage({ title: 'File:Cat.gif' })])) });
    const g = await getGif('wikimedia:File:Cat.gif', 'safe', { fetchImpl: m.fetch });
    expect(g?.title).toBe('Cat');
    expect(m.calls[0]!.searchParams.get('titles')).toBe('File:Cat.gif');
  });
  it('rejects malformed ids without calling upstream', async () => {
    const m = mockFetch({});
    expect(await getGif('wikimedia:File:A.gif|File:B.gif', 'safe', { fetchImpl: m.fetch })).toBeNull();
    expect(await getGif('giphy:123', 'safe', { fetchImpl: m.fetch })).toBeNull();
    expect(await getGif('openverse:not-a-uuid', 'safe', { fetchImpl: m.fetch })).toBeNull();
    expect(m.calls).toHaveLength(0);
  });
});

describe('fetchJson', () => {
  it('retries once on 429 with a short Retry-After and sends the User-Agent', async () => {
    let n = 0;
    const seen: string[] = [];
    const f = (async (_u: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('User-Agent') ?? '');
      return ++n === 1 ? new Response('slow down', { status: 429, headers: { 'Retry-After': '0' } }) : json({ ok: true });
    }) as unknown as typeof fetch;
    expect(await fetchJson('https://x', { timeoutMs: 1000, fetchImpl: f })).toEqual({ ok: true });
    expect(n).toBe(2);
    expect(seen[0]).toMatch(/^mcp-gifs\/\d+\.\d+\.\d+ \(https:\/\/github\.com\/vikramgorla\/mcp-gifs\)$/);
  });
  it('does not wait on long Retry-After values', async () => {
    const f = (async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } })) as unknown as typeof fetch;
    await expect(fetchJson('https://x', { timeoutMs: 1000, fetchImpl: f })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 120 });
  });
  it('reports timeouts', async () => {
    const f = ((_u: string, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    const err = await fetchJson<never>('https://x', { timeoutMs: 20, fetchImpl: f }).catch((e: unknown) => e as UpstreamError);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).toMatch(/timed out/);
  });
});

describe('size cap', () => {
  it('skips files larger than maxBytes', async () => {
    const big = commonsPage({ title: 'File:Big.gif' });
    big.imageinfo[0]!.size = 50 * 1024 * 1024;
    const m = mockFetch({ commons: () => json(commonsResponse([big, commonsPage({ title: 'File:Small.gif', index: 2 })])), openverse: () => json({ results: [] }) });
    const r = await searchGifs(params({ maxBytes: 10 * 1024 * 1024 }), { fetchImpl: m.fetch });
    expect(r.results.map((g) => g.title)).toEqual(['Small']);
  });
});
