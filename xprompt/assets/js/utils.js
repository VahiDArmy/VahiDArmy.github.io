// Text utilities: direction detection, HTML escaping, diff rendering, toasts.

const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
const LTR_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u1E00-\u1EFF]/g;

/** Return 'rtl' or 'ltr' based on the dominant strong character class. */
export function detectDirection(text) {
  if (!text || !text.trim()) return 'ltr';
  const rtl = (text.match(RTL_RE) || []).length;
  const ltr = (text.match(LTR_RE) || []).length;
  if (rtl === 0 && ltr === 0) return 'ltr';
  return rtl > ltr ? 'rtl' : 'ltr';
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function wordCount(text) {
  return (String(text).trim().match(/\S+/g) || []).length;
}

/**
 * Render diff parts (from `diffWordsWithSpace`) as line-wrapped HTML.
 * Each line is its own block so per-line direction and layout stay clean.
 * Additions are wrapped in <span class="diff-add">, removals in
 * <span class="diff-del">. Newlines are split outside of the tags.
 */
export function renderDiffLines(parts) {
  const lines = [[]];
  for (const part of parts) {
    const chunks = String(part.value).split('\n');
    chunks.forEach((chunk, i) => {
      if (i > 0) lines.push([]);
      if (!chunk) return;
      lines[lines.length - 1].push({
        text: chunk,
        type: part.added ? 'add' : part.removed ? 'del' : 'same'
      });
    });
  }

  return lines.map((segs) => {
    if (!segs.length) return '<div class="line"><br></div>';
    const inner = segs.map((s) => {
      const t = escapeHtml(s.text);
      if (s.type === 'add') return `<span class="diff-add">${t}</span>`;
      if (s.type === 'del') return `<span class="diff-del">${t}</span>`;
      return t;
    }).join('');
    return `<div class="line">${inner}</div>`;
  }).join('');
}

/** Simple toast notification. */
export function toast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}
