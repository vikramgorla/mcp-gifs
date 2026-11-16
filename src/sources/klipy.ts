import { fetchJson, type FetchJsonOptions } from '../http.js';
import { stripHtml, toWords, truncate } from '../text.js';
import type { Gif, Safety } from '../types.js';

/**
 * KLIPY GIF API (https://docs.klipy.com). The API key is part of the path:
 * `https://api.klipy.com/api/v1/{KEY}/gifs/search`. The key comes only from
 * the operator's environment (KLIPY_API_KEY), never from MCP clients, and it
 * is never echoed back: errors from fetchJson carry the status, not the URL.
 *
 * KLIPY integration rules this module follows (see docs/KLIPY.md):
 * - Search and Trending results are returned in KLIPY's order and are not
 *   reordered, filtered or suppressed here. Content filtering is KLIPY's
 *   `rating` parameter plus the filters set in the KLIPY Partner Panel.
 * - Media is never fetched, stored or re-hosted: results carry KLIPY's own
 *   media URLs, which clients load directly.
 * - KLIPY results are never mixed with another provider's results.
 */
export const KLIPY_API = 'https://api.klipy.com/api/v1';
/** KLIPY accepts per_page 8-50. */
const MIN_PER_PAGE = 8;
const MAX_PER_PAGE = 50;

export const KLIPY_ATTRIBUTION_URL = 'https://docs.klipy.com/attribution';
export const KLIPY_POWERED_BY = 'Powered by KLIPY';
export const KLIPY_SEARCH_PLACEHOLDER = 'Search KLIPY';

interface KlipyFormat { url: string; width?: number; height?: number; size?: number }
interface KlipyRendition { gif?: KlipyFormat; webp?: KlipyFormat; mp4?: KlipyFormat; jpg?: KlipyFormat; webm?: KlipyFormat }
export interface KlipyItem {
  id?: number | string;
  slug?: string;
  title?: string | null;
  type?: string;
  tags?: string[] | null;
  file?: { hd?: KlipyRendition; md?: KlipyRendition; sm?: KlipyRendition; xs?: KlipyRendition };
}
interface KlipyListResponse { result?: boolean; data?: { data?: KlipyItem[]; has_next?: boolean } }
interface KlipyItemResponse { result?: boolean; data?: KlipyItem | { data?: KlipyItem } }

/** Our safety levels mapped to KLIPY's MPA-style rating parameter. */
export function klipyRating(safety: Safety): 'g' | 'pg-13' {
  return safety === 'safe' ? 'g' : 'pg-13';
}

export function isKlipyLocale(locale: string): boolean {
  return /^[a-z]{2}_[A-Z]{2}$/.test(locale);
}

/**
 * Largest GIF rendition that fits within maxBytes (unknown sizes count as
 * fitting). If none fits, the smallest one is used: KLIPY results are never
 * dropped for size, so the result set stays as KLIPY composed it.
 */
function pickRendition(file: NonNullable<KlipyItem['file']>, maxBytes: number): { r: KlipyRendition; gif: KlipyFormat } | null {
  let smallest: { r: KlipyRendition; gif: KlipyFormat } | null = null;
  for (const key of ['hd', 'md', 'sm', 'xs'] as const) {
    const r = file[key];
    if (!r?.gif?.url) continue;
    if ((r.gif.size ?? 0) <= maxBytes) return { r, gif: r.gif };
    smallest = { r, gif: r.gif };
  }
  return smallest;
}

export function mapKlipy(item: KlipyItem, maxBytes = Infinity): Gif | null {
  // No customer_id is sent, so KLIPY returns no ad items; anything without GIF files cannot be shown as a GIF.
  if (!item.slug || !item.file || (item.type && item.type !== 'gif')) return null;
  const picked = pickRendition(item.file, maxBytes);
  if (!picked) return null;
  const { r, gif } = picked;
  const preview = item.file.sm?.gif ?? item.file.xs?.gif ?? gif;
  const title = truncate(stripHtml(item.title ?? ''), 200) || 'Untitled GIF';
  const pageUrl = `https://klipy.com/gifs/${encodeURIComponent(item.slug)}`;
  return {
    id: `klipy:${item.slug}`,
    title,
    url: gif.url,
    previewUrl: preview.url,
    mp4Url: r.mp4?.url ?? null,
    webpUrl: r.webp?.url ?? null,
    width: gif.width ?? 0,
    height: gif.height ?? 0,
    fileSizeBytes: gif.size ?? null,
    animated: null,
    frameCount: null,
    source: 'klipy',
    pageUrl,
    author: null,
    authorUrl: null,
    license: 'KLIPY API terms',
    licenseUrl: KLIPY_ATTRIBUTION_URL,
    attributionRequired: true,
    attribution: `"${title}" · ${KLIPY_POWERED_BY} · ${pageUrl}`,
    description: null,
  };
}

function base(apiKey: string): string {
  return `${KLIPY_API}/${encodeURIComponent(apiKey)}/gifs`;
}

function listParams(limit: number, safety: Safety, locale?: string): URLSearchParams {
  const p = new URLSearchParams({
    per_page: String(Math.min(MAX_PER_PAGE, Math.max(MIN_PER_PAGE, limit))),
    page: '1',
    rating: klipyRating(safety),
  });
  if (locale && isKlipyLocale(locale)) p.set('locale', locale);
  return p;
}

/** First `limit` items of KLIPY's list, in KLIPY's order. */
function collect(data: KlipyListResponse, limit: number, maxBytes: number): Gif[] {
  const out: Gif[] = [];
  for (const item of data.data?.data ?? []) {
    const g = mapKlipy(item, maxBytes);
    if (g) out.push(g);
    if (out.length >= limit) break;
  }
  return out;
}

export interface KlipyQuery { apiKey: string; limit: number; safety: Safety; locale?: string; maxBytes?: number }

export async function searchKlipy(query: string, q: KlipyQuery, opts: FetchJsonOptions): Promise<Gif[]> {
  const words = toWords(query);
  if (words.length === 0) return [];
  const p = listParams(q.limit, q.safety, q.locale);
  p.set('q', words.join(' '));
  const data = await fetchJson<KlipyListResponse>(`${base(q.apiKey)}/search?${p}`, opts);
  return collect(data, q.limit, q.maxBytes ?? Infinity);
}

export async function trendingKlipy(q: KlipyQuery, opts: FetchJsonOptions): Promise<Gif[]> {
  const data = await fetchJson<KlipyListResponse>(`${base(q.apiKey)}/trending?${listParams(q.limit, q.safety, q.locale)}`, opts);
  return collect(data, q.limit, q.maxBytes ?? Infinity);
}

export async function getKlipyGif(slug: string, apiKey: string, opts: FetchJsonOptions): Promise<Gif | null> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(slug)) return null;
  const res = await fetchJson<KlipyItemResponse>(`${base(apiKey)}/${slug}`, opts);
  const d = res.data;
  const item = d && 'data' in d && d.data && !('file' in d) ? d.data : (d as KlipyItem | undefined);
  if (!item) return null;
  return mapKlipy(item);
}
