/* ============================================================================
   VALIDATORS
   ============================================================================ */

(function (window) {
  "use strict";

  const Persian = window.Persian || {};
  const C = window.C || { PATTERNS: {} };

  const Validators = {
    /* ---------- Primitives ---------- */
    required(value) {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },

    minLength(value, min) {
      return String(value || "").length >= min;
    },

    maxLength(value, max) {
      return String(value || "").length <= max;
    },

    between(value, min, max) {
      const n = Number(value);
      return !isNaN(n) && n >= min && n <= max;
    },

    /* ---------- Email ---------- */
    email(value) {
      return C.PATTERNS?.EMAIL?.test(String(value || "").trim()) || false;
    },

    /* ---------- Phone (Iran) ---------- */
    phone(value) {
      const cleaned = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      const digits = cleaned.replace(/[\s-()]/g, "");
      return C.PATTERNS?.PHONE_IR?.test(digits) || false;
    },

    /* ---------- National ID (Iran, 10 digits with checksum) ---------- */
    nationalId(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      if (!/^\d{10}$/.test(s)) return false;
      if (/^(\d)\1{9}$/.test(s)) return false;
      let check = +s[9];
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += +s[i] * (10 - i);
      const r = sum % 11;
      return (r < 2 && check === r) || (r >= 2 && check === 11 - r);
    },

    /* ---------- Postal code ---------- */
    postalCode(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      return /^\d{10}$/.test(s);
    },

    /* ---------- IBAN (Iran) ---------- */
    iban(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      return /^IR\d{24}$/i.test(s.replace(/\s/g, ""));
    },

    /* ---------- Number ---------- */
    number(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      return s !== "" && !isNaN(Number(s));
    },

    integer(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      return /^-?\d+$/.test(s);
    },

    positive(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      const n = Number(s);
      return !isNaN(n) && n > 0;
    },

    nonNegative(value) {
      const s = Persian.toEnglishDigits ? Persian.toEnglishDigits(value) : String(value);
      const n = Number(s);
      return !isNaN(n) && n >= 0;
    },

    /* ---------- Date ---------- */
    date(value) {
      if (!value) return false;
      const d = new Date(value);
      return !isNaN(d.getTime());
    },

    past(value) {
      return this.date(value) && new Date(value) < new Date();
    },

    future(value) {
      return this.date(value) && new Date(value) > new Date();
    },

    /* ---------- URL ---------- */
    url(value) {
      return C.PATTERNS?.URL?.test(String(value || "")) || false;
    },

    /* ---------- SKU ---------- */
    sku(value) {
      return C.PATTERNS?.SKU?.test(String(value || "")) || false;
    },

    /* ---------- Password ---------- */
    password(value) {
      const s = String(value || "");
      return {
        length: s.length >= 8,
        upper: /[A-Z]/.test(s),
        lower: /[a-z]/.test(s),
        digit: /\d/.test(s),
        special: /[!@#$%^&*(),.?":{}|<>_\-]/.test(s),
      };
    },

    passwordStrength(value) {
      const s = String(value || "");
      if (!s) return 0;
      let score = 0;
      if (s.length >= 8) score++;
      if (s.length >= 12) score++;
      if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
      if (/\d/.test(s)) score++;
      if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(s)) score++;
      return Math.min(4, Math.ceil(score * 4 / 5));
    },

    /* ---------- File ---------- */
    fileSize(file, maxMB = 8) {
      if (!file) return false;
      return file.size <= maxMB * 1024 * 1024;
    },

    fileType(file, allowed = []) {
      if (!file || !allowed.length) return true;
      return allowed.includes(file.type);
    },

    /* ---------- URL-safe / CSS class ---------- */
    safeId(value) {
      return /^[a-zA-Z0-9_-]+$/.test(String(value || ""));
    },

    /* ---------- Hex color ---------- */
    hexColor(value) {
      return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(String(value || ""));
    },

    /* ---------- Compare ---------- */
    equals(a, b) {
      return a === b;
    },

    matches(value, other) {
      return value === other;
    },

    /* ---------- Form validator ---------- */
    validate(values, schema) {
      const errors = {};
      let valid = true;

      Object.entries(schema).forEach(([field, rules]) => {
        const value = values[field];
        const ruleList = Array.isArray(rules) ? rules : [rules];

        for (const rule of ruleList) {
          const result = this.applyRule(field, value, rule, values);
          if (result !== true) {
            errors[field] = result;
            valid = false;
            break;
          }
        }
      });

      return { valid, errors };
    },

    applyRule(field, value, rule, allValues) {
      const messages = {
        required: "این فیلد اجباری است",
        email: "ایمیل معتبر نیست",
        phone: "شماره موبایل معتبر نیست",
        nationalId: "کد ملی معتبر نیست",
        number: "باید عدد باشد",
        integer: "باید عدد صحیح باشد",
        positive: "باید مقدار مثبت باشد",
        nonNegative: "مقدار منفی مجاز نیست",
        url: "آدرس معتبر نیست",
        sku: "کد کالا باید شامل حروف، عدد، خط تیره یا زیرخط باشد (۳ تا ۳۲ کاراکتر)",
        date: "تاریخ معتبر نیست",
        hexColor: "کد رنگ معتبر نیست",
      };

      if (typeof rule === "string") {
        const fn = this[rule];
        if (typeof fn === "function") {
          const ok = fn.call(this, value);
          return ok ? true : (messages[rule] || `قاعده «${rule}» برقرار نشد`);
        }
        return true;
      }

      if (typeof rule === "function") {
        const ok = rule(value, allValues);
        return ok === true || ok == null ? true : (typeof ok === "string" ? ok : "مقدار نامعتبر");
      }

      if (typeof rule === "object" && rule.type) {
        const fn = this[rule.type];
        if (typeof fn === "function") {
          const ok = fn.call(this, value, rule.param);
          return ok ? true : (rule.message || messages[rule.type] || "مقدار نامعتبر");
        }
      }

      return true;
    },
  };

  window.Validators = Validators;
})(window);