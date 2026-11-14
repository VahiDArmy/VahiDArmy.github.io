/**
 * Markdown rendering with zero raw HTML pass-through.
 * Model output is untrusted: escape first, then add only the tags we generate.
 * Code fences, tables, lists, quotes, links, task lists and headings are supported.
 */
import { escapeHtml, escapeAttr, normalizeText, isValidHttpUrl } from '../utils.js';
import { icon } from './icons.js';

const TOKEN = '\u0002';

function sanitizeUrl(url) {
  const clean = String(url || '').trim();
  if (!clean) return null;
  if (/^(javascript|data|vbscript|file):/i.test(clean)) return null;
  if (clean.startsWith('#') || clean.startsWith('/')) return null;
  if (/^mailto:/i.test(clean)) return escapeAttr(clean);
  if (!/^https?:\/\//i.test(clean)) {
    if (/^www\./i.test(clean)) return escapeAttr(`https://${clean}`);
    return null;
  }
  return isValidHttpUrl(clean) ? escapeAttr(clean) : null;
}

function emphasis(text) {
  let out = text;
  out = out.replace(/\*\*([^*\n][^*]*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n][^_]*?)__/g, '<strong>$1</strong>');
  out = out.replace(/~~([^~\n][^~]*?)~~/g, '<del>$1</del>');
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  return out;
}

function inline(text) {
  let out = escapeHtml(text);
  const codes = [];
  const links = [];

  out = out.replace(/`([^`\n]+)`/g, (match, code) => {
    codes.push(`<code>${code}</code>`);
    return `${TOKEN}C${codes.length - 1}${TOKEN}`;
  });

  // [label](url "title")
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (match, label, url, title) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label;
    links.push(
      `<a href="${safe}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeAttr(title)}"` : ''}>${label}</a>`,
    );
    return `${TOKEN}L${links.length - 1}${TOKEN}`;
  });

  // Bare URLs and www links, with trailing punctuation excluded.
  out = out.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/g, (match, prefix, url) => {
    let clean = url;
    let trailing = '';
    while (/[.,;:!?]$/.test(clean)) {
      trailing = clean.slice(-1) + trailing;
      clean = clean.slice(0, -1);
    }
    if (clean.endsWith(')') && (clean.match(/\(/g) || []).length < (clean.match(/\)/g) || []).length) {
      trailing = `)${trailing}`;
      clean = clean.slice(0, -1);
    }
    const safe = sanitizeUrl(clean);
    if (!safe) return match;
    links.push(`<a href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a>`);
    return `${prefix}${TOKEN}L${links.length - 1}${TOKEN}${trailing}`;
  });

  out = emphasis(out);

  out = out.replace(new RegExp(`${TOKEN}L(\\d+)${TOKEN}`, 'g'), (match, index) => links[Number(index)] || '');
  out = out.replace(new RegExp(`${TOKEN}C(\\d+)${TOKEN}`, 'g'), (match, index) => codes[Number(index)] || '');
  return out;
}

function codeBlock(lang, code, closed) {
  const language = (lang || 'text').trim().slice(0, 24) || 'text';
  const label = escapeHtml(language);
  return `<div class="md-code" data-lang="${escapeAttr(language)}">
    <div class="md-code__bar">
      <span class="md-code__lang">${label}${closed ? '' : ' · streaming'}</span>
      <button type="button" class="md-code__copy" data-copy-code aria-label="Copy code">${icon('copy', { size: 14 })}<span>Copy</span></button>
    </div>
    <pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>
  </div>`;
}

function extractCode(text) {
  const blocks = [];
  let out = text.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const index = blocks.length;
    blocks.push(codeBlock(lang, code, true));
    return `\n${TOKEN}B${index}${TOKEN}\n`;
  });
  const unclosed = out.indexOf('```');
  if (unclosed !== -1) {
    const rest = out.slice(unclosed);
    const match = rest.match(/^```([^\n`]*)\n?([\s\S]*)$/);
    if (match) {
      const index = blocks.length;
      blocks.push(codeBlock(match[1], match[2], false));
      out = `${out.slice(0, unclosed)}\n${TOKEN}B${index}${TOKEN}\n`;
    }
  }
  return { text: out, blocks };
}

function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) return false;
  return /-/.test(line) && line.includes('|');
}

function listItem(line) {
  const match = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
  if (!match) return null;
  return {
    indent: match[1].replace(/\t/g, '    ').length,
    ordered: /\d/.test(match[2]),
    content: match[3],
  };
}

function renderList(lines) {
  const items = lines.map(listItem).filter(Boolean);
  if (!items.length) return '';
  const ordered = items[0].ordered;
  const tag = ordered ? 'ol' : 'ul';
  const body = items
    .map((item) => {
      let content = item.content;
      let prefix = '';
      const task = content.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        prefix = `<input type="checkbox" disabled ${task[1].toLowerCase() === 'x' ? 'checked' : ''} aria-label="${task[1].toLowerCase() === 'x' ? 'completed' : 'incomplete'} task"> `;
        content = task[2];
      }
      const indentClass = item.indent >= 2 ? ' class="md-li--nested"' : '';
      return `<li${indentClass}>${prefix}${inline(content)}</li>`;
    })
    .join('');
  return `<${tag} class="md-list">${body}</${tag}>`;
}

function renderTable(headerLine, separatorLine, bodyLines) {
  const head = splitTableRow(headerLine);
  const aligns = splitTableRow(separatorLine).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
  const rows = bodyLines.map(splitTableRow);
  const headHtml = head.map((cell, index) => `<th style="text-align:${aligns[index] || 'left'}">${inline(cell)}</th>`).join('');
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${head.map((_, index) => `<td style="text-align:${aligns[index] || 'left'}">${inline(row[index] || '')}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

export function renderMarkdown(input, { streaming = false } = {}) {
  const source = normalizeText(input);
  if (!source.trim()) return '';
  const { text, blocks } = extractCode(source);
  const lines = text.split('\n');
  const html = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.map((line) => inline(line)).join('<br>');
    html.push(`<p>${content}</p>`);
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const blockToken = trimmed.match(new RegExp(`^${TOKEN}B(\\d+)${TOKEN}$`));
    if (blockToken) {
      flushParagraph();
      html.push(blocks[Number(blockToken[1])] || '');
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level} class="md-h md-h${level}">${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed.replace(/\s/g, ''))) {
      flushParagraph();
      html.push('<hr class="md-hr">');
      continue;
    }

    if (/^&gt;\s?/.test(escapeHtml(trimmed)) || /^>/.test(trimmed)) {
      flushParagraph();
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      i -= 1;
      html.push(`<blockquote class="md-quote">${quoteLines.map((l) => `<p>${inline(l)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      const headerLine = trimmed;
      const separator = lines[i + 1];
      const body = [];
      let cursor = i + 2;
      while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim()) {
        body.push(lines[cursor]);
        cursor += 1;
      }
      html.push(renderTable(headerLine, separator, body));
      i = cursor - 1;
      continue;
    }

    if (listItem(line)) {
      flushParagraph();
      const listLines = [];
      let cursor = i;
      while (cursor < lines.length) {
        if (!lines[cursor].trim()) break;
        if (!listItem(lines[cursor])) break;
        listLines.push(lines[cursor]);
        cursor += 1;
      }
      html.push(renderList(listLines));
      i = cursor - 1;
      continue;
    }

    paragraph.push(line.trim());
  }
  flushParagraph();

  if (!html.length && source.trim()) html.push(`<p>${inline(source)}</p>`);

  return `<div class="markdown ${streaming ? 'markdown--streaming' : ''}">${html.join('')}</div>`;
}

export function stripMarkdown(input, maxLength = 0) {
  let text = normalizeText(input)
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength && text.length > maxLength) text = `${text.slice(0, maxLength - 1).trim()}…`;
  return text;
}

/** Delegate code-copy buttons inside a container. */
export function bindCodeCopy(container, onCopied) {
  if (!container || container.dataset.copyBound === '1') return;
  container.dataset.copyBound = '1';
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-code]');
    if (!button || !container.contains(button)) return;
    const code = button.closest('.md-code')?.querySelector('code')?.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      button.classList.add('is-copied');
      const label = button.querySelector('span');
      if (label) label.textContent = 'Copied';
      onCopied?.(code);
      window.setTimeout(() => {
        button.classList.remove('is-copied');
        if (label) label.textContent = 'Copy';
      }, 1600);
    } catch (error) {
      onCopied?.(null, error);
    }
  });
}
