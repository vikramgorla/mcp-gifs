import { describe, expect, it } from 'vitest';
import { commonsPreviewWidth, commonsThumbUrl, commonsTitleFromUploadUrl, mapCommonsPage, pickCommonsPreviewUrl, searchCommons } from '../src/sources/wikimedia.js';
import { licenseName, mapOpenverse, openverseAllowed, searchOpenverse } from '../src/sources/openverse.js';
import { commonsPage, commonsResponse, json, mockFetch, ovImage } from './fixtures.js';

const opts = (f: typeof fetch) => ({ timeoutMs: 1000, fetchImpl: f });

describe('Wikimedia Commons mapping', () => {
  it('maps imageinfo + extmetadata to a Gif', () => {
    const c = mapCommonsPage(
      commonsPage({
        title: 'File:Cat jump.gif',
        frameCount: 24,
        artist: '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane &amp; Co</a>',
        description: '<p>A <b>cat</b> jumping</p>',
        categories: 'Cats|Animated GIF files',
      }),
    );
    expect(c).not.toBeNull();
    const g = c!.gif;
    expect(g).toMatchObject({
      id: 'wikimedia:File:Cat jump.gif',
      title: 'Cat jump',
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Cat_jump.gif',
      previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat_jump.gif/320px-Cat_jump.gif',
      width: 400,
      height: 300,
      fileSizeBytes: 123456,
      animated: true,
      frameCount: 24,
      source: 'wikimedia-commons',
      pageUrl: 'https://commons.wikimedia.org/wiki/Cat_jump.gif',
      author: 'Jane & Co',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Jane',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      attributionRequired: true,
      description: 'A cat jumping',
    });
    expect(g.attribution).toBe('"Cat jump" by Jane & Co, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0), via Wikimedia Commons: https://commons.wikimedia.org/wiki/Cat_jump.gif');
    expect(c!.categories).toEqual(['Cats', 'Animated GIF files']);
  });

  it('handles public domain files without author or license URL, and red-link authors', () => {
    const g = mapCommonsPage(commonsPage({ title: 'File:Old film.gif', license: 'Public domain', licenseUrl: '', attributionRequired: 'false', artist: '<a href="//commons.wikimedia.org/w/index.php?title=User:X&amp;action=edit&amp;redlink=1">X</a>' }))!.gif;
    expect(g.licenseUrl).toBeNull();
    expect(g.attributionRequired).toBe(false);
    expect(g.author).toBe('X');
    expect(g.authorUrl).toBeNull();
  });

  it('rejects non-GIF files', () => {
    expect(mapCommonsPage(commonsPage({ title: 'File:A.png', mime: 'image/png' }))).toBeNull();
  });

  it('derives Commons titles from upload URLs', () => {
    expect(commonsTitleFromUploadUrl('https://upload.wikimedia.org/wikipedia/commons/7/78/Cat_fall_150x300_6fps.gif')).toBe('File:Cat fall 150x300 6fps.gif');
    expect(commonsTitleFromUploadUrl('https://upload.wikimedia.org/wikipedia/commons/2/21/Spinning_Dancer%282%29.gif')).toBe('File:Spinning Dancer(2).gif');
    expect(commonsTitleFromUploadUrl('https://example.org/a.gif')).toBeNull();
  });
});

describe('searchCommons', () => {
  it('keeps only animated GIFs (frameCount > 1), in search rank order', async () => {
    const m = mockFetch({
      commons: () =>
        json(
          commonsResponse([
            commonsPage({ title: 'File:Static.gif', index: 1, frameCount: 1 }),
            commonsPage({ title: 'File:Second.gif', index: 3 }),
            commonsPage({ title: 'File:First.gif', index: 2 }),
          ]),
        ),
    });
    const res = await searchCommons('cat', 5, 'safe', opts(m.fetch));
    expect(res.map((g) => g.title)).toEqual(['First', 'Second']);
    const q = m.calls[0]!.searchParams;
    expect(q.get('gsrsearch')).toBe('filemime:image/gif cat');
    expect(q.get('gsrnamespace')).toBe('6');
    expect(q.get('iiprop')).toContain('metadata');
    expect(q.get('iiurlwidth')).toBe('320');
  });

  it('runs a relaxed OR query when the strict multi-word query returns too few', async () => {
    const m = mockFetch({
      commons: (u) =>
        u.searchParams.get('gsrsearch')!.includes(' OR ')
          ? json(commonsResponse([commonsPage({ title: 'File:A.gif' }), commonsPage({ title: 'File:B.gif', index: 2 })]))
          : json(commonsResponse([commonsPage({ title: 'File:A.gif' })])),
    });
    const res = await searchCommons('happy dance', 3, 'safe', opts(m.fetch));
    expect(m.calls.map((c) => c.searchParams.get('gsrsearch'))).toEqual(['filemime:image/gif happy dance', 'filemime:image/gif (happy OR dance)']);
    expect(res.map((g) => g.title)).toEqual(['A', 'B']);
  });

  it('applies the safety filter to categories', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([commonsPage({ title: 'File:A.gif', categories: 'Nudity' }), commonsPage({ title: 'File:B.gif', index: 2 })])) });
    const res = await searchCommons('art', 5, 'safe', opts(m.fetch));
    expect(res.map((g) => g.title)).toEqual(['B']);
  });
});

describe('Openverse mapping', () => {
  it('names licenses', () => {
    expect(licenseName('by-sa', '3.0')).toBe('CC BY-SA 3.0');
    expect(licenseName('cc0', '1.0')).toBe('CC0 1.0');
    expect(licenseName('pdm', '1.0')).toBe('Public Domain Mark 1.0');
  });
  it('maps a result', () => {
    const g = mapOpenverse(ovImage('1'))!;
    expect(g).toMatchObject({ source: 'openverse', animated: null, license: 'CC BY 2.0', attributionRequired: true, author: 'Jane Doe', url: 'https://live.staticflickr.com/1/1.gif' });
    expect(g.attribution).toContain('via Flickr (found via Openverse)');
  });
  it('never returns a /thumb/ proxy as the GIF url, or non-GIFs', () => {
    expect(mapOpenverse(ovImage('2', { url: 'https://api.openverse.org/v1/images/2/thumb/' }))).toBeNull();
    expect(mapOpenverse(ovImage('3', { filetype: 'png' }))).toBeNull();
  });
  it('drops mature results always and sensitive ones in safe mode', () => {
    expect(openverseAllowed(ovImage('4', { mature: true }) as never, 'moderate')).toBe(false);
    expect(openverseAllowed(ovImage('5', { unstable__sensitivity: ['sensitive_text'] }) as never, 'safe')).toBe(false);
    expect(openverseAllowed(ovImage('5', { unstable__sensitivity: ['sensitive_text'] }) as never, 'moderate')).toBe(true);
  });
  it('queries with extension=gif and never mature=true', async () => {
    const m = mockFetch({ openverse: () => json({ results: [ovImage('1'), ovImage('2', { mature: true })] }) });
    const res = await searchOpenverse('cat', 5, 'safe', opts(m.fetch));
    expect(res).toHaveLength(1);
    const q = m.calls[0]!.searchParams;
    expect(q.get('extension')).toBe('gif');
    expect(q.has('mature')).toBe(false);
    expect(Number(q.get('page_size'))).toBeLessThanOrEqual(20);
  });
});

describe('Commons preview URLs', () => {
  it('picks a thumbnail width strictly below the original, preferring 320', () => {
    expect(commonsPreviewWidth(640)).toBe(320);
    expect(commonsPreviewWidth(320)).toBe(240);
    expect(commonsPreviewWidth(270)).toBe(240);
    expect(commonsPreviewWidth(200)).toBe(160);
    expect(commonsPreviewWidth(50)).toBe(40);
    expect(commonsPreviewWidth(2)).toBe(1);
    expect(commonsPreviewWidth(1)).toBeNull();
  });

  it('builds a hashed Commons thumb URL and preserves percent-encoding', () => {
    expect(commonsThumbUrl('https://upload.wikimedia.org/wikipedia/commons/7/71/Rocket_Launch_%282%29.gif', 240)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rocket_Launch_%282%29.gif/240px-Rocket_Launch_%282%29.gif',
    );
    expect(commonsThumbUrl('https://example.org/a.gif', 240)).toBeNull();
  });

  it('uses Commons thumburl when it is a distinct /thumb/ rendition', () => {
    const provided = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat_jump.gif/320px-Cat_jump.gif';
    expect(
      pickCommonsPreviewUrl({
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Cat_jump.gif',
        thumburl: `${provided}?utm_source=commons.wikimedia.org`,
        width: 400,
      }),
    ).toBe(provided);
  });

  it('synthesizes a smaller /thumb/ URL when Commons returns the original for a narrow GIF', () => {
    const original = 'https://upload.wikimedia.org/wikipedia/commons/7/71/Rocket_Launch_%282%29.gif';
    // Commons sets thumburl = original when the file is already narrower than iiurlwidth (320).
    expect(pickCommonsPreviewUrl({ url: original, thumburl: original, width: 270 })).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rocket_Launch_%282%29.gif/240px-Rocket_Launch_%282%29.gif',
    );
    expect(pickCommonsPreviewUrl({ url: `${original}?utm_content=original`, width: 270 })).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rocket_Launch_%282%29.gif/240px-Rocket_Launch_%282%29.gif',
    );
  });

  it('maps a narrow multi-megabyte GIF to a reduced preview, not the original', () => {
    const original = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Rocket_Launch_(2).gif';
    const c = mapCommonsPage(
      commonsPage({
        title: 'File:Rocket Launch (2).gif',
        width: 270,
        height: 270,
        frameCount: 150,
        thumburl: original, // Commons echoes the original when width < 320
      }),
    );
    expect(c).not.toBeNull();
    expect(c!.gif.url).toBe(original);
    expect(c!.gif.previewUrl).not.toBe(original);
    expect(c!.gif.previewUrl).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Rocket_Launch_(2).gif/240px-Rocket_Launch_(2).gif',
    );
  });
});
