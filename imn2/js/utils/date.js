/**
 * date.js — تقویم شمسی (جلالی) و میلادی
 * بدون وابستگی به کتابخانه خارجی.
 * تمام توابع خالص (pure) و immutable هستند.
 *
 * نوع داده تاریخ داخلی: رشته ISO میلادی "YYYY-MM-DD" یا آبجکت Date.
 */

/* ---------- ثابت‌ها ---------- */

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const JALALI_WEEKDAYS = [
  'شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه',
  'چهارشنبه', 'پنج‌شنبه', 'جمعه',
];

export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/* =========================================================================
   تبدیل جلالی <-> میلادی (الگوریتم khayyam)
   ========================================================================= */

function div(a, b) { return Math.floor(a / b); }

export function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + (365 * jy) + (div(jy, 33) * 8) + div((jy % 33) + 3, 4) + jd
           + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0, 31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  let gm;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400)
           - 80 + gd + g_d_m[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

/* =========================================================================
   ISO helper ها
   ========================================================================= */

/** @returns {string} "YYYY-MM-DD" */
export function toISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayISO() {
  return toISO(today());
}

/* =========================================================================
   تبدیل ISO <-> جلالی
   ========================================================================= */

export function isoToJalali(iso) {
  const d = fromISO(iso);
  return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function jalaliToISO(jy, jm, jd) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return toISO(new Date(gy, gm - 1, gd));
}

/* =========================================================================
   عملیات روی روز
   ========================================================================= */

export function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : fromISO(date);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function diffDays(a, b) {
  const da = a instanceof Date ? new Date(a) : fromISO(a);
  const db = b instanceof Date ? new Date(b) : fromISO(b);
  da.setHours(0, 0, 0, 0); db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / 86400000);
}

export function isSameDay(a, b) {
  return toISO(a) === toISO(b);
}

export function isToday(iso) {
  return toISO(today()) === toISO(iso);
}

export function isFuture(iso) {
  return fromISO(iso) > today();
}

/* =========================================================================
   نمایش‌های فارسی
   ========================================================================= */

export function formatJalali(iso, { withWeekday = false, short = false } = {}) {
  const { jy, jm, jd } = isoToJalali(iso);
  const month = short
    ? JALALI_MONTHS[jm - 1].slice(0, 3)
    : JALALI_MONTHS[jm - 1];
  const base = `${toFa(jd)} ${month} ${toFa(jy)}`;
  if (!withWeekday) return base;
  return `${weekdayName(iso)}، ${base}`;
}

export function weekdayName(iso) {
  const d = fromISO(iso);
  // JS: 0=Sunday ... 6=Saturday
  // Persian week: 0=Saturday ... 6=Friday
  const map = [6, 0, 1, 2, 3, 4, 5];
  return JALALI_WEEKDAYS[map[d.getDay()]];
}

export function weekdayIndex(iso) {
  // 0 = شنبه ... 6 = جمعه
  const d = fromISO(iso);
  return [6, 0, 1, 2, 3, 4, 5][d.getDay()];
}

export function weekdayShort(iso) {
  return JALALI_WEEKDAYS_SHORT[weekdayIndex(iso)];
}

function toFa(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

/* =========================================================================
   نمایش نسبی
   ========================================================================= */

export function relativeDayLabel(iso) {
  const diff = diffDays(today(), iso);
  if (diff === 0) return 'امروز';
  if (diff === -1) return 'دیروز';
  if (diff === 1) return 'فردا';
  if (diff === -2) return 'پریروز';
  if (diff === 2) return 'پس‌فردا';
  return weekdayName(iso);
}

/* =========================================================================
   محدوده‌ها
   ========================================================================= */

export function startOfWeek(iso, weekStartsSaturday = true) {
  const d = fromISO(iso);
  const idx = weekdayIndex(iso); // 0=ش، 6=ج
  const shift = weekStartsSaturday ? idx : (idx + 1) % 7;
  return toISO(addDays(d, -shift));
}

export function endOfWeek(iso, weekStartsSaturday = true) {
  const s = startOfWeek(iso, weekStartsSaturday);
  return toISO(addDays(fromISO(s), 6));
}

export function startOfJalaliMonth(iso) {
  const { jy, jm } = isoToJalali(iso);
  return jalaliToISO(jy, jm, 1);
}

export function endOfJalaliMonth(iso) {
  const { jy, jm } = isoToJalali(iso);
  const nextM = jm === 12 ? 1 : jm + 1;
  const nextY = jm === 12 ? jy + 1 : jy;
  const firstNext = fromISO(jalaliToISO(nextY, nextM, 1));
  return toISO(addDays(firstNext, -1));
}

export function daysInJalaliMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: 29 یا 30 (سال کبیسه)
  const leap = isJalaliLeap(jy);
  return leap ? 30 : 29;
}

export function isJalaliLeap(jy) {
  // الگوریتم تقریبی کبیسه
  const mod = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(mod);
}

export function enumerateDays(startIso, endIso) {
  const out = [];
  let cur = fromISO(startIso);
  const end = fromISO(endIso);
  while (cur <= end) {
    out.push(toISO(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function enumerateWeek(iso, weekStartsSaturday = true) {
  const s = startOfWeek(iso, weekStartsSaturday);
  return enumerateDays(s, addDays(fromISO(s), 6).toISOString().slice(0, 10));
}

/* =========================================================================
   محدوده‌ی ماه برای تقویم
   ========================================================================= */

/**
 * ماتریسی از روزهای ماه جلالی + قبل/بعد برای پر کردن شبکه ۷ ستونی.
 * هر خانه: { iso, jd, jm, jy, isOutside, isToday }
 */
export function jalaliMonthMatrix(jy, jm, weekStartsSaturday = true) {
  const firstISO = jalaliToISO(jy, jm, 1);
  const firstWeekIdx = weekdayIndex(firstISO); // موقعیت شنبه‌محور
  const shift = weekStartsSaturday ? firstWeekIdx : (firstWeekIdx + 1) % 7;

  const cells = [];
  // روزهای ماه قبل
  const startFrom = addDays(fromISO(firstISO), -shift);
  const total = 42; // 6 ردیف × 7 روز
  for (let i = 0; i < total; i++) {
    const iso = toISO(addDays(startFrom, i));
    const j = isoToJalali(iso);
    cells.push({
      iso,
      jy: j.jy,
      jm: j.jm,
      jd: j.jd,
      isOutside: j.jm !== jm,
      isToday: isToday(iso),
    });
  }
  return cells;
}