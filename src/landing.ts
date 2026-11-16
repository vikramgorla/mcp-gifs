import { REPO_URL, VERSION } from './version.js';

export interface LandingOptions {
  /** True when a KLIPY key is configured: the demo searches KLIPY and shows KLIPY attribution. */
  klipy: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root{
  --bg:#eef1f7;--surface:#fff;--ink:#1c2333;--muted:#5b6478;--line:#d5dbe7;
  --blue:#2f5bea;--blue-ink:#fff;--sticker:#ffd23f;--code:#f5f7fb;
  --radius-l:22px;--radius-s:10px;
  --round:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI Variable Display",system-ui,sans-serif;
  --body:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#151a26;--surface:#1e2433;--ink:#e8ecf5;--muted:#9aa3b8;--line:#2e3647;
  --blue:#7c9cff;--blue-ink:#10162a;--code:#171c28;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 var(--body)}
a{color:var(--blue);text-underline-offset:2px}
a:focus-visible,button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--blue);outline-offset:2px;border-radius:6px}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header.top{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
.brand{font:700 20px/1 var(--round);letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.brand small{font:500 13px var(--body);color:var(--muted);margin-left:8px}
nav a{color:var(--muted);text-decoration:none;margin-left:20px;font-size:15px}
nav a:hover{color:var(--ink)}
.hero{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:56px;align-items:start;padding:40px 0 72px}
h1{font:800 clamp(38px,5.4vw,62px)/1.02 var(--round);letter-spacing:-.025em;margin:0 0 22px;max-width:12ch}
.lede{font-size:19px;color:var(--muted);max-width:34em;margin:0 0 28px}
.endpoint{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 6px 6px 18px;max-width:30em}
.endpoint code{font:14px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.btn{font:600 14px var(--body);border:0;border-radius:999px;padding:9px 16px;background:var(--blue);color:var(--blue-ink);cursor:pointer}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.hint{font-size:14px;color:var(--muted);margin:10px 0 0 18px}
/* The picker: the one bold element on the page. */
.picker{background:var(--surface);border-radius:var(--radius-l);box-shadow:0 1px 0 var(--line),0 24px 60px -28px rgba(28,35,51,.35);overflow:hidden;position:relative}
.picker::before{content:"";position:absolute;inset:0 0 auto 0;height:6px;background:var(--sticker)}
.picker-head{padding:22px 18px 10px}
.search{display:flex;align-items:center;gap:10px;background:var(--bg);border-radius:14px;padding:4px 6px 4px 14px}
.search svg{flex:none;color:var(--muted)}
.search input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:16px var(--body);padding:10px 0}
.search input::placeholder{color:var(--muted)}
.search input:focus{outline:none}
.search:focus-within{box-shadow:0 0 0 2px var(--blue)}
.powered{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 4px 0;font-size:13px;color:var(--muted)}
.powered a{color:var(--ink);font-weight:700;text-decoration:none;white-space:nowrap}
.powered a:hover{text-decoration:underline}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:6px 18px 14px}
.chip{font:500 14px var(--body);background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}
.chip:hover{border-color:var(--ink)}
.grid{display:flex;gap:8px;align-items:flex-start;padding:0 12px 12px;min-height:280px}
.col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.tile{display:block;width:100%;border:0;padding:0;background:var(--bg);border-radius:var(--radius-s);overflow:hidden;cursor:pointer;position:relative}
.tile img{display:block;width:100%;height:auto}
.tile .cap{display:block;font-size:12px;line-height:1.35;color:var(--muted);text-align:left;padding:6px 8px 8px;background:var(--surface)}
.status{font-size:14px;color:var(--muted);padding:0 18px 16px;min-height:1.5em}
.empty{display:grid;place-items:center;text-align:center;color:var(--muted);font-size:15px;min-height:260px;flex:1;padding:0 24px}
section{padding:64px 0;border-top:1px solid var(--line)}
h2{font:750 30px/1.15 var(--round);letter-spacing:-.015em;margin:0 0 10px}
.sub{color:var(--muted);max-width:40em;margin:0 0 28px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:36px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.tabs button{font:600 14px var(--body);border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:7px 14px;cursor:pointer}
.tabs button[aria-selected=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
pre{background:var(--code);border:1px solid var(--line);border-radius:14px;padding:16px 18px;overflow:auto;font:14px/1.6 var(--mono);margin:0}
dl.tools{margin:0}
dl.tools dt{font:700 16px var(--mono);margin-top:18px}
dl.tools dt:first-child{margin-top:0}
dl.tools dd{margin:4px 0 0;color:var(--muted)}
.credit{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px}
.credit h3{font:700 18px var(--round);margin:0 0 6px}
.credit p{margin:0;color:var(--muted);font-size:15px}
footer{padding:36px 0 56px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
footer a{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:999px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.show{opacity:1}
@media (max-width:860px){.hero{grid-template-columns:1fr;gap:36px;padding-top:16px}nav a{margin-left:14px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

function script(): string {
  return `
(() => {
  const form = document.getElementById('search');
  const input = document.getElementById('q');
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  const toast = document.getElementById('toast');
  let seq = 0;

  function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 1600); }

  async function callTool(name, args) {
    const res = await fetch('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    if (res.status === 429) throw new Error('Too many searches from this network. Try again in a minute.');
    const text = await res.text();
    const line = text.trim().startsWith('{') ? text : (text.split('\\n').find((l) => l.startsWith('data:')) || '').slice(5);
    const msg = JSON.parse(line || 'null');
    if (!msg || msg.error) throw new Error((msg && msg.error && msg.error.message) || 'The server did not answer.');
    if (msg.result.isError) throw new Error(msg.result.content[0].text);
    return msg.result.structuredContent;
  }

  function render(r) {
    grid.replaceChildren();
    if (!r.results.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = r.notes[r.notes.length - 1] || 'No GIFs found. Try other words.';
      grid.append(e);
      return;
    }
    // Results keep the order the server returned them: left to right, each into the shortest column.
    const n = grid.clientWidth < 420 ? 2 : 3;
    const cols = Array.from({ length: n }, () => { const c = document.createElement('div'); c.className = 'col'; grid.append(c); return { el: c, h: 0 }; });
    for (const g of r.results) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.title = g.title + ' (click to copy the GIF link)';
      const img = document.createElement('img');
      img.src = g.previewUrl; // media loads straight from the provider
      img.alt = g.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      if (g.width && g.height) { img.width = g.width; img.height = g.height; }
      b.append(img);
      if (g.source !== 'klipy') {
        const cap = document.createElement('span');
        cap.className = 'cap';
        cap.textContent = (g.author ? g.author + ', ' : '') + g.license + ' via ' + (g.source === 'openverse' ? 'Openverse' : 'Wikimedia Commons');
        b.append(cap);
      }
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(g.url); say('GIF link copied'); } catch { window.open(g.url, '_blank', 'noopener'); }
      });
      const col = cols.reduce((a, c) => (c.h < a.h ? c : a));
      col.el.append(b);
      col.h += g.width && g.height ? g.height / g.width : 1;
    }
  }

  async function run(query) {
    const my = ++seq;
    status.textContent = query ? 'Searching for “' + query + '”…' : 'Loading…';
    try {
      const r = await callTool('search_gifs', { query, limit: 12 });
      if (my !== seq) return;
      render(r);
      const src = r.sourcesQueried.includes('klipy') && r.results[0] && r.results[0].source === 'klipy' ? 'KLIPY' : 'Wikimedia Commons and Openverse';
      status.textContent = r.count + ' GIF' + (r.count === 1 ? '' : 's') + ' for “' + query + '” from ' + src + '. Click one to copy its link.';
    } catch (err) {
      if (my !== seq) return;
      status.textContent = err.message;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) run(q); });
  for (const c of document.querySelectorAll('.chip')) c.addEventListener('click', () => { input.value = c.dataset.q; run(c.dataset.q); });

  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent); say('Copied'); } catch { say('Select the text to copy it'); } });
  }

  const tabs = document.querySelectorAll('.tabs button');
  for (const t of tabs) t.addEventListener('click', () => {
    for (const o of tabs) { const on = o === t; o.setAttribute('aria-selected', String(on)); document.getElementById(o.getAttribute('aria-controls')).hidden = !on; }
  });
})();
`;
}

export function landingPage(origin: string, opts: LandingOptions = { klipy: false }): string {
  const mcpUrl = `${origin}/mcp`;
  const klipy = opts.klipy;
  const placeholder = klipy ? 'Search KLIPY' : 'Search GIFs';
  const chips = klipy ? ['facepalm', 'thank you', 'happy dance', 'mind blown', 'good morning'] : ['cat', 'rocket launch', 'dancing', 'ocean waves'];
  const clients: Array<[string, string, string]> = [
    ['claude', 'Claude', `Settings → Connectors → Add custom connector\n\n${mcpUrl}`],
    ['code', 'Claude Code', `claude mcp add --transport http gifs ${mcpUrl}`],
    ['cursor', 'Cursor', JSON.stringify({ mcpServers: { gifs: { url: mcpUrl } } }, null, 2)],
    ['vscode', 'VS Code', JSON.stringify({ servers: { gifs: { type: 'http', url: mcpUrl } } }, null, 2)],
  ];
  const tabs = clients
    .map(([id, label], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}">${label}</button>`)
    .join('');
  const panels = clients
    .map(([id, , body], i) => `<div role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}"${i === 0 ? '' : ' hidden'}><pre>${esc(body)}</pre></div>`)
    .join('');

  const description = klipy
    ? 'An MCP server that lets AI agents search GIFs the way chat apps do. GIF search is powered by KLIPY, with openly licensed GIFs from Wikimedia Commons and Openverse as a fallback.'
    : 'An MCP server that lets AI agents find openly licensed animated GIFs from Wikimedia Commons and Openverse.';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>mcp-gifs: GIF search for AI agents${klipy ? ', powered by KLIPY' : ''}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#eef1f7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#151a26" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232f5bea'/%3E%3Ctext x='16' y='21' font-family='system-ui,sans-serif' font-size='12' font-weight='800' text-anchor='middle' fill='white'%3EGIF%3C/text%3E%3C/svg%3E">
<style>${CSS}</style>
</head><body>
<div class="wrap">
<header class="top">
  <a class="brand" href="/">mcp-gifs<small>v${VERSION}</small></a>
  <nav aria-label="Site"><a href="#connect">Connect</a><a href="#credits">Credits</a><a href="${REPO_URL}">GitHub</a></nav>
</header>

<main>
<div class="hero">
  <div>
    <h1>GIF search for AI agents</h1>
    <p class="lede">${klipy ? 'Give Claude, Cursor or any MCP client the same reaction GIFs people pick in chat apps. GIF search is powered by KLIPY.' : 'Give Claude, Cursor or any MCP client openly licensed animated GIFs, each with its license and a ready-made credit line.'} No sign-in and no API key needed to connect.</p>
    <div class="endpoint">
      <code id="endpoint">${esc(mcpUrl)}</code>
      <button class="btn" type="button" data-copy="endpoint">Copy</button>
    </div>
    <p class="hint">Add this URL to your MCP client. Setup for each client is <a href="#connect">below</a>.</p>
  </div>

  <div class="picker" aria-label="Try the GIF search">
    <div class="picker-head">
      <form id="search" class="search" role="search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <label class="sr" for="q">${placeholder}</label>
        <input id="q" name="q" type="search" placeholder="${placeholder}" autocomplete="off" enterkeyhint="search" maxlength="200">
        <button class="btn" type="submit">Search</button>
      </form>
      <div class="powered">${klipy ? '<span><a href="https://klipy.com" rel="noopener">Powered by KLIPY</a></span><span>Results shown in KLIPY’s order</span>' : '<span>Openly licensed GIFs from Wikimedia Commons and Openverse</span>'}</div>
    </div>
    <div class="chips" aria-label="Example searches">${chips.map((c) => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <p id="status" class="status" role="status" aria-live="polite"></p>
    <div id="grid" class="grid"><div class="empty">Type a few words or pick an example to see what your agent gets back.</div></div>
  </div>
</div>

<section id="connect">
  <h2>Connect your agent</h2>
  <p class="sub">The server speaks MCP Streamable HTTP and keeps no sessions. Pick your client:</p>
  <div class="cols">
    <div>
      <div class="tabs" role="tablist" aria-label="MCP clients">${tabs}</div>
      ${panels}
    </div>
    <div>
      <dl class="tools">
        <dt>search_gifs</dt><dd>Find GIFs by keywords. Returns direct GIF links, previews, sizes and a credit line for each result.</dd>
        ${klipy ? '<dt>trending_gifs</dt><dd>What people are sending right now, like the first tab of a GIF picker.</dd>' : ''}
        <dt>get_gif</dt><dd>Look up one GIF again by the id that search returned.</dd>
      </dl>
    </div>
  </div>
</section>

<section id="credits">
  <h2>Where the GIFs come from</h2>
  <p class="sub">Every result says where it came from. Agents are told to show that credit next to any GIF they display.</p>
  <div class="credit">
    ${klipy ? `<div><h3>KLIPY</h3><p>GIF search is <a href="https://klipy.com" rel="noopener">powered by KLIPY</a>. KLIPY results are shown in KLIPY’s order, loaded straight from KLIPY, never mixed with other sources, and carry “Powered by KLIPY”. See KLIPY’s <a href="https://docs.klipy.com/attribution" rel="noopener">attribution guidelines</a>.</p></div>` : ''}
    <div><h3>Wikimedia Commons</h3><p>Openly licensed GIFs with their author and license. ${klipy ? 'Used when KLIPY has no match.' : 'The main source.'} Not affiliated with the Wikimedia Foundation.</p></div>
    <div><h3>Openverse</h3><p>More openly licensed GIFs, used to fill gaps. Made with Openverse, not endorsed by Openverse.</p></div>
  </div>
</section>
</main>

<footer>
  ${klipy ? '<p>GIF search powered by <a href="https://klipy.com" rel="noopener">KLIPY</a>.</p>' : ''}
  <p>mcp-gifs v${VERSION} is open source under the MIT license. Read the <a href="${REPO_URL}">source and docs on GitHub</a> or check the <a href="/health">server status</a>.</p>
</footer>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${script()}</script>
</body></html>`;
}
