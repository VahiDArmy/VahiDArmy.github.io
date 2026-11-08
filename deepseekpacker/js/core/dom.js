// AURORA OS — DOM Helpers

export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') {
      el.className = v;
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign(el.dataset, v);
    } else if (k === 'html') {
      el.innerHTML = v;
    } else if (k === 'text') {
      el.textContent = v;
    } else if (k === 'ref' && typeof v === 'function') {
      v(el);
    } else {
      el.setAttribute(k, v === true ? '' : v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false || c === true) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function replace(el, ...nodes) {
  clear(el);
  for (const n of nodes) {
    if (n == null) continue;
    el.append(n.nodeType ? n : document.createTextNode(String(n)));
  }
  return el;
}

export function on(el, evt, fn, opts) {
  el.addEventListener(evt, fn, opts);
  return () => el.removeEventListener(evt, fn, opts);
}

export function delegate(root, evt, selector, fn) {
  const handler = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) fn(e, target);
  };
  root.addEventListener(evt, handler);
  return () => root.removeEventListener(evt, handler);
}

export function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(1) + ' GB';
}

export function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function fmtPct(n, digits = 1) {
  if (n == null) return '—';
  return (n * 100).toFixed(digits) + '%';
}

export function fmtDate(d, opts = {}) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...opts });
}

export function fmtTime(d, withSeconds = false) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined, hour12: false,
  });
}

export function relTime(ts) {
  const diff = Date.now() - (ts instanceof Date ? ts.getTime() : ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + 'd ago';
  return fmtDate(new Date(ts));
}

export function debounce(fn, ms = 200) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function throttle(fn, ms = 100) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) { last = now; fn(...args); }
    else {
      clearTimeout(timer);
      timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
export function uid() { return Math.random().toString(36).slice(2, 10); }
export function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
