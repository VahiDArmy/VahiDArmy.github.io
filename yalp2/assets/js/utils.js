/* ============================================================
   Utilities — formatting, Persian numerals, fuzzy search, DOM
   ============================================================ */

/* ---------- numbers & text ---------- */

const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

export function toFaDigits(input) {
  return String(input ?? '').replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}

export function toEnDigits(input) {
  return String(input ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatNumber(n, { fa = true, grouping = true } = {}) {
  if (n === null || n === undefined || Number.isNaN(+n)) return '—';
  const num = +n;
  let str = grouping ? num.toLocaleString('en-US') : String(num);
  return fa ? toFaDigits(str) : str;
}

export function formatPrice(price, { fa = true } = {}) {
  if (price === null || price === undefined || price === '' || Number.isNaN(+price)) return '—';
  const n = +price;
  const s = n.toLocaleString('en-US');
  return (fa ? toFaDigits(s) : s) + ' تومان';
}

export function formatDate(iso, { fa = true, withTime = false } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const fmt = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
    return fmt.format(d);
  } catch {
    const s = d.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
    return fa ? toFaDigits(s) : s;
  }
}

export function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - d) / 1000);
  if (diff < 5) return 'همین حالا';
  if (diff < 60) return `${toFaDigits(diff)} ثانیه پیش`;
  if (diff < 3600) return `${toFaDigits(Math.floor(diff / 60))} دقیقه پیش`;
  if (diff < 86400) return `${toFaDigits(Math.floor(diff / 3600))} ساعت پیش`;
  if (diff < 86400 * 7) return `${toFaDigits(Math.floor(diff / 86400))} روز پیش`;
  return formatDate(iso);
}

/** Normalize Persian text for search: unify ی/ك, remove diacritics, digits → EN */
export function normalizeFa(input) {
  if (input == null) return '';
  let s = String(input);
  s = s.replace(/[\u064A\u0649]/g, 'ی'); // ي ى → ی
  s = s.replace(/[\u0643]/g, 'ک');        // ك → ک
  s = s.replace(/[\u0629]/g, 'ه');        // ة → ه
  s = s.replace(/[\u0640]/g, '');          // ـ
  s = s.replace(/[\u064B-\u065F\u0670]/g, ''); // diacritics
  s = toEnDigits(s);
  s = s.replace(/[.,،؛;:!?؟…"'«»()\[\]{}]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

/* ---------- fuzzy search ---------- */

/** Tokenize a query into normalized tokens */
export function tokenize(q) {
  return normalizeFa(q).split(' ').filter(Boolean);
}

/**
 * Score a haystack string against query tokens.
 * Returns 0 when no match; positive score otherwise.
 * Bounded score, prefers prefix/substring over scattered matches.
 */
export function fuzzyScore(haystack, tokens) {
  if (!tokens.length) return 1;
  const h = normalizeFa(haystack);
  if (!h) return 0;
  let total = 0;
  for (const t of tokens) {
    if (!t) continue;
    const idx = h.indexOf(t);
    if (idx === -1) return 0;
    // base score
    let s = t.length * 2;
    if (idx === 0) s += 6;
    else if (h[idx - 1] === ' ') s += 4;
    // bonus if haystack ends with token
    if (idx + t.length === h.length) s += 2;
    total += s;
  }
  // small bonus for shorter haystacks (more relevant)
  return total + Math.max(0, 20 - h.length / 4);
}

/* ---------- DOM ---------- */

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait = 160) {
  let t = 0;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, wait = 80) {
  let last = 0, timer = 0;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = 0;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export function uid() {
  return (crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
}

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export function groupBy(arr, keyFn) {
  const out = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function safeJson(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/* ---------- small pub/sub for local state ---------- */

export function createSignal(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(value, next)) return;
      value = next;
      for (const fn of subs) fn(value);
    },
    update: (fn) => { value = fn(value); for (const s of subs) s(value); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };
}
