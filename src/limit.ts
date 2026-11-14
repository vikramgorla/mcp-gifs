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

/** Opt-in in-memory per-IP cap (requests / 60 s). Unset or 0 disables. */
export const RATE_LIMIT_PER_IP_ENV = 'RATE_LIMIT_PER_IP';
/** Opt-in in-memory global cap (requests / 60 s). Unset or 0 disables. */
export const RATE_LIMIT_GLOBAL_ENV = 'RATE_LIMIT_GLOBAL';

/**
 * Parse an opt-in requests-per-60s limit. Unset, empty, 0, or an invalid
 * value means the limiter is disabled.
 */
export function envRateLimit(
  name: string,
  source: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): number | undefined {
  const raw = source[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : undefined;
}

/** Build in-memory limiters from env; missing or 0 vars leave that limiter off. */
export function memoryLimitersFromEnv(
  source: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
) {
  const globalLimit = envRateLimit(RATE_LIMIT_GLOBAL_ENV, source);
  const perIpLimit = envRateLimit(RATE_LIMIT_PER_IP_ENV, source);
  return {
    globalRateLimiter: globalLimit ? memoryRateLimiter(globalLimit, 60_000) : undefined,
    rateLimiter: perIpLimit ? memoryRateLimiter(perIpLimit, 60_000) : undefined,
  };
}
