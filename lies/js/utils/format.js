/* ============================================================
   js/utils/format.js
   Persian-aware formatting helpers
   ============================================================ */

import { PERSIAN_DIGITS, DIGIT_MAP, FA_MONTHS } from '../config/constants.js';

/* ── Digits ──────────────────────────────────────────────── */

/**
 * Convert Latin digits in a string/number to Persian digits.
 * @param {string|number} input
 * @returns {string}
 */
export function toFaDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Convert Persian/Arabic digits back to Latin.
 * @param {string} input
 * @returns {string}
 */
export function toEnDigits(input) {
  if (!input) return '';
  return String(input).replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] ?? d);
}

/**
 * Normalize any user numeric input to a Latin-digit string.
 * @param {string|number} input
 * @returns {string}
 */
export function normalizeNumber(input) {
  return toEnDigits(String(input ?? '').trim()).replace(/[^\d.\-]/g, '');
}

/* ── Numbers ─────────────────────────────────────────────── */

/**
 * Format a number with Persian digits and optional grouping.
 * @param {number} n
 * @param {{digits?:boolean, grouping?:boolean, decimals?:number}} [opts]
 * @returns {string}
 */
export function formatNumber(n, opts = {}) {
  const { digits = true, grouping = true, decimals = 0 } = opts;
  if (n === null || n === undefined || Number.isNaN(Number(n))) return digits ? '—' : '-';
  const num = Number(n);
  const s = num.toLocaleString('en-US', {
    useGrouping: grouping,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return digits ? toFaDigits(s) : s;
}

/**
 * Format a percentage.
 * @param {number} ratio 0..1
 * @param {{decimals?:number, digits?:boolean}} [opts]
 * @returns {string}
 */
export function formatPercent(ratio, opts = {}) {
  const { decimals = 0, digits = true } = opts;
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) return '—';
  const v = (Number(ratio) * 100).toFixed(decimals);
  return `${digits ? toFaDigits(v) : v}٪`;
}

/**
 * Compact number (1.2 هزار / 3.4 میلیون).
 * @param {number} n
 * @returns {string}
 */
export function formatCompact(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs < 1000) return toFaDigits(num);
  if (abs < 1_000_000) return `${toFaDigits((num / 1000).toFixed(1))} هزار`;
  if (abs < 1_000_000_000) return `${toFaDigits((num / 1_000_000).toFixed(1))} میلیون`;
  return `${toFaDigits((num / 1_000_000_000).toFixed(1))} میلیارد`;
}

/**
 * Pad a number with leading zeros.
 * @param {number} n
 * @param {number} [len=2]
 * @returns {string}
 */
export function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

/**
 * Bytes → human-readable Persian.
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  const b = Number(bytes) || 0;
  if (b === 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const i = Math.min(Math.floor(Math.log(Math.abs(b)) / Math.log(1024)), units.length - 1);
  const v = (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : decimals);
  return `${toFaDigits(v)} ${units[i]}`;
}

/* ── Text ────────────────────────────────────────────────── */

/**
 * Truncate a string to a max length with an ellipsis.
 * @param {string} str
 * @param {number} max
 * @param {string} [suffix='…']
 * @returns {string}
 */
export function truncate(str, max = 80, suffix = '…') {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max - suffix.length).trimEnd() + suffix;
}

/**
 * Estimate reading time in Persian (roughly 200 wpm).
 * @param {string} text
 * @returns {string}
 */
export function readingTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${toFaDigits(minutes)} دقیقه`;
}

/**
 * Word count.
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Character count (excluding trailing whitespace).
 * @param {string} text
 * @returns {number}
 */
export function charCount(text) {
  return String(text || '').replace(/\s+$/, '').length;
}

/**
 * Title-case the first letter of a Persian string (no-op for Persian but useful for mixed).
 * @param {string} s
 * @returns {string}
 */
export function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build initials from a display name.
 * @param {string} name
 * @param {number} [max=2]
 * @returns {string}
 */
export function initials(name, max = 2) {
  if (!name) return '؟';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  return parts.slice(0, max).map((p) => p[0]).join('');
}

/**
 * Slugify a string (keeps Persian letters, removes spaces).
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Dates (Jalali via Intl) ─────────────────────────────── */

const JALALI_FMT_CACHE = new Map();

function jalaliFormatter(opts) {
  const key = JSON.stringify(opts);
  if (!JALALI_FMT_CACHE.has(key)) {
    JALALI_FMT_CACHE.set(
      key,
      new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts)
    );
  }
  return JALALI_FMT_CACHE.get(key);
}

/**
 * Format a date as a Jalali date string (Persian digits).
 * @param {Date|string|number} date
 * @param {{style?: 'full'|'long'|'medium'|'short', withTime?: boolean}} [opts]
 * @returns {string}
 */
export function formatDate(date, opts = {}) {
  const d = toDate(date);
  if (!d) return '—';
  const { style = 'medium', withTime = false } = opts;

  const dateOpts = {
    short:  { year: '2-digit', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'long', day: 'numeric' },
    long:   { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
    full:   { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', era: undefined },
  }[style] || { year: 'numeric', month: 'long', day: 'numeric' };

  if (withTime) {
    dateOpts.hour = '2-digit';
    dateOpts.minute = '2-digit';
  }

  try {
    return jalaliFormatter(dateOpts).format(d);
  } catch {
    return d.toLocaleDateString('fa-IR');
  }
}

/**
 * Format time only (HH:mm in Persian digits).
 * @param {Date|string|number} date
 * @param {{seconds?:boolean}} [opts]
 * @returns {string}
 */
export function formatTime(date, opts = {}) {
  const d = toDate(date);
  if (!d) return '—';
  const fmtOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
  if (opts.seconds) fmtOpts.second = '2-digit';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', fmtOpts).format(d);
  } catch {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/**
 * Relative time in Persian ("۳ دقیقه پیش", "دیروز").
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatRelative(date) {
  const d = toDate(date);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);

  const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });

  if (abs < 45) return 'همین حالا';
  if (abs < 90) return rtf.format(-Math.round(sec / 60), 'minute');
  if (abs < 3600) return rtf.format(-Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(sec / 3600), 'hour');
  if (abs < 604800) return rtf.format(-Math.round(sec / 86400), 'day');
  if (abs < 2592000) return rtf.format(-Math.round(sec / 604800), 'week');
  if (abs < 31536000) return rtf.format(-Math.round(sec / 2592000), 'month');
  return rtf.format(-Math.round(sec / 31536000), 'year');
}

/**
 * Format a Jalali month + year label.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatMonthYear(date) {
  const d = toDate(date);
  if (!d) return '—';
  try {
    return jalaliFormatter({ year: 'numeric', month: 'long' }).format(d);
  } catch {
    return d.toLocaleDateString('fa-IR');
  }
}

/**
 * Get Jalali parts of a date.
 * @param {Date|string|number} date
 * @returns {{year:number, month:number, day:number, weekday:number, hour:number, minute:number}}
 */
export function jalaliParts(date) {
  const d = toDate(date) || new Date();
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };
  return {
    year: Number(toEnDigits(map.year)),
    month: Number(toEnDigits(map.month)),
    day: Number(toEnDigits(map.day)),
    weekday: weekdayMap[map.weekday] ?? 0,
    hour: Number(toEnDigits(map.hour)),
    minute: Number(toEnDigits(map.minute)),
  };
}

/**
 * Persian month name for a Jalali month index (1-12).
 * @param {number} m
 * @returns {string}
 */
export function jalaliMonthName(m) {
  return FA_MONTHS[Math.max(0, Math.min(11, Number(m) - 1))] || '';
}

/* ── Safe coercion ───────────────────────────────────────── */

/**
 * Coerce anything to a Date or return null.
 * @param {Date|string|number} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pluralize an Iranian-style counted noun (Persian doesn't pluralize; kept for labels).
 * @param {number} n
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
export function pluralize(n, singular, plural = singular) {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Build a "خواندن" label for an entity count.
 * @param {number} n
 * @returns {string}
 */
export function countLabel(n) {
  return formatNumber(n);
}

/* ── Export names ────────────────────────────────────────── */

/**
 * Build a timestamped filename for exports (Persian-safe).
 * @param {string} base
 * @param {string} [ext='json']
 * @returns {string}
 */
export function exportFilename(base, ext = 'json') {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}-${stamp}.${ext}`;
}