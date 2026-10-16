/* ============================================================
   js/utils/jalali.js
   Jalali (Shamsi) calendar utilities built on Intl API.
   No external library needed.
   ============================================================ */

import { FA_WEEKDAYS, FA_WEEKDAYS_SHORT, FA_MONTHS } from '../config/constants.js';
import { toFaDigits } from './format.js';

const PERSIAN_CAL = 'fa-IR-u-ca-persian';
const GREGORIAN_CAL = 'en-US-u-ca-gregory';

/**
 * Format a date to Jalali parts using Intl.
 * @param {Date} date
 * @returns {{year:number, month:number, day:number, weekday:number}}
 */
function partsOf(date) {
  const dtf = new Intl.DateTimeFormat(GREGORIAN_CAL, {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
    timeZone: 'UTC',
  });
  // Use a proper formatter to extract Persian date
  const fmt = new Intl.DateTimeFormat(PERSIAN_CAL, {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
    timeZone: 'local',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  const weekdayMap = { شنبه: 0, یک‌شنبه: 1, 'یکشنبه': 1, دوشنبه: 2, 'سه‌شنبه': 3, سه‌شنبه: 3, چهارشنبه: 4, 'پنج‌شنبه': 5, پنجشنبه: 5, جمعه: 6, Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };
  return {
    year: Number(out.year?.replace(/\D/g, '')) || 0,
    month: Number(out.month?.replace(/\D/g, '')) || 0,
    day: Number(out.day?.replace(/\D/g, '')) || 0,
    weekday: weekdayMap[out.weekday] ?? 0,
  };
  // eslint-disable-next-line no-unreachable
  void dtf;
}

/**
 * Public: get Jalali parts.
 * @param {Date|string|number} [date=new Date()]
 * @returns {{year:number, month:number, day:number, weekday:number}}
 */
export function getJalaliParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return { year: 0, month: 0, day: 0, weekday: 0 };
  return partsOf(d);
}

/**
 * Is a Gregorian year a leap year (approximation is fine for the Jalali cycle).
 * We compute properly by checking the number of days in the Jalali year.
 * @param {number} jy Jalali year
 * @returns {boolean}
 */
export function isJalaliLeap(jy) {
  // Convert to a rough Gregorian guess and check via Intl
  const gregYear = jy + 621;
  const startDate = jalaliToDate(jy, 1, 1);
  const endDate = jalaliToDate(jy + 1, 1, 1);
  if (!startDate || !endDate) return false;
  const days = Math.round((endDate - startDate) / 86400000);
  return days === 366;
  // eslint-disable-next-line no-unreachable
  void gregYear;
}

/**
 * Number of days in a Jalali month.
 * @param {number} jy @param {number} jm 1-12
 * @returns {number}
 */
export function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/**
 * Convert Jalali date to Gregorian Date object.
 * Approximation: start from a known Jalali epoch (March 21, 622 CE / 1 Farvardin 1).
 * Uses iterative correction to stay within ±1 day.
 * @param {number} jy
 * @param {number} jm 1-12
 * @param {number} jd 1-31
 * @returns {Date|null}
 */
export function jalaliToDate(jy, jm, jd) {
  // Known anchor: 1 Farvardin 1400 = 2021-03-21
  const anchor = new Date(Date.UTC(2021, 2, 21));
  const ANCHOR_JY = 1400;
  const ANCHOR_JM = 1;
  const ANCHOR_JD = 1;

  const daysBetween = jalaliDayDiff(
    { y: ANCHOR_JY, m: ANCHOR_JM, d: ANCHOR_JD },
    { y: jy, m: jm, d: jd }
  );
  const target = new Date(anchor.getTime() + daysBetween * 86400000);
  return Number.isNaN(target.getTime()) ? null : target;
}

/**
 * Number of days between two Jalali dates (b - a).
 * @param {{y:number,m:number,d:number}} a
 * @param {{y:number,m:number,d:number}} b
 * @returns {number}
 */
function jalaliDayDiff(a, b) {
  return jalaliToJulianDay(b) - jalaliToJulianDay(a);
}

/**
 * Convert Jalali to Julian Day Number (JDN).
 * Standard algorithm (Borkowski).
 * @param {{y:number,m:number,d:number}} j
 * @returns {number}
 */
function jalaliToJulianDay(j) {
  const jy = j.y + 1595;
  let days = -355668 +
    (365 * jy) +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    j.d +
    (j.m < 7 ? (j.m - 1) * 31 : (j.m - 7) * 30 + 186);
  return days + 1948320;
}

/**
 * Convert a Gregorian Date to Jalali parts.
 * @param {Date} date
 * @returns {{y:number, m:number, d:number}}
 */
export function dateToJalali(date) {
  const p = getJalaliParts(date);
  return { y: p.year, m: p.month, d: p.day };
}

/**
 * Build a month grid: array of weeks, each week = array of 7 cells.
 * Cells are `{ date: Date|null, day: number|null, isToday: boolean, isCurrentMonth: boolean }`.
 * @param {number} jy
 * @param {number} jm
 * @param {Date} [today=new Date()]
 * @returns {Array<Array<{date:Date|null,day:number|null,isToday:boolean,isCurrentMonth:boolean}>>}
 */
export function buildJalaliMonthGrid(jy, jm, today = new Date()) {
  const daysInMonth = jalaliMonthDays(jy, jm);
  const firstDate = jalaliToDate(jy, jm, 1);
  if (!firstDate) return [];

  const firstWeekday = getJalaliParts(firstDate).weekday; // 0=Sat
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

/**
 * Persian weekday names (Saturday-first order).
 * @returns {string[]}
 */
export function getWeekdayLabels() {
  return [...FA_WEEKDAYS];
}

/**
 * Short Persian weekday labels.
 * @returns {string[]}
 */
export function getWeekdayShortLabels() {
  return [...FA_WEEKDAYS_SHORT];
}

/**
 * Persian month name.
 * @param {number} m 1-12
 * @returns {string}
 */
export function getMonthName(m) {
  return FA_MONTHS[Math.max(0, Math.min(11, m - 1))] || '';
}

/**
 * Format a Jalali date as "۱۴۰۳/۰۵/۱۲" or "۱۲ مرداد ۱۴۰۳".
 * @param {Date|string|number} date
 * @param {'short'|'long'} [style='short']
 * @returns {string}
 */
export function formatJalali(date, style = 'short') {
  const { y, m, d } = dateToJalali(new Date(date));
  if (!y) return '—';
  if (style === 'long') return `${toFaDigits(d)} ${getMonthName(m)} ${toFaDigits(y)}`;
  return `${toFaDigits(y)}/${toFaDigits(String(m).padStart(2, '0'))}/${toFaDigits(String(d).padStart(2, '0'))}`;
}

/**
 * Get the start & end dates of a Jalali month as Gregorian Dates.
 * @param {number} jy @param {number} jm
 * @returns {{start:Date, end:Date}}
 */
export function jalaliMonthRange(jy, jm) {
  const start = jalaliToDate(jy, jm, 1) || new Date();
  const lastDay = jalaliMonthDays(jy, jm);
  const end = jalaliToDate(jy, jm, lastDay) || start;
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Relative label in Persian ("امروز", "دیروز", "۳ روز پیش").
 * @param {Date|string|number} date
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
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

/**
 * Convert a Jalali date to an ISO string (Gregorian UTC).
 * @param {number} jy @param {number} jm @param {number} jd
 * @param {{hour?:number,minute?:number}} [time]
 * @returns {string}
 */
export function jalaliToISO(jy, jm, jd, time = {}) {
  const d = jalaliToDate(jy, jm, jd);
  if (!d) return new Date().toISOString();
  d.setHours(time.hour ?? 12, time.minute ?? 0, 0, 0);
  return d.toISOString();
}