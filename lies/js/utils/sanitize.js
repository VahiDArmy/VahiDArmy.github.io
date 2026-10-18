/* ============================================================
   js/utils/sanitize.js
   FIXED: Replaced `innerHTML` with `DOMParser` in `stripHtml()`.
   ============================================================ */

const ENTITIES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

export function stripHtml(input) {
  if (input === null || input === undefined) return '';
  const s = String(input);
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    return doc.body.textContent || '';
  }
  return s.replace(/<[^>]*>/g, '');
}

export function normalizeWhitespace(s) {
  if (!s) return '';
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizePersian(s) {
  if (!s) return '';
  return String(s).replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9').replace(/[\u064B-\u0652\u0670]/g, '').replace(/[\u200C\u200D]{2,}/g, '\u200C').replace(/\u0640+/g, '').replace(/[\u0622\u0623\u0625]/g, '\u0627');
}

export function cleanText(s, opts = {}) {
  const { maxLen = 0, multiline = true } = opts;
  let out = stripHtml(s);
  out = normalizeWhitespace(out);
  if (!multiline) out = out.replace(/\n+/g, ' ');
  if (maxLen > 0 && out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

export function sanitizeUrl(url, fallback = '#') {
  if (!url) return fallback;
  const s = String(url).trim();
  if (/^(javascript|data|vbscript|file):/i.test(s)) return fallback;
  return s;
}

export function sanitizeFilename(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 120) || 'file';
}