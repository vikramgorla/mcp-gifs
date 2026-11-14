import { describe, expect, it } from 'vitest';
import { buildAttribution, cleanUrl, stripHtml, toWords } from '../src/text.js';

describe('text helpers', () => {
  it('strips HTML and decodes entities', () => {
    expect(stripHtml('<a href="x">Jane &amp; <b>Joe</b></a>&#39;s&nbsp;cat')).toBe("Jane & Joe's cat");
  });
  it('removes utm tracking params only', () => {
    expect(cleanUrl('https://upload.wikimedia.org/a/b.gif?utm_source=x&utm_content=y')).toBe('https://upload.wikimedia.org/a/b.gif');
    expect(cleanUrl('https://x.org/a.gif?keep=1&utm_x=2')).toBe('https://x.org/a.gif?keep=1');
  });
  it('reduces queries to plain words, dropping search operators', () => {
    expect(toWords('  Happy   DANCE!! ')).toEqual(['happy', 'dance']);
    expect(toWords('insource:"foo" -bar OR baz*')).toEqual(['insource', 'foo', 'bar', 'baz']);
    expect(toWords("rock'n roll t-rex")).toEqual(["rock'n", 'roll', 't-rex']);
    expect(toWords('ñandú 猫')).toEqual(['ñandú', '猫']);
    expect(toWords('???')).toEqual([]);
  });
  it('builds an attribution line', () => {
    expect(buildAttribution({ title: 'Cat', author: 'Jane', license: 'CC BY 4.0', licenseUrl: 'https://cc/by', pageUrl: 'https://p', sourceLabel: 'Wikimedia Commons' })).toBe(
      '"Cat" by Jane, CC BY 4.0 (https://cc/by), via Wikimedia Commons: https://p',
    );
    expect(buildAttribution({ title: 'Cat', author: null, license: 'Public domain', licenseUrl: null, pageUrl: 'https://p', sourceLabel: 'X' })).toBe('"Cat", Public domain, via X: https://p');
  });
});
