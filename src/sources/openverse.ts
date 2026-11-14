import { fetchJson, type FetchJsonOptions } from '../http.js';
import { isGifAllowed } from '../safety.js';
import { buildAttribution, stripHtml, toWords, truncate } from '../text.js';
import type { Gif, Safety } from '../types.js';

export const OPENVERSE_API = 'https://api.openverse.org/v1/images/';
/** Anonymous Openverse requests are capped at page_size 20. */
const MAX_PAGE_SIZE = 20;

export interface OpenverseImage {
  id: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  foreign_landing_url?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  license: string;
  license_version?: string | null;
  license_url?: string | null;
  provider?: string | null;
  source?: string | null;
  filetype?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  mature?: boolean;
  tags?: Array<{ name: string }> | null;
  unstable__sensitivity?: string[] | null;
}
interface OpenverseResponse { results?: OpenverseImage[] }

export function licenseName(license: string, version?: string | null): string {
  const l = license.toLowerCase();
  if (l === 'cc0') return 'CC0 1.0';
  if (l === 'pdm') return 'Public Domain Mark 1.0';
  return `CC ${l.toUpperCase()}${version ? ` ${version}` : ''}`;
}

const PROVIDER_LABELS: Record<string, string> = { wikimedia: 'Wikimedia Commons', flickr: 'Flickr' };

export function mapOpenverse(img: OpenverseImage): Gif | null {
  if (!img.url || (img.filetype && img.filetype.toLowerCase() !== 'gif')) return null;
  // Prefer an original file URL; never hand out an Openverse /thumb/ proxy as the GIF itself.
  if (/\/thumb\/?$/.test(img.url)) return null;
  const title = truncate(stripHtml(img.title ?? ''), 200) || 'Untitled GIF';
  const author = img.creator ? truncate(stripHtml(img.creator), 200) : null;
  const license = licenseName(img.license, img.license_version);
  const licenseUrl = img.license_url ?? null;
  const pageUrl = img.foreign_landing_url ?? `https://openverse.org/image/${img.id}`;
  const providerLabel = PROVIDER_LABELS[img.source ?? img.provider ?? ''] ?? (img.source ?? img.provider ?? 'the original source');
  return {
    id: `openverse:${img.id}`,
    title,
    url: img.url,
    previewUrl: img.thumbnail ?? img.url,
    width: img.width ?? 0,
    height: img.height ?? 0,
    fileSizeBytes: img.filesize ?? null,
    animated: null,
    frameCount: null,
    source: 'openverse',
    pageUrl,
    author,
    authorUrl: img.creator_url ?? null,
    license,
    licenseUrl,
    attributionRequired: !['cc0', 'pdm'].includes(img.license.toLowerCase()),
    attribution: buildAttribution({ title, author, license, licenseUrl, pageUrl, sourceLabel: `${providerLabel} (found via Openverse)` }),
    description: null,
  };
}

export function openverseAllowed(img: OpenverseImage, safety: Safety): boolean {
  if (img.mature === true) return false;
  if (safety === 'safe' && (img.unstable__sensitivity?.length ?? 0) > 0) return false;
  return isGifAllowed({ title: img.title ?? '', description: null, categories: (img.tags ?? []).map((t) => t.name) }, safety);
}

export async function searchOpenverse(query: string, limit: number, safety: Safety, opts: FetchJsonOptions): Promise<Gif[]> {
  const words = toWords(query);
  if (words.length === 0) return [];
  // Never send mature=true: the API default excludes mature results.
  const params = new URLSearchParams({
    q: words.join(' '),
    extension: 'gif',
    page_size: String(Math.min(MAX_PAGE_SIZE, Math.max(limit * 2, 10))),
  });
  const data = await fetchJson<OpenverseResponse>(`${OPENVERSE_API}?${params}`, opts);
  const out: Gif[] = [];
  for (const img of data.results ?? []) {
    if (!openverseAllowed(img, safety)) continue;
    const g = mapOpenverse(img);
    if (g) out.push(g);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getOpenverseImage(id: string, safety: Safety, opts: FetchJsonOptions): Promise<Gif | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const img = await fetchJson<OpenverseImage>(`${OPENVERSE_API}${id}/`, opts);
  if (!openverseAllowed(img, safety)) return null;
  return mapOpenverse(img);
}
