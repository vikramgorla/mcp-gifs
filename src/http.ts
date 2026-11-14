import { USER_AGENT } from './version.js';

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface FetchJsonOptions {
  timeoutMs: number;
  /** Retry once on 429/503 when Retry-After is at most this many seconds. */
  maxRetryAfterSeconds?: number;
  fetchImpl?: typeof fetch;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, n);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, (date - Date.now()) / 1000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a JSON document with our User-Agent, a hard timeout and one polite retry. */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRetry = opts.maxRetryAfterSeconds ?? 2;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      const msg = name === 'TimeoutError' || name === 'AbortError' ? `timed out after ${opts.timeoutMs} ms` : String((err as Error)?.message ?? err);
      throw new UpstreamError(msg, null);
    }
    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch {
        throw new UpstreamError('invalid JSON response', res.status);
      }
    }
    const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
    if ((res.status === 429 || res.status === 503) && attempt === 0 && retryAfter !== null && retryAfter <= maxRetry) {
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new UpstreamError(`HTTP ${res.status}`, res.status, retryAfter);
  }
}
