import { REPO_URL, VERSION } from './version.js';

export function landingPage(origin: string): string {
  const mcpUrl = `${origin}/mcp`;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const cfg = esc(JSON.stringify({ mcpServers: { gifs: { url: mcpUrl } } }, null, 2));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>mcp-gifs</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#222}code,pre{background:#f4f4f4;border-radius:4px}pre{padding:.75rem;overflow:auto}code{padding:0 .25rem}</style>
</head><body>
<h1>mcp-gifs <small>v${VERSION}</small></h1>
<p>A public, no-auth <a href="https://modelcontextprotocol.io">MCP</a> server that finds openly licensed animated GIFs by keyword, from <a href="https://commons.wikimedia.org">Wikimedia Commons</a> with <a href="https://openverse.org">Openverse</a> as a fallback.</p>
<h2>Connect</h2>
<p>MCP endpoint (Streamable HTTP, stateless): <code>${esc(mcpUrl)}</code></p>
<pre>${cfg}</pre>
<p>Tools: <code>search_gifs</code> (query, limit, safety, source) and <code>get_gif</code> (id). With a KLIPY key configured, also <code>trending_gifs</code>, and reaction GIFs "Powered by KLIPY".</p>
<h2>Attribution</h2>
<p>Every result carries its license and a ready-made attribution line. Show it next to the GIF. Results are filtered with a best-effort keyword safety filter (Commons has no official content rating).</p>
<p>Made with Openverse, not endorsed by Openverse. Not affiliated with the Wikimedia Foundation.</p>
<p><a href="${REPO_URL}">Source, docs and self-hosting on GitHub</a> · <a href="/health">/health</a></p>
</body></html>`;
}
