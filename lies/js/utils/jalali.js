/* ============================================================
   js/utils/jalali.js
   FULL EXPORT: Ensures all functions, including jalaliMonthDays,
   are properly exported for the heatmap chart.
   ============================================================ */

import { FA_WEEKDAYS, FA_WEEKDAYS_SHORT, FA_MONTHS } from '../config/constants.js';
import { toFaDigits } from './format.js';

const PERSIAN_CAL = 'fa-IR-u-ca-persian';
const GREGORIAN_CAL = 'en-US-u-ca-gregory';

/* ── Safe Intl wrapper ──────────────────────────────────── */

function safeFormatter(locale, opts = {}) {
  try {
    const clean = { ...opts };
    if (clean.timeZone === 'local' || clean.timeZone === 'Local') {
      delete clean.timeZone;
    }
    return new Intl.DateTimeFormat(locale, clean);
  } catch (err) {
    console.warn('[jalali] Intl.DateTimeFormat failed', err);
    return null;
  }
}

/* ── Parts extraction ───────────────────────────────────── */

function partsOf(date) {
  const fmt = safeFormatter(PERSIAN_CAL, {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  });
  if (!fmt) {
    return { year: 0, month: 0, day: 0, weekday: 0 };
  }

  const out = {};
  try {
    for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  } catch (err) {
    return { year: 0, month: 0, day: 0, weekday: 0 };
  }

  const weekdayMap = {
    'شنبه': 0, 'یک‌شنبه': 1, 'یکشنبه': 1,
    'دوشنبه': 2, 'سه‌شنبه': 3, 'سه شنبه': 3,
    'چهارشنبه': 4, 'پنج‌شنبه': 5, 'پنجشنبه': 5,
    'جمعه': 6,
    'Sat': 0, 'Sun': 1, 'Mon': 2, 'Tue': 3, 'Wed': 4, 'Thu': 5, 'Fri': 6,
  };

  return {
    year: Number(String(out.year || '').replace(/\D/g, '')) || 0,
    month: Number(String(out.month || '').replace(/\D/g, '')) || 0,
    day: Number(String(out.day || '').replace(/\D/g, '')) || 0,
    weekday: weekdayMap[out.weekday] ?? 0,
  };
}

export function getJalaliParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return { year: 0, month: 0, day: 0, weekday: 0 };
  return partsOf(d);
}

/* ── Leap-year & month length ───────────────────────────── */

export function isJalaliLeap(jy) {
  const startDate = jalaliToDate(jy, 1, 1);
  const endDate = jalaliToDate(jy + 1, 1, 1);
  if (!startDate || !endDate) return false;
  const days = Math.round((endDate - startDate) / 86400000);
  return days === 366;
}

// 🛡️ THIS IS THE MISSING FUNCTION
export function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/* ── Conversion ─────────────────────────────────────────── */

export function jalaliToDate(jy, jm, jd) {
  const anchor = Date.UTC(2021, 2, 21);
  const ANCHOR_JY = 1400;
  const ANCHOR_JM = 1;
  const ANCHOR_JD = 1;

  const daysBetween = jalaliDayDiff(
    { y: ANCHOR_JY, m: ANCHOR_JM, d: ANCHOR_JD },
    { y: jy, m: jm, d: jd }
  );
  const target = new Date(anchor + daysBetween * 86400000);
  return Number.isNaN(target.getTime()) ? null : target;
}

function jalaliDayDiff(a, b) {
  return jalaliToJulianDay(b) - jalaliToJulianDay(a);
}

function jalaliToJulianDay(j) {
  const jy = j.y + 1595;
  const days = -355668 +
    (365 * jy) +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    j.d +
    (j.m < 7 ? (j.m - 1) * 31 : (j.m - 7) * 30 + 186);
  return days + 1948320;
}

export function dateToJalali(date) {
  const p = getJalaliParts(date);
  return { y: p.year, m: p.month, d: p.day };
}

/* ── Grid ───────────────────────────────────────────────── */

export function buildJalaliMonthGrid(jy, jm, today = new Date()) {
  const daysInMonth = jalaliMonthDays(jy, jm);
  const firstDate = jalaliToDate(jy, jm, 1);
  if (!firstDate) return [];

  const firstWeekday = getJalaliParts(firstDate).weekday; 
  const todayParts = getJalaliParts(today);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, day: null, isToday: false, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = jalaliToDate(jy, jm, d);
    cells.push({
      date,
      day: d,
      isToday: !!date && date.toDateString() === today.toDateString(),
      isCurrentMonth: jy === todayParts.year && jm === todayParts.month,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, isToday: false, isCurrentMonth: false });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/* ── Labels ─────────────────────────────────────────────── */

export function getWeekdayLabels() {
  return [...FA_WEEKDAYS];
}

export function getWeekdayShortLabels() {
  return [...FA_WEEKDAYS_SHORT];
}

export function getMonthName(m) {
  return FA_MONTHS[Math.max(0, Math.min(11, Number(m) - 1))] || '';
}

export function formatJalali(date, style = 'short') {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const { y, m, d: day } = dateToJalali(d);
  if (!y) return '—';
  if (style === 'long') return `${toFaDigits(day)} ${getMonthName(m)} ${toFaDigits(y)}`;
  return `${toFaDigits(y)}/${toFaDigits(String(m).padStart(2, '0'))}/${toFaDigits(String(day).padStart(2, '0'))}`;
}

export function jalaliMonthRange(jy, jm) {
  const start = jalaliToDate(jy, jm, 1) || new Date();
  const lastDay = jalaliMonthDays(jy, jm);
  const end = jalaliToDate(jy, jm, lastDay) || start;
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function jalaliRelativeLabel(date, now = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b - a) / 86400000);
  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'دیروز';
  if (diffDays === 2) return 'پریروز';
  if (diffDays < 7) return `${toFaDigits(diffDays)} روز پیش`;
  if (diffDays < 30) return `${toFaDigits(Math.round(diffDays / 7))} هفته پیش`;
  if (diffDays < 365) return `${toFaDigits(Math.round(diffDays / 30))} ماه پیش`;
  return `${toFaDigits(Math.round(diffDays / 365))} سال پیش`;
}

export function jalaliToISO(jy, jm, jd, time = {}) {
  const d = jalaliToDate(jy, jm, jd);
  if (!d) return new Date().toISOString();
  d.setHours(time.hour ?? 12, time.minute ?? 0, 0, 0);
  return d.toISOString();
}

// Unused import cleanup
void GREGORIAN_CAL;