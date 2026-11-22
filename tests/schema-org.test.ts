import { describe, expect, it } from 'vitest';
import { imageObjectSchema, toImageObject } from '../src/schema-org.js';
import type { Gif } from '../src/types.js';

const base: Gif = {
  id: 'klipy:dance-1', title: 'Happy dance', url: 'https://static.klipy.com/d/hd.gif', previewUrl: 'https://static.klipy.com/d/sm.gif',
  mp4Url: 'https://static.klipy.com/d/hd.mp4', webpUrl: 'https://static.klipy.com/d/hd.webp', width: 480, height: 270, fileSizeBytes: 245_000,
  animated: null, frameCount: null, source: 'klipy', pageUrl: 'https://klipy.com/gifs/dance-1', author: null, authorUrl: null,
  license: 'KLIPY API terms', licenseUrl: 'https://docs.klipy.com/attribution', attributionRequired: true,
  attribution: '"Happy dance" · Powered by KLIPY · https://klipy.com/gifs/dance-1', creditText: 'Powered by KLIPY', description: null,
};

describe('schema.org ImageObject', () => {
  it('a KLIPY GIF: renditions, the platform credit, provider, license page; no creator or copyright notice', () => {
    const o = toImageObject(base);
    expect(imageObjectSchema.parse(o)).toEqual(o);
    expect(o).toMatchObject({
      '@type': 'ImageObject', identifier: 'klipy:dance-1', name: 'Happy dance', contentUrl: base.url, encodingFormat: 'image/gif',
      thumbnailUrl: base.previewUrl, contentSize: '245 KB', url: base.pageUrl, creditText: 'Powered by KLIPY',
      acquireLicensePage: 'https://docs.klipy.com/attribution', provider: { '@type': 'Organization', name: 'KLIPY', url: 'https://klipy.com' },
      encoding: [{ '@type': 'MediaObject', contentUrl: base.mp4Url, encodingFormat: 'video/mp4' }, { '@type': 'MediaObject', contentUrl: base.webpUrl, encodingFormat: 'image/webp' }],
    });
    expect(o).not.toHaveProperty('creator');
    expect(o).not.toHaveProperty('copyrightNotice');
  });

  it('an openly licensed file: creator, its own credit, copyright notice, license with its link; no renditions', () => {
    const o = toImageObject({ ...base, id: 'wikimedia:File:Cat.gif', source: 'wikimedia-commons', mp4Url: null, webpUrl: null, author: 'Jane', authorUrl: 'https://commons.wikimedia.org/wiki/User:Jane',
      license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', creditText: 'Jane · CC BY-SA 4.0', fileSizeBytes: 2_400_000, pageUrl: 'https://commons.wikimedia.org/wiki/File:Cat.gif' });
    expect(imageObjectSchema.parse(o)).toEqual(o);
    expect(o).toMatchObject({ creator: { '@type': 'Person', name: 'Jane', url: 'https://commons.wikimedia.org/wiki/User:Jane' }, creditText: 'Jane · CC BY-SA 4.0',
      copyrightNotice: '© Jane', license: { '@type': 'CreativeWork', name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0' },
      acquireLicensePage: 'https://commons.wikimedia.org/wiki/File:Cat.gif', contentSize: '2.4 MB', provider: { name: 'Wikimedia Commons' } });
    expect(o).not.toHaveProperty('encoding');
  });

  it('no credit required: no creditText at all', () => {
    expect(toImageObject({ ...base, source: 'openverse', creditText: '', attributionRequired: false })).not.toHaveProperty('creditText');
  });
});
