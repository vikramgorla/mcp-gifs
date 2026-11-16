/**
 * How long a response may be kept in this server's shared result cache,
 * derived only from the upstream response headers (RFC 9111 freshness).
 *
 * Used for KLIPY: KLIPY requires caching to follow the headers it returns,
 * so there is no fixed TTL and no heuristic caching.
 *
 * - `no-store`, `no-cache` or `private` → 0 (this cache is shared and
 *   cannot revalidate).
 * - `s-maxage` (for shared caches) wins over `max-age`; the `Age` header is
 *   subtracted.
 * - Otherwise `Expires` minus `Date` (or now when `Date` is missing).
 * - No freshness information → 0 (do not cache).
 */
export function freshnessSeconds(headers: Headers, now: number = Date.now()): number {
  const cc = (headers.get('Cache-Control') ?? '').toLowerCase();
  const directives = new Map<string, string | true>();
  for (const part of cc.split(',')) {
    const [k, v] = part.trim().split('=', 2) as [string, string | undefined];
    if (k) directives.set(k, v === undefined ? true : v.replace(/^"|"$/g, ''));
  }
  if (directives.has('no-store') || directives.has('no-cache') || directives.has('private')) return 0;

  const age = Math.max(0, Number(headers.get('Age')) || 0);
  for (const name of ['s-maxage', 'max-age']) {
    const raw = directives.get(name);
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Math.max(0, Number(raw) - age);
  }

  const expires = headers.get('Expires');
  if (expires !== null) {
    const exp = Date.parse(expires);
    if (Number.isNaN(exp)) return 0; // invalid Expires means already expired
    const date = Date.parse(headers.get('Date') ?? '');
    const base = Number.isNaN(date) ? now : date;
    return Math.max(0, Math.floor((exp - base) / 1000) - age);
  }
  return 0;
}
