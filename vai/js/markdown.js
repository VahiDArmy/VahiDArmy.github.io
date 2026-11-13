// ============================================================================
// markdown.js — dependency-free markdown renderer with XSS-safe HTML escaping
// Supports: headings, bold, italic, strike, inline code, fenced code, links,
// lists, tables, blockquotes, hr, hard breaks, autolinks.
// ============================================================================

import { escapeHtml } from "./utils.js";

// ---------------------------------------------------------------------------
// Code fence handling: extract fences first so we don't mangle their content.
// ---------------------------------------------------------------------------
function extractFences(src) {
  const fences = [];
  // Fence syntax: ```lang\n ... ```  or ~~~\n ... ~~~
  const re = /^```([a-zA-Z0-9_+\-#.]*)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;
  let out = src.replace(re, (_full, lang, body) => {
    const id = `\u0000FENCE${fences.length}\u0000`;
    fences.push({ lang: (lang || "").trim(), body });
    return id;
  });
  // Also support unclosed fences at end (streaming) — be tolerant.
  const reOpen = /^```([a-zA-Z0-9_+\-#.]*)[ \t]*\r?\n([\s\S]*)$/m;
  out = out.replace(reOpen, (_full, lang, body) => {
    const id = `\u0000FENCE${fences.length}\u0000`;
    fences.push({ lang: (lang || "").trim(), body, open: true });
    return id;
  });
  return { out, fences };
}

function restoreFences(html, fences) {
  return html.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i) => {
    const f = fences[Number(i)];
    if (!f) return "";
    const lang = escapeHtml(f.lang || "");
    const body = escapeHtml(f.body);
    const label = f.lang ? f.lang : "text";
    return (
      `<div class="codeblock" data-lang="${lang}">` +
      `<div class="codeblock__head">` +
      `<span class="codeblock__lang">${escapeHtml(label)}</span>` +
      `<span class="codeblock__spacer"></span>` +
      `<button type="button" class="codeblock__btn" data-act="copy-code">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>` +
      `<span>کپی</span>` +
      `</button>` +
      `</div>` +
      `<pre class="codeblock__pre"><code data-raw="${escapeAttrInline(f.body)}">${body}</code></pre>` +
      `</div>`
    );
  });
}

function escapeAttrInline(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Inline span renderer.
// ---------------------------------------------------------------------------
function inlineHtml(src) {
  let s = escapeHtml(src);

  // inline code — grab it first, protect from other inline rules
  const inlineCodes = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    const id = `\u0001ICODE${inlineCodes.length}\u0001`;
    inlineCodes.push(code);
    return id;
  });

  // bold + italic combos
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  // strikethrough
  s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  // autolinks inside text
  s = s.replace(
    /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"']+)/g,
    (_m, pre, url) => {
      const href = url.startsWith("www.") ? `https://${url}` : url;
      return `${pre}<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`;
    }
  );

  // restore inline code
  s = s.replace(/\u0001ICODE(\d+)\u0001/g, (_m, i) => `<code>${inlineCodes[Number(i)]}</code>`);

  // hard break at line end with two spaces
  s = s.replace(/ {2,}\n/g, "<br>\n");

  return s;
}

// ---------------------------------------------------------------------------
// Block-level renderer.
// ---------------------------------------------------------------------------
function renderBlocks(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const isBlank = (l) => /^\s*$/.test(l);
  const indent = (l) => (l.match(/^(\s*)/) || ["", ""])[1].length;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // heading
    let m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inlineHtml(m[2].trim())}</h${lvl}>`);
      i++;
      continue;
    }

    // hr
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // blockquote (possibly multi-line)
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(buf.join("\n"))}</blockquote>`);
      continue;
    }

    // table (must have header row + separator row)
    if (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const header = splitTableRow(line);
      const sep = splitTableRow(lines[i + 1]);
      const aligns = sep.map((c) => {
        const t = c.trim();
        if (/^:-+:$/.test(t)) return "center";
        if (/^-+:$/.test(t)) return "end";
        return "start";
      });
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      let tbl = `<table><thead><tr>`;
      header.forEach((h, idx) => {
        tbl += `<th style="text-align:${aligns[idx] || "start"}">${inlineHtml(h.trim())}</th>`;
      });
      tbl += `</tr></thead><tbody>`;
      for (const row of rows) {
        tbl += `<tr>`;
        for (let c = 0; c < header.length; c++) {
          tbl += `<td style="text-align:${aligns[c] || "start"}">${inlineHtml((row[c] || "").trim())}</td>`;
        }
        tbl += `</tr>`;
      }
      tbl += `</tbody></table>`;
      out.push(tbl);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const it = lines[i].replace(/^\s*[-*+]\s+/, "");
        items.push(it);
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const it = lines[i].replace(/^\s*\d+[.)]\s+/, "");
        items.push(it);
        i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ol>`);
      continue;
    }

    // paragraph
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*(?:---|\*\*\*|___)\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineHtml(buf.join("\n"))}</p>`);
  }

  return out.join("\n");
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function renderMarkdown(src) {
  if (!src) return "";
  const { out, fences } = extractFences(String(src));
  const html = renderBlocks(out);
  return restoreFences(html, fences);
}

// For safety, treat everything as plain text when the input is very large.
export function renderMarkdownLazy(src) {
  if (!src) return "";
  if (src.length > 80_000) {
    return `<pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(src)}</pre>`;
  }
  return renderMarkdown(src);
}

/** Only textual extraction (for the model that must receive clean text). */
export function stripMarkdown(src) {
  if (!src) return "";
  return String(src)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z0-9]*\n?/g, ""))
    .replace(/[*_~`>#-]/g, "")
    .replace(/\n{3,}/g, "\n\n");
}
