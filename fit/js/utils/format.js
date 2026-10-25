/* ==========================================================================
   Utils — Format
   Persian digits, number formatting, dates.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  const PERSIAN_MONTHS = [
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
    'اسفند'
  ];

  /**
   * Convert Latin digits in a string to Persian digits.
   */
  function toPersian(str) {
    return String(str).replace(/\d/g, (d) => PERSIAN_DIGITS[+d]);
  }

  /**
   * Convert Persian digits in a string to Latin digits.
   */
  function toLatin(str) {
    return String(str).replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  }

  /**
   * Format a number according to the app's current settings.
   * @param {number} n
   * @param {Object} [opts]
   * @param {number} [opts.decimals]
   * @param {boolean} [opts.persian]
   * @param {boolean} [opts.grouping]  thousands separator
   * @param {string} [opts.fallback]   displayed when n is invalid
   */
  function formatNumber(n, opts) {
    opts = opts || {};
    const fallback = opts.fallback !== undefined ? opts.fallback : '—';
    if (n === null || n === undefined || n === '' || typeof n === 'boolean') return fallback;
    const num = typeof n === 'number' ? n : parseFloat(String(n));
    if (!isFinite(num)) return fallback;

    const decimals = typeof opts.decimals === 'number' ? opts.decimals : 4;
    const persian = opts.persian !== false;
    const grouping = opts.grouping !== false;

    let out;
    const abs = Math.abs(num);
    if (num === 0) {
      out = decimals > 0 && opts.keepZeros !== false ? (0).toFixed(decimals) : '0';
    } else if (abs >= 1e7 || abs < 1e-4) {
      out = num.toExponential(Math.min(decimals, 4));
    } else {
      out = num.toFixed(decimals);
      if (decimals > 0 && opts.trimZeros !== false) {
        out = out.replace(/\.?0+$/, '');
      }
    }

    if (grouping) {
      const parts = out.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      out = parts.join('.');
    }

    return persian ? toPersian(out) : out;
  }

  /**
   * Format a percentage.
   */
  function formatPercent(n, decimals, opts) {
    if (!isFinite(n)) return '—';
    const d = typeof decimals === 'number' ? decimals : 2;
    const s = (n * 100).toFixed(d) + '٪';
    const persian = !opts || opts.persian !== false;
    return persian ? toPersian(s) : s.replace('٪', '%');
  }

  /**
   * Format a number with fixed decimals (no grouping, no trimming).
   * For scientific values in result tables.
   */
  function formatFixed(n, decimals) {
    if (!isFinite(n)) return '—';
    const d = typeof decimals === 'number' ? decimals : 4;
    return toPersian(n.toFixed(d));
  }

  /**
   * Compact number — like 1.2K, 3.4M. Kept for stats.
   */
  function formatCompact(n) {
    if (!isFinite(n)) return '—';
    const abs = Math.abs(n);
    let out;
    if (abs >= 1e9) out = (n / 1e9).toFixed(1) + 'B';
    else if (abs >= 1e6) out = (n / 1e6).toFixed(1) + 'M';
    else if (abs >= 1e3) out = (n / 1e3).toFixed(1) + 'K';
    else out = String(n);
    return toPersian(out);
  }

  /**
   * Round to n significant digits.
   */
  function roundSig(n, sig) {
    if (!isFinite(n) || n === 0) return n;
    const mult = Math.pow(10, sig - 1 - Math.floor(Math.log10(Math.abs(n))));
    return Math.round(n * mult) / mult;
  }

  /**
   * Parse a user-typed number. Accepts Persian digits, commas, and spaces.
   * Returns NaN when not a valid number.
   */
  function parseNumber(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    const s = toLatin(String(v))
      .replace(/[,٬\s]/g, '')
      .replace(/٫/g, '.')
      .trim();
    if (s === '') return NaN;
    if (!/^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }

  /**
   * Format an ISO date string or timestamp as a Persian relative string.
   */
  function formatRelativeTime(ts) {
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const sec = Math.round(diff / 1000);
    if (sec < 5) return 'همین حالا';
    if (sec < 60) return `${toPersian(sec)} ثانیه پیش`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${toPersian(min)} دقیقه پیش`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${toPersian(hr)} ساعت پیش`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${toPersian(day)} روز پیش`;
    return formatJalali(ts);
  }

  /**
   * Convert a Gregorian date to Jalali (Shamsi).
   * Based on the standard algorithm.
   */
  function toJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days =
      365 * gy +
      Math.floor((gy2 + 3) / 4) -
      Math.floor((gy2 + 99) / 100) +
      Math.floor((gy2 + 399) / 400) -
      80 +
      gd +
      g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return { jy, jm, jd };
  }

  /**
   * Format a timestamp as a Persian (Jalali) date string.
   */
  function formatJalali(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const { jy, jm, jd } = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return toPersian(`${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy} — ${hh}:${mm}`);
  }

  /**
   * Short Jalali date only.
   */
  function formatJalaliDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const { jy, jm, jd } = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return toPersian(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
  }

  /**
   * Persian ordinal — 1 → «اول»... not commonly needed but useful.
   * Kept minimal.
   */
  function formatFileSize(bytes) {
    if (!isFinite(bytes) || bytes < 0) return '—';
    const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    const out = i === 0 ? `${toPersian(Math.round(v))} ${units[i]}` : `${toPersian(v.toFixed(1))} ${units[i]}`;
    return out;
  }

  /**
   * Pluralize a word for Persian (simple — most nouns are invariant).
   */
  function pluralize(count, singular, plural) {
    const p = typeof plural === 'string' ? plural : singular;
    return `${toPersian(count)} ${count === 1 ? singular : p}`;
  }

  App.Format = {
    toPersian,
    toLatin,
    formatNumber,
    formatPercent,
    formatFixed,
    formatCompact,
    roundSig,
    parseNumber,
    formatRelativeTime,
    formatJalali,
    formatJalaliDate,
    formatFileSize,
    pluralize
  };
})(window);