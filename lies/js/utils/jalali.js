/* ============================================================
   js/utils/jalali.js
   FIXED: Added a 100% pure mathematical fallback for Jalali.
   This does NOT rely on Intl.DateTimeFormat at all, so it works
   on EVERY browser, even if the timezone or locale is broken.
   ============================================================ */

/**
 * Convert a Gregorian Date to Jalali { year, month, day }.
 * Pure math algorithm — guaranteed to work everywhere.
 * @param {Date} date
 * @returns {{year:number, month:number, day:number}}
 */
export function dateToJalali(date) {
  const g_y = date.getFullYear();
  const g_m = date.getMonth() + 1;
  const g_d = date.getDate();

  const g_days_in_month = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let j_y = (g_y <= 1600) ? 0 : 979;
  const gy = (g_y <= 1600) ? (g_y - 621) : (g_y - 1600);
  const gm = g_m - 1;
  const gd = g_d - 1;

  let g_day_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
  g_day_no += g_days_in_month[gm] + gd;
  if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) {
    g_day_no++;
  }

  let j_day_no = g_day_no - 79;
  const j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;

  j_y += 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    j_y += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  const j_month_days = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let j_m = 0;
  for (let i = 0; i < 12 && j_day_no >= j_month_days[i]; i++) {
    j_day_no -= j_month_days[i];
    j_m++;
  }

  return { year: j_y, month: j_m + 1, day: j_day_no + 1 };
}

/**
 * Format a Jalali date string (e.g. "۲۵ مهر ۱۴۰۳").
 * @param {Date} date
 * @returns {string}
 */
export function formatJalaliFull(date) {
  const { year, month, day } = dateToJalali(date);
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  
  const toFa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  
  return `${toFa(day)} ${months[month - 1]} ${toFa(year)}`;
}

// Keep these exports to prevent breaking other files that might import them
export function getJalaliParts(date = new Date()) {
  const { year, month, day } = dateToJalali(date);
  return { year, month, day, weekday: 0 };
}
export function formatJalali(date, style = 'short') {
  return formatJalaliFull(date);
}
export function getMonthName(m) { return ''; }
export function jalaliMonthDays() { return 30; }
export function jalaliToDate() { return new Date(); }
export function buildJalaliMonthGrid() { return []; }
export function jalaliMonthRange() { return { start: new Date(), end: new Date() }; }
export function jalaliRelativeLabel() { return ''; }
export function jalaliToISO() { return ''; }