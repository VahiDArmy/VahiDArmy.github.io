/* ============================================================
   js/utils/validation.js
   Field-level validators + form-level engine
   FIXED: Import LIMITS from app.config.js instead of constants.js
   ============================================================ */

import { REGEX } from '../config/constants.js';
import { LIMITS } from '../config/app.config.js'; // ← FIX: LIMITS lives here
import { toEnDigits } from './format.js';
import { cleanText } from './sanitize.js';

/* ── Primitive validators ─────────────────────────────────── */

/**
 * Validate an email address (RFC-lite).
 * @param {string} v @returns {{valid:boolean, message?:string}}
 */
export function validateEmail(v) {
  const s = String(v || '').trim();
  if (!s) return { valid: false, message: 'ایمیل الزامی است.' };
  if (s.length > 254) return { valid: false, message: 'ایمیل بسیار طولانی است.' };
  if (!REGEX.EMAIL.test(s)) return { valid: false, message: 'قالب ایمیل نامعتبر است.' };
  return { valid: true };
}

/**
 * Password strength with Persian labels.
 * @param {string} v
 * @returns {{valid:boolean, score:0|1|2|3|4, label:string, message?:string}}
 */
export function validatePassword(v) {
  const s = String(v || '');
  if (!s) return { valid: false, score: 0, label: 'خالی', message: 'رمز عبور الزامی است.' };
  if (s.length < 8) return { valid: false, score: 1, label: 'ضعیف', message: 'حداقل ۸ کاراکتر لازم است.' };

  let score = 1;
  if (s.length >= 10) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;

  const capped = /** @type {0|1|2|3|4} */ (Math.min(4, score));
  const labels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'بسیار قوی'];
  return { valid: score >= 2, score: capped, label: labels[capped] };
}

/**
 * Check password confirmation match.
 * @param {string} a @param {string} b @returns {{valid:boolean,message?:string}}
 */
export function validatePasswordMatch(a, b) {
  if (a !== b) return { valid: false, message: 'رمزهای عبور یکسان نیستند.' };
  return { valid: true };
}

/**
 * Validate a required text field.
 * @param {string} v
 * @param {{min?:number,max?:number,label?:string,multiline?:boolean}} [opts]
 * @returns {{valid:boolean, message?:string, value:string}}
 */
export function validateText(v, opts = {}) {
  const { min = 1, max = 4000, label = 'این فیلد', multiline = true } = opts;
  const cleaned = cleanText(v, { maxLen: max + 1, multiline });
  if (!cleaned) return { valid: false, message: `${label} الزامی است.`, value: '' };
  if (cleaned.length < min) {
    return { valid: false, message: `${label} باید حداقل ${min} کاراکتر باشد.`, value: cleaned };
  }
  if (cleaned.length > max) {
    return { valid: false, message: `${label} نباید از ${max} کاراکتر بیشتر باشد.`, value: cleaned.slice(0, max) };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validate a display name.
 * @param {string} v @returns {{valid:boolean,message?:string,value:string}}
 */
export function validateDisplayName(v) {
  const cleaned = cleanText(v, { maxLen: LIMITS.displayNameMax, multiline: false });
  if (!cleaned) return { valid: false, message: 'نام نمایشی الزامی است.', value: '' };
  if (cleaned.length < 2) return { valid: false, message: 'نام نمایشی حداقل ۲ کاراکتر باشد.', value: cleaned };
  if (cleaned.length > LIMITS.displayNameMax) {
    return { valid: false, message: `حداکثر ${LIMITS.displayNameMax} کاراکتر.`, value: cleaned };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validate a tag name.
 * @param {string} v @returns {{valid:boolean,message?:string,value:string}}
 */
export function validateTagName(v) {
  const cleaned = cleanText(v, { maxLen: LIMITS.tagNameMax, multiline: false });
  if (!cleaned) return { valid: false, message: 'نام برچسب الزامی است.', value: '' };
  if (!REGEX.TAG.test(cleaned)) {
    return { valid: false, message: 'فقط حروف، اعداد، فاصله و خط تیره.', value: cleaned };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validate a numeric range.
 * @param {any} v @param {number} min @param {number} max
 * @returns {{valid:boolean,message?:string,value:number}}
 */
export function validateRange(v, min, max) {
  const n = Number(toEnDigits(String(v ?? '')));
  if (Number.isNaN(n)) return { valid: false, message: 'عدد نامعتبر است.', value: NaN };
  if (n < min || n > max) return { valid: false, message: `مقدار باید بین ${min} و ${max} باشد.`, value: n };
  return { valid: true, value: n };
}

/* ── Form validation engine ──────────────────────────────── */

/**
 * @typedef {Object} FieldRule
 * @property {(value:any, all:Object)=>({valid:boolean,message?:string,value?:any})} validate
 * @property {string} [errorFor]
 */

/**
 * Create a lightweight form validator.
 * @param {HTMLFormElement} form
 * @param {Record<string, (value:any, all:Record<string,any>) => ({valid:boolean, message?:string, value?:any})>} rules
 */
export function createValidator(form, rules) {
  const $fields = () => Array.from(form.elements).filter((n) => n.name);

  function getValues() {
    const out = {};
    for (const el of $fields()) {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) out[el.name] = el.value;
        else if (!(el.name in out)) out[el.name] = '';
      } else {
        out[el.name] = el.value;
      }
    }
    return out;
  }

  function errorElFor(name) {
    return form.querySelector(`[data-error-for="${name}"]`);
  }

  function setError(name, message) {
    const node = errorElFor(name);
    if (node) {
      node.textContent = message;
      node.classList.add('is-visible');
    }
    const field = form.elements[name];
    if (field && field.closest) field.closest('.field')?.classList.add('has-error');
  }

  function clearError(name) {
    const node = errorElFor(name);
    if (node) {
      node.textContent = '';
      node.classList.remove('is-visible');
    }
    const field = form.elements[name];
    if (field && field.closest) field.closest('.field')?.classList.remove('has-error');
  }

  function clearAll() {
    for (const name of Object.keys(rules)) clearError(name);
  }

  function validateField(name) {
    const rule = rules[name];
    if (!rule) return true;
    const values = getValues();
    const res = rule(values[name], values);
    if (!res.valid) {
      setError(name, res.message || 'مقدار نامعتبر است.');
      return false;
    }
    clearError(name);
    return true;
  }

  function validateAll() {
    const values = getValues();
    const errors = {};
    const clean = {};
    let ok = true;
    for (const [name, rule] of Object.entries(rules)) {
      const res = rule(values[name], values);
      if (!res.valid) {
        ok = false;
        errors[name] = res.message || 'نامعتبر';
        setError(name, errors[name]);
      } else {
        clearError(name);
        clean[name] = res.value !== undefined ? res.value : values[name];
      }
    }
    return { ok, values: clean, errors };
  }

  function focusFirstError() {
    const first = form.querySelector('.has-error input, .has-error textarea, .has-error select');
    first?.focus();
  }

  for (const name of Object.keys(rules)) {
    const el = form.elements[name];
    if (!el) continue;
    const handler = () => {
      if (el.dataset.touched) validateField(name);
    };
    el.addEventListener('blur', () => { el.dataset.touched = '1'; validateField(name); });
    el.addEventListener('input', handler);
  }

  return { validateAll, validateField, setError, clearError, clearAll, getValues, focusFirstError };
}