/**
 * Live smoke test (NOT run in CI): hits the real Wikimedia Commons and
 * Openverse APIs, once directly and once through the stdio MCP server.
 * If KLIPY_API_KEY is set, the stdio server also uses KLIPY.
 *
 *   npm run smoke                 # direct + stdio
 *   npm run smoke -- "happy dance" # custom queries
 *   MCP_URL=http://localhost:8787/mcp npm run smoke   # also test an HTTP endpoint
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { searchGifs } from '../src/search.js';

const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['cat', 'happy dance', 'rocket launch'];
let failed = false;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};

async function direct() {
  for (const q of queries) {
    const t = Date.now();
    const r = await searchGifs({ query: q, limit: 5, safety: 'safe', source: 'auto' });
    check(r.count > 0, `direct "${q}": ${r.count} results in ${Date.now() - t} ms via ${r.sourcesQueried.join('+')}`);
    for (const g of r.results) console.log(`      - [${g.source}] ${g.title} ${g.width}x${g.height} frames=${g.frameCount} ${g.license}\n        ${g.url}`);
    for (const n of r.notes) console.log(`      note: ${n}`);
  }
  const ov = await searchGifs({ query: 'cat', limit: 3, safety: 'safe', source: 'openverse' }).catch((e: Error) => e);
  if (ov instanceof Error) console.log(`WARN  openverse-only search failed (rate limit / 504 is normal): ${ov.message}`);
  else check(true, `openverse-only "cat": ${ov.count} results ${ov.notes.join(' ')}`);
  const blocked = await searchGifs({ query: 'nude', limit: 3, safety: 'safe', source: 'auto' });
  check(blocked.count === 0 && blocked.sourcesQueried.length === 0, 'unsafe query blocked before any upstream call');
}

async function stdio() {
  const child = spawn('npx', ['tsx', 'src/stdio.ts'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const rl = createInterface({ input: child.stdout });
  const pending = new Map<number, (v: unknown) => void>();
  rl.on('line', (line) => {
    const msg = JSON.parse(line) as { id?: number };
    if (msg.id !== undefined) pending.get(msg.id)?.(msg);
  });
  let id = 0;
  const rpc = (method: string, params: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely typed JSON-RPC replies
    new Promise<any>((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: myId, method, params })}\n`);
    });
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
  check(init.result?.serverInfo?.name === 'mcp-gifs', `stdio initialize -> ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version} (${init.result?.protocolVersion})`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const list = await rpc('tools/list', {});
  check(list.result?.tools?.length === 2, `stdio tools/list -> ${list.result?.tools?.map((t: { name: string }) => t.name).join(', ')}`);
  const call = await rpc('tools/call', { name: 'search_gifs', arguments: { query: queries[0], limit: 3 } });
  const sc = call.result?.structuredContent;
  check(!call.result?.isError && sc?.count > 0, `stdio tools/call search_gifs("${queries[0]}") -> ${sc?.count} results`);
  const first = sc?.results?.[0];
  if (first) {
    const got = await rpc('tools/call', { name: 'get_gif', arguments: { id: first.id } });
    check(got.result?.structuredContent?.found === true, `stdio get_gif(${first.id})`);
  }
  child.kill();
}

async function http(url: string) {
  const post = async (body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify(body) });
    const text = await res.text();
    const data = text.startsWith('{') ? text : text.split('\n').find((l) => l.startsWith('data:'))?.slice(5) ?? '{}';
    return JSON.parse(data);
  };
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
  check(init.result?.serverInfo?.name === 'mcp-gifs', `http initialize -> ${JSON.stringify(init.result?.serverInfo)}`);
  const call = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_gifs', arguments: { query: queries[0], limit: 3 } } });
  check(call.result?.structuredContent?.count > 0, `http tools/call -> ${call.result?.structuredContent?.count} results`);
}

await direct();
await stdio();
if (process.env.MCP_URL) await http(process.env.MCP_URL);
process.exit(failed ? 1 : 0);
