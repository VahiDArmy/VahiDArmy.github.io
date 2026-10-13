/**
 * Input validation + sanitization helpers.
 * Persian error messages, ready to be shown by the UI layer.
 */

import { toLatinDigits } from "./format.js";

export const validators = {
  required(value) {
    if (value == null) return "این فیلد الزامی است";
    if (typeof value === "string" && value.trim() === "")
      return "این فیلد الزامی است";
    if (Array.isArray(value) && value.length === 0)
      return "حداقل یک مورد را انتخاب کنید";
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
      return String(value).length >= min
        ? null
        : `حداقل ${min} کاراکتر وارد کنید`;
    };
  },

  maxLength(max) {
    return (value) => {
      if (!value) return null;
      return String(value).length <= max
        ? null
        : `حداکثر ${max} کاراکتر مجاز است`;
    };
  },

  number(value) {
    if (value === "" || value == null) return null;
    const v = Number(toLatinDigits(value));
    return Number.isFinite(v) ? null : "عدد معتبر وارد کنید";
  },

  integer(value) {
    if (value === "" || value == null) return null;
    const v = Number(toLatinDigits(value));
    return Number.isInteger(v) ? null : "عدد صحیح وارد کنید";
  },

  range(min, max) {
    return (value) => {
      if (value === "" || value == null) return null;
      const v = Number(toLatinDigits(value));
      if (!Number.isFinite(v)) return "عدد معتبر وارد کنید";
      if (v < min) return `مقدار باید حداقل ${min} باشد`;
      if (v > max) return `مقدار باید حداکثر ${max} باشد`;
      return null;
    };
  },

  positive(value) {
    if (value === "" || value == null) return null;
    const v = Number(toLatinDigits(value));
    if (!Number.isFinite(v)) return "عدد معتبر وارد کنید";
    return v > 0 ? null : "مقدار باید بزرگ‌تر از صفر باشد";
  },

  time(value) {
    if (!value) return null;
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))
      ? null
      : "ساعت را به صورت ۲۴ ساعته وارد کنید (مثال: 08:30)";
  },

  isoDate(value) {
    if (!value) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? null
      : "تاریخ معتبر نیست";
  },

  password(value) {
    if (!value) return "رمز عبور را وارد کنید";
    const v = String(value);
    if (v.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
    if (!/[A-Za-z]/.test(v)) return "رمز عبور باید حداقل یک حرف داشته باشد";
    if (!/\d/.test(v)) return "رمز عبور باید حداقل یک عدد داشته باشد";
    return null;
  },

  match(otherValue, label = "مقدار") {
    return (value) =>
      value === otherValue ? null : `${label} یکسان نیست`;
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

/** Normalize numeric string input coming from Persian keyboards. */
export function normalizeNumber(input) {
  if (input == null || input === "") return "";
  const clean = toLatinDigits(String(input)).replace(/[^\d.\-]/g, "");
  return clean;
}

/** Trim + collapse whitespace in Persian text. */
export function normalizeText(input) {
  return String(input ?? "")
    .replace(/\u200c+/g, "\u200c") // collapse ZWNJ runs
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip HTML tags + dangerous chars for safe innerHTML injection later. */
export function sanitizeText(input) {
  return String(input ?? "")
    .replace(/[<>]/g, "")
    .trim();
}