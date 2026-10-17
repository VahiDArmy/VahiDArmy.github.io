/* ============================================================
   js/utils/jalali.js
   FIXED: Removed Intl.DateTimeFormat entirely. 
          Implemented a pure mathematical Jalali converter to 
          ensure it works on ALL mobile browsers without failing.
   ============================================================ */

import { FA_WEEKDAYS, FA_WEEKDAYS_SHORT, FA_MONTHS } from '../config/constants.js';
import { toFaDigits } from './format.js';

/**
 * Pure mathematical conversion from Gregorian to Jalali.
 * @param {Date} date 
 * @returns {{year:number, month:number, day:number, weekday:number}}
 */
export function getJalaliParts(date = new Date()) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  let gyy = (gy <= 1600) ? gy - 621 : gy - 1600;
  const gy2 = (gm > 2) ? (gyy + 1) : gyy;
  
  let days = (365 * gyy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  
  jy += 33 * (parseInt(days / 12053));
  days %= 12053;
  jy += 4 * (parseInt(days / 1461));
  days %= 1461;
  jy += parseInt((days - 1) / 365);
  
  if (days > 365) days = (days - 1) % 365;
  
  const jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  
  // JS getDay: 0=Sun, 1=Mon... We want 0=Sat, 1=Sun...
  const wd = (date.getDay() + 1) % 7;

  return { year: jy, month: jm, day: jd, weekday: wd };
}

export function getMonthName(m) {
  return FA_MONTHS[Math.max(0, Math.min(11, Number(m) - 1))] || 'مهر';
}

export function getWeekdayLabels() {
  return [...FA_WEEKDAYS];
}

export function getWeekdayShortLabels() {
  return [...FA_WEEKDAYS_SHORT];
}

export function formatJalali(date, style = 'short') {
  const d = date instanceof Date ? date : new Date(date);
  const { year, month, day } = getJalaliParts(d);
  if (style === 'long') return `${toFaDigits(day)} ${getMonthName(month)} ${toFaDigits(year)}`;
  return `${toFaDigits(year)}/${toFaDigits(String(month).padStart(2, '0'))}/${toFaDigits(String(day).padStart(2, '0'))}`;
}

export function jalaliRelativeLabel(date, now = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
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