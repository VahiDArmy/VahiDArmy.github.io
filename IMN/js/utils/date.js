/**
 * Date helpers.
 *
 * Two calendars coexist in this app:
 *  - ISO strings (YYYY-MM-DD) for storage & API.
 *  - Jalali (Persian) dates for display.
 *
 * The Jalali ⇄ Gregorian conversion uses the well-tested jalaali-js
 * algorithm (public domain) — it is deterministic and does not depend on
 * Intl's implementation.
 *
 * All conversions go through LOCAL time (never toISOString) so a user in
 * UTC+3:30 gets consistent day boundaries.
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
  if (!ISO_DATE_RE.test(iso || "")) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISO(iso) {
  if (!ISO_DATE_RE.test(iso || "")) return false;
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1) return false;
  const dim = new Date(y, m, 0).getDate();
  return d <= dim;
}

/* ---------- Arithmetic ------------------------------------------------ */
export function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/**
 * Add months, clamping the day so that 31 Jan + 1 month → 28/29 Feb
 * (rather than rolling over into March).
 */
export function addMonths(iso, months) {
  const d = fromISO(iso);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return toISO(d);
}

export function diffDays(aISO, bISO) {
  const a = fromISO(aISO).getTime();
  const b = fromISO(bISO).getTime();
  return Math.round((a - b) / 86400000);
}

export function startOfWeek(iso, weekStartsOn = 6 /* Saturday */) {
  const d = fromISO(iso);
  const day = d.getDay();
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
  // Safety: cap at 5 years to avoid runaway loops
  let guard = 0;
  while (cur <= endISO && guard++ < 1900) {
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

/** Short Jalali date, always `YYYY/MM/DD`, always Latin digits. */
export function formatShort(iso) {
  const j = toJalali(iso);
  return `${j.year}/${String(j.month).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
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

export function formatRelative(iso) {
  const diff = diffDays(iso, todayISO());
  if (diff === 0) return "امروز";
  if (diff === -1) return "دیروز";
  if (diff === 1) return "فردا";
  return formatShort(iso);
}

/* ---------- Time helpers ----------------------------------------------- */
/** Accepts "HH:MM" or "HH:MM:SS". Returns { hours, minutes, seconds } or null. */
export function parseTime(str) {
  if (!str || typeof str !== "string") return null;
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return { hours: h, minutes: min, seconds: sec };
}

export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutesBetween(start, end) {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return 0;
  const a = s.hours * 60 + s.minutes;
  let b = e.hours * 60 + e.minutes;
  if (b <= a) b += 24 * 60;
  return b - a;
}

/* ---------- Gregorian ⇄ Jalali (jalaali-js, public domain) ------------- */

function div(a, b) { return Math.trunc(a / b); }
function mod(a, b) { return a - Math.trunc(a / b) * b; }

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("Invalid Jalali year");

  let jm;
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5)
        + gd - 34840408;
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

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
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

/** ISO (Gregorian) → { year, month, day } in Jalali. */
export function toJalali(iso) {
  const d = fromISO(iso);
  const j = d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  return { year: j.jy, month: j.jm, day: j.jd };
}

/** Jalali { year, month, day } → ISO (Gregorian). */
export function jalaliToISO(jy, jm, jd) {
  const g = d2g(j2d(jy, jm, jd));
  return toISO(new Date(g.gy, g.gm - 1, g.gd));
}

export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const r = jalCal(jy);
  return r.leap === 1 ? 30 : 29;
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const JALALI_WEEKDAYS = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه",
];