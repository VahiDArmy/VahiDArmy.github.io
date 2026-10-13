/**
 * Date helpers.
 *
 * Two calendars coexist in this app:
 *  - ISO strings (YYYY-MM-DD) for storage & API.
 *  - Jalali (Persian) dates for display.
 *
 * The Intl API natively supports `fa-IR-u-ca-persian`, so we can render
 * Jalali without pulling a dependency. We also expose a tiny Gregorian
 * ⇄ Jalali converter for places where Intl is not enough (calendar grid).
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- ISO helpers ------------------------------------------------ */
export function todayISO() {
  return toISO(new Date());
}

export function toISO(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso) {
  if (!ISO_DATE_RE.test(iso)) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISO(iso) {
  if (!ISO_DATE_RE.test(iso || "")) return false;
  const d = fromISO(iso);
  return !Number.isNaN(d.getTime());
}

/* ---------- Arithmetic ------------------------------------------------- */
export function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso, months) {
  const d = fromISO(iso);
  d.setMonth(d.getMonth() + months);
  return toISO(d);
}

export function diffDays(aISO, bISO) {
  const a = fromISO(aISO).getTime();
  const b = fromISO(bISO).getTime();
  return Math.round((a - b) / 86400000);
}

export function startOfWeek(iso, weekStartsOn = 6 /* Saturday */) {
  const d = fromISO(iso);
  const day = d.getDay(); // 0=Sunday … 6=Saturday
  const delta = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - delta);
  return toISO(d);
}

export function endOfWeek(iso, weekStartsOn = 6) {
  return addDays(startOfWeek(iso, weekStartsOn), 6);
}

export function startOfMonth(iso) {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(iso) {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function rangeDays(startISO, endISO) {
  const out = [];
  let cur = startISO;
  while (cur <= endISO) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isSameDay(aISO, bISO) {
  return aISO === bISO;
}

export function isToday(iso) {
  return iso === todayISO();
}

export function isFuture(iso) {
  return iso > todayISO();
}

/* ---------- Formatting ------------------------------------------------ */
const FA_LOCALE = "fa-IR-u-ca-persian-nu-latn";

export function formatLong(iso) {
  const d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatShort(iso) {
  const d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatWeekday(iso) {
  const d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat(FA_LOCALE, { weekday: "long" }).format(d);
  } catch {
    return iso;
  }
}

export function formatWeekdayShort(iso) {
  const d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat(FA_LOCALE, { weekday: "short" }).format(d);
  } catch {
    return iso;
  }
}

export function formatMonthYear(iso) {
  const d = fromISO(iso);
  try {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/** "امروز" / "دیروز" / formatted date */
export function formatRelative(iso) {
  const diff = diffDays(iso, todayISO());
  if (diff === 0) return "امروز";
  if (diff === -1) return "دیروز";
  if (diff === 1) return "فردا";
  return formatShort(iso);
}

/* ---------- Time helpers ----------------------------------------------- */
export function parseTime(str) {
  if (!str || typeof str !== "string") return null;
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hours: h, minutes: min };
}

export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** minutes between two "HH:MM" strings, wrapping past midnight */
export function minutesBetween(start, end) {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return 0;
  const a = s.hours * 60 + s.minutes;
  let b = e.hours * 60 + e.minutes;
  if (b <= a) b += 24 * 60; // crossed midnight
  return b - a;
}

/* ---------- Gregorian ⇄ Jalali (minimal, no dep) ----------------------- */
/* Implements the well-known jalaali-js algorithm (public domain). */

function div(a, b) { return Math.floor(a / b); }
function mod(a, b) { return a - Math.floor(a / b) * b; }

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0];
  let jm, jump = 0, leap, n, i;

  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("Invalid Jalali year");

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

export function toJalali(isoDate) {
  const d = fromISO(isoDate);
  const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
  let jy = gy - 621;
  let r = jalCal(jy);
  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gDayNo = 0;

  const gy2 = gm > 2 ? gy + 1 : gy;
  const isLeap = gy2 % 4 === 0 && (gy2 % 100 !== 0 || gy2 % 400 === 0);

  const gDays = [...gDaysInMonth];
  if (isLeap) gDays[1] = 29;

  for (let i = 0; i < gm - 1; i += 1) gDayNo += gDays[i];
  gDayNo += gd;

  const jDayNo = gDayNo - r.march;
  const jNp = div(jDayNo, 12053);
  let jy2 = jy;
  jDayNo %= 12053;
  jy2 += 33 * jNp + 4 * div(jDayNo, 1461);
  jDayNo %= 1461;

  if (jDayNo > 365) {
    jy2 += div(jDayNo - 1, 365);
    jDayNo = (jDayNo - 1) % 365;
  }
  const jm = jDayNo < 186
    ? 1 + div(jDayNo, 31)
    : 7 + div(jDayNo - 186, 30);
  const jd = 1 + (jDayNo < 186 ? mod(jDayNo, 31) : mod(jDayNo - 186, 30));

  return { year: jy2, month: jm, day: jd };
}

/** Number of days in a Jalali month. */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand — leap years have 30 days
  const r = jalCal(jy);
  return r.leap === 0 ? 30 : 29;
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const JALALI_WEEKDAYS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه",
];