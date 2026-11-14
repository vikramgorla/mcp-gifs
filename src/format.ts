import type { Gif, SearchResult } from './types.js';

function size(bytes: number | null): string {
  if (bytes === null) return '';
  return bytes >= 1048576 ? `, ${(bytes / 1048576).toFixed(1)} MB` : `, ${Math.round(bytes / 1024)} KB`;
}

export function gifToMarkdown(g: Gif, n?: number): string {
  const head = n === undefined ? `**${g.title}**` : `${n}. **${g.title}**`;
  const anim = g.animated === true ? `animated, ${g.frameCount} frames` : g.animated === false ? 'static' : 'animation not verified';
  return [
    head,
    `   - GIF: ${g.url}`,
    `   - Preview: ${g.previewUrl}`,
    `   - ${g.width}×${g.height}${size(g.fileSizeBytes)}, ${anim}; source: ${g.source}`,
    `   - License: ${g.license}${g.licenseUrl ? ` (${g.licenseUrl})` : ''}${g.attributionRequired ? ' (attribution required)' : ''}`,
    `   - Attribution: ${g.attribution}`,
    `   - id: \`${g.id}\``,
  ].join('\n');
}

export function searchToMarkdown(r: SearchResult): string {
  const lines = [`Found ${r.count} GIF${r.count === 1 ? '' : 's'} for "${r.query}" (safety: ${r.safety}; sources: ${r.sourcesQueried.join(', ') || 'none'}).`];
  if (r.notes.length) lines.push(...r.notes.map((n) => `> ${n}`));
  if (r.results.length) {
    lines.push('', ...r.results.map((g, i) => gifToMarkdown(g, i + 1)));
    lines.push('', 'When you show a GIF, include its attribution line and keep the license link.');
  }
  return lines.join('\n');
}
