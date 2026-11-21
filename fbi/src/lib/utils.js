// Generic helpers shared across the app.

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttr(str) {
  return escapeHtml(str).replaceAll('\n', '&#10;');
}

export function clip(text, max = 80) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

export const PERSIAN_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;

export function isRtlText(text) {
  const s = String(text || '');
  for (const ch of s.slice(0, 400)) {
    if (PERSIAN_RE.test(ch)) return true;
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return false;
  }
  return false;
}

/** Direction of the first strong character (for placeholders and chips). */
export function textDir(text) {
  return isRtlText(text) ? 'rtl' : 'ltr';
}

export function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNum(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

export function formatBytes(n) {
  const v = Number(n || 0);
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  return (v / 1024 / 1024).toFixed(2) + ' MB';
}

export function estimateTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  let ascii = 0;
  let other = 0;
  for (const ch of s) {
    if (ch.charCodeAt(0) < 128) ascii++;
    else other++;
  }
  return Math.max(1, Math.ceil(ascii / 4 + other / 2.2));
}

export function debounce(fn, wait = 250) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 80) {
  let last = 0;
  let timer = 0;
  let pending = null;
  return (...args) => {
    pending = args;
    const now = Date.now();
    const run = () => {
      last = Date.now();
      timer = 0;
      fn(...pending);
    };
    if (now - last >= wait) run();
    else if (!timer) timer = setTimeout(run, wait - (now - last));
  };
}

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFilename(name, ext = 'md') {
  const base = String(name || 'chat')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return `${base || 'chat'}.${ext}`;
}

export function initials(name, email) {
  const src = String(name || email || 'N').trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple JSON syntax highlighter that is safe for innerHTML. */
export function jsonHighlight(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  // Quotes stay literal: this output goes inside an element as HTML text, and
  // the tokenizer below relies on seeing them.
  const escaped = String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'n';
      if (match.startsWith('"')) cls = match.endsWith(':') ? 'k' : 's';
      else if (/^(true|false)$/.test(match)) cls = 'b';
      else if (match === 'null') cls = 'z';
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function truncateMiddle(str, max = 32) {
  const s = String(str || '');
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return s.slice(0, half) + '…' + s.slice(-half);
}

export function prettyModel(id) {
  if (!id) return '—';
  if (id === 'openrouter/free') return 'openrouter / free';
  const [vendor, ...rest] = String(id).split('/');
  const name = rest.join('/').replace(/:free$/, '');
  return `${vendor.charAt(0).toUpperCase() + vendor.slice(1)} · ${name}`;
}
