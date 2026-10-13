/**
 * Input validation + sanitization helpers.
 * Persian error messages, ready to be shown by the UI layer.
 */

import { toLatinDigits, normalizeNumber } from "./format.js";

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const INTEGER_RE = /^-?\d+$/;

export const validators = {
  required(value) {
    if (value == null) return "این فیلد الزامی است";
    if (typeof value === "string" && value.trim() === "") return "این فیلد الزامی است";
    if (Array.isArray(value) && value.length === 0) return "حداقل یک مورد را انتخاب کنید";
    return null;
  },

  email(value) {
    if (!value) return null;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
    return ok ? null : "ایمیل معتبر وارد کنید";
  },

  minLength(min) {
    return (value) => {
      if (!value) return null;
      return String(value).length >= min ? null : `حداقل ${min} کاراکتر وارد کنید`;
    };
  },

  maxLength(max) {
    return (value) => {
      if (!value) return null;
      return String(value).length <= max ? null : `حداکثر ${max} کاراکتر مجاز است`;
    };
  },

  /** Strict number: accepts "-12", "3.5", "۳٫۵". Rejects "0x10", "1e3". */
  number(value) {
    if (value === "" || value == null) return null;
    const v = normalizeNumber(value);
    if (!v || !NUMERIC_RE.test(v)) return "عدد معتبر وارد کنید";
    return null;
  },

  /** Strict integer: accepts "5", "۵", "-3". Rejects "5.0", "1e3". */
  integer(value) {
    if (value === "" || value == null) return null;
    const v = normalizeNumber(value);
    if (!v || !INTEGER_RE.test(v)) return "عدد صحیح وارد کنید";
    return null;
  },

  range(min, max) {
    return (value) => {
      if (value === "" || value == null) return null;
      const v = Number(normalizeNumber(value));
      if (!Number.isFinite(v)) return "عدد معتبر وارد کنید";
      if (v < min) return `مقدار باید حداقل ${min} باشد`;
      if (v > max) return `مقدار باید حداکثر ${max} باشد`;
      return null;
    };
  },

  positive(value) {
    if (value === "" || value == null) return null;
    const v = Number(normalizeNumber(value));
    if (!Number.isFinite(v)) return "عدد معتبر وارد کنید";
    return v > 0 ? null : "مقدار باید بزرگ‌تر از صفر باشد";
  },

  /** Accepts "HH:MM" or "HH:MM:SS". */
  time(value) {
    if (!value) return null;
    return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value).trim())
      ? null
      : "ساعت را به صورت ۲۴ ساعته وارد کنید (مثال: 08:30)";
  },

  /** Strict ISO date — validates calendar day-of-month, not just pattern. */
  isoDate(value) {
    if (!value) return null;
    const s = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "تاریخ معتبر نیست";
    const [y, m, d] = s.split("-").map(Number);
    if (m < 1 || m > 12) return "تاریخ معتبر نیست";
    if (d < 1 || d > new Date(y, m, 0).getDate()) return "تاریخ معتبر نیست";
    return null;
  },

  password(value) {
    if (!value) return "رمز عبور را وارد کنید";
    const v = String(value);
    if (v.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
    if (!/[A-Za-z]/.test(v)) return "رمز عبور باید حداقل یک حرف داشته باشد";
    if (!/\d/.test(v)) return "رمز عبور باید حداقل یک عدد داشته باشد";
    return null;
  },

  /**
   * Match validator.
   * Pass either a value or a getter function. Using a getter avoids
   * comparing against a stale snapshot if the other field changes later.
   *   match(() => form.password.value, "تکرار رمز عبور")
   */
  match(otherOrGetter, label = "مقدار") {
    return (value) => {
      const other = typeof otherOrGetter === "function" ? otherOrGetter() : otherOrGetter;
      return value === other ? null : `${label} یکسان نیست`;
    };
  },
};

/**
 * Validate a whole object.
 * schema: { field: [validator1, validator2, ...] }
 * Returns { valid, errors: { field: message } }
 */
export function validate(values, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    const value = values[field];
    for (const rule of rules) {
      const msg = typeof rule === "function" ? rule(value) : null;
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Trim + collapse whitespace in Persian text. */
export function normalizeText(input) {
  return String(input ?? "")
    .replace(/\u200c+/g, "\u200c")
    .replace(/\s+/g, " ")
    .trim();
}

/* toLatinDigits re-exported so consumers don't need to import two modules */
export { toLatinDigits, normalizeNumber };