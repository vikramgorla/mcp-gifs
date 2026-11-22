import { VERSION } from '../src/version.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import vercel from '../src/vercel.js';
import { commonsPage, commonsResponse, json, mockFetch } from './fixtures.js';

const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' };

async function rpc(body: unknown, extra: Record<string, string> = {}) {
  const res = await vercel.fetch(new Request('https://gifs.example.vercel.app/mcp', { method: 'POST', headers: { ...HEADERS, ...extra }, body: JSON.stringify(body) }));
  const text = await res.text();
  const payload = text.trim().startsWith('{') ? text : (text.split('\n').find((l) => l.startsWith('data:'))?.slice(5) ?? 'null');
  return { res, msg: JSON.parse(payload) };
}

afterEach(() => vi.unstubAllGlobals());

describe('Vercel HTTP surface', () => {
  it('exports the Edge runtime and serves /health and the landing page', async () => {
    const { config } = await import('../src/vercel.js');
    expect(config.runtime).toBe('edge');
    const h = await vercel.fetch(new Request('https://gifs.example.vercel.app/health'));
    expect(await h.json()).toMatchObject({ status: 'ok', name: 'mcp-gifs', version: VERSION });
    expect(h.headers.get('Cache-Control')).toMatch(/max-age=60/);
    const l = await vercel.fetch(new Request('https://gifs.example.vercel.app/'));
    expect(await l.text()).toContain('https://gifs.example.vercel.app/mcp');
  });

  it('answers MCP initialize and search_gifs', async () => {
    const m = mockFetch({ commons: () => json(commonsResponse([1, 2].map((i) => commonsPage({ title: `File:Cat ${i}.gif`, index: i })))) });
    vi.stubGlobal('fetch', m.fetch);
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
    expect(init.res.status).toBe(200);
    expect(init.msg.result.serverInfo).toMatchObject({ name: 'mcp-gifs', version: VERSION });
    const call = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_gifs', arguments: { query: 'cat dance', limit: 2 } } });
    expect(call.msg.result.structuredContent.count).toBe(2);
  });
});
