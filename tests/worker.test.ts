import { VERSION } from '../src/version.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/worker.js';
import { commonsPage, commonsResponse, json, mockFetch } from './fixtures.js';

const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' };

async function rpc(body: unknown, env = {}) {
  const res = await worker.fetch(new Request('https://mcp-gifs.example.workers.dev/mcp', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) }), env);
  const text = await res.text();
  const payload = text.trim().startsWith('{') ? text : (text.split('\n').find((l) => l.startsWith('data:'))?.slice(5) ?? 'null');
  return { res, msg: JSON.parse(payload) };
}

afterEach(() => vi.unstubAllGlobals());

describe('worker HTTP surface', () => {
  it('serves /health and the landing page', async () => {
    const h = await worker.fetch(new Request('https://x.dev/health'), {});
    expect(await h.json()).toMatchObject({ status: 'ok', name: 'mcp-gifs', version: VERSION });
    const l = await worker.fetch(new Request('https://x.dev/'), {});
    expect(await l.text()).toContain('https://x.dev/mcp');
  });

  it('answers MCP initialize, tools/list and tools/call over Streamable HTTP', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([1, 2].map((i) => commonsPage({ title: `File:Cat ${i}.gif`, index: i })))) });
    vi.stubGlobal('fetch', m.fetch);

    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
    expect(init.res.status).toBe(200);
    expect(init.res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(init.msg.result.serverInfo).toMatchObject({ name: 'mcp-gifs' });

    const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(list.msg.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(['get_gif', 'search_gifs']);

    const call = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_gifs', arguments: { query: 'cat dance', limit: 2 } } });
    const sc = call.msg.result.structuredContent;
    expect(sc.count).toBe(2);
    // schema.org ImageObjects: standard fields any client can read
    expect(sc.results[0]).toMatchObject({ '@context': 'https://schema.org', '@type': 'ImageObject', encodingFormat: 'image/gif', animated: true,
      provider: { '@type': 'Organization', name: 'Wikimedia Commons' }, license: { '@type': 'CreativeWork' } });
    expect(sc.results[0].contentUrl).toMatch(/^https:\/\//);
    expect(sc.results[0]).not.toHaveProperty('previewUrl');
    expect(call.msg.result.content[0].text).toContain('Attribution:');
  });

  it('validates tool input', async () => {
    const call = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_gifs', arguments: { query: 'cat', limit: 99 } } });
    const failed = call.msg.error !== undefined || call.msg.result?.isError === true;
    expect(failed).toBe(true);
  });

  it('rate-limits per IP when the binding denies', async () => {
    const env = { RATE_LIMITER: { limit: async () => ({ success: false }) } };
    const { res, msg } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(msg.error.message).toMatch(/per IP/);
  });

  it('enforces the global cap before the per-IP limiter', async () => {
    const calls: string[] = [];
    const env = {
      GLOBAL_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          calls.push(`global:${key}`);
          return { success: false };
        },
      },
      RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          calls.push(`ip:${key}`);
          return { success: true };
        },
      },
    };
    const { res, msg } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(msg.error.message).toMatch(/server-wide/);
    expect(calls).toEqual(['global:global']);
  });

  it('checks the per-IP limiter only after the global cap allows the request', async () => {
    const calls: string[] = [];
    const env = {
      GLOBAL_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          calls.push(`global:${key}`);
          return { success: true };
        },
      },
      RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          calls.push(`ip:${key}`);
          return { success: true };
        },
      },
    };
    const { res } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, env);
    expect(res.status).toBe(200);
    expect(calls[0]).toBe('global:global');
    expect(calls[1]).toMatch(/^ip:mcp:/);
  });

  it('handles CORS preflight', async () => {
    const res = await worker.fetch(new Request('https://x.dev/mcp', { method: 'OPTIONS' }), {});
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Mcp-Protocol-Version');
  });
});
