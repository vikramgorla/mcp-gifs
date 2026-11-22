import { REPO_URL, VERSION } from './version.js';

export interface LandingOptions {
  /** True when a KLIPY key is configured: the demo searches KLIPY and shows KLIPY attribution. */
  klipy: boolean;
}

/** Self-hosted display font (SIL OFL), served by app.ts with a long cache. */
export const FONT_PATH = '/assets/bricolage-v1.woff2';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/*
 * Design: a sticker sheet. Thick ink outlines and hard offset shadows like
 * die-cut stickers, a sunshine-yellow hero, and one bold element (the GIF
 * picker). Motion: one pop-in for the headline on load, plus responses to
 * the user's own actions. Mobile first; nothing may be wider than the screen.
 */
const CSS = `
@font-face{font-family:"Bricolage";src:url(${FONT_PATH}) format("woff2");font-weight:200 800;font-display:swap}
:root{
  --sun:#ffd93d;--pink:#ff5da2;--mint:#3ddc97;--sky:#5bb8ff;--grape:#1e1446;
  --page:#f3eeff;--card:#fff;--ink:#1e1446;--muted:#4f4675;--line:#1e1446;--on-accent:#1e1446;
  --hero:var(--sun);--field:#f3eeff;
  --display:"Bricolage","Arial Rounded MT Bold",system-ui,sans-serif;
  --body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --b:3px;--shadow:5px 5px 0 var(--line);
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{
  --page:#140e33;--card:#241a55;--ink:#fff7e0;--muted:#c9c0ee;--line:#000;--hero:#2b1f6b;--field:#140e33;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:hidden}
body{margin:0;background:var(--page);color:var(--ink);font:17px/1.55 var(--body);overflow-x:hidden}
a{color:inherit;text-decoration-thickness:2px;text-underline-offset:3px}
img,svg{max-width:100%}
:focus-visible{outline:3px solid var(--pink);outline-offset:3px;border-radius:8px}
.wrap{width:100%;max-width:1140px;margin:0 auto;padding:0 20px}

/* Hero band */
.hero{background:var(--hero);border-bottom:var(--b) solid var(--line);position:relative;overflow:hidden}
.deco{position:absolute;pointer-events:none}
.deco.star{width:84px;top:96px;right:4%;color:var(--pink);transform:rotate(14deg)}
.deco.ring{width:70px;bottom:40px;left:-18px;color:var(--sky)}
.deco.squig{width:140px;top:34px;left:42%;color:var(--mint)}
header.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;position:relative}
.logo{display:inline-flex;align-items:center;gap:10px;font:800 22px/1 var(--display);text-decoration:none;color:var(--ink)}
.logo b{display:inline-block;font:800 13px/1 var(--display);background:var(--pink);color:var(--on-accent);border:var(--b) solid var(--line);border-radius:9px;padding:6px 7px 5px;transform:rotate(-8deg);box-shadow:3px 3px 0 var(--line)}
.logo small{font:600 12px var(--body);color:var(--muted)}
nav{display:flex;gap:6px}
nav a{font:700 15px var(--display);text-decoration:none;padding:7px 12px;border-radius:999px;border:2px solid transparent}
nav a:hover{border-color:var(--line);background:var(--card)}
.hero-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:34px;padding:22px 0 56px;position:relative}
.hero-grid>*{min-width:0}
h1{font:800 clamp(46px,11vw,88px)/.92 var(--display);letter-spacing:-.035em;margin:0 0 20px}
h1 span{display:inline-block}
@media (prefers-reduced-motion:no-preference){
  h1 span{animation:pop .55s cubic-bezier(.3,1.6,.5,1) both}
  h1 span:nth-child(2){animation-delay:.08s}h1 span:nth-child(3){animation-delay:.16s}h1 span:nth-child(4){animation-delay:.24s}h1 span:nth-child(5){animation-delay:.32s}h1 span:nth-child(6){animation-delay:.4s}
}
@keyframes pop{from{transform:translateY(40%) scale(.6) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
.lede{font-size:clamp(17px,2.4vw,20px);max-width:32em;margin:0 0 24px}
.endpoint{display:flex;align-items:center;gap:8px;background:var(--card);border:var(--b) solid var(--line);border-radius:16px;padding:6px 6px 6px 14px;box-shadow:var(--shadow);max-width:34em}
.endpoint code{font:600 14px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.btn{font:800 15px/1 var(--display);border:var(--b) solid var(--line);border-radius:12px;padding:10px 16px;background:var(--pink);color:var(--on-accent);cursor:pointer;box-shadow:3px 3px 0 var(--line);flex:none}
.btn:active{transform:translate(3px,3px);box-shadow:none}
.hint{font-size:15px;margin:14px 2px 0}

/* The picker: the bold element */
.picker{background:var(--card);border:var(--b) solid var(--line);border-radius:26px;box-shadow:8px 8px 0 var(--line);overflow:hidden}
.picker-bar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:var(--b) solid var(--line);background:var(--sky)}
.picker-bar i{width:13px;height:13px;border-radius:50%;border:2px solid var(--line);background:var(--card);flex:none}
.picker-bar i:nth-child(2){background:var(--sun)}.picker-bar i:nth-child(3){background:var(--mint)}
.picker-bar span{font:800 15px var(--display);color:var(--on-accent);margin-left:6px}
.picker-head{padding:16px 16px 6px}
.search{display:flex;align-items:center;gap:8px;background:var(--field);border:var(--b) solid var(--line);border-radius:16px;padding:5px 5px 5px 12px}
.search svg{flex:none;width:20px;height:20px}
.search input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:600 17px var(--body);padding:9px 0}
.search input::placeholder{color:var(--muted);opacity:1}
.search input:focus{outline:none}
.search:focus-within{box-shadow:0 0 0 3px var(--pink)}
.powered{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px 12px;margin:10px 2px 0;font-size:13px;color:var(--muted)}
.powered a{color:var(--ink);font:800 14px var(--display);text-decoration:none;white-space:nowrap}
.powered a:hover{text-decoration:underline}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px 6px}
.chip{font:700 15px var(--display);border:2px solid var(--line);border-radius:999px;padding:6px 13px;cursor:pointer;color:var(--on-accent);box-shadow:2px 2px 0 var(--line);transition:transform .15s}
.chip:nth-child(5n+1){background:var(--sun);transform:rotate(-2deg)}
.chip:nth-child(5n+2){background:var(--mint);transform:rotate(1.5deg)}
.chip:nth-child(5n+3){background:var(--sky);transform:rotate(-1deg)}
.chip:nth-child(5n+4){background:var(--pink);transform:rotate(2deg)}
.chip:nth-child(5n+5){background:#ffa94d;transform:rotate(-1.5deg)}
.chip:hover{transform:rotate(0) scale(1.06)}
.chip:active{transform:translate(2px,2px);box-shadow:none}
.status{font-size:14px;color:var(--muted);padding:6px 16px 10px;min-height:1.5em;margin:0}
.grid{display:flex;gap:8px;align-items:flex-start;padding:0 12px 14px;min-height:240px}
.col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.tile{display:block;width:100%;border:2px solid var(--line);padding:0;background:var(--field);border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .15s}
.tile:hover{transform:rotate(-1.5deg) scale(1.03)}
.tile img{display:block;width:100%;height:auto}
.tile .cap{display:block;font-size:12px;line-height:1.35;color:var(--muted);text-align:left;padding:6px 8px 8px;background:var(--card)}
.empty{flex:1;display:grid;place-items:center;align-content:center;gap:10px;text-align:center;color:var(--muted);font-size:15px;min-height:220px;padding:0 20px}
.empty b{font:800 44px/1 var(--display);color:var(--ink)}
@media (prefers-reduced-motion:no-preference){.empty b{display:inline-block;animation:wobble 2.4s ease-in-out 1s 2}}
@keyframes wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}

/* Sections */
section{padding:64px 0}
h2{font:800 clamp(32px,6vw,48px)/1 var(--display);letter-spacing:-.025em;margin:0 0 12px}
.sub{max-width:36em;margin:0 0 30px;color:var(--muted)}
.connect{display:grid;grid-template-columns:minmax(0,1fr);gap:30px}
.connect>*{min-width:0}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.tabs button{font:700 15px var(--display);border:2px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;cursor:pointer}
.tabs button[aria-selected=true]{background:var(--ink);color:var(--page)}
pre{background:var(--card);border:var(--b) solid var(--line);border-radius:18px;padding:16px;margin:0;font:13.5px/1.6 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:var(--shadow);max-width:100%}
.tools{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin:0;padding:0;list-style:none}
.tools li{border:var(--b) solid var(--line);border-radius:20px;padding:16px 18px;box-shadow:var(--shadow);color:var(--on-accent)}
.tools li:nth-child(1){background:var(--mint);transform:rotate(-.8deg)}
.tools li:nth-child(2){background:var(--sun);transform:rotate(.6deg)}
.tools li:nth-child(3){background:var(--sky);transform:rotate(-.4deg)}
.tools code{font:800 17px var(--mono)}
.tools p{margin:4px 0 0;font-size:15.5px}
.credits{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.credit{background:var(--card);border:var(--b) solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow)}
.credit.main{background:var(--pink);color:var(--on-accent)}
.credit h3{font:800 24px/1.1 var(--display);margin:0 0 8px}
.credit p{margin:0;font-size:15.5px}
footer{background:var(--grape);color:#fff7e0;border-top:var(--b) solid var(--line);padding:34px 0 44px;font-size:15px}
footer p{margin:0 0 8px}
footer .big{font:800 22px var(--display)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,20px);background:var(--ink);color:var(--page);font:800 15px var(--display);padding:11px 18px;border-radius:14px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:9;max-width:calc(100vw - 40px)}
.toast.show{opacity:1;transform:translate(-50%,0)}

@media (min-width:640px){
  .tools{grid-template-columns:repeat(3,minmax(0,1fr))}
  .credits{grid-template-columns:2fr 1fr 1fr}
}
@media (min-width:900px){
  .wrap{padding:0 32px}
  .hero-grid{grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:56px;align-items:start;padding:40px 0 80px}
  .picker{transform:rotate(1.2deg)}
  .connect{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:48px}
  .tools{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:520px){.endpoint code{white-space:normal;overflow-wrap:anywhere;font-size:13px}nav a.opt{display:none}.deco.star{width:56px;top:70px;right:-10px}.deco.squig{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
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
    if (!msg || msg.error) throw new Error((msg && msg.error && msg.error.message) || 'The server did not answer. Try again.');
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
    // Keep the order the server returned: left to right, each into the shortest column.
    const n = grid.clientWidth < 420 ? 2 : 3;
    const cols = Array.from({ length: n }, () => { const c = document.createElement('div'); c.className = 'col'; grid.append(c); return { el: c, h: 0 }; });
    for (const g of r.results) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.title = g.name + ' (tap to copy the GIF link)';
      const img = document.createElement('img');
      img.src = g.thumbnailUrl; // media loads straight from the provider
      img.alt = g.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      if (g.width && g.height) { img.width = g.width; img.height = g.height; }
      b.append(img);
      if (g.provider.name !== 'KLIPY') {
        const cap = document.createElement('span');
        cap.className = 'cap';
        cap.textContent = (g.creator ? g.creator.name + ', ' : '') + g.license.name + ' via ' + g.provider.name;
        b.append(cap);
      }
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(g.contentUrl); say('GIF link copied!'); } catch { window.open(g.contentUrl, '_blank', 'noopener'); }
      });
      const col = cols.reduce((a, c) => (c.h < a.h ? c : a));
      col.el.append(b);
      col.h += g.width && g.height ? g.height / g.width : 1;
    }
  }

  async function run(query) {
    const my = ++seq;
    status.textContent = 'Looking for “' + query + '”…';
    try {
      const r = await callTool('search_gifs', { query, limit: 12 });
      if (my !== seq) return;
      render(r);
      const src = r.results[0] && r.results[0].source === 'klipy' ? 'KLIPY' : 'Wikimedia Commons and Openverse';
      status.textContent = r.count + ' GIF' + (r.count === 1 ? '' : 's') + ' for “' + query + '” from ' + src + '. Tap one to copy its link.';
    } catch (err) {
      if (my !== seq) return;
      status.textContent = err.message;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.blur(); run(q); } });
  for (const c of document.querySelectorAll('.chip')) c.addEventListener('click', () => { input.value = c.dataset.q; run(c.dataset.q); });
  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent); say('Copied!'); } catch { say('Select the text to copy it'); } });
  }
  const tabs = document.querySelectorAll('.tabs button');
  for (const t of tabs) t.addEventListener('click', () => {
    for (const o of tabs) { const on = o === t; o.setAttribute('aria-selected', String(on)); document.getElementById(o.getAttribute('aria-controls')).hidden = !on; }
  });
})();
`;
}

const STAR = '<svg class="deco star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4l13 30 33 4-25 22 8 33-29-17-29 17 8-33L4 38l33-4z" fill="currentColor" stroke="#1e1446" stroke-width="5" stroke-linejoin="round"/></svg>';
const RING = '<svg class="deco ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="20"/><circle cx="50" cy="50" r="44" fill="none" stroke="#1e1446" stroke-width="4"/><circle cx="50" cy="50" r="24" fill="none" stroke="#1e1446" stroke-width="4"/></svg>';
const SQUIG = '<svg class="deco squig" viewBox="0 0 160 40" aria-hidden="true"><path d="M6 24c14-22 26 22 40 0s26 22 40 0 26 22 40 0 22 18 28 4" fill="none" stroke="#1e1446" stroke-width="13" stroke-linecap="round"/><path d="M6 24c14-22 26 22 40 0s26 22 40 0 26 22 40 0 22 18 28 4" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>';

export function landingPage(origin: string, opts: LandingOptions = { klipy: false }): string {
  const mcpUrl = `${origin}/mcp`;
  const klipy = opts.klipy;
  const placeholder = klipy ? 'Search KLIPY' : 'Search GIFs';
  const chips = klipy ? ['facepalm', 'mind blown', 'happy dance', 'thank you', 'good morning', 'cat', 'party'] : ['cat', 'rocket launch', 'dancing', 'ocean waves'];
  const clients: Array<[string, string, string]> = [
    ['claude', 'Claude', `Settings → Connectors → Add custom connector, then paste:\n${mcpUrl}`],
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
    ? 'An MCP server that gives AI agents a GIF button. GIF search is powered by KLIPY, with openly licensed GIFs from Wikimedia Commons and Openverse as a fallback.'
    : 'An MCP server that lets AI agents find openly licensed animated GIFs from Wikimedia Commons and Openverse.';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>mcp-gifs: a GIF button for your AI agent${klipy ? ', powered by KLIPY' : ''}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffd93d" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#2b1f6b" media="(prefers-color-scheme: dark)">
<link rel="preload" href="${FONT_PATH}" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='4' width='28' height='24' rx='7' fill='%23ff5da2' stroke='%231e1446' stroke-width='3' transform='rotate(-8 16 16)'/%3E%3Ctext x='16' y='21' font-family='system-ui,sans-serif' font-size='11' font-weight='900' text-anchor='middle' fill='%231e1446' transform='rotate(-8 16 16)'%3EGIF%3C/text%3E%3C/svg%3E">
<style>${CSS}</style>
</head><body>
<div class="hero">
  ${STAR}${RING}${SQUIG}
  <div class="wrap">
    <header class="top">
      <a class="logo" href="/"><b>GIF</b>mcp-gifs<small>v${VERSION}</small></a>
      <nav aria-label="Site"><a class="opt" href="#connect">Connect</a><a class="opt" href="#credits">Credits</a><a href="${REPO_URL}">GitHub</a></nav>
    </header>
    <main class="hero-grid" id="top">
      <div>
        <h1><span>Give</span> <span>your</span> <span>AI</span> <span>a</span> <span>GIF</span> <span>button.</span></h1>
        <p class="lede">${klipy ? 'Claude, Cursor and any MCP client can find the same reaction GIFs people send in chat apps. GIF search is powered by KLIPY.' : 'Claude, Cursor and any MCP client can find openly licensed animated GIFs, each with its license and a credit line.'} No sign-in and no API key needed.</p>
        <div class="endpoint">
          <code id="endpoint">${esc(mcpUrl)}</code>
          <button class="btn" type="button" data-copy="endpoint">Copy</button>
        </div>
        <p class="hint">Paste this URL into your MCP client. <a href="#connect">Setup for each client</a></p>
      </div>

      <div class="picker" aria-label="Try the GIF search">
        <div class="picker-bar" aria-hidden="true"><i></i><i></i><i></i><span>Try it</span></div>
        <div class="picker-head">
          <form id="search" class="search" role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
            <label class="sr" for="q">${placeholder}</label>
            <input id="q" name="q" type="search" placeholder="${placeholder}" autocomplete="off" enterkeyhint="search" maxlength="200">
            <button class="btn" type="submit">Search</button>
          </form>
          <div class="powered">${klipy ? '<a href="https://klipy.com" rel="noopener">Powered by KLIPY</a><span>Shown in KLIPY’s order</span>' : '<span>Openly licensed GIFs from Wikimedia Commons and Openverse</span>'}</div>
        </div>
        <div class="chips" aria-label="Example searches">${chips.map((c) => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <p id="status" class="status" role="status" aria-live="polite"></p>
        <div id="grid" class="grid"><div class="empty"><b aria-hidden="true">:-)</b>Pick a sticker above or type anything. This is exactly what your agent gets back.</div></div>
      </div>
    </main>
  </div>
</div>

<section id="connect">
  <div class="wrap">
    <h2>Plug it in</h2>
    <p class="sub">One URL, no keys, no sessions. The server speaks MCP Streamable HTTP. Pick your client:</p>
    <div class="connect">
      <div>
        <div class="tabs" role="tablist" aria-label="MCP clients">${tabs}</div>
        ${panels}
      </div>
      <ul class="tools" aria-label="Tools your agent gets">
        <li><code>search_gifs</code><p>Find GIFs by a few words. Each result has a direct GIF link, a preview, its size and a credit line.</p></li>
        ${klipy ? '<li><code>trending_gifs</code><p>What people are sending right now, like the first tab of a GIF picker.</p></li>' : ''}
        <li><code>get_gif</code><p>Look up one GIF again by the id search returned.</p></li>
      </ul>
    </div>
  </div>
</section>

<section id="credits">
  <div class="wrap">
    <h2>Where the GIFs come from</h2>
    <p class="sub">Every result says where it came from, and agents are told to show that credit with any GIF they display.</p>
    <div class="credits">
      ${klipy ? `<div class="credit main"><h3>Powered by KLIPY</h3><p>GIF search is <a href="https://klipy.com" rel="noopener">powered by KLIPY</a>. KLIPY results keep KLIPY’s order, load straight from KLIPY, are never mixed with other sources and always carry “Powered by KLIPY”. Read KLIPY’s <a href="https://docs.klipy.com/attribution" rel="noopener">attribution guidelines</a>.</p></div>` : ''}
      <div class="credit"><h3>Wikimedia Commons</h3><p>Openly licensed GIFs with their author and license. ${klipy ? 'Used when KLIPY has no match.' : 'The main source.'} Not affiliated with the Wikimedia Foundation.</p></div>
      <div class="credit"><h3>Openverse</h3><p>More openly licensed GIFs to fill gaps. Made with Openverse, not endorsed by Openverse.</p></div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    ${klipy ? '<p class="big">GIF search powered by <a href="https://klipy.com" rel="noopener">KLIPY</a>.</p>' : ''}
    <p>mcp-gifs v${VERSION} is open source under the MIT license. Read the <a href="${REPO_URL}">source and docs on GitHub</a> or check the <a href="/health">server status</a>.</p>
  </div>
</footer>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${script()}</script>
</body></html>`;
}
