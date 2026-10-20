/**
 * Formatting helpers — Persian dates, numerals, files, text.
 */

const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

/** Convert all ASCII digits to Persian digits. */
export function toFaDigits(input) {
  return String(input ?? '').replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** Convert Persian/Arabic digits to Latin. */
export function toEnDigits(input) {
  return String(input ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Format a number with Persian digits and thousands separators. */
export function formatNumber(n, { persian = true, compact = false } = {}) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  let out;
  if (compact) {
    out = new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
  } else {
    out = new Intl.NumberFormat('fa-IR').format(num);
  }
  return persian ? out : toEnDigits(out);
}

/** Relative time in Persian ("۳ دقیقه پیش"). */
export function timeAgo(dateLike) {
  if (!dateLike) return '—';
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = (Date.now() - date.getTime()) / 1000;
  const abs = Math.abs(diff);
  const isFuture = diff < 0;

  const units = [
    ['year', 60 * 60 * 24 * 365, 'سال'],
    ['month', 60 * 60 * 24 * 30, 'ماه'],
    ['day', 60 * 60 * 24, 'روز'],
    ['hour', 60 * 60, 'ساعت'],
    ['minute', 60, 'دقیقه'],
    ['second', 1, 'ثانیه'],
  ];

  for (const [, seconds, label] of units) {
    if (abs >= seconds) {
      const value = Math.floor(abs / seconds);
      return isFuture
        ? `${formatNumber(value)} ${label} بعد`
        : `${formatNumber(value)} ${label} پیش`;
    }
  }
  return 'همین حالا';
}

/** Full Persian date: "۲۹ آبان ۱۴۰۳" */
export function formatDate(dateLike, { withTime = false } = {}) {
  if (!dateLike) return '—';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(d);
  if (!withTime) return datePart;
  const timePart = new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit', minute: '2-digit',
  }).format(d);
  return `${datePart} • ${timePart}`;
}

/** Short numeric date for tables: "۱۴۰۳/۰۸/۲۹" */
export function formatDateShort(dateLike) {
  if (!dateLike) return '—';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR-u-nu-arabext', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Bytes → human readable (Persian-aware). */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes && bytes !== 0) return '—';
  const b = Number(bytes);
  if (b === 0) return '۰ بایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), sizes.length - 1);
  return `${formatNumber((b / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Truncate text at a word boundary. */
export function truncateText(text, max = 120) {
  const str = String(text ?? '').trim();
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Build initials from a name for avatar fallback. */
export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
}

/** Slugify — keep Persian letters as-is. */
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .toLowerCase();
}

/** Pluralize Persian word given count (simple fallback). */
export function pluralFa(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

/** Extract a friendly error message from an unknown error / supabase error. */
export function friendlyError(err, fallback = 'خطایی رخ داد. دوباره تلاش کنید.') {
  if (!err) return fallback;
  const message = err.message || err.error_description || err.hint || '';
  if (!message) return fallback;

  const map = {
    'Invalid login credentials': 'ایمیل یا رمز عبور نادرست است.',
    'Email not confirmed': 'ایمیل شما هنوز تأیید نشده است.',
    'User already registered': 'این ایمیل قبلاً ثبت شده است.',
    'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
    'Unable to validate email address: invalid format': 'ایمیل نامعتبر است.',
    'New password should be different from the old password.': 'رمز جدید نباید با رمز قبلی یکسان باشد.',
    'Auth session missing!': 'نشست شما منقضی شده است. دوباره وارد شوید.',
    'duplicate key value violates unique constraint': 'مقداری تکراری است.',
  };
  for (const [en, fa] of Object.entries(map)) {
    if (message.includes(en)) return fa;
  }
  return message;
}