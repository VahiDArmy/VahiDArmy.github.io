/**
 * Date Utilities for Madacto (Jalali <-> Gregorian)
 */

export function toJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (parseInt(days / 12053));
  days %= 12053;
  jy += 4 * (parseInt(days / 1461));
  days %= 1461;
  if (days > 365) {
    jy += parseInt((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

export function toGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((parseInt(jy / 33)) * 8) + (parseInt(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * (parseInt(days / 146097));
  days %= 146097;
  if (days > 36524) {
    gy += 100 * (parseInt(--days / 36524));
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (parseInt(days / 1461));
  days %= 1461;
  if (days > 365) {
    gy += parseInt((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

/** Format JS Date to YYYY-MM-DD (Gregorian) */
export function formatDateISO(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/** Format JS Date to Shamsi "1405/08/12" */
export function formatDateShamsi(date) {
  const d = new Date(date);
  const [jy, jm, jd] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/** Get Start of Current Week (Saturday) */
export function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day === 6) ? 0 : -(day + 1);
  const start = new Date(now.setDate(now.getDate() + diff));
  start.setHours(0, 0, 0, 0);
  return start;
}