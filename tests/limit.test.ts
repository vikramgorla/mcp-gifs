import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, envRateLimit, memoryLimitersFromEnv, memoryRateLimiter } from '../src/limit.js';

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

describe('envRateLimit', () => {
  it('treats unset, empty, 0, or invalid values as disabled', () => {
    expect(envRateLimit('RATE_LIMIT_PER_IP', {})).toBeUndefined();
    expect(envRateLimit('RATE_LIMIT_PER_IP', { RATE_LIMIT_PER_IP: '' })).toBeUndefined();
    expect(envRateLimit('RATE_LIMIT_PER_IP', { RATE_LIMIT_PER_IP: '0' })).toBeUndefined();
    expect(envRateLimit('RATE_LIMIT_PER_IP', { RATE_LIMIT_PER_IP: 'nope' })).toBeUndefined();
    expect(envRateLimit('RATE_LIMIT_PER_IP', { RATE_LIMIT_PER_IP: '-10' })).toBeUndefined();
    expect(envRateLimit('RATE_LIMIT_GLOBAL', { RATE_LIMIT_GLOBAL: '0' })).toBeUndefined();
  });
  it('parses a positive integer opt-in', () => {
    expect(envRateLimit('RATE_LIMIT_PER_IP', { RATE_LIMIT_PER_IP: '60' })).toBe(60);
    expect(envRateLimit('RATE_LIMIT_GLOBAL', { RATE_LIMIT_GLOBAL: ' 120 ' })).toBe(120);
  });
});

describe('memoryLimitersFromEnv', () => {
  it('leaves both limiters off when env vars are unset', () => {
    const l = memoryLimitersFromEnv({});
    expect(l.globalRateLimiter).toBeUndefined();
    expect(l.rateLimiter).toBeUndefined();
  });
  it('enables only the limiters that have a positive value', async () => {
    const off = memoryLimitersFromEnv({ RATE_LIMIT_PER_IP: '0', RATE_LIMIT_GLOBAL: '0' });
    expect(off.globalRateLimiter).toBeUndefined();
    expect(off.rateLimiter).toBeUndefined();
    const both = memoryLimitersFromEnv({ RATE_LIMIT_PER_IP: '1', RATE_LIMIT_GLOBAL: '2' });
    expect(await both.rateLimiter!.limit({ key: 'mcp:1.1.1.1' })).toEqual({ success: true });
    expect(await both.rateLimiter!.limit({ key: 'mcp:1.1.1.1' })).toEqual({ success: false });
    expect(await both.globalRateLimiter!.limit({ key: 'global' })).toEqual({ success: true });
    expect(await both.globalRateLimiter!.limit({ key: 'global' })).toEqual({ success: true });
    expect(await both.globalRateLimiter!.limit({ key: 'global' })).toEqual({ success: false });
  });
});
