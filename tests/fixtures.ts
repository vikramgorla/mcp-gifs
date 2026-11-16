import { vi } from 'vitest';

export interface PageOpts {
  title: string;
  index?: number;
  frameCount?: number;
  mime?: string;
  width?: number;
  height?: number;
  license?: string;
  licenseUrl?: string;
  artist?: string;
  categories?: string;
  description?: string;
  attributionRequired?: string;
  /** Override Commons thumburl. `null` omits it (Commons sometimes does this for narrow GIFs). */
  thumburl?: string | null;
}

export function commonsPage(o: PageOpts) {
  const file = o.title.replace(/^File:/, '').replace(/ /g, '_');
  const meta: Record<string, { value: string }> = {
    ObjectName: { value: o.title.replace(/^File:/, '').replace(/\.gif$/, '') },
    LicenseShortName: { value: o.license ?? 'CC BY-SA 4.0' },
    Categories: { value: o.categories ?? 'Animated GIF files' },
    AttributionRequired: { value: o.attributionRequired ?? 'true' },
  };
  if (o.licenseUrl !== '') meta.LicenseUrl = { value: o.licenseUrl ?? 'https://creativecommons.org/licenses/by-sa/4.0' };
  if (o.artist !== undefined) meta.Artist = { value: o.artist };
  if (o.description !== undefined) meta.ImageDescription = { value: o.description };
  return {
    pageid: 1,
    ns: 6,
    title: o.title,
    index: o.index ?? 1,
    imageinfo: [
      {
        size: 123456,
        width: o.width ?? 400,
        height: o.height ?? 300,
        ...(o.thumburl === null
          ? {}
          : {
              thumburl:
                o.thumburl ??
                `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/320px-${file}?utm_source=commons.wikimedia.org&utm_content=thumbnail`,
            }),
        url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${file}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original`,
        descriptionurl: `https://commons.wikimedia.org/wiki/${file}`,
        mime: o.mime ?? 'image/gif',
        metadata: [
          { name: 'frameCount', value: o.frameCount ?? 12 },
          { name: 'looped', value: true },
        ],
        extmetadata: meta,
      },
    ],
  };
}

export function commonsResponse(pages: unknown[]) {
  return { batchcomplete: true, query: { pages } };
}

export function ovImage(id: string, extra: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-0000-0000-${id.padStart(12, '0')}`,
    title: `Openverse ${id}`,
    url: `https://live.staticflickr.com/1/${id}.gif`,
    thumbnail: `https://api.openverse.org/v1/images/${id}/thumb/`,
    foreign_landing_url: `https://www.flickr.com/photos/x/${id}`,
    creator: 'Jane Doe',
    creator_url: 'https://www.flickr.com/people/jane',
    license: 'by',
    license_version: '2.0',
    license_url: 'https://creativecommons.org/licenses/by/2.0/',
    provider: 'flickr',
    source: 'flickr',
    filetype: 'gif',
    filesize: 1000,
    width: 200,
    height: 150,
    mature: false,
    tags: [],
    unstable__sensitivity: [],
    ...extra,
  };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** A fetch mock that routes by host and records every requested URL. */
export function mockFetch(routes: { commons?: Handler; openverse?: Handler; klipy?: Handler }) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    calls.push(url);
    if (url.hostname === 'commons.wikimedia.org' && routes.commons) return routes.commons(url, init);
    if (url.hostname === 'api.openverse.org' && routes.openverse) return routes.openverse(url, init);
    if (url.hostname === 'api.klipy.com' && routes.klipy) return routes.klipy(url, init);
    return new Response('not mocked', { status: 500 });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const fmt = (name: string, w: number, size: number) => ({ url: `https://static.klipy.com/${name}`, width: w, height: w, size });

export function klipyItem(slug: string, over: Record<string, unknown> = {}) {
  return {
    id: slug.length,
    slug,
    title: `GIF ${slug}`,
    type: 'gif',
    tags: ['reaction'],
    file: {
      hd: { gif: fmt(`${slug}/hd.gif`, 498, 4_000_000), mp4: fmt(`${slug}/hd.mp4`, 498, 400_000), webp: fmt(`${slug}/hd.webp`, 498, 900_000) },
      md: { gif: fmt(`${slug}/md.gif`, 300, 1_200_000), mp4: fmt(`${slug}/md.mp4`, 300, 150_000) },
      sm: { gif: fmt(`${slug}/sm.gif`, 200, 500_000) },
      xs: { gif: fmt(`${slug}/xs.gif`, 100, 90_000) },
    },
    ...over,
  };
}

export function klipyList(items: unknown[]) {
  return { result: true, data: { data: items, current_page: 1, per_page: 24, has_next: false } };
}
