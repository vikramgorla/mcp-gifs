import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, memoryRateLimiter } from '../src/limit.js';

describe('memoryRateLimiter', () => {
  it('allows up to the limit then denies until the window resets', async () => {
    const l = memoryRateLimiter(2, 60_000);
    expect(await l.limit({ key: 'a' })).toEqual({ success: true });
    expect(await l.limit({ key: 'a' })).toEqual({ success: true });
    expect(await l.limit({ key: 'a' })).toEqual({ success: false });
    expect(await l.limit({ key: 'b' })).toEqual({ success: true });
  });
  it('resets after the window', async () => {
    const l = memoryRateLimiter(1, 20);
    expect(await l.limit({ key: 'x' })).toEqual({ success: true });
    expect(await l.limit({ key: 'x' })).toEqual({ success: false });
    await new Promise((r) => setTimeout(r, 25));
    expect(await l.limit({ key: 'x' })).toEqual({ success: true });
  });
});

describe('clientIpFromHeaders', () => {
  it('prefers the first X-Forwarded-For hop', () => {
    const req = new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'x-real-ip': '9.9.9.9' } });
    expect(clientIpFromHeaders(req)).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip and unknown', () => {
    expect(clientIpFromHeaders(new Request('https://x', { headers: { 'x-real-ip': '8.8.8.8' } }))).toBe('8.8.8.8');
    expect(clientIpFromHeaders(new Request('https://x'))).toBe('unknown');
  });
});
