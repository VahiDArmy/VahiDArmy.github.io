/* ==========================================================================
   jalali.js — تبدیل و قالب‌بندی تاریخ شمسی (بدون وابستگی)
   الگوریتم پورت‌شده از jalaali-js
   ========================================================================== */

import { faNum, parseISODate } from './utils.js';

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

export const JALALI_MONTHS = [
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

export const JALALI_MONTHS_SHORT = ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'];

export const JALALI_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر');

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function toJalali(gy, gm, gd) {
  const jdn = g2d(gy, gm, gd);
  let gy2 = d2g(jdn).gy;
  let jy = gy2 - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy2, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function toGregorian(jy, jm, jd) {
  const r = jalCal(jy);
  const jdn = g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  return d2g(jdn);
}

export function isLeapJalali(jy) {
  try {
    return jalCal(jy).leap === 0;
  } catch {
    return false;
  }
}

export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

export function jalaliFromISO(iso) {
  const d = parseISODate(iso) || new Date();
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function isoFromJalali(jy, jm, jd) {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

export function todayJalali() {
  const d = new Date();
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function jalaliWeekdayIndex(iso) {
  const d = parseISODate(iso);
  if (!d) return 0;
  return (d.getDay() + 1) % 7;
}

/**
 * قالب‌بندی تاریخ ISO به شمسی
 * mode: 'short' | 'long' | 'numeric' | 'month' | 'weekday' | 'full'
 */
export function formatJalali(iso, mode = 'short') {
  if (!iso) return '—';
  const j = jalaliFromISO(iso);
  const num = (n) => faNum(String(n).padStart(2, '0'));

  switch (mode) {
    case 'long':
      return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
    case 'numeric':
      return `${faNum(j.jy)}/${num(j.jm)}/${num(j.jd)}`;
    case 'month':
      return `${JALALI_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
    case 'weekday':
      return JALALI_WEEKDAYS[jalaliWeekdayIndex(iso)];
    case 'full':
      return `${JALALI_WEEKDAYS[jalaliWeekdayIndex(iso)]}، ${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
    case 'short':
    default:
      return `${num(j.jy)}/${num(j.jm)}/${num(j.jd)}`;
  }
}

export function jalaliMonthKey(iso) {
  const j = jalaliFromISO(iso);
  return `${j.jy}-${String(j.jm).padStart(2, '0')}`;
}

export function jalaliMonthLabel(key) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return '';
  return `${JALALI_MONTHS[m - 1]} ${faNum(y)}`;
}

/** فاصله زمانی دو تاریخ شمسی به روز */
export function daysInJalaliMonth(jy, jm) {
  return jalaliMonthLength(jy, jm);
}

/** برچسب نسبی برای تاریخ خرید */
export function purchaseAgo(iso) {
  const d = parseISODate(iso);
  if (!d) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  if (days === 0) return 'امروز';
  if (days === 1) return 'دیروز';
  if (days < 7) return `${faNum(days)} روز پیش`;
  if (days < 31) return `${faNum(Math.round(days / 7))} هفته پیش`;
  if (days < 365) return `${faNum(Math.round(days / 30))} ماه پیش`;
  return `${faNum(Math.round(days / 365))} سال پیش`;
}
