// Tool results as schema.org ImageObjects (https://schema.org/ImageObject): the standard vocabulary for an image with
// its renditions, creator, credit line, copyright notice, license and provider (the fields Google Images and IPTC photo
// metadata use). Any client can read them without knowing this server. Fields schema.org has no property for keep
// their own names: `animated`, `frameCount`, `attributionRequired`, `attribution` (a ready-made line with title and link).
import { z } from 'zod';
import { KLIPY_ATTRIBUTION_URL } from './sources/klipy.js';
import type { Gif, SourceName } from './types.js';

const PROVIDERS: Record<SourceName, { name: string; url: string }> = {
  klipy: { name: 'KLIPY', url: 'https://klipy.com' },
  'wikimedia-commons': { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org' },
  openverse: { name: 'Openverse', url: 'https://openverse.org' },
};

const organization = z.object({ '@type': z.literal('Organization'), name: z.string(), url: z.string() });
const rendition = z.object({
  '@type': z.literal('MediaObject'),
  contentUrl: z.string(),
  encodingFormat: z.enum(['video/mp4', 'image/webp']),
});

export const imageObjectSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('ImageObject'),
  identifier: z.string().describe('Pass to get_gif to fetch this GIF again.'),
  name: z.string(),
  description: z.string().optional(),
  contentUrl: z.string().describe('Direct URL of the original animated GIF.'),
  encodingFormat: z.literal('image/gif'),
  thumbnailUrl: z.string().describe('Smaller preview (about 320px wide, or a reduced Commons thumb when the original is narrower).'),
  encoding: z.array(rendition).optional().describe('The same clip in other formats: MP4 (smaller, what chat apps send), animated WebP. KLIPY results.'),
  width: z.number(),
  height: z.number(),
  contentSize: z.string().optional().describe('File size of the GIF, e.g. "245 KB".'),
  url: z.string().describe('The page of this GIF at its provider, with its full license details.'),
  creator: z.object({ '@type': z.literal('Person'), name: z.string(), url: z.string().optional() }).optional(),
  creditText: z.string().optional().describe('The credit this GIF needs, without its title or link: the same "Powered by KLIPY" for every KLIPY result; author and license for an openly licensed file that requires attribution; absent when none is required.'),
  copyrightNotice: z.string().optional(),
  license: z.object({ '@type': z.literal('CreativeWork'), name: z.string(), url: z.string().optional() }),
  acquireLicensePage: z.string().describe('Where to read how this GIF may be used.'),
  provider: organization,
  isAccessibleForFree: z.literal(true),
  animated: z.boolean().nullable().describe('true = verified frameCount > 1; null = not verifiable for this source.'),
  frameCount: z.number().nullable(),
  attributionRequired: z.boolean(),
  attribution: z.string().describe('Ready-made attribution line (title, credit, link) for showing next to the GIF.'),
});
export type ImageObject = z.infer<typeof imageObjectSchema>;

/** "245 KB" / "1.4 MB" for a size in bytes. */
const sizeText = (bytes: number): string => (bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`);

/** One GIF as a schema.org ImageObject (absent values are left out, not null). */
export function toImageObject(g: Gif): ImageObject {
  const encoding = [
    ...(g.mp4Url ? [{ '@type': 'MediaObject' as const, contentUrl: g.mp4Url, encodingFormat: 'video/mp4' as const }] : []),
    ...(g.webpUrl ? [{ '@type': 'MediaObject' as const, contentUrl: g.webpUrl, encodingFormat: 'image/webp' as const }] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    identifier: g.id,
    name: g.title,
    ...(g.description ? { description: g.description } : {}),
    contentUrl: g.url,
    encodingFormat: 'image/gif',
    thumbnailUrl: g.previewUrl,
    ...(encoding.length ? { encoding } : {}),
    width: g.width,
    height: g.height,
    ...(g.fileSizeBytes ? { contentSize: sizeText(g.fileSizeBytes) } : {}),
    url: g.pageUrl,
    ...(g.author ? { creator: { '@type': 'Person' as const, name: g.author, ...(g.authorUrl ? { url: g.authorUrl } : {}) } } : {}),
    ...(g.creditText ? { creditText: g.creditText } : {}),
    ...(g.author && g.attributionRequired ? { copyrightNotice: `© ${g.author}` } : {}),
    license: { '@type': 'CreativeWork', name: g.license, ...(g.licenseUrl ? { url: g.licenseUrl } : {}) },
    acquireLicensePage: g.source === 'klipy' ? KLIPY_ATTRIBUTION_URL : g.pageUrl,
    provider: { '@type': 'Organization', ...PROVIDERS[g.source] },
    isAccessibleForFree: true,
    animated: g.animated,
    frameCount: g.frameCount,
    attributionRequired: g.attributionRequired,
    attribution: g.attribution,
  };
}
