/**
 * Form validators.
 *
 * Usage:
 *   const schema = {
 *     email:   [rules.required(), rules.email()],
 *     password:[rules.required(), rules.minLength(8)],
 *   };
 *   const errors = validate(values, schema);
 *   // => { email: 'ایمیل نامعتبر است', ... }  (empty if valid)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-.~:/?#[\]@!$&'()*+,;=%]*)?$/i;
// Iranian mobile: 09XXXXXXXXX or +989XXXXXXXXX (digits may be Persian)
const IR_PHONE_RE = /^(\+?98|0)?9\d{9}$/;

function normalizeDigits(v) {
  return String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s-]/g, '');
}

export const isEmail = (v) => EMAIL_RE.test(String(v ?? '').trim());
export const isUrl   = (v) => URL_RE.test(String(v ?? '').trim());
export const isPhone = (v) => IR_PHONE_RE.test(normalizeDigits(v));
export const isNumeric = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
export const isInteger = (v) => Number.isInteger(Number(v));
export const isEmpty = (v) =>
  v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** A rule is a function (value, allValues) => null | string(errorMessage) */
export const rules = {
  required: (msg = 'این فیلد الزامی است') => (v) => (isEmpty(v) ? msg : null),

  email: (msg = 'ایمیل نامعتبر است') => (v) => (!v || isEmail(v) ? null : msg),

  url: (msg = 'نشانی معتبر نیست') => (v) => (!v || isUrl(v) ? null : msg),

  phone: (msg = 'شماره موبایل نامعتبر است') => (v) => (!v || isPhone(v) ? null : msg),

  numeric: (msg = 'عدد وارد کنید') => (v) => (isEmpty(v) || isNumeric(v) ? null : msg),

  integer: (msg = 'عدد صحیح وارد کنید') => (v) =>
    (isEmpty(v) || isInteger(v) ? null : msg),

  minLength: (n, msg) => (v) => {
    if (isEmpty(v)) return null;
    return String(v).length >= n ? null : msg || `حداقل ${n} کاراکتر لازم است`;
  },

  maxLength: (n, msg) => (v) => {
    if (isEmpty(v)) return null;
    return String(v).length <= n ? null : msg || `حداکثر ${n} کاراکتر مجاز است`;
  },

  min: (n, msg) => (v) => {
    if (isEmpty(v)) return null;
    return Number(v) >= n ? null : msg || `حداقل ${n} است`;
  },

  max: (n, msg) => (v) => {
    if (isEmpty(v)) return null;
    return Number(v) <= n ? null : msg || `حداکثر ${n} است`;
  },

  pattern: (re, msg = 'قالب نامعتبر است') => (v) =>
    (isEmpty(v) || re.test(String(v)) ? null : msg),

  oneOf: (list, msg = 'مقدار نامعتبر است') => (v) =>
    (isEmpty(v) || list.includes(v) ? null : msg),

  matches: (otherKey, msg = 'مقادیر یکسان نیستند') => (v, values) =>
    (v === (values || {})[otherKey] ? null : msg),

  /** Password: min 8, at least one letter + one digit. */
  password: (msg = 'رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و رقم باشد') => (v) => {
    if (isEmpty(v)) return null;
    const s = String(v);
    return s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s) ? null : msg;
  },

  /** Username: latin letters, digits, underscore, dot — 3-24 chars. */
  username: (msg = 'نام کاربری نامعتبر است (۳ تا ۲۴ کاراکتر، حروف لاتین، عدد، نقطه یا زیرخط)') => (v) => {
    if (isEmpty(v)) return null;
    return /^[A-Za-z0-9_.]{3,24}$/.test(String(v)) ? null : msg;
  },

  fileSize: (maxBytes, msg) => (file) => {
    if (!file || typeof file.size !== 'number') return null;
    return file.size <= maxBytes ? null : msg || 'حجم فایل بیش از حد مجاز است';
  },

  fileType: (accept, msg = 'نوع فایل مجاز نیست') => (file) => {
    if (!file || !file.type) return null;
    const list = String(accept).split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length) return null;
    const mime = file.type;
    const ok = list.some((t) => {
      if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t.toLowerCase());
      if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));
      return mime === t;
    });
    return ok ? null : msg;
  },
};

/**
 * Validate a values object against a schema of rule arrays.
 * @param {Object} values
 * @param {Object<string, Function[]|Function>} schema
 * @returns {Object<string, string>} — fieldName → first error
 */
export function validate(values, schema) {
  const errors = {};
  for (const [field, list] of Object.entries(schema || {})) {
    const fns = Array.isArray(list) ? list : [list];
    for (const fn of fns) {
      if (typeof fn !== 'function') continue;
      const message = fn(values ? values[field] : undefined, values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}

export function hasErrors(errors) {
  return !!errors && Object.keys(errors).length > 0;
}