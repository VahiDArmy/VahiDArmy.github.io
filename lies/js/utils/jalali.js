/* ============================================================
   js/utils/jalali.js
   FIXED: Removed all Intl.DateTimeFormat dependencies.
   Now uses pure mathematical algorithms (Borkowski) to convert
   Gregorian to Jalali. Works on EVERY device and browser.
   ============================================================ */

import { FA_WEEKDAYS, FA_WEEKDAYS_SHORT, FA_MONTHS } from '../config/constants.js';
import { toFaDigits } from './format.js';

/**
 * Convert Gregorian to Jalali (Pure Math)
 */
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

/**
 * Convert Jalali to Gregorian (Pure Math)
 */
export function jalaliToGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((Math.floor(jy / 33)) * 8) + (Math.floor(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * (Math.floor(days / 146097));
  days %= 146097;
  if (days > 36524) {
    gy += 100 * (Math.floor(--days / 36524));
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  gy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return { gy, gm, gd };
}

/**
 * Get Jalali parts from a Date object
 */
export function getJalaliParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return { year: 0, month: 0, day: 0, weekday: 0 };
  
  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  
  // JS getDay(): Sunday = 0, Monday = 1 ... Saturday = 6
  // Persian week starts on Saturday (0)
  const weekday = (d.getDay() + 1) % 7;

  return { year: jy, month: jm, day: jd, weekday };
}

export function isJalaliLeap(jy) {
  return ((jy + 12) % 33) % 4 === 0; // Simplified leap year check
}

export function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

export function jalaliToDate(jy, jm, jd) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

export function dateToJalali(date) {
  const p = getJalaliParts(date);
  return { y: p.year, m: p.month, d: p.day };
}

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

export function getWeekdayLabels() { return [...FA_WEEKDAYS]; }
export function getWeekdayShortLabels() { return [...FA_WEEKDAYS_SHORT]; }
export function getMonthName(m) { return FA_MONTHS[Math.max(0, Math.min(11, Number(m) - 1))] || ''; }

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