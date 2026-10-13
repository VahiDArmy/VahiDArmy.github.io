/**
 * format.js — قالب‌بندی اعداد، تاریخ‌ها، واحدها
 * تمام اعداد به فارسی نمایش داده می‌شوند.
 */

const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

/* ---------- تبدیل ارقام ---------- */

export function toFaDigits(input) {
  return String(input ?? '').replace(/\d/g, (d) => FA_DIGITS[+d]);
}

export function toEnDigits(input) {
  return String(input ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/* ---------- اعداد ---------- */

export function formatNumber(n, { fa = true, decimals = 0, grouping = true } = {}) {
  if (n == null || isNaN(n)) return fa ? '—' : '-';
  const num = Number(n);
  let out = decimals > 0
    ? num.toFixed(decimals)
    : String(Math.round(num));
  if (grouping) {
    const [int, dec] = out.split('.');
    out = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
  }
  return fa ? toFaDigits(out) : out;
}

export function formatKcal(n) {
  return `${formatNumber(n, { decimals: 0 })}`;
}

export function formatGram(n) {
  return `${formatNumber(n, { decimals: n % 1 === 0 ? 0 : 1 })} گرم`;
}

export function formatWeight(n) {
  return `${formatNumber(n, { decimals: 1 })} کیلوگرم`;
}

export function formatHeight(n) {
  return `${formatNumber(n, { decimals: 0 })} سانتی‌متر`;
}

export function formatDistance(n) {
  return `${formatNumber(n, { decimals: n % 1 === 0 ? 0 : 2 })} کیلومتر`;
}

export function formatDuration(minutes) {
  if (minutes == null) return '—';
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${formatNumber(h)} ساعت و ${formatNumber(r)} دقیقه`;
  if (h) return `${formatNumber(h)} ساعت`;
  return `${formatNumber(r)} دقیقه`;
}

export function formatDurationShort(minutes) {
  if (minutes == null) return '—';
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${formatNumber(h)}:${toFaDigits(String(r).padStart(2, '0'))}`;
}

/* ---------- درصد ---------- */

export function formatPercent(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return `${formatNumber(n, { decimals })}٪`;
}

/* ---------- زمان (HH:MM) ---------- */

export function formatTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = String(hhmm).split(':');
  if (h == null || m == null) return '—';
  return `${toFaDigits(h.padStart(2, '0'))}:${toFaDigits(m.padStart(2, '0'))}`;
}

/* ---------- واحدهای دینامیک ---------- */

export function formatWithUnit(value, unit) {
  if (value == null || value === '' || isNaN(value)) return '—';
  const n = Number(value);
  switch (unit) {
    case 'kcal':    return `${formatNumber(n, { decimals: 0 })} کیلوکالری`;
    case 'g':       return `${formatNumber(n, { decimals: n % 1 === 0 ? 0 : 1 })} گرم`;
    case 'kg':      return `${formatNumber(n, { decimals: 1 })} کیلوگرم`;
    case 'cm':      return `${formatNumber(n, { decimals: 0 })} سانتی‌متر`;
    case 'km':      return `${formatNumber(n, { decimals: n % 1 === 0 ? 0 : 2 })} کیلومتر`;
    case 'min':     return formatDuration(n);
    case 'mgdl':    return `${formatNumber(n, { decimals: 0 })} mg/dL`;
    case 'mmhg':    return `${formatNumber(n, { decimals: 0 })} mmHg`;
    case 'iu':      return `${formatNumber(n, { decimals: 1 })} واحد`;
    case 'serving': return `${formatNumber(n, { decimals: n % 1 === 0 ? 0 : 1 })} واحد`;
    default:        return `${formatNumber(n)} ${unit || ''}`.trim();
  }
}

/* ---------- خط کوتاه‌سازی متن ---------- */

export function truncate(str, max = 40) {
  const s = String(str ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/* ---------- حروف اول برای آواتار ---------- */

export function initials(name) {
  const s = String(name || '').trim();
  if (!s) return '؟';
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('');
}

/* ---------- ارز/درصد رنگ ---------- */

export function toneFor(delta, { upGood = true } = {}) {
  if (delta == null || delta === 0) return 'flat';
  const up = delta > 0;
  if (up === upGood) return 'up';
  return 'down';
}

/* ---------- خط امن برای فایل‌های CSV ---------- */

export function toCsvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}