/* =========================================================
   توابع کمکی عمومی
   ========================================================= */
window.Utils = (function () {

  /* ---- شناسه یکتا ---- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- انتخاب ---- */
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  /* ---- ساخت المان ---- */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---- escape HTML ---- */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---- نرمال‌سازی متن فارسی برای جستجو ---- */
  function normalizeFa(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ۀ/g, 'ه')
      .replace(/ة/g, 'ه')
      .replace(/[ًٌٍَُِّْ]/g, '')
      .replace(/[\u200c\u200f\u200e]/g, ' ')
      .replace(/[-\u2010-\u2015]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---- اعداد فارسی ---- */
  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function toFa(input) {
    if (input == null) return '';
    return String(input).replace(/\d/g, d => FA_DIGITS[+d]);
  }
  function toEn(input) {
    if (input == null) return '';
    return String(input).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }

  /* ---- فرمت عدد ---- */
  function fmt(n, digits = 0) {
    if (n == null || isNaN(n)) return '—';
    return toFa(Number(n).toFixed(digits).replace(/\.0+$/, ''));
  }

  /* ---- تاریخ شمسی ---- */
  function toJalali(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    } catch { return d.toLocaleDateString(); }
  }

  function toJalaliLong(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch { return d.toLocaleString(); }
  }

  function relativeTime(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d)) return '—';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return 'لحظه‌ای پیش';
    if (min < 60) return toFa(min) + ' دقیقه پیش';
    if (hr < 24) return toFa(hr) + ' ساعت پیش';
    if (day < 30) return toFa(day) + ' روز پیش';
    return toJalali(d);
  }

  /* ---- دیبانس ---- */
  function debounce(fn, wait = 200) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  function throttle(fn, wait = 200) {
    let last = 0, timer;
    return (...args) => {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer); timer = null;
        last = now; fn(...args);
      } else if (!timer) {
        timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, remaining);
      }
    };
  }

  /* ---- کلون عمیق ---- */
  function clone(obj) {
    if (obj == null) return obj;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(obj); } catch {}
    }
    return JSON.parse(JSON.stringify(obj));
  }

  /* ---- ادغام عمیق ---- */
  function deepMerge(target, source) {
    const out = clone(target);
    for (const k in source) {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = deepMerge(out[k] || {}, source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  /* ---- تبدیل بایت به base64 ---- */
  function uint8ToBase64(u8) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToUint8(b64) {
    const clean = b64.replace(/\s/g, '');
    const binary = atob(clean);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function strToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToStr(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
  }

  /* ---- دانلود فایل ---- */
  function download(filename, content, mime = 'application/json') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---- کپی به کلیپ‌بورد ---- */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = el('textarea', { style: { position: 'fixed', opacity: 0 } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch { return false; }
  }

  /* ---- گروه‌بندی ---- */
  function groupBy(arr, fn) {
    return arr.reduce((acc, item) => {
      const k = fn(item);
      (acc[k] ||= []).push(item);
      return acc;
    }, {});
  }

  function unique(arr) { return Array.from(new Set(arr)); }

  function sortBy(arr, fn, dir = 'asc') {
    const mul = dir === 'desc' ? -1 : 1;
    return [...arr].sort((a, b) => {
      const va = fn(a), vb = fn(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb, 'fa') * mul;
      return (va - vb) * mul;
    });
  }

  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  function range(n) { return Array.from({ length: n }, (_, i) => i); }

  function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(text, query) {
    if (!query) return esc(text);
    const safe = esc(text);
    const words = normalizeFa(query).split(' ').filter(w => w.length > 0);
    if (!words.length) return safe;
    let out = safe;
    words.forEach(w => {
      const re = new RegExp(`(${escapeRegex(w)})`, 'gi');
      out = out.replace(re, '<mark style="background:rgba(124,92,255,0.35);color:inherit;border-radius:3px;padding:0 2px;">$1</mark>');
    });
    return out;
  }

  function highlightClassic(text, query) {
    if (!query) return esc(text);
    const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return esc(text).replace(re, '<mark>$1</mark>');
  }

  /* ---- بررسی آنلاین بودن ---- */
  function isOnline() { return navigator.onLine; }

  /* ---- اعتبارسنجی ---- */
  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function isUrl(s) { try { new URL(s); return true; } catch { return false; } }

  /* ---- ترتیب‌دهی با انیمیشن تأخیری ---- */
  function stagger(children, base = 25, max = 300) {
    children.forEach((c, i) => {
      c.style.animationDelay = Math.min(i * base, max) + 'ms';
    });
  }

  /* ---- ریاضیات ---- */
  function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }
  function avg(arr) { return arr.length ? sum(arr) / arr.length : 0; }
  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(avg(arr.map(x => (x - m) ** 2)));
  }

  /* ---- نام‌گذاری تاریخ فایل ---- */
  function timestampName(prefix = 'backup', ext = 'json') {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${prefix}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
  }

  /* ---- پارس امن JSON ----
     ✅ FIX: اکنون ورودی‌های null / undefined / '' / 'null' / 'undefined' را
     به‌درستی به fallback تبدیل می‌کند. */
  function safeParse(json, fallback = null) {
    if (json == null) return fallback;
    if (typeof json === 'string') {
      const trimmed = json.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return fallback;
    }
    try {
      const out = JSON.parse(json);
      return out == null ? fallback : out;
    } catch {
      return fallback;
    }
  }

  return {
    uid, $, $$, el, esc,
    normalizeFa, toFa, toEn, fmt,
    toJalali, toJalaliLong, relativeTime,
    debounce, throttle, clone, deepMerge,
    uint8ToBase64, base64ToUint8, strToBase64, base64ToStr,
    download, copyToClipboard,
    groupBy, unique, sortBy, clamp, range,
    escapeRegex, highlight, highlightClassic,
    isOnline, isEmail, isUrl,
    stagger, sum, avg, median, stdDev,
    timestampName, safeParse
  };
})();