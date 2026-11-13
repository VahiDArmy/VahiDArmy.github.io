/* ============================================================
   NEXUS CHAT — MARKDOWN RENDERER
   Zero-dependency, XSS-safe Markdown → HTML.
   Attaches to window.Nexus.Markdown.

   Supports: headings, bold, italic, strikethrough, inline code,
   fenced code blocks, links, images, ordered/unordered lists,
   nested lists, task lists, blockquotes, tables, horizontal rules,
   autolinks, line breaks.

   Usage: Nexus.Markdown.render(text) -> HTML string
   ============================================================ */
(function () {
  'use strict';

  /* ---------- HTML escape ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- URL sanitization ---------- */
  function sanitizeUrl(url) {
    const u = String(url).trim();
    // Block javascript: and data: URLs except images
    if (/^\s*javascript:/i.test(u) || /^\s*vbscript:/i.test(u)) return '#';
    if (/^\s*data:/i.test(u) && !/^\s*data:image\//i.test(u)) return '#';
    return u;
  }

  /* ---------- Inline rendering ---------- */
  function renderInline(text, opts) {
    opts = opts || {};
    if (!text) return '';

    // 1. Protect inline code from other transformations
    const codeSlots = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const idx = codeSlots.length;
      codeSlots.push(`<code>${escapeHtml(code)}</code>`);
      return `\u0000CODE${idx}\u0000`;
    });

    // 2. Protect math-ish $...$ ? skip for now.

    // 3. Escape HTML
    text = escapeHtml(text);

    // 4. Images ![alt](url)
    text = text.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
      (_, alt, url, title) => {
        const safe = sanitizeUrl(url);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}"${t} loading="lazy">`;
      }
    );

    // 5. Links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
      (_, label, url, title) => {
        const safe = sanitizeUrl(url);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const isExternal = /^https?:\/\//i.test(safe);
        const rel = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(safe)}"${t}${rel}>${label}</a>`;
      }
    );

    // 6. Autolinks
    text = text.replace(
      /(^|[\s(])((?:https?:\/\/|mailto:)[^\s<>()]+)/g,
      (m, pre, url) => {
        if (/<a\b/i.test(pre) || /href="/i.test(pre)) return m;
        return `${pre}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
      }
    );

    // 7. Bold + italic (order matters)
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^_])__([^_\n]+)__/g, '$1<strong>$2</strong>');
    text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

    // 8. Strikethrough
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // 9. Highlight
    text = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');

    // 10. Line breaks
    text = text.replace(/ {2,}\n/g, '<br>');
    text = text.replace(/\n/g, '<br>');

    // 11. Restore inline code
    text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeSlots[Number(i)]);

    return text;
  }

  /* ---------- Code block ---------- */
  function renderCodeBlock(code, lang) {
    const language = (lang || 'plaintext').toLowerCase();
    const safeLang = /^[a-z0-9+#.-]+$/.test(language) ? language : 'plaintext';
    const escaped = escapeHtml(code);

    // Apply highlighting if available
    let highlighted = escaped;
    if (window.Nexus && window.Nexus.Highlight) {
      try {
        highlighted = window.Nexus.Highlight.highlight(code, safeLang);
      } catch (e) {
        highlighted = escaped;
      }
    }

    const encoded = escapeHtml(encodeURIComponent(code));

    return `
<div class="code-block" data-lang="${safeLang}">
  <div class="code-block-header">
    <span class="code-block-lang">${safeLang}</span>
    <button class="code-copy-btn" type="button" data-code="${encoded}" aria-label="Copy code">
      ⧉ Copy
    </button>
  </div>
  <pre><code class="language-${safeLang}">${highlighted}</code></pre>
</div>`.trim();
  }

  /* ---------- Table parser ---------- */
  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(c => c.trim());
  }

  function parseAlignment(sep) {
    const cells = splitTableRow(sep);
    return cells.map(c => {
      const t = c.trim();
      if (/^:.*:$/.test(t)) return 'center';
      if (/^:/.test(t)) return 'left';
      if (/:$/.test(t)) return 'right';
      return 'left';
    });
  }

  function renderTable(headers, aligns, rows) {
    let html = '<table>\n<thead>\n<tr>\n';
    headers.forEach((h, i) => {
      html += `<th style="text-align:${aligns[i] || 'left'}">${renderInline(h)}</th>\n`;
    });
    html += '</tr>\n</thead>\n<tbody>\n';
    rows.forEach(row => {
      html += '<tr>\n';
      headers.forEach((_, i) => {
        html += `<td style="text-align:${aligns[i] || 'left'}">${renderInline(row[i] || '')}</td>\n`;
      });
      html += '</tr>\n';
    });
    html += '</tbody>\n</table>';
    return html;
  }

  /* ---------- Main parser ---------- */
  function renderMarkdown(text) {
    if (text == null) return '';
    const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = src.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      /* ---------- Fenced code block ---------- */
      const fence = line.match(/^( {0,3})```([a-zA-Z0-9+#.\-]*)\s*$/);
      if (fence) {
        const lang = fence[2] || 'plaintext';
        const buffer = [];
        i++;
        while (i < lines.length && !/^ {0,3}```\s*$/.test(lines[i])) {
          buffer.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        out.push(renderCodeBlock(buffer.join('\n'), lang));
        continue;
      }

      /* ---------- ATX heading ---------- */
      const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (h) {
        const level = h[1].length;
        out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
        i++;
        continue;
      }

      /* ---------- Setext heading ---------- */
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (line.trim() && /^=+\s*$/.test(next)) {
          out.push(`<h1>${renderInline(line.trim())}</h1>`);
          i += 2;
          continue;
        }
        if (line.trim() && /^-+\s*$/.test(next)) {
          out.push(`<h2>${renderInline(line.trim())}</h2>`);
          i += 2;
          continue;
        }
      }

      /* ---------- Horizontal rule ---------- */
      if (/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      /* ---------- Blockquote ---------- */
      if (/^\s{0,3}>/.test(line)) {
        const buffer = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
          buffer.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        out.push(`<blockquote>${renderMarkdown(buffer.join('\n'))}</blockquote>`);
        continue;
      }

      /* ---------- Table ---------- */
      if (
        i + 1 < lines.length &&
        line.includes('|') &&
        isTableSeparator(lines[i + 1])
      ) {
        const headers = splitTableRow(line);
        const aligns = parseAlignment(lines[i + 1]);
        i += 2;
        const rows = [];
        while (
          i < lines.length &&
          lines[i].trim() &&
          lines[i].includes('|')
        ) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        out.push(renderTable(headers, aligns, rows));
        continue;
      }

      /* ---------- Unordered list ---------- */
      const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
      if (ulMatch) {
        const indent = ulMatch[1].length;
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*+])\s+(.+)$/);
          if (!m || m[1].length !== indent) break;
          const itemText = m[3];
          // Task list item?
          const task = itemText.match(/^\[( |x|X)\]\s+(.*)$/);
          if (task) {
            const checked = task[1].toLowerCase() === 'x';
            items.push({
              html: `<input type="checkbox" disabled ${checked ? 'checked' : ''}> ${renderInline(task[2])}`,
              task: true,
              checked,
            });
          } else {
            items.push({ html: renderInline(itemText), task: false });
          }
          i++;
        }
        const isTask = items.some(it => it.task);
        const lis = items.map(it => {
          if (it.task) {
            return `<li class="task-list-item ${it.checked ? 'checked' : ''}">${it.html}</li>`;
          }
          return `<li>${it.html}</li>`;
        }).join('\n');
        out.push(`<ul${isTask ? ' class="task-list"' : ''}>\n${lis}\n</ul>`);
        continue;
      }

      /* ---------- Ordered list ---------- */
      const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
      if (olMatch) {
        const indent = olMatch[1].length;
        const startNum = parseInt(olMatch[2], 10);
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)(\d+)[.)]\s+(.+)$/);
          if (!m || m[1].length !== indent) break;
          items.push(renderInline(m[3]));
          i++;
        }
        const startAttr = startNum !== 1 ? ` start="${startNum}"` : '';
        out.push(`<ol${startAttr}>\n${items.map(t => `<li>${t}</li>`).join('\n')}\n</ol>`);
        continue;
      }

      /* ---------- Blank line ---------- */
      if (!line.trim()) {
        i++;
        continue;
      }

      /* ---------- Paragraph ---------- */
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^ {0,3}(#{1,6})\s+/.test(lines[i]) &&
        !/^ {0,3}```/.test(lines[i]) &&
        !/^\s{0,3}>/.test(lines[i]) &&
        !/^(\s*)([-*+])\s+/.test(lines[i]) &&
        !/^(\s*)(\d+)[.)]\s+/.test(lines[i]) &&
        !/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) {
        out.push(`<p>${renderInline(para.join('\n'))}</p>`);
      }
    }

    return out.join('\n');
  }

  /* ---------- Code copy button wiring ---------- */
  function attachCodeCopyButtons(container) {
    if (!container) return;
    container.querySelectorAll('.code-copy-btn').forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', function () {
        const encoded = btn.getAttribute('data-code') || '';
        let code;
        try {
          code = decodeURIComponent(encoded);
        } catch (e) {
          code = encoded;
        }
        const done = () => {
          const original = btn.innerHTML;
          btn.classList.add('copied');
          btn.innerHTML = '✓ Copied';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = original;
          }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(done);
        } else {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (e) { /* noop */ }
          document.body.removeChild(ta);
          done();
        }
      });
    });
  }

  /* ---------- Export ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Markdown = {
    render: renderMarkdown,
    renderInline: renderInline,
    escapeHtml: escapeHtml,
    attachCodeCopyButtons: attachCodeCopyButtons,
  };
})();
