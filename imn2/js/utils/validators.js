/**
 * validators.js — اعتبارسنجی ورودی‌ها
 */

import { toEnDigits } from './format.js';

export const V = {
  required(v) { return v != null && String(v).trim() !== ''; },

  email(v) {
    const s = String(v || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  },

  minLength(v, n) { return String(v ?? '').length >= n; },
  maxLength(v, n) { return String(v ?? '').length <= n; },

  number(v, { min = -Infinity, max = Infinity } = {}) {
    const n = Number(toEnDigits(v));
    if (!Number.isFinite(n)) return false;
    return n >= min && n <= max;
  },

  integer(v, opts) { return this.number(v, opts) && Number.isInteger(Number(toEnDigits(v))); },

  time(v) {
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(v || '').trim());
  },

  isoDate(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());
  },
};

/* ---------- قدرت رمز عبور ---------- */

/**
 * @returns {{ score: 0|1|2|3|4, label: string }}
 */
export function passwordStrength(pw) {
  const s = String(pw || '');
  let score = 0;
  if (s.length >= 8) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  if (s.length < 6) score = Math.min(score, 1);
  const labels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'خوب', 'قوی'];
  return { score, label: labels[score] };
}

/* ---------- فرم ورود ---------- */

export function validateLogin({ email, password }) {
  const errors = {};
  if (!V.required(email)) errors.email = 'ایمیل الزامی است.';
  else if (!V.email(email)) errors.email = 'ایمیل معتبر نیست.';
  if (!V.required(password)) errors.password = 'رمز عبور الزامی است.';
  else if (!V.minLength(password, 6)) errors.password = 'رمز عبور حداقل ۶ کاراکتر باشد.';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateSignup({ displayName, email, password, password2 }) {
  const errors = {};
  if (!V.required(displayName)) errors.displayName = 'نام نمایشی الزامی است.';
  else if (!V.maxLength(displayName, 40)) errors.displayName = 'حداکثر ۴۰ کاراکتر.';

  if (!V.required(email)) errors.email = 'ایمیل الزامی است.';
  else if (!V.email(email)) errors.email = 'ایمیل معتبر نیست.';

  if (!V.required(password)) errors.password = 'رمز عبور الزامی است.';
  else if (!V.minLength(password, 8)) errors.password = 'رمز عبور حداقل ۸ کاراکتر باشد.';

  if (password !== password2) errors.password2 = 'رمزها یکسان نیستند.';

  return { ok: Object.keys(errors).length === 0, errors };
}

/* ---------- محدوده‌های پزشکی ---------- */

export function validateGlucose(value) {
  const n = Number(toEnDigits(value));
  if (!Number.isFinite(n)) return { ok: false, msg: 'عدد معتبر وارد کنید.' };
  if (n < 20)  return { ok: false, msg: 'مقدار قند خون پایین‌تر از حد مجاز است.' };
  if (n > 800) return { ok: false, msg: 'مقدار قند خون بالاتر از حد مجاز است.' };
  return { ok: true };
}

export function validateBloodPressure(sys, dia) {
  const s = Number(toEnDigits(sys));
  const d = Number(toEnDigits(dia));
  if (!Number.isFinite(s) || !Number.isFinite(d)) return { ok: false, msg: 'اعداد معتبر وارد کنید.' };
  if (s <= d) return { ok: false, msg: 'سیستولیک باید بزرگتر از دیاستولیک باشد.' };
  if (s < 40 || s > 300) return { ok: false, msg: 'سیستولیک خارج از محدوده.' };
  if (d < 20 || d > 200) return { ok: false, msg: 'دیاستولیک خارج از محدوده.' };
  return { ok: true };
}

export function validateWeight(value) {
  const n = Number(toEnDigits(value));
  if (!Number.isFinite(n)) return { ok: false, msg: 'عدد معتبر وارد کنید.' };
  if (n < 10 || n > 400) return { ok: false, msg: 'وزن خارج از محدوده.' };
  return { ok: true };
}

export function validateInsulinUnits(value) {
  const n = Number(toEnDigits(value));
  if (!Number.isFinite(n)) return { ok: false, msg: 'عدد معتبر وارد کنید.' };
  if (n <= 0 || n > 200) return { ok: false, msg: 'واحد انسولین نامعتبر.' };
  return { ok: true };
}

/* ---------- نمایش خطا ---------- */

export function applyErrors(formEl, errors) {
  formEl.querySelectorAll('.field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
  formEl.querySelectorAll('.field__error').forEach((e) => (e.textContent = ''));
  Object.entries(errors).forEach(([name, msg]) => {
    const input = formEl.querySelector(`[name="${name}"]`);
    if (!input) return;
    const field = input.closest('.field');
    if (field) field.classList.add('is-invalid');
    const errEl = formEl.querySelector(`[data-error-for="${input.id}"]`);
    if (errEl) errEl.textContent = msg;
  });
}