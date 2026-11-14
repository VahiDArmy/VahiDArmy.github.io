/**
 * Markdown rendering with zero raw HTML pass-through.
 * Model output is untrusted: escape first, then add only the tags we generate.
 * Code fences, tables, lists, quotes, links, task lists and headings are supported.
 */
import { escapeHtml, escapeAttr, normalizeText, isValidHttpUrl } from '../utils.js';
import { icon } from './icons.js';

const TOKEN = '\u0002';

/**
 * Paragraph-level direction for mixed Persian/Arabic + English.
 * Counts strong RTL (Arabic script family) vs strong LTR letters.
 * Neutral / weak characters are ignored so short English in a Persian
 * paragraph does not flip the whole block incorrectly.
 */
const RTL_STRONG = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

export function textDirection(text) {
  const source = String(text || '');
  let rtl = 0;
  let ltr = 0;
  for (const char of source) {
    if (RTL_STRONG.test(char)) rtl += 1;
    else if (LTR_STRONG.test(char)) ltr += 1;
  }
  if (rtl === 0 && ltr === 0) return 'auto';
  return rtl >= ltr ? 'rtl' : 'ltr';
}

function dirAttr(text) {
  const dir = textDirection(text);
  return dir === 'auto' ? ' dir="auto"' : ` dir="${dir}"`;
}

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

/**
 * Fence info: ```html, ```html index.html, ```css:styles.css, ```javascript app.js
 * Also peeks at the first line for filename comments (HTML comment, CSS block
 * comment, or // / # line comment naming the file).
 */
function parseFenceMeta(langRaw, code) {
  const raw = String(langRaw || '').trim();
  let language = 'text';
  let filename = '';
  const spaced = raw.match(/^([A-Za-z0-9_+#.-]+)\s+([^\s].*)$/);
  const colon = raw.match(/^([A-Za-z0-9_+#.-]+)\s*:\s*([^\s].*)$/);
  if (spaced) {
    language = spaced[1];
    filename = spaced[2].trim();
  } else if (colon) {
    language = colon[1];
    filename = colon[2].trim();
  } else if (raw) {
    language = raw;
  }
  language = language.slice(0, 24).toLowerCase() || 'text';
  filename = filename.replace(/[<>"|?*\\]/g, '').slice(0, 120);

  if (!filename) {
    const first = String(code || '')
      .split('\n')
      .find((line) => line.trim()) || '';
    const fromComment =
      first.match(/^\s*<!--\s*([^\s*][^>]{0,80}?)\s*-->/) ||
      first.match(/^\s*\/\*\s*([^\s*][^*]{0,80}?)\s*\*\//) ||
      first.match(/^\s*\/\/\s*([^\s][^\n]{0,80})/) ||
      first.match(/^\s*#\s*([^\s][^\n]{0,80})/);
    if (fromComment) {
      const candidate = fromComment[1].trim().replace(/[<>"|?*\\]/g, '');
      if (/\.[a-z0-9]{1,8}$/i.test(candidate) || /^(index|main|app|style|styles|script)/i.test(candidate)) {
        filename = candidate.slice(0, 120);
      }
    }
  }

  if (!filename) {
    if (language === 'html' || language === 'htm') filename = 'index.html';
    else if (language === 'svg') filename = 'preview.svg';
    else if (language === 'css') filename = 'styles.css';
    else if (language === 'js' || language === 'javascript') filename = 'script.js';
  }

  return { language, filename };
}

const PREVIEWABLE = new Set(['html', 'htm', 'svg']);

function codeBlock(lang, code, closed) {
  const { language, filename } = parseFenceMeta(lang, code);
  const label = escapeHtml(filename && filename !== language ? `${language} · ${filename}` : language);
  const canPreview = PREVIEWABLE.has(language) || /\.(html?|svg)$/i.test(filename);
  const previewBtn = canPreview
    ? `<button type="button" class="md-code__preview" data-preview-code aria-label="Preview HTML">${icon('eye', { size: 14 })}<span>Preview</span></button>`
    : '';
  return `<div class="md-code" data-lang="${escapeAttr(language)}" data-filename="${escapeAttr(filename)}" dir="ltr">
    <div class="md-code__bar">
      <span class="md-code__lang">${label}${closed ? '' : ' · streaming'}</span>
      <div class="md-code__actions">
        ${previewBtn}
        <button type="button" class="md-code__copy" data-copy-code aria-label="Copy code">${icon('copy', { size: 14 })}<span>Copy</span></button>
      </div>
    </div>
    <pre dir="ltr"><code dir="ltr">${escapeHtml(code.replace(/\n$/, ''))}</code></pre>
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
  const listDir = textDirection(items.map((item) => item.content).join(' '));
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
      return `<li${indentClass}${dirAttr(content)}>${prefix}${inline(content)}</li>`;
    })
    .join('');
  const listDirAttr = listDir === 'auto' ? ' dir="auto"' : ` dir="${listDir}"`;
  return `<${tag} class="md-list"${listDirAttr}>${body}</${tag}>`;
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
    const plain = paragraph.join(' ');
    const content = paragraph.map((line) => inline(line)).join('<br>');
    html.push(`<p${dirAttr(plain)}>${content}</p>`);
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
      html.push(`<h${level} class="md-h md-h${level}"${dirAttr(heading[2])}>${inline(heading[2])}</h${level}>`);
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
      const quotePlain = quoteLines.join(' ');
      html.push(
        `<blockquote class="md-quote"${dirAttr(quotePlain)}>${quoteLines
          .map((l) => `<p${dirAttr(l)}>${inline(l)}</p>`)
          .join('')}</blockquote>`,
      );
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

  if (!html.length && source.trim()) html.push(`<p${dirAttr(source)}>${inline(source)}</p>`);

  return `<div class="markdown ${streaming ? 'markdown--streaming' : ''}" dir="auto">${html.join('')}</div>`;
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

function collectSiblingFiles(codeEl) {
  const root = codeEl.closest('.markdown') || codeEl.parentElement;
  if (!root) return [];
  return Array.from(root.querySelectorAll('.md-code')).map((node) => {
    const language = (node.dataset.lang || 'text').toLowerCase();
    const filename = node.dataset.filename || '';
    const content = node.querySelector('code')?.textContent || '';
    return { language, filename, content, node };
  });
}

function mimeForFilename(name, language) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.css') || language === 'css') return 'text/css';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || language === 'js' || language === 'javascript') {
    return 'text/javascript';
  }
  if (lower.endsWith('.svg') || language === 'svg') return 'image/svg+xml';
  if (lower.endsWith('.json')) return 'application/json';
  return 'text/html';
}

function basename(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim();
}

/**
 * Build a runnable HTML document from one entry file + sibling css/js/svg assets.
 * Relative href/src to known filenames are rewritten to blob: URLs so the preview
 * runs entirely in the browser with no server.
 */
function assemblePreviewDocument(entry, files) {
  const byName = new Map();
  for (const file of files) {
    const name = basename(file.filename);
    if (name) byName.set(name.toLowerCase(), file);
  }

  const blobUrls = [];
  const urlCache = new Map();
  const urlFor = (name) => {
    const key = basename(name).toLowerCase();
    if (urlCache.has(key)) return urlCache.get(key);
    const file = byName.get(key);
    if (!file) return null;
    const blob = new Blob([file.content], { type: mimeForFilename(file.filename, file.language) });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    urlCache.set(key, url);
    return url;
  };

  let html = entry.content;
  const isSvg = entry.language === 'svg' || /\.svg$/i.test(entry.filename);
  if (isSvg && !/<svg[\s>]/i.test(html)) {
    html = `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`;
  }
  if (isSvg) {
    return {
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#0b0d12;color:#e8e6e3}svg{max-width:min(100%,720px);height:auto}</style></head><body>${html}</body></html>`,
      blobUrls,
      filesUsed: [entry.filename || 'preview.svg'],
    };
  }

  // Inline same-folder assets that look like relative links.
  html = html.replace(
    /(<(?:link|script|img|source|video|audio|iframe)\b[^>]*?\s(?:href|src)=["'])([^"']+)(["'][^>]*>)/gi,
    (match, pre, ref, post) => {
      if (/^(https?:|data:|blob:|\/\/|#|mailto:)/i.test(ref)) return match;
      const mapped = urlFor(ref);
      if (!mapped) return match;
      return `${pre}${mapped}${post}`;
    },
  );

  // If the HTML has no stylesheet/script tags, auto-attach sibling css/js.
  const hasStylesheet = /<link\b[^>]*rel=["']?stylesheet/i.test(html) || /<style[\s>]/i.test(html);
  const hasScript = /<script[\s>]/i.test(html);
  const extras = [];
  if (!hasStylesheet) {
    for (const file of files) {
      if (file === entry) continue;
      if (file.language === 'css' || /\.css$/i.test(file.filename)) {
        extras.push(`<style data-from="${escapeAttr(file.filename)}">\n${file.content}\n</style>`);
      }
    }
  }
  if (!hasScript) {
    for (const file of files) {
      if (file === entry) continue;
      if (file.language === 'js' || file.language === 'javascript' || /\.m?js$/i.test(file.filename)) {
        extras.push(`<script data-from="${escapeAttr(file.filename)}">\n${file.content}\n</script>`);
      }
    }
  }

  if (extras.length) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${extras.join('\n')}\n</body>`);
    } else if (/<\/html>/i.test(html)) {
      html = html.replace(/<\/html>/i, `${extras.join('\n')}\n</html>`);
    } else {
      html = `${html}\n${extras.join('\n')}`;
    }
  }

  if (!/<!doctype/i.test(html) && !/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n${html}\n</body></html>`;
  } else if (!/<meta\s+charset=/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1><meta charset="utf-8">');
  }

  const filesUsed = files
    .filter((file) => file === entry || extras.some((chunk) => chunk.includes(file.filename)) || byName.has(basename(file.filename).toLowerCase()))
    .map((file) => file.filename || file.language);

  return { html, blobUrls, filesUsed: [...new Set(filesUsed)] };
}

/**
 * Open a sandboxed HTML/SVG preview. When the message has sibling css/js fences,
 * they are folded into the document so relative multi-file projects run locally.
 */
export function openCodePreview(codeEl) {
  if (!codeEl) return null;
  const files = collectSiblingFiles(codeEl);
  const entry =
    files.find((file) => file.node === codeEl) ||
    files.find((file) => PREVIEWABLE.has(file.language) || /\.(html?|svg)$/i.test(file.filename));
  if (!entry) return null;

  const related = files.filter((file) => {
    if (file === entry) return true;
    if (PREVIEWABLE.has(file.language) || /\.(html?|svg)$/i.test(file.filename)) return false;
    return (
      file.language === 'css' ||
      file.language === 'js' ||
      file.language === 'javascript' ||
      /\.(css|m?js|json|svg)$/i.test(file.filename)
    );
  });

  const { html, blobUrls, filesUsed } = assemblePreviewDocument(entry, related);
  const frame = document.createElement('iframe');
  frame.className = 'html-preview__frame';
  frame.title = 'HTML preview';
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups-to-escape-sandbox');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.srcdoc = html;

  const shell = document.createElement('div');
  shell.className = 'html-preview';
  shell.innerHTML = `<div class="html-preview__meta"><span class="html-preview__badge">Local sandbox</span><span class="html-preview__files">${escapeHtml(
    (filesUsed.length ? filesUsed : [entry.filename || entry.language]).join(' · '),
  )}</span></div>`;
  shell.appendChild(frame);

  // Lazy import avoids a hard cycle with modal consumers.
  return import('./modal.js').then(({ openModal }) => {
    const modal = openModal({
      title: 'HTML preview',
      subtitle: 'Runs in a sandboxed iframe on this device. Sibling CSS/JS fences in the same reply are included when linked or auto-attached.',
      body: shell,
      size: 'xl',
      className: 'modal--preview',
      actions: [
        {
          label: 'Open in new tab',
          icon: 'external',
          variant: 'ghost',
          onClick: () => {
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          },
        },
        { label: 'Close', variant: 'primary' },
      ],
      onClose: () => {
        for (const url of blobUrls) URL.revokeObjectURL(url);
      },
    });
    return modal;
  });
}

/** Delegate Preview buttons on HTML/SVG code fences. */
export function bindCodePreview(container) {
  if (!container || container.dataset.previewBound === '1') return;
  container.dataset.previewBound = '1';
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-code]');
    if (!button || !container.contains(button)) return;
    const codeEl = button.closest('.md-code');
    if (!codeEl) return;
    openCodePreview(codeEl)?.catch?.(() => {});
  });
}
