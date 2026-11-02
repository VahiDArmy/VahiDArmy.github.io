/* ==========================================================================
   jalali.js — تبدیل و قالب‌بندی تاریخ شمسی (بدون وابستگی)
   الگوریتم: jalaali-js (MIT)
   ========================================================================== */

import { faDigits } from './utils.js';

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const JALALI_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
];

/* --------------------------------------------------------------------------
   هسته‌ی تبدیل
   -------------------------------------------------------------------------- */
function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm, jump = 0, leap, leapG, march, n, i;

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`سال جلالی نامعتبر است: ${jy}`);
  }

  for (i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function toJalaali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

export function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function d2j(jdn) {
  let gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;

  k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function isLeapJalaaliYear(jy) {
  return jalCal(jy).leap === 0;
}

export function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

/* --------------------------------------------------------------------------
   قالب‌بندی‌های فارسی
   -------------------------------------------------------------------------- */
function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toJalaaliObject(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return {
    ...j,
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    weekday: d.getDay(),
    date: d,
  };
}

/** ۱۲ مرداد ۱۴۰۴ */
export function formatShamsiDate(input = new Date(), { withWeekday = false } = {}) {
  const j = toJalaaliObject(input);
  const month = JALALI_MONTHS[j.jm - 1];
  const base = `${faDigits(j.jd)} ${month} ${faDigits(j.jy)}`;
  return withWeekday ? `${JALALI_WEEKDAYS[j.weekday]}، ${base}` : base;
}

/** ۱۴۰۴/۰۵/۱۲ */
export function formatShamsiNumeric(input = new Date()) {
  const j = toJalaaliObject(input);
  return faDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`);
}

/** ۱۴:۰۵ */
export function formatShamsiTime(input = new Date()) {
  const j = toJalaaliObject(input);
  return faDigits(`${pad2(j.hour)}:${pad2(j.minute)}`);
}

/** ۱۴:۰۵:۳۲ */
export function formatShamsiTimeSeconds(input = new Date()) {
  const j = toJalaaliObject(input);
  return faDigits(`${pad2(j.hour)}:${pad2(j.minute)}:${pad2(j.second)}`);
}

/** ۱۲ مرداد ۱۴۰۴ — ۱۴:۰۵ */
export function formatShamsiDateTime(input = new Date(), opts = {}) {
  const { withWeekday = false, withSeconds = false } = opts;
  const datePart = formatShamsiDate(input, { withWeekday });
  const timePart = withSeconds ? formatShamsiTimeSeconds(input) : formatShamsiTime(input);
  return `${datePart} — ${timePart}`;
}

/** امروز / دیروز / ۱۲ مرداد ۱۴۰۴ */
export function relativeShamsiDay(input = new Date(), now = new Date()) {
  const a = new Date(input);
  const b = new Date(now);

  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(b) - startOf(a)) / 86400000);

  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'دیروز';
  if (diffDays === 2) return 'پریروز';
  if (diffDays > 2 && diffDays < 7) return `${faDigits(diffDays)} روز پیش`;
  return formatShamsiDate(a);
}

/** «۲ ساعت پیش» یا تاریخ کامل برای قدیمی‌ترها */
export function relativeShamsiFull(input = new Date(), now = new Date()) {
  const a = new Date(input);
  const diff = now - a;

  if (diff < 0) return formatShamsiDateTime(a);
  if (diff < 60_000) return 'همین حالا';
  if (diff < 3_600_000) return `${faDigits(Math.floor(diff / 60_000))} دقیقه پیش`;
  if (diff < 86_400_000) return `${faDigits(Math.floor(diff / 3_600_000))} ساعت پیش`;

  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${faDigits(days)} روز پیش`;

  return formatShamsiDateTime(a);
}

/** ساعتِ روز به شکل «صبح / ظهر / عصر / شب» */
export function daypartFa(input = new Date()) {
  const h = new Date(input).getHours();
  if (h >= 4 && h < 11) return 'صبح';
  if (h >= 11 && h < 14) return 'ظهر';
  if (h >= 14 && h < 18) return 'عصر';
  if (h >= 18 && h < 22) return 'شب';
  return 'شب‌زنده‌داری';
}

export default {
  toJalaali,
  toGregorian,
  formatShamsiDate,
  formatShamsiNumeric,
  formatShamsiTime,
  formatShamsiTimeSeconds,
  formatShamsiDateTime,
  relativeShamsiDay,
  relativeShamsiFull,
  daypartFa,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
};