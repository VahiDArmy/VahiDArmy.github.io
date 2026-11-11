/* ============================================================
   THEORIES STUDIO — Utilities
   ============================================================ */

/* ---------- DOM helpers ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
};

export const fragment = (...children) => {
  const f = document.createDocumentFragment();
  children.flat().forEach(c => { if (c) f.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
  return f;
};

export const clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); return node; };

export const htmlToNode = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/* ---------- Escaping / sanitization ---------- */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m => ESCAPE_MAP[m]);
export const escapeAttr = (s) => escapeHtml(s).replace(/`/g, '&#96;');

export const sanitizeHtml = (html) => {
  if (!html) return '';
  const t = document.createElement('template');
  t.innerHTML = html;
  const walk = (node) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'].includes(tag)) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) child.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(t.content);
  return t.innerHTML;
};

/* ---------- Text helpers ---------- */
export const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return (tmp.textContent || tmp.innerText || '').trim();
};

export const truncate = (s, n = 120, suffix = '…') => {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - suffix.length).trimEnd() + suffix : s;
};

export const highlight = (text, query) => {
  if (!query) return escapeHtml(text);
  const safe = escapeHtml(text);
  const escaped = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return safe.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  } catch { return safe; }
};

/* ---------- Numbers ---------- */
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
export const toFaDigits = (n) => String(n ?? '').replace(/\d/g, d => FA_DIGITS[+d]);
export const toEnDigits = (s) => String(s ?? '').replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const FA_GROUP = new Intl.NumberFormat('fa-IR');
export const formatNumber = (n) => {
  if (n === null || n === undefined || Number.isNaN(+n)) return '—';
  return FA_GROUP.format(+n);
};
export const formatCompact = (n) => {
  n = +n || 0;
  if (n < 1000) return formatNumber(n);
  if (n < 1_000_000) return toFaDigits((n / 1000).toFixed(1).replace(/\.0$/, '')) + ' هزار';
  return toFaDigits((n / 1_000_000).toFixed(1).replace(/\.0$/, '')) + ' میلیون';
};
export const formatBytes = (b) => {
  b = +b || 0;
  if (b < 1024) return toFaDigits(b) + ' بایت';
  if (b < 1024 * 1024) return toFaDigits((b / 1024).toFixed(1)) + ' کیلوبایت';
  if (b < 1024 * 1024 * 1024) return toFaDigits((b / 1024 / 1024).toFixed(1)) + ' مگابایت';
  return toFaDigits((b / 1024 / 1024 / 1024).toFixed(1)) + ' گیگابایت';
};
export const formatPercent = (p) => toFaDigits(Math.round(+p || 0)) + '٪';

/* ---------- Persian / Arabic normalization ---------- */
export const normalizeFa = (s) => String(s ?? '')
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[ۀة]/g, 'ه')
  .replace(/\u200c+/g, '\u200c')
  .trim();

/* ---------- Slug ---------- */
export const slugify = (s) => normalizeFa(s)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\u200c]+/gu, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || 'item';

/* ---------- Date / time ---------- */
export const FA_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export const FA_WEEKDAYS = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

export const relativeTime = (dateLike) => {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);
  const units = [
    [60, 'ثانیه'],
    [60, 'دقیقه'],
    [24, 'ساعت'],
    [7, 'روز'],
    [4.345, 'هفته'],
    [12, 'ماه'],
    [Infinity, 'سال']
  ];
  let value = abs, i = 0;
  while (i < units.length - 1 && value >= units[i][0]) {
    value /= units[i][0];
    i++;
  }
  const amount = toFaDigits(Math.max(1, Math.round(value)));
  const suffix = sec >= 0 ? 'پیش' : 'دیگر';
  return `${amount} ${units[i][1]} ${suffix}`;
};

export const dateTimeFormat = (dateLike) => {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
};

/* ---------- ID ---------- */
export const uid = (prefix = '') => {
  const s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}-${s}` : s;
};

/* ---------- Debounce / throttle ---------- */
export const debounce = (fn, wait = 240) => {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
};

export const throttle = (fn, wait = 120) => {
  let last = 0, t;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      clearTimeout(t);
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(t);
      t = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, remaining);
    }
  };
};

/* ---------- Promise helpers ---------- */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const retry = async (fn, tries = 3, delay = 400) => {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await sleep(delay * (i + 1)); }
  }
  throw lastErr;
};

/* ---------- Arrays ---------- */
export const uniq = (arr) => Array.from(new Set(arr));
export const groupBy = (arr, keyFn) => arr.reduce((acc, item) => {
  const k = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
  (acc[k] ||= []).push(item);
  return acc;
}, {});
export const sortBy = (arr, keyFn, dir = 'asc') => arr.slice().sort((a, b) => {
  const va = typeof keyFn === 'function' ? keyFn(a) : a[keyFn];
  const vb = typeof keyFn === 'function' ? keyFn(b) : b[keyFn];
  if (va < vb) return dir === 'asc' ? -1 : 1;
  if (va > vb) return dir === 'asc' ? 1 : -1;
  return 0;
});
export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- Colors ---------- */
export const colorFromString = (str) => {
  let hash = 0;
  for (let i = 0; i < String(str || '').length; i++) hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  const s = 60 + (Math.abs(hash >> 8) % 20);
  const l = 45 + (Math.abs(hash >> 16) % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

export const hexToRgb = (hex) => {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const rgba = (hex, a = 1) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(124,58,237,${a})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
};

/* ---------- Clipboard ---------- */
export const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
};

/* ---------- Download ---------- */
export const downloadFile = (filename, content, mime = 'application/octet-stream') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

export const downloadJSON = (filename, data) => {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
};

/* ---------- Local storage ---------- */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

/* ---------- Validate ---------- */
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
export const isUrl = (s) => /^https?:\/\//i.test(String(s || '').trim());
export const isImageFile = (file) => file && file.type && file.type.startsWith('image/');

/* ---------- File helpers ---------- */
export const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

export const readFileAsText = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsText(file);
});

export const compressImage = (file, maxWidth = 1920, quality = 0.82) => new Promise((resolve, reject) => {
  if (!isImageFile(file)) return reject(new Error('not-image'));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('compress-failed'));
      resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  };
  img.onerror = () => reject(new Error('image-load-failed'));
  img.src = URL.createObjectURL(file);
});

/* ---------- Range ---------- */
export const range = (n, start = 0) => Array.from({ length: n }, (_, i) => start + i);

/* ---------- Safe JSON ---------- */
export const safeJSON = (s, fallback = null) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

/* ---------- Random ---------- */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ---------- URL ---------- */
export const parseQuery = (qs) => {
  const out = {};
  new URLSearchParams(qs || '').forEach((v, k) => { out[k] = v; });
  return out;
};
export const buildQuery = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach(x => p.append(k, x));
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

/* ---------- Truncate HTML safely (approx by text) ---------- */
export const excerptFromHtml = (html, len = 160) => {
  const txt = stripHtml(html).replace(/\s+/g, ' ').trim();
  return truncate(txt, len);
};
