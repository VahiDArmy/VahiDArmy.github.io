/**
 * بازاربان — ابزارهای عمومی
 * ---------------------------------------------------------------------------
 * این فایل هیچ وابستگی‌ای ندارد و در همهٔ ماژول‌ها استفاده می‌شود:
 * پاک‌سازی متن فارسی، قالب‌بندی اعداد و قیمت، تاریخ شمسی، ذخیره‌سازی محلی،
 * جست‌وجوی تقریبی و توابع کوچک DOM.
 */

/* --------------------------------------------------------------------------
   ۱) DOM
   -------------------------------------------------------------------------- */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function on(target, event, handler, options) {
  if (!target) return () => {};
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** واگذاری رویداد — همهٔ اکشن‌های `data-action` را یک‌جا می‌گیرد */
export function delegate(root, eventName, selector, handler) {
  if (!root) return () => {};
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(eventName, listener);
  return () => root.removeEventListener(eventName, listener);
}

/* --------------------------------------------------------------------------
   ۲) متن و امنیت
   -------------------------------------------------------------------------- */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** فرار دادن متن برای درج در HTML (همهٔ رشته‌های کاربر باید از این عبور کنند) */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

/** فرار دادن مقدار برای صفت‌ها (همان مجموعه، اما نام صریح) */
export const attr = (value) => esc(value);

/** حذف تگ‌های HTML از ورودی متنی (برای پیش‌نمایش) */
export const stripTags = (value) =>
  String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** کوتاه کردن متن با سه‌نقطه، بدون شکستن کلمه */
export function truncate(value, max = 120) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

/** نرمال‌سازی فارسی: ی/ک عربی، همزه، اعراب، اعداد و نیم‌فاصله */
export function normalizeFa(input) {
  return String(input ?? '')
    .replace(/[يﻯﻰ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ی')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** تبدیل رقم‌های لاتین به فارسی */
export function toFa(value) {
  return String(value ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** تبدیل رقم‌های فارسی/عربی به لاتین */
export function toEn(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** فقط رقم‌ها، همیشه لاتین */
export const digitsOnly = (value) => toEn(value).replace(/[^\d]/g, '');

/** شروع کلمات — برای آواتار و نشان برند */
export function initials(name = '') {
  const clean = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!clean) return '؟';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

/** ساخت اسلاگ سازگار با فارسی (حروف فارسی حفظ می‌شوند) */
export function slugify(value) {
  const normalized = normalizeFa(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || `item-${Date.now().toString(36)}`;
}

/** اسلاگ لاتین برای فروشنده‌های اینترنتی */
export function latinSlug(value) {
  const base = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `vendor-${Date.now().toString(36)}`;
}

/* --------------------------------------------------------------------------
   ۳) اعداد و قیمت
   -------------------------------------------------------------------------- */
const FA_LOCALE = 'fa-IR';

export function fmtNum(value, fallback = '۰') {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString(FA_LOCALE, { maximumFractionDigits: 1 });
}

export function fmtInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '۰';
  return Math.round(n).toLocaleString(FA_LOCALE);
}

/** خلاصه‌سازی اعداد: ۱٬۲۳۴ → ۱٫۲ هزار */
export function fmtCompact(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) < 1000) return fmtInt(n);
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toLocaleString(FA_LOCALE, { maximumFractionDigits: 1 })} هزار`;
  return `${(n / 1_000_000).toLocaleString(FA_LOCALE, { maximumFractionDigits: 1 })} میلیون`;
}

export function fmtPercent(value, { signed = false, digits = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(digits));
  const prefix = signed && rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toLocaleString(FA_LOCALE, { maximumFractionDigits: digits })}٪`;
}

/** قیمت به تومان با جداکنندهٔ فارسی */
export function fmtPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'نامشخص';
  return `${Math.round(n).toLocaleString(FA_LOCALE)} تومان`;
}

export function fmtPriceShort(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(FA_LOCALE, { maximumFractionDigits: 1 })} م.ت`;
  if (n >= 1000) return `${(n / 1000).toLocaleString(FA_LOCALE, { maximumFractionDigits: 0 })} ه.ت`;
  return fmtInt(n);
}

/** شمارش خوانا: «۳ نقد» */
export function faCount(count, singular, plural) {
  const n = Number(count) || 0;
  if (n === 0) return `بدون ${singular}`;
  return `${fmtInt(n)} ${n === 1 ? singular : plural || singular}`;
}

/* --------------------------------------------------------------------------
   ۴) تاریخ شمسی
   -------------------------------------------------------------------------- */
const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function div(a, b) {
  return Math.floor(a / b);
}

/** تبدیل میلادی به شمسی (الگوریتم استاندارد، بدون وابستگی) */
export function toJalali(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  let gy = date.getFullYear();
  let gm = date.getMonth() + 1;
  const gd = date.getDate();

  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    gDaysInMonth.slice(0, gm - 1).reduce((a, b) => a + b, 0);

  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { year: jy, month: jm, day: jd };
}

export function formatJalali(dateInput, { withYear = true } = {}) {
  const j = toJalali(dateInput);
  if (!j) return '—';
  const day = toFa(j.day);
  const month = JALALI_MONTHS[j.month - 1] || '';
  return withYear ? `${day} ${month} ${toFa(j.year)}` : `${day} ${month}`;
}

export function formatJalaliShort(dateInput) {
  const j = toJalali(dateInput);
  if (!j) return '—';
  const mm = String(j.month).padStart(2, '0');
  const dd = String(j.day).padStart(2, '0');
  return toFa(`${j.year}/${mm}/${dd}`);
}

export function formatJalaliNumeric(dateInput) {
  const j = toJalali(dateInput);
  if (!j) return '—';
  return toFa(`${j.year}/${String(j.month).padStart(2, '0')}/${String(j.day).padStart(2, '0')}`);
}

/** زمان نسبی فارسی */
export function relTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return 'همین حالا';
  if (abs < hour) {
    const n = Math.floor(abs / minute);
    return future ? `${fmtInt(n)} دقیقهٔ دیگر` : `${fmtInt(n)} دقیقه پیش`;
  }
  if (abs < day) {
    const n = Math.floor(abs / hour);
    return future ? `${fmtInt(n)} ساعت دیگر` : `${fmtInt(n)} ساعت پیش`;
  }
  if (abs < 2 * day) return future ? 'فردا' : 'دیروز';
  if (abs < 30 * day) {
    const n = Math.floor(abs / day);
    return future ? `${fmtInt(n)} روز دیگر` : `${fmtInt(n)} روز پیش`;
  }
  if (abs < 365 * day) {
    const n = Math.floor(abs / (30 * day));
    return future ? `${fmtInt(n)} ماه دیگر` : `${fmtInt(n)} ماه پیش`;
  }
  return formatJalali(date, { withYear: true });
}

export function monthKey(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}

/* --------------------------------------------------------------------------
   ۵) آرایه و شیء
   -------------------------------------------------------------------------- */
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
export const sum = (arr, fn = (x) => x) => arr.reduce((acc, item) => acc + (Number(fn(item)) || 0), 0);
export const avg = (arr, fn = (x) => x) => (arr.length ? sum(arr, fn) / arr.length : 0);

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

export function uniqBy(list, keyFn) {
  const seen = new Set();
  return list.filter((item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chunk(list, size) {
  const result = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

export function sortBy(list, fn, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = fn(a);
    const vb = fn(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'fa') * dir;
    }
    return (va < vb ? -1 : 1) * dir;
  });
}

export function range(start, end) {
  const result = [];
  for (let i = start; i <= end; i += 1) result.push(i);
  return result;
}

export function pick(obj, keys) {
  const out = {};
  for (const key of keys) if (obj && key in obj) out[key] = obj[key];
  return out;
}

export function omit(obj, keys) {
  const set = new Set(keys);
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !set.has(k)));
}

/* --------------------------------------------------------------------------
   ۶) جست‌وجوی تقریبی
   -------------------------------------------------------------------------- */
/**
 * امتیاز تطبیق یک متن با کوئری. هرچه بالاتر، مرتبط‌تر.
 * تطبیق کامل > شروع با > شامل > همهٔ کلمات پراکنده.
 */
export function matchScore(haystack, query) {
  const h = normalizeFa(haystack);
  const q = normalizeFa(query);
  if (!q) return 0;
  if (!h) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 78;
  if (h.includes(q)) return 60;

  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    const found = tokens.filter((token) => h.includes(token)).length;
    if (found === tokens.length) return 46;
    if (found > 0) return Math.round((found / tokens.length) * 34);
  }

  // تطبیق حروف پراکنده — فقط برای کوئری‌های کوتاه
  if (q.length >= 3) {
    let index = 0;
    let hits = 0;
    for (const char of q) {
      const found = h.indexOf(char, index);
      if (found !== -1) {
        hits += 1;
        index = found + 1;
      }
    }
    if (hits === q.length) return 18;
  }
  return 0;
}

/** جست‌وجو در چند فیلد با وزن */
export function weightedScore(fields, query) {
  let total = 0;
  for (const [value, weight] of fields) {
    if (!value) continue;
    total += matchScore(value, query) * weight;
  }
  return total;
}

/** به‌روزرسانی رشتهٔ کوئری در URL بدون رفرش */
export function setQueryString(key, value) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState({}, '', url);
}

export function getQueryParams(search = window.location.search) {
  return Object.fromEntries(new URLSearchParams(search).entries());
}

/* --------------------------------------------------------------------------
   ۷) ذخیره‌سازی محلی (با محافظ در برابر خطا)
   -------------------------------------------------------------------------- */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[bb] خواندن ذخیره‌سازی ناموفق بود:', key, error);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[bb] نوشتن ذخیره‌سازی ناموفق بود:', key, error);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[bb] حذف از ذخیره‌سازی ناموفق بود:', key, error);
    }
  },
  raw(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

/* --------------------------------------------------------------------------
   ۸) زمان‌بندی و تعامل
   -------------------------------------------------------------------------- */
export function debounce(fn, wait = 220) {
  let timer = null;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  debounced.flush = (...args) => {
    window.clearTimeout(timer);
    fn(...args);
  };
  return debounced;
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      window.clearTimeout(timer);
      timer = null;
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = window.setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

export const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** قفل اسکرول با شمارنده (برای چند لایهٔ باز هم‌زمان) */
let scrollLocks = 0;
export function lockScroll(locked) {
  scrollLocks = Math.max(0, scrollLocks + (locked ? 1 : -1));
  document.body.dataset.scrollLocked = String(scrollLocks > 0);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function shareUrl(url, title = CONFIG_TITLE) {
  if (navigator.share) {
    return navigator.share({ title, url }).then(() => true).catch(() => false);
  }
  return copyText(url);
}

const CONFIG_TITLE = 'بازاربان';

/** شناسهٔ کوتاه */
export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** هش ساده برای انتخاب رنگ پایدار */
export function hashString(value) {
  let hash = 0;
  const str = String(value ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function hueFrom(value, spread = 360, offset = 0) {
  return (hashString(value) + offset) % spread;
}

/** انتخاب رنگ دسته‌بندی */
export function categoryColor(id) {
  const map = {
    produce: 'var(--cat-produce)',
    dairy: 'var(--cat-dairy)',
    bakery: 'var(--cat-bakery)',
    protein: 'var(--cat-protein)',
    pantry: 'var(--cat-pantry)',
    drinks: 'var(--cat-drinks)',
    snacks: 'var(--cat-snacks)',
    household: 'var(--cat-household)',
    personal: 'var(--cat-personal)',
    frozen: 'var(--cat-frozen)',
    other: 'var(--cat-other)',
  };
  return map[id] || 'var(--cat-other)';
}

/* --------------------------------------------------------------------------
   ۹) اعتبارسنجی
   -------------------------------------------------------------------------- */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
}

export function isStrongEnough(password) {
  return String(password || '').length >= 6;
}

export function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value).startsWith('http') ? value : `https://${value}`);
    return Boolean(url.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

/** نمایش امن لینک بیرونی */
export function externalLink(url, label) {
  const safe = normalizeUrl(url);
  if (!isValidUrl(safe)) return esc(label || url || '');
  return `<a href="${attr(safe)}" target="_blank" rel="noopener noreferrer nofollow">${esc(label || safe)}</a>`;
}

/* --------------------------------------------------------------------------
   ۱۰) رنگ‌ها و ظاهر
   -------------------------------------------------------------------------- */
export function readableLevel(level) {
  if (level === 'good') return CONFIG_LEVEL_LABELS.good;
  if (level === 'meh') return CONFIG_LEVEL_LABELS.meh;
  if (level === 'bad') return CONFIG_LEVEL_LABELS.bad;
  return 'بدون امتیاز';
}

const CONFIG_LEVEL_LABELS = { good: 'خوب', meh: 'نه‌خوب', bad: 'افتضاح' };

/** تبدیل درجهٔ hue به رنگ CSS */
export const hsl = (hue, s = 70, l = 55, alpha = 1) =>
  alpha === 1 ? `hsl(${hue} ${s}% ${l}%)` : `hsl(${hue} ${s}% ${l}% / ${alpha})`;

/** تحلیل متن برای نمایش کوتاه در کارت‌ها */
export function excerpt(value, length = 150) {
  return truncate(stripTags(value), length);
}

/** آمار کوچک از یک آرایه */
export function distribution(list, valueFn) {
  const map = countBy(list, valueFn);
  return {
    total: list.length,
    values: map,
    get: (key) => map.get(key) || 0,
  };
}

/** دانلود یک شیء به‌صورت فایل JSON */
export function downloadJson(data, filename = 'bazaarban.json') {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    return true;
  } catch (error) {
    console.warn('[bb] ساخت فایل خروجی ناموفق بود:', error);
    return false;
  }
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${toFa(n)} بایت`;
  if (n < 1024 * 1024) return `${toFa((n / 1024).toFixed(1))} کیلوبایت`;
  return `${toFa((n / (1024 * 1024)).toFixed(1))} مگابایت`;
}
