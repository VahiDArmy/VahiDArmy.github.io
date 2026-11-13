import { escapeHtml } from './utils.js';

export function renderMarkdown(input) {
  if (input == null) return '';
  let md = String(input);

  const blocks = [];
  md = md.replace(/```([a-zA-Z0-9_+\-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blocks.length;
    blocks.push({ lang: lang || '', code });
    return `\u0000B${i}\u0000`;
  });

  const inlines = [];
  md = md.replace(/`([^`\n]+)`/g, (_, code) => {
    const i = inlines.length;
    inlines.push(code);
    return `\u0000I${i}\u0000`;
  });

  md = escapeHtml(md);

  // Tables
  md = md.replace(/((?:^\|.+\|\s*\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(Boolean);
    if (rows.length < 2) return tableBlock;
    const sep = rows[1];
    if (!/^\|[\s:|-]+\|?$/.test(sep.replace(/\s/g, ''))) return tableBlock;
    const headers = rows[0].split('|').slice(1, -1).map(s => s.trim());
    const body = rows.slice(2).map(r => r.split('|').slice(1, -1).map(s => s.trim()));
    let html = '<table><thead><tr>';
    html += headers.map(h => `<th>${h}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const r of body) {
      html += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>';
    return html;
  });

  // Headers
  md = md.replace(/^###### (.+)$/gm, '<h4>$1</h4>');
  md = md.replace(/^##### (.+)$/gm, '<h4>$1</h4>');
  md = md.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  md = md.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  md = md.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // HR
  md = md.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  md = md.replace(/^&gt; ?(.+)$/gm, '<blockquote>$1</blockquote>');
  md = md.replace(/(<blockquote>[\s\S]*?<\/blockquote>)(?:\s*<blockquote>([\s\S]*?)<\/blockquote>)+/g, (m) => {
    return m.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
  });

  // Emphasis
  md = md.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/(^|[^*\w])\*([^*\n]+?)\*/g, '$1<em>$2</em>');
  md = md.replace(/__(.+?)__/g, '<strong>$1</strong>');
  md = md.replace(/(^|[^\w])_([^_\n]+?)_/g, '$1<em>$2</em>');
  md = md.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  md = md.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, text, href, title) => {
    const safe = String(href).replace(/^javascript:/i, '#');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
  });

  // Autolink
  md = md.replace(/(^|[\s(])(https?:\/\/[^\s<>"']+)/g, (_, pre, url) => {
    return `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Lists
  md = md.replace(/^(\s*)[-*+] (.+)$/gm, (_, indent, text) => {
    const depth = Math.min(3, Math.floor(indent.length / 2));
    return `<li data-depth="${depth}">${text}</li>`;
  });
  md = md.replace(/^(\s*)\d+\. (.+)$/gm, (_, indent, text) => {
    const depth = Math.min(3, Math.floor(indent.length / 2));
    return `<li class="ol" data-depth="${depth}">${text}</li>`;
  });

  md = md.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, (m) => {
    if (/class="ol"/.test(m)) return '<ol>' + m.replace(/ class="ol" data-depth="\d+"/g, '') + '</ol>';
    return '<ul>' + m.replace(/ data-depth="\d+"/g, '') + '</ul>';
  });

  // Paragraphs
  let html = md.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (!p) return '';
    if (/^<(h[1-6]|ul|ol|hr|blockquote|pre|table|div)/.test(p)) return p;
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  // Restore code blocks
  let result = html.replace(/\u0000B(\d+)\u0000/g, (_, i) => {
    const { lang, code } = blocks[+i];
    const clean = code.replace(/\n$/, '');
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return `<pre><button class="copy-code-btn" type="button" data-copy>Copy</button><code${langClass}>${escapeHtml(clean)}</code></pre>`;
  });

  result = result.replace(/\u0000I(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(inlines[+i])}</code>`);

  return result;
}

export function plainTextPreview(md, max = 120) {
  if (!md) return '';
  let s = String(md)
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = s.slice(0, max - 1) + '…';
  return s;
}
