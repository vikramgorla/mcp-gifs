import { UpstreamError, type FetchJsonOptions } from './http.js';
import { blockedTerm } from './safety.js';
import { commonsFrameCounts, commonsTitleFromUploadUrl, getCommonsFile, searchCommons } from './sources/wikimedia.js';
import { getOpenverseImage, searchOpenverse } from './sources/openverse.js';
import { getKlipyGif, searchKlipy, trendingKlipy } from './sources/klipy.js';
import { toWords } from './text.js';
import type { Gif, ResultCache, Safety, SearchParams, SearchResult, SourceName, SourceParam } from './types.js';

export interface SearchDeps {
  cache?: ResultCache;
  fetchImpl?: typeof fetch;
  cacheTtlSeconds?: number;
  /** Operator's KLIPY API key (env KLIPY_API_KEY). When unset, KLIPY is off. */
  klipyApiKey?: string;
}

export const KLIPY_TIMEOUT_MS = 5000;
export const KLIPY_NOTE =
  'Powered by KLIPY. Show "Powered by KLIPY" wherever these GIFs are displayed, keep them in this order, load media from the URLs given (do not re-host), and do not mix them with GIFs from other providers in the same set. If you offer a search box for these results, its placeholder must read "Search KLIPY".';
export const KLIPY_NOT_CONFIGURED = 'KLIPY is not configured on this server (no KLIPY_API_KEY), so meme/reaction GIFs are unavailable.';

export const COMMONS_TIMEOUT_MS = 8000;
/** Used when the client asked for Openverse explicitly. */
export const OPENVERSE_TIMEOUT_MS = 8000;
/**
 * Shorter cap in auto mode so a slow Openverse does not delay a Commons
 * response. Timeouts still trip the circuit breaker.
 */
export const OPENVERSE_AUTO_TIMEOUT_MS = 2000;

export function openverseTimeoutMs(source: SourceParam): number {
  return source === 'auto' ? OPENVERSE_AUTO_TIMEOUT_MS : OPENVERSE_TIMEOUT_MS;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class SearchFailedError extends Error {}

/**
 * Tiny per-isolate circuit breaker for Openverse: after a failure (504s and
 * timeouts are common for anonymous use) skip it for a while instead of making
 * every request wait on it again. A 429 Retry-After extends the pause.
 */
const OPENVERSE_COOLDOWN_MS = 60_000;
let openverseCooldownUntil = 0;
export function resetOpenverseCooldown(): void {
  openverseCooldownUntil = 0;
}
function tripOpenverse(err: unknown): void {
  const retry = err instanceof UpstreamError && err.retryAfterSeconds ? Math.min(err.retryAfterSeconds * 1000, 600_000) : 0;
  openverseCooldownUntil = Date.now() + Math.max(OPENVERSE_COOLDOWN_MS, retry);
}

/** Drop Openverse results hosted on Commons that Commons reports as static (single frame). */
async function verifyOpenverseAnimation(gifs: Gif[], opts: FetchJsonOptions, notes: string[]): Promise<Gif[]> {
  const titled = gifs.map((g) => ({ g, title: commonsTitleFromUploadUrl(g.url) }));
  const titles = titled.flatMap((t) => (t.title ? [t.title] : []));
  if (titles.length === 0) return gifs;
  try {
    const counts = await commonsFrameCounts(titles, opts);
    return titled.flatMap(({ g, title }) => {
      if (!title || !counts.has(title)) return [g];
      const fc = counts.get(title) ?? null;
      if (fc !== null && fc <= 1) return [];
      return [{ ...g, frameCount: fc, animated: fc === null ? null : true }];
    });
  } catch (err) {
    notes.push(`Could not verify animation for Openverse results (${describeError(err)}).`);
    return gifs;
  }
}

export async function searchGifs(params: SearchParams, deps: SearchDeps = {}): Promise<SearchResult> {
  const { query, limit, safety, source } = params;
  const maxBytes = params.maxBytes ?? Infinity;
  const notes: string[] = [];
  const sourcesQueried: SourceName[] = [];
  const base = { query, safety };

  const blocked = blockedTerm(query, safety);
  if (blocked) {
    return { ...base, count: 0, results: [], sourcesQueried, notes: [`Query blocked by the "${safety}" safety filter (matched "${blocked}").`] };
  }
  const words = toWords(query);
  if (words.length === 0) {
    return { ...base, count: 0, results: [], sourcesQueried, notes: ['Query has no searchable words.'] };
  }

  const klipyKey = deps.klipyApiKey || undefined;
  const cacheKey = `search:v3:${source}:${klipyKey ? 'k' : '-'}:${params.locale ?? ''}:${safety}:${limit}:${maxBytes}:${words.join(' ')}`;
  const cached = (await deps.cache?.get(cacheKey)) as SearchResult | undefined;
  if (cached) return { ...cached, query };

  let failures = 0;
  let degraded = false;
  /** When KLIPY was consulted, the open-source fallback may not outlive KLIPY's own cache lifetime. */
  let klipyCacheCap = Infinity;

  // KLIPY (reaction/meme GIFs, the kind chat apps show) goes first when configured.
  // Its results are returned on their own, never mixed with open-licence results.
  if (source === 'klipy' && !klipyKey) {
    return { ...base, count: 0, results: [], sourcesQueried, notes: [KLIPY_NOT_CONFIGURED] };
  }
  if (klipyKey && (source === 'auto' || source === 'klipy')) {
    sourcesQueried.push('klipy');
    try {
      const { gifs: k, cacheSeconds } = await searchKlipy(query, { apiKey: klipyKey, limit, safety, locale: params.locale, maxBytes }, { timeoutMs: KLIPY_TIMEOUT_MS, fetchImpl: deps.fetchImpl, maxRetryAfterSeconds: 0 });
      if (k.length > 0 || source === 'klipy') {
        const klipyNotes = k.length ? [KLIPY_NOTE] : ['No matching GIFs found on KLIPY. Try different keywords.'];
        const out: SearchResult = { ...base, count: k.length, results: k, sourcesQueried, notes: klipyNotes };
        // Cache only as long as KLIPY's response headers allow; no fixed TTL.
        if (cacheSeconds > 0) await deps.cache?.put(cacheKey, out, cacheSeconds);
        return out;
      }
      klipyCacheCap = cacheSeconds;
      notes.push('KLIPY had no matches; showing openly licensed GIFs instead.');
    } catch (err) {
      if (source === 'klipy') throw new SearchFailedError(`KLIPY unavailable: ${describeError(err)}.`);
      failures++;
      degraded = true;
      notes.push(`KLIPY unavailable (${describeError(err)}); showing openly licensed GIFs instead.`);
    }
  }

  const commonsOpts: FetchJsonOptions = { timeoutMs: COMMONS_TIMEOUT_MS, fetchImpl: deps.fetchImpl };
  const ovOpts: FetchJsonOptions = { timeoutMs: openverseTimeoutMs(source), fetchImpl: deps.fetchImpl, maxRetryAfterSeconds: 0 };
  const results: Gif[] = [];
  const seen = new Set<string>();
  const push = (gifs: Gif[]) => {
    for (const g of gifs) {
      if (results.length >= limit) break;
      if (seen.has(g.url)) continue;
      seen.add(g.url);
      results.push(g);
    }
  };
  if (source === 'auto' || source === 'wikimedia') {
    sourcesQueried.push('wikimedia-commons');
    try {
      push(await searchCommons(query, limit, safety, commonsOpts, maxBytes));
    } catch (err) {
      failures++;
      notes.push(`Wikimedia Commons unavailable: ${describeError(err)}.`);
    }
  }

  const wantOpenverse = source === 'openverse' || (source === 'auto' && results.length < limit);
  if (wantOpenverse && source === 'auto' && Date.now() < openverseCooldownUntil) {
    degraded = true;
    notes.push('Openverse fallback skipped: it failed recently and is cooling down.');
  } else if (wantOpenverse) {
    sourcesQueried.push('openverse');
    try {
      const ov = await searchOpenverse(query, Math.min(20, (limit - results.length) * 2), safety, ovOpts);
      push(await verifyOpenverseAnimation(ov.filter((g) => !seen.has(g.url) && (g.fileSizeBytes ?? 0) <= maxBytes), commonsOpts, notes));
    } catch (err) {
      failures++;
      tripOpenverse(err);
      notes.push(`Openverse unavailable: ${describeError(err)}${source === 'auto' ? ' (fallback skipped)' : ''}.`);
    }
  }

  if (sourcesQueried.length > 0 && failures === sourcesQueried.length) {
    throw new SearchFailedError(`All GIF sources failed. ${notes.join(' ')}`);
  }
  if (results.length === 0) notes.push('No matching animated GIFs found. Try broader or different keywords.');

  const out: SearchResult = { ...base, count: results.length, results, sourcesQueried, notes };
  const ttl = Math.min(deps.cacheTtlSeconds ?? 600, klipyCacheCap);
  if (failures === 0 && !degraded && ttl > 0) await deps.cache?.put(cacheKey, out, ttl);
  return out;
}

/** Fetch a single GIF by the id returned from search_gifs. */
export async function getGif(id: string, safety: Safety, deps: SearchDeps = {}): Promise<Gif | null> {
  const opts: FetchJsonOptions = { timeoutMs: COMMONS_TIMEOUT_MS, fetchImpl: deps.fetchImpl };
  if (/[|\r\n]/.test(id) || id.length > 300) return null;
  if (id.startsWith('wikimedia:')) return getCommonsFile(id.slice('wikimedia:'.length), safety, opts);
  if (id.startsWith('klipy:')) {
    if (!deps.klipyApiKey) return null;
    return getKlipyGif(id.slice('klipy:'.length), deps.klipyApiKey, { ...opts, timeoutMs: KLIPY_TIMEOUT_MS });
  }
  if (id.startsWith('openverse:')) return getOpenverseImage(id.slice('openverse:'.length), safety, { ...opts, timeoutMs: OPENVERSE_TIMEOUT_MS });
  return null;
}

export interface TrendingParams { limit: number; safety: Safety; locale?: string; maxBytes?: number }

/** Trending reaction GIFs, like the default tab of a chat app's GIF picker. KLIPY only. */
export async function trendingGifs(params: TrendingParams, deps: SearchDeps = {}): Promise<SearchResult> {
  const base = { query: '', safety: params.safety };
  if (!deps.klipyApiKey) return { ...base, count: 0, results: [], sourcesQueried: [], notes: [KLIPY_NOT_CONFIGURED] };
  const maxBytes = params.maxBytes ?? Infinity;
  const cacheKey = `trending:v2:${params.locale ?? ''}:${params.safety}:${params.limit}:${maxBytes}`;
  const cached = (await deps.cache?.get(cacheKey)) as SearchResult | undefined;
  if (cached) return cached;
  let results: Gif[];
  let cacheSeconds: number;
  try {
    ({ gifs: results, cacheSeconds } = await trendingKlipy({ apiKey: deps.klipyApiKey, ...params, maxBytes }, { timeoutMs: KLIPY_TIMEOUT_MS, fetchImpl: deps.fetchImpl, maxRetryAfterSeconds: 0 }));
  } catch (err) {
    throw new SearchFailedError(`KLIPY unavailable: ${describeError(err)}.`);
  }
  const out: SearchResult = { ...base, count: results.length, results, sourcesQueried: ['klipy'], notes: [KLIPY_NOTE] };
  // Cache only as long as KLIPY's response headers allow; no fixed TTL.
  if (cacheSeconds > 0) await deps.cache?.put(cacheKey, out, cacheSeconds);
  return out;
}
