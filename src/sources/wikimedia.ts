import { fetchJson, type FetchJsonOptions } from '../http.js';
import { isGifAllowed } from '../safety.js';
import { buildAttribution, cleanUrl, stripHtml, toWords, truncate } from '../text.js';
import type { Gif, Safety } from '../types.js';

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const PREVIEW_WIDTH = 320;
const EXTMETA_FIELDS = 'ObjectName|ImageDescription|Artist|LicenseShortName|LicenseUrl|AttributionRequired|Categories|UsageTerms';

interface ExtValue { value?: string | number }
interface ImageInfo {
  url: string;
  descriptionurl: string;
  thumburl?: string;
  width: number;
  height: number;
  size?: number;
  mime?: string;
  metadata?: Array<{ name: string; value: unknown }> | null;
  extmetadata?: Record<string, ExtValue | undefined>;
}
interface Page { pageid?: number; title: string; index?: number; missing?: boolean; imageinfo?: ImageInfo[] }
interface QueryResponse { query?: { pages?: Page[] }; error?: { code: string; info: string } }

export interface CommonsCandidate { gif: Gif; categories: string[] }

function ext(info: ImageInfo, key: string): string {
  const v = info.extmetadata?.[key]?.value;
  return v === undefined || v === null ? '' : String(v);
}

function frameCountOf(info: ImageInfo): number | null {
  const fc = info.metadata?.find((m) => m.name === 'frameCount')?.value;
  return typeof fc === 'number' ? fc : null;
}

function authorUrlFrom(artistHtml: string): string | null {
  const href = /href="([^"]+)"/.exec(artistHtml)?.[1];
  if (!href) return null;
  const decoded = href.replace(/&amp;/g, '&');
  const abs = decoded.startsWith('//') ? `https:${decoded}` : decoded;
  if (!/^https?:\/\//.test(abs) || /action=edit&redlink=1/.test(abs)) return null;
  return abs;
}

/** Map one Commons page (with imageinfo) to our Gif shape. Returns null when unusable. */
export function mapCommonsPage(page: Page): CommonsCandidate | null {
  const info = page.imageinfo?.[0];
  if (!info || info.mime !== 'image/gif' || !info.url) return null;
  const title = stripHtml(ext(info, 'ObjectName')) || page.title.replace(/^File:/, '').replace(/\.gif$/i, '');
  const artistHtml = ext(info, 'Artist');
  const author = truncate(stripHtml(artistHtml), 200) || null;
  const license = stripHtml(ext(info, 'LicenseShortName')) || stripHtml(ext(info, 'UsageTerms')) || 'See file page';
  const licenseUrl = ext(info, 'LicenseUrl') || null;
  const pageUrl = info.descriptionurl;
  const frameCount = frameCountOf(info);
  const description = truncate(stripHtml(ext(info, 'ImageDescription')), 300) || null;
  const categories = ext(info, 'Categories').split('|').map((c) => c.trim()).filter(Boolean);
  const gif: Gif = {
    id: `wikimedia:${page.title}`,
    title,
    url: cleanUrl(info.url),
    previewUrl: cleanUrl(info.thumburl ?? info.url),
    width: info.width,
    height: info.height,
    fileSizeBytes: info.size ?? null,
    animated: frameCount === null ? null : frameCount > 1,
    frameCount,
    source: 'wikimedia-commons',
    pageUrl,
    author,
    authorUrl: authorUrlFrom(artistHtml),
    license,
    licenseUrl,
    attributionRequired: ext(info, 'AttributionRequired') !== 'false',
    attribution: buildAttribution({ title, author, license, licenseUrl, pageUrl, sourceLabel: 'Wikimedia Commons' }),
    description,
  };
  return { gif, categories };
}

function baseParams(): URLSearchParams {
  return new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata|metadata',
    iiurlwidth: String(PREVIEW_WIDTH),
    iiextmetadatafilter: EXTMETA_FIELDS,
    iiextmetadatalanguage: 'en',
    iimetadataversion: 'latest',
    origin: '*',
  });
}

function keep(c: CommonsCandidate | null, safety: Safety, maxBytes: number): c is CommonsCandidate {
  return !!c && c.gif.animated === true && (c.gif.fileSizeBytes ?? 0) <= maxBytes && isGifAllowed({ ...c.gif, categories: c.categories }, safety);
}

async function runSearch(search: string, gsrlimit: number, opts: FetchJsonOptions): Promise<Page[]> {
  const params = baseParams();
  params.set('generator', 'search');
  params.set('gsrsearch', search);
  params.set('gsrnamespace', '6');
  params.set('gsrlimit', String(gsrlimit));
  const data = await fetchJson<QueryResponse>(`${COMMONS_API}?${params}`, opts);
  if (data.error) throw new Error(`Commons API error: ${data.error.info}`);
  return [...(data.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Search Commons for animated GIFs. Runs the strict (all words) query first; if
 * that yields fewer than `limit` animated results and the query has several
 * words, runs one relaxed OR query. Sequential on purpose (low concurrency).
 */
export async function searchCommons(query: string, limit: number, safety: Safety, opts: FetchJsonOptions, maxBytes = Infinity): Promise<Gif[]> {
  const words = toWords(query);
  if (words.length === 0) return [];
  const gsrlimit = Math.min(50, Math.max(20, limit * 4));
  const out = new Map<string, Gif>();
  const add = (pages: Page[]) => {
    for (const p of pages) {
      const c = mapCommonsPage(p);
      if (keep(c, safety, maxBytes) && !out.has(c.gif.url)) out.set(c.gif.url, c.gif);
    }
  };
  add(await runSearch(`filemime:image/gif ${words.join(' ')}`, gsrlimit, opts));
  if (out.size < limit && words.length > 1) {
    add(await runSearch(`filemime:image/gif (${words.join(' OR ')})`, gsrlimit, opts));
  }
  return [...out.values()].slice(0, limit);
}

/** Fetch one Commons file by title ("File:Foo.gif"). */
export async function getCommonsFile(title: string, safety: Safety, opts: FetchJsonOptions): Promise<Gif | null> {
  const params = baseParams();
  params.set('titles', title.startsWith('File:') ? title : `File:${title}`);
  const data = await fetchJson<QueryResponse>(`${COMMONS_API}?${params}`, opts);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return null;
  const c = mapCommonsPage(page);
  if (!c || !isGifAllowed({ ...c.gif, categories: c.categories }, safety)) return null;
  return c.gif;
}

const UPLOAD_RE = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:[0-9a-f]\/[0-9a-f]{2}\/)([^/?#]+)$/;

/** "https://upload.wikimedia.org/wikipedia/commons/7/78/Foo_bar.gif" -> "File:Foo bar.gif" */
export function commonsTitleFromUploadUrl(url: string): string | null {
  const m = UPLOAD_RE.exec(url.split('?')[0] ?? '');
  if (!m?.[1]) return null;
  try {
    return `File:${decodeURIComponent(m[1]).replace(/_/g, ' ')}`;
  } catch {
    return null;
  }
}

/**
 * Look up frame counts for Commons files in one batched request (max 50 titles).
 * Returns a map title -> frameCount (null when unknown). Used to verify that
 * Openverse results hosted on Commons are actually animated.
 */
export async function commonsFrameCounts(titles: string[], opts: FetchJsonOptions): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const unique = [...new Set(titles)].slice(0, 50);
  if (unique.length === 0) return out;
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'metadata',
    iimetadataversion: 'latest', titles: unique.join('|'), origin: '*',
  });
  const data = await fetchJson<QueryResponse>(`${COMMONS_API}?${params}`, opts);
  for (const p of data.query?.pages ?? []) {
    const info = p.imageinfo?.[0];
    out.set(p.title, info ? frameCountOf(info) : null);
  }
  return out;
}
