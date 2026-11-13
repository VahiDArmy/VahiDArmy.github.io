export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, '&#10;');
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(ts) {
  return `${formatDate(ts)} · ${formatTime(ts)}`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms) {
  let last = 0, trailing = null, timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn(...args);
    } else {
      trailing = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          if (trailing) fn(...trailing);
        }, remaining);
      }
    }
  };
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function formatNumber(n) {
  if (n == null) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function autoResize(textarea, maxH = 280) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const h = Math.min(textarea.scrollHeight, maxH);
  textarea.style.height = h + 'px';
  textarea.style.overflowY = textarea.scrollHeight > maxH ? 'auto' : 'hidden';
}

export function isMobile() {
  return window.matchMedia('(max-width: 880px)').matches;
}

export function scrollToBottom(el, smooth = true) {
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

export function isNearBottom(el, threshold = 80) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

export const storage = {
  get(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { return false; }
  },
  remove(k) {
    try { localStorage.removeItem(k); return true; }
    catch { return false; }
  }
};

export function truncate(s, n) {
  if (s == null) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(ts);
}

export function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function charCount(text) {
  return text ? text.length : 0;
}

export function dom(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v != null) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function groupByDate(items, getTs) {
  const groups = new Map();
  for (const item of items) {
    const key = formatDate(getTs(item));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}
