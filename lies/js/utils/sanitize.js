/* ============================================================
   js/utils/sanitize.js
   XSS-safe HTML escaping, text cleaning, URL sanitization
   ============================================================ */

/** HTML entity map for the 5 critical chars. */
const ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Escape HTML special characters in a string.
 * Always use this before inserting user content into innerHTML.
 * @param {any} input
 * @returns {string}
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Escape a value for safe use in an HTML attribute (double-quoted).
 * @param {any} input
 * @returns {string}
 */
export function escapeAttr(input) {
  return escapeHtml(input);
}

/**
 * Strip ALL HTML tags from a string.
 * @param {any} input
 * @returns {string}
 */
export function stripHtml(input) {
  if (input === null || input === undefined) return '';
  const s = String(input);
  // Remove tags using a DOM parser (safer than regex against tricky payloads)
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = s;
    return tmp.textContent || tmp.innerText || '';
  }
  return s.replace(/<[^>]*>/g, '');
}

/**
 * Detect whether a string contains HTML tags.
 * @param {string} s
 * @returns {boolean}
 */
export function containsHtml(s) {
  return /<[^>]*>/.test(String(s || ''));
}

/**
 * Normalize whitespace: collapse runs, trim, and strip control chars.
 * @param {string} s
 * @returns {string}
 */
export function normalizeWhitespace(s) {
  if (!s) return '';
  return String(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalize Persian/Arabic characters:
 *  - Arabic Yeh ي → Persian Yeh ی
 *  - Arabic Kaf ك → Persian Kaf ک
 *  - Convert Arabic-Indic digits to Latin digits
 *  - Collapse ZWNJ runs
 * @param {string} s
 * @returns {string}
 */
export function normalizePersian(s) {
  if (!s) return '';
  return String(s)
    .replace(/\u064A/g, '\u06CC') // ي → ی
    .replace(/\u0643/g, '\u06A9') // ك → ک
    .replace(/[\u064B-\u0652\u0670]/g, '') // strip harakat
    .replace(/[\u200C\u200D]{2,}/g, '\u200C')
    .replace(/\u0640+/g, '') // strip tatweel
    .replace(/[\u0622\u0623\u0625]/g, '\u0627'); // Alef variants → ا
}

/**
 * Full user-text cleaning pipeline for storage.
 * @param {string} s
 * @param {{maxLen?: number, multiline?: boolean}} [opts]
 * @returns {string}
 */
export function cleanText(s, opts = {}) {
  const { maxLen = 0, multiline = true } = opts;
  let out = stripHtml(s);
  out = normalizeWhitespace(out);
  if (!multiline) out = out.replace(/\n+/g, ' ');
  if (maxLen > 0 && out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

/**
 * Sanitize a URL to only allow safe protocols.
 * @param {string} url
 * @param {string} [fallback='#']
 * @returns {string}
 */
export function sanitizeUrl(url, fallback = '#') {
  if (!url) return fallback;
  const s = String(url).trim();
  // Block dangerous protocols
  if (/^(javascript|data|vbscript|file):/i.test(s)) return fallback;
  // Allow http(s), mailto, tel, and relative/anchor
  if (
    /^https?:\/\//i.test(s) ||
    /^mailto:/i.test(s) ||
    /^tel:/i.test(s) ||
    s.startsWith('#') ||
    s.startsWith('/') ||
    s.startsWith('./')
  ) {
    return s;
  }
  return fallback;
}

/**
 * Sanitize a filename (for exports).
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120) || 'file';
}

/**
 * Deeply sanitize an object's string fields.
 * @template T @param {T} obj @returns {T}
 */
export function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? stripHtml(obj) : obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeObject(v);
  }
  return out;
}

/**
 * Build a safe element from a plain object — never uses innerHTML.
 * @param {string} tag @param {string} [text] @returns {HTMLElement}
 */
export function safeEl(tag, text = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}