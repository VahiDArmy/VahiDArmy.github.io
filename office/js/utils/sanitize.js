/**
 * HTML sanitization — used anywhere user-provided content might be injected
 * into the DOM (though we prefer textContent everywhere). This is a strict
 * whitelist-based sanitizer, not a full HTML parser.
 */

import { escapeHtml } from './dom.js';

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote',
  'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a',
]);

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'rel', 'target'],
};

/**
 * Very simple sanitizer: escapes dangerous characters, then rebuilds a
 * minimal safe subset. This is intended as defense-in-depth only —
 * the primary rule across the app is "never use innerHTML with user data".
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  const raw = String(html ?? '');
  // First pass: strip any <script>, <style>, <iframe>, <object>, event handlers
  const stripped = raw
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]*)/gi, '')
    .replace(/javascript:/gi, '');

  // Second pass: escape everything not in our whitelist
  // (We can't do a real parser here without a dependency, so we allow the
  // tags above and escape everything else.)
  const tokens = stripped.split(/(<\/?[a-zA-Z][^>]*>)/g);
  const out = [];

  for (const token of tokens) {
    const tagMatch = token.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\/?>$/);
    if (!tagMatch) {
      out.push(escapeHtml(token));
      continue;
    }
    const tag = tagMatch[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      out.push(escapeHtml(token));
      continue;
    }

    const isClosing = token.startsWith('</');
    const isSelfClosing = /\/>$/.test(token) || ['br', 'hr'].includes(tag);

    if (isClosing) {
      out.push(`</${tag}>`);
      continue;
    }

    const attrsAllowed = ALLOWED_ATTRS[tag] || [];
    const attrsString = tagMatch[2] || '';
    const cleanedAttrs = [];
    const attrRe = /([a-zA-Z\-:]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m;
    while ((m = attrRe.exec(attrsString))) {
      const name = m[1].toLowerCase();
      const value = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] || '';
      if (!attrsAllowed.includes(name)) continue;
      if (name === 'href') {
        if (/^\s*javascript:/i.test(value) || /^\s*data:/i.test(value)) continue;
      }
      cleanedAttrs.push(`${name}="${escapeHtml(value)}"`);
    }

    if (tag === 'a' && !cleanedAttrs.some((a) => a.startsWith('rel='))) {
      cleanedAttrs.push('rel="noopener noreferrer"');
    }

    out.push(`<${tag}${cleanedAttrs.length ? ' ' + cleanedAttrs.join(' ') : ''}${isSelfClosing ? ' /' : ''}>`);
  }

  return out.join('');
}

/** Convert plain-text (with newlines) into safe paragraphs. */
export function textToParagraphs(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Strip all HTML and return plain text. */
export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html ?? '');
  return div.textContent || '';
}