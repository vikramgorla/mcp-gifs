const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Strip HTML tags and decode common entities; collapse whitespace. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Remove Wikimedia's utm_* tracking parameters from upload URLs. */
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Turn free text into plain search words: letters, digits, apostrophes and
 * hyphens inside words only. This keeps CirrusSearch operators (insource:,
 * quotes, wildcards, leading '-') out of upstream queries.
 */
export function toWords(query: string, maxWords = 8): string[] {
  return (query.normalize('NFKC').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [])
    .map((w) => w.toLowerCase())
    .filter((w) => w !== 'or' && w !== 'and' && w !== 'not')
    .slice(0, maxWords);
}

/** schema.org creditText of an openly licensed work: "<author> · <license>" when attribution is required, else ''. */
export function workCredit(g: { author: string | null; license: string; attributionRequired: boolean }): string {
  if (!g.attributionRequired) return '';
  return [g.author, g.license].filter(Boolean).join(' · ');
}

export function buildAttribution(g: { title: string; author: string | null; license: string; licenseUrl: string | null; pageUrl: string; sourceLabel: string }): string {
  const by = g.author ? ` by ${g.author}` : '';
  const lic = g.licenseUrl ? `${g.license} (${g.licenseUrl})` : g.license;
  return `"${g.title}"${by}, ${lic}, via ${g.sourceLabel}: ${g.pageUrl}`;
}
