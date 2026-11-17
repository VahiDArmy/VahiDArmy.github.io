/* ==========================================================================
   utils.js — ابزارهای عمومی: اعداد فارسی، نرمال‌سازی متن، تاریخ، CSV، DOM
   ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** HTML-escape */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ترکیب کلاس‌ها */
export function cls(...args) {
  const out = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === 'string') out.push(a);
    else if (Array.isArray(a)) out.push(cls(...a));
    else if (typeof a === 'object') {
      for (const [k, v] of Object.entries(a)) if (v) out.push(k);
    }
  }
  return out.join(' ');
}

/* ------------------------------ اعداد فارسی ------------------------------ */

export function faNum(value) {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function faDigits(value) {
  return faNum(String(value ?? ''));
}

export function fmtInt(value, { fa = true, group = '٬' } = {}) {
  if (value === null || value === undefined || value === '') return fa ? '—' : '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const rounded = Math.round(n * 100) / 100;
  const [intPart, decPart] = String(Math.abs(rounded)).split('.');
  const withGroups = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = rounded < 0 ? '−' : '';
  const out = decPart ? `${sign}${withGroups}.${decPart}` : `${sign}${withGroups}`;
  return fa ? faNum(out) : out;
}

export function fmtMoney(value, currency = 'IRT', { fa = true, unit = true } = {}) {
  if (value === null || value === undefined || value === '') return fa ? '—' : '-';
  const label = unit ? (currency === 'IRR' ? ' ریال' : ' تومان') : '';
  return `${fmtInt(value, { fa })}${label}`;
}

export function fmtCompact(value, { fa = true } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return fa ? '۰' : '0';
  const abs = Math.abs(n);
  const out =
    abs >= 1_000_000_000
      ? `${(n / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)} میلیارد`
      : abs >= 1_000_000
        ? `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)} میلیون`
        : abs >= 10_000
          ? `${Math.round(n / 1000)} هزار`
          : fmtInt(n, { fa });
  return fa ? faNum(out) : out;
}

export function fmtQty(value) {
  if (value === null || value === undefined) return '—';
  return faNum(String(value).replace('.', '٫'));
}

/** «۱۲۵٬۰۰۰» یا «125000» یا «۱۲۵ هزار» → عدد */
export function parseNum(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (!s) return null;
  s = s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[٬,\s]/g, '')
    .replace(/٫/g, '.');
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

export function pct(part, total, digits = 0) {
  if (!total) return 0;
  const v = (Number(part) / Number(total)) * 100;
  return Number(v.toFixed(digits));
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function round(v, digits = 0) {
  const f = 10 ** digits;
  return Math.round(Number(v) * f) / f;
}

/* --------------------------- نرمال‌سازی متن فارسی -------------------------- */

const RUBS = /[\u064B-\u0652\u0670\u0640]/g;
const ZW = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;

/** یکسان‌سازی حروف عربی/فارسی، حذف اعراب و نیم‌فاصله و فاصله‌های اضافه */
export function normFa(input) {
  if (input === null || input === undefined) return '';
  let s = String(input).normalize('NFKC').toLowerCase();
  s = s.replace(RUBS, '').replace(ZW, '');
  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/ء/g, '')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[.,،؛:!?؟«»"'`ـ()\[\]{}<>/\\|+=*%$#@^~_]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CHAR_CLASS = {
  ا: '[اأإآٱ]',
  ی: '[یيىئ]',
  ک: '[کك]',
  ه: '[هةۀ]',
  و: '[وؤ]',
};

/** هایلایت توکن‌های جست‌وجو در متن اصلی (با تحمل نیم‌فاصله و ی/ي) */
export function highlight(text, tokens = []) {
  const raw = String(text ?? '');
  if (!tokens || !tokens.length) return esc(raw);
  const words = tokens
    .map((t) => normFa(t))
    .filter((t) => t.length >= 2)
    .slice(0, 4);
  if (!words.length) return esc(raw);

  const patterns = words.map((word) => {
    const chars = Array.from(word).map((ch) => {
      if (ch === ' ') return '[\\s\\u200c\\u200d]{0,2}';
      return CHAR_CLASS[ch] || escapeRegExp(ch);
    });
    return chars.join('[\\u200c\\u200d]{0,1}');
  });

  let out = esc(raw);
  try {
    const re = new RegExp(`(${patterns.join('|')})`, 'gi');
    out = out.replace(re, '<mark class="hl">$1</mark>');
  } catch {
    return esc(raw);
  }
  return out;
}

/** فاصله لِوِنشتاین برای تحمل غلط تایپی */
export function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[t.length];
}

/** امتیاز تطابق ۰..۱ */
export function fuzzyScore(needle, haystack) {
  const q = normFa(needle);
  const h = normFa(haystack);
  if (!q) return 0.0001;
  if (!h) return 0;
  if (h === q) return 1;
  let score = 0;
  if (h.startsWith(q)) score = 0.94;
  else if (h.includes(` ${q}`)) score = 0.9;
  else if (h.includes(q)) score = 0.82;
  else {
    const words = h.split(' ');
    let best = 0;
    for (const w of words) {
      if (!w) continue;
      const dist = levenshtein(q, w);
      const sim = 1 - dist / Math.max(q.length, w.length);
      if (sim > best) best = sim;
    }
    score = best >= 0.72 ? 0.6 + (best - 0.72) * 0.8 : 0;
  }
  return Math.max(0, Math.min(1, score));
}

export function slugify(input) {
  return normFa(input).replace(/\s+/g, '-').replace(/[^a-z0-9\u0600-\u06FF-]/g, '').slice(0, 60);
}

export function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

export function hashHue(text) {
  let h = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/* --------------------------------- تاریخ --------------------------------- */

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function parseISODate(iso) {
  if (!isIsoDate(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const base = parseISODate(iso) || new Date();
  base.setDate(base.getDate() + Number(days || 0));
  const pad = (n) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

export function dayDiff(aISO, bISO = todayISO()) {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

export function relTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 45) return 'همین حالا';
  if (diff < 90) return 'یک دقیقه پیش';
  if (diff < 3600) return `${faNum(Math.round(diff / 60))} دقیقه پیش`;
  if (diff < 86400) return `${faNum(Math.round(diff / 3600))} ساعت پیش`;
  if (diff < 86400 * 7) {
    const days = Math.round(diff / 86400);
    return days === 1 ? 'دیروز' : `${faNum(days)} روز پیش`;
  }
  if (diff < 86400 * 30) return `${faNum(Math.round(diff / 86400 / 7))} هفته پیش`;
  if (diff < 86400 * 365) return `${faNum(Math.round(diff / 86400 / 30))} ماه پیش`;
  return `${faNum(Math.round(diff / 86400 / 365))} سال پیش`;
}

/* --------------------------------- آرایه‌ها ------------------------------- */

export function debounce(fn, wait = 180) {
  let t = 0;
  const wrapped = (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => window.clearTimeout(t);
  return wrapped;
}

export function throttle(fn, wait = 120) {
  let last = 0;
  let timer = 0;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = window.setTimeout(() => {
        timer = 0;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function sumBy(list, fn) {
  return (list || []).reduce((acc, item) => acc + (Number(typeof fn === 'function' ? fn(item) : item[fn]) || 0), 0);
}

export function countBy(list, fn) {
  const map = new Map();
  for (const item of list || []) {
    const key = typeof fn === 'function' ? fn(item) : item[fn];
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

export function avgBy(list, fn) {
  const arr = list || [];
  if (!arr.length) return 0;
  return sumBy(arr, fn) / arr.length;
}

export function sortBy(list, fn, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...(list || [])].sort((a, b) => {
    const va = typeof fn === 'function' ? fn(a) : a[fn];
    const vb = typeof fn === 'function' ? fn(b) : b[fn];
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string' || typeof vb === 'string') {
      return sign * String(va).localeCompare(String(vb), 'fa');
    }
    return sign * (Number(va) - Number(vb));
  });
}

export function uniqueBy(list, fn) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const key = typeof fn === 'function' ? fn(item) : item[fn];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < (list || []).length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function range(n, start = 0) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => i + start);
}

export function uid(prefix = 'id') {
  const rnd = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${rnd.replace(/-/g, '').slice(0, 18)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------- DOM --------------------------------- */

export function on(root, type, selector, handler, options) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

export function once(target, type, handler, options) {
  target.addEventListener(type, handler, { ...options, once: true });
}

export function nextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

export function trapFocus(container) {
  const focusable = () =>
    $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container,
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

export function focusFirst(container) {
  const el = container.querySelector(
    '[autofocus], input:not([type="hidden"]):not([disabled]), button:not([disabled]), select, textarea',
  );
  if (el) el.focus({ preventScroll: true });
}

/* ------------------------------- فایل و متن ------------------------------ */

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function toCSV(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {});
  const head = cols.map((c) => `"${String(c.label ?? c).replace(/"/g, '""')}"`).join(',');
  const body = (rows || [])
    .map((row) =>
      cols
        .map((c) => {
          const key = c.key ?? c;
          const raw = typeof key === 'string' && key.includes('.') ? key.split('.').reduce((o, k) => o?.[k], row) : row[key];
          const value = raw === null || raw === undefined ? '' : String(raw).replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(','),
    )
    .join('\n');
  return `\uFEFF${head}\n${body}`;
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

export function truncate(text, max = 80) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** خواندن مقدار تودرتو مثل a.b.c */
export function getPath(obj, path, fallback) {
  try {
    const value = String(path)
      .split('.')
      .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}
