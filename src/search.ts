import { UpstreamError, type FetchJsonOptions } from './http.js';
import { blockedTerm } from './safety.js';
import { commonsFrameCounts, commonsTitleFromUploadUrl, getCommonsFile, searchCommons } from './sources/wikimedia.js';
import { getOpenverseImage, searchOpenverse } from './sources/openverse.js';
import { toWords } from './text.js';
import type { Gif, ResultCache, Safety, SearchParams, SearchResult, SourceName } from './types.js';

export interface SearchDeps {
  cache?: ResultCache;
  fetchImpl?: typeof fetch;
  cacheTtlSeconds?: number;
}

const COMMONS_TIMEOUT_MS = 8000;
const OPENVERSE_TIMEOUT_MS = 8000;

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

  const cacheKey = `search:v1:${source}:${safety}:${limit}:${maxBytes}:${words.join(' ')}`;
  const cached = (await deps.cache?.get(cacheKey)) as SearchResult | undefined;
  if (cached) return { ...cached, query };

  const commonsOpts: FetchJsonOptions = { timeoutMs: COMMONS_TIMEOUT_MS, fetchImpl: deps.fetchImpl };
  const ovOpts: FetchJsonOptions = { timeoutMs: OPENVERSE_TIMEOUT_MS, fetchImpl: deps.fetchImpl, maxRetryAfterSeconds: 0 };
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
  let failures = 0;
  let degraded = false;

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
  if (failures === 0 && !degraded) await deps.cache?.put(cacheKey, out, deps.cacheTtlSeconds ?? 600);
  return out;
}

/** Fetch a single GIF by the id returned from search_gifs. */
export async function getGif(id: string, safety: Safety, deps: SearchDeps = {}): Promise<Gif | null> {
  const opts: FetchJsonOptions = { timeoutMs: COMMONS_TIMEOUT_MS, fetchImpl: deps.fetchImpl };
  if (/[|\r\n]/.test(id) || id.length > 300) return null;
  if (id.startsWith('wikimedia:')) return getCommonsFile(id.slice('wikimedia:'.length), safety, opts);
  if (id.startsWith('openverse:')) return getOpenverseImage(id.slice('openverse:'.length), safety, { ...opts, timeoutMs: OPENVERSE_TIMEOUT_MS });
  return null;
}
