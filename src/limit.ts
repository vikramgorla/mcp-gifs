/** Best-effort fixed-window limiter. Counts are per process / isolate only. */
export function memoryRateLimiter(limit: number, periodMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    async limit(opts: { key: string }): Promise<{ success: boolean }> {
      const now = Date.now();
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      }
      const slot = hits.get(opts.key);
      if (!slot || now >= slot.reset) {
        hits.set(opts.key, { count: 1, reset: now + periodMs });
        return { success: true };
      }
      if (slot.count >= limit) return { success: false };
      slot.count += 1;
      return { success: true };
    },
  };
}

/** Vercel (and most proxies) put the client IP in X-Forwarded-For. */
export function clientIpFromHeaders(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || request.headers.get('x-vercel-forwarded-for') || 'unknown';
}
