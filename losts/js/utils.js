export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function faDigits(input) {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}

export function fmtNum(value, decimals = 0) {
  const num = Number(value) || 0;
  const str = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return str.replace(/,/g, '٬').replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}

export function fmtMoney(value) {
  const num = Number(value) || 0;
  return `${fmtNum(Math.round(num))} تومان`;
}

export function fmtCompactMoney(value) {
  const num = Number(value) || 0;
  if (num >= 1000000000) return `${fmtNum(num / 1000000000, 1)} میلیارد`;
  if (num >= 1000000) return `${fmtNum(num / 1000000, 1)} میلیون`;
  if (num >= 1000) return `${fmtNum(num / 1000, 1)} هزار`;
  return fmtNum(num);
}

export function fmtDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${faDigits(hours)} ساعت و ${faDigits(mins)} دقیقه`;
  if (hours) return `${faDigits(hours)} ساعت`;
  if (mins) return `${faDigits(mins)} دقیقه`;
  return '۰ دقیقه';
}

export function fmtDurationShort(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${faDigits(total)}د`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${faDigits(hours)}س ${faDigits(mins)}د` : `${faDigits(hours)}س`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, wait = 200) {
  let last = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}

export function download(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function sumBy(list, keyFn) {
  return list.reduce((acc, item) => acc + (Number(keyFn(item)) || 0), 0);
}

export function uniqueBy(list, keyFn) {
  const seen = new Set();
  return list.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------- Persian calendar helpers ---------- */

const PERSIAN_PARTS_FMT = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function persianParts(date) {
  const parts = PERSIAN_PARTS_FMT.formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function persianToday() {
  return persianParts(new Date());
}

export function persianToUTCDate(py, pm, pd) {
  const target = py * 10000 + pm * 100 + pd;
  let lo = Math.floor(Date.UTC(py + 621, 0, 1) / 86400000);
  let hi = Math.floor(Date.UTC(py + 622, 6, 1) / 86400000);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = new Date(mid * 86400000);
    const p = persianParts(candidate);
    const value = p.y * 10000 + p.m * 100 + p.d;
    if (value === target) return candidate;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(Date.UTC(py + 621, 0, 1));
}

export function persianMonthLength(py, pm) {
  const start = persianToUTCDate(py, pm, 1);
  let nextY = py;
  let nextM = pm + 1;
  if (nextM > 12) { nextM = 1; nextY += 1; }
  const next = persianToUTCDate(nextY, nextM, 1);
  return Math.round((next - start) / 86400000);
}

export function isoToUTCDate(iso) {
  if (!iso) return new Date();
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
}

export function utcDateToISO(date) {
  return date.toISOString().slice(0, 10);
}

export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatPersianDate(iso, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  if (!iso) return '—';
  const date = isoToUTCDate(iso);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', ...options }).format(date);
}

export function formatPersianWeekday(iso, style = 'long') {
  const date = isoToUTCDate(iso);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', weekday: style }).format(date);
}

export function persianDayOfWeek(date) {
  return (date.getUTCDay() + 1) % 7;
}

export function daysBetweenISO(a, b) {
  const da = isoToUTCDate(a);
  const db = isoToUTCDate(b);
  return Math.round((db - da) / 86400000);
}

export function addDaysISO(iso, days) {
  const date = isoToUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToISO(date);
}

export function relativeTime(timestamp) {
  if (!timestamp) return '';
  const then = new Date(timestamp).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faDigits(days)} روز پیش`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${faDigits(weeks)} هفته پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${faDigits(months)} ماه پیش`;
  return `${faDigits(Math.floor(days / 365))} سال پیش`;
}

export function formatClock(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':');
  return `${faDigits(h)}:${faDigits(m || '00')}`;
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 5) return 'شب‌زنده‌داری';
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  if (hour < 20) return 'عصر بخیر';
  return 'شب بخیر';
}

export function pickPrompt(seed) {
  const list = [
    'امروز چه چیزی باعث لبخندت شد؟',
    'آخرین باری که برای خودت وقت گذاشتی کِی بود؟',
    'یک شادی کوچک که امروز تجربه کردی چیست؟',
    'چه چیزی امروز حالت را بهتر کرد؟',
    'اگر امروز یک هدیه به خودت می‌دادی، چه بود؟',
    'کدام لحظهٔ امروز را دوست داری برای همیشه نگه داری؟',
    'امروز از چه چیزی لذت بردی که پول نمی‌توانست بخرد؟',
    'چه کاری برای خودت کردی که به آن افتخار می‌کنی؟',
    'یک طعم، صدا یا بو که امروز خوشحالت کرد؟',
    'امروز چه چیز کوچکی را جشن گرفتی؟',
  ];
  const index = Math.abs(seed ?? new Date().getDate()) % list.length;
  return list[index];
}

export function initials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '✨';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return clean.slice(0, 1);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

export function escapeAttr(value) {
  return esc(value).replace(/`/g, '&#96;');
}
