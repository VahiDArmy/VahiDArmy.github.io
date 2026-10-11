/**
 * ابزارهای اعتبارسنجی
 */
const ValidationUtils = {
  /**
   * الزامی
   */
  required(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },

  /**
   * حداقل طول
   */
  minLength(value, min) {
    return String(value || '').length >= min;
  },

  /**
   * حداکثر طول
   */
  maxLength(value, max) {
    return String(value || '').length <= max;
  },

  /**
   * در بازه طول
   */
  lengthBetween(value, min, max) {
    const len = String(value || '').length;
    return len >= min && len <= max;
  },

  /**
   * ایمیل
   */
  email(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value));
  },

  /**
   * شماره موبایل ایران
   */
  iranianMobile(value) {
    if (!value) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value)).replace(/[\s-]/g, '');
    return /^(\+98|0098|98|0)?9\d{9}$/.test(cleaned);
  },

  /**
   * تلفن ثابت ایران
   */
  iranianPhone(value) {
    if (!value) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value)).replace(/[\s-]/g, '');
    return /^(\+98|0098|98|0)?\d{2,3}\d{8}$/.test(cleaned);
  },

  /**
   * کد ملی ایران
   */
  iranianNationalCode(value) {
    if (!value) return true;
    const code = StringUtils.persianToEnglishDigits(String(value)).trim();

    if (!/^\d{10}$/.test(code)) return false;
    if (/^(\d)\1{9}$/.test(code)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(code[i]) * (10 - i);
    }

    const remainder = sum % 11;
    const checkDigit = parseInt(code[9]);

    return (remainder < 2 && checkDigit === remainder) ||
           (remainder >= 2 && checkDigit === 11 - remainder);
  },

  /**
   * کد پستی ایران
   */
  iranianPostalCode(value) {
    if (!value) return true;
    const code = StringUtils.persianToEnglishDigits(String(value)).replace(/\s/g, '');
    return /^\d{10}$/.test(code);
  },

  /**
   * شماره شبا ایران
   */
  iranianIBAN(value) {
    if (!value) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value)).replace(/\s/g, '').toUpperCase();

    if (!/^IR\d{24}$/.test(cleaned)) return false;

    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
    let numeric = '';

    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numeric += (char.charCodeAt(0) - 55).toString();
      } else {
        numeric += char;
      }
    }

    let remainder = 0;
    for (const digit of numeric) {
      remainder = (remainder * 10 + parseInt(digit)) % 97;
    }

    return remainder === 1;
  },

  /**
   * کارت بانکی
   */
  bankCard(value) {
    if (!value) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value)).replace(/[\s-]/g, '');

    if (!/^\d{16}$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 16; i++) {
      let digit = parseInt(cleaned[15 - i]);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    return sum % 10 === 0;
  },

  /**
   * URL
   */
  url(value) {
    if (!value) return true;
    try {
      const url = new URL(String(value));
      return ['http:', 'https:', 'ftp:'].includes(url.protocol);
    } catch (e) {
      return false;
    }
  },

  /**
   * IPv4
   */
  ipv4(value) {
    if (!value) return true;
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(value)) &&
           String(value).split('.').every(part => parseInt(part, 10) <= 255);
  },

  /**
   * IPv6
   */
  ipv6(value) {
    if (!value) return true;
    return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(String(value));
  },

  /**
   * عدد
   */
  number(value) {
    if (value === '' || value === null || value === undefined) return true;
    return !isNaN(Number(StringUtils.persianToEnglishDigits(String(value))));
  },

  /**
   * عدد صحیح
   */
  integer(value) {
    if (value === '' || value === null || value === undefined) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value));
    return /^-?\d+$/.test(cleaned);
  },

  /**
   * عدد اعشاری
   */
  float(value) {
    if (value === '' || value === null || value === undefined) return true;
    const cleaned = StringUtils.persianToEnglishDigits(String(value));
    return /^-?\d+(\.\d+)?$/.test(cleaned);
  },

  /**
   * مثبت
   */
  positive(value) {
    if (value === '' || value === null || value === undefined) return true;
    return Number(value) > 0;
  },

  /**
   * منفی
   */
  negative(value) {
    if (value === '' || value === null || value === undefined) return true;
    return Number(value) < 0;
  },

  /**
   * بازه
   */
  range(value, min, max) {
    if (value === '' || value === null || value === undefined) return true;
    const num = Number(value);
    return num >= min && num <= max;
  },

  /**
   * الگو
   */
  pattern(value, regex) {
    if (!value) return true;
    const re = regex instanceof RegExp ? regex : new RegExp(regex);
    return re.test(String(value));
  },

  /**
   * بدون فاصله
   */
  noWhitespace(value) {
    if (!value) return true;
    return !/\s/.test(String(value));
  },

  /**
   * نام کاربری
   */
  username(value) {
    if (!value) return true;
    return /^[a-zA-Z0-9_]{3,32}$/.test(String(value));
  },

  /**
   * گذرواژه قوی
   */
  strongPassword(value) {
    if (!value) return true;
    const str = String(value);
    return (
      str.length >= 8 &&
      /[a-z]/.test(str) &&
      /[A-Z]/.test(str) &&
      /\d/.test(str) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(str)
    );
  },

  /**
   * تاریخ
   */
  date(value) {
    if (!value) return true;
    const d = new Date(value);
    return !isNaN(d.getTime());
  },

  /**
   * در گذشته
   */
  pastDate(value) {
    if (!value) return true;
    return new Date(value) < new Date();
  },

  /**
   * در آینده
   */
  futureDate(value) {
    if (!value) return true;
    return new Date(value) > new Date();
  },

  /**
   * JSON
   */
  json(value) {
    if (!value) return true;
    try {
      JSON.parse(String(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * شناسه SQL
   */
  sqlIdentifier(value) {
    if (!value) return true;
    return /^[a-zA-Z_\u0600-\u06FF][a-zA-Z0-9_\u0600-\u06FF]*$/.test(String(value));
  },

  /**
   * نام جدول معتبر
   */
  tableName(value) {
    if (!value) return false;
    const str = String(value);
    if (str.length > 64) return false;
    if (/^\d/.test(str)) return false;
    return /^[a-zA-Z_\u0600-\u06FF][a-zA-Z0-9_\u0600-\u06FF]*$/.test(str);
  },

  /**
   * نوع داده SQLite
   */
  sqliteType(value) {
    if (!value) return false;
    const validTypes = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME', 'VARCHAR', 'CHAR', 'DECIMAL'];
    return validTypes.includes(String(value).toUpperCase().split('(')[0].trim());
  },

  /**
   * اعتبارسنجی چندگانه
   */
  validate(value, rules) {
    const errors = [];

    for (const [ruleName, ruleValue] of Object.entries(rules)) {
      const ruleFn = this[ruleName];
      if (typeof ruleFn !== 'function') continue;

      const result = Array.isArray(ruleValue)
        ? ruleFn.call(this, value, ...ruleValue)
        : ruleFn.call(this, value, ruleValue);

      if (result !== true) {
        errors.push({ rule: ruleName, message: this._getMessage(ruleName, ruleValue) });
      }
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * پیام خطا
   */
  _getMessage(ruleName, ruleValue) {
    const messages = {
      required: 'این فیلد الزامی است',
      minLength: `حداقل ${ruleValue} کاراکتر لازم است`,
      maxLength: `حداکثر ${ruleValue} کاراکتر مجاز است`,
      email: 'ایمیل نامعتبر',
      iranianMobile: 'شماره موبایل نامعتبر',
      iranianNationalCode: 'کد ملی نامعتبر',
      iranianPostalCode: 'کد پستی نامعتبر',
      url: 'آدرس اینترنتی نامعتبر',
      ipv4: 'آدرس IPv4 نامعتبر',
      number: 'عدد نامعتبر',
      integer: 'عدد صحیح نامعتبر',
      float: 'عدد اعشاری نامعتبر',
      positive: 'عدد باید مثبت باشد',
      negative: 'عدد باید منفی باشد',
      range: `مقدار باید بین ${ruleValue[0]} و ${ruleValue[1]} باشد`,
      pattern: 'الگو مطابقت ندارد',
      username: 'نام کاربری نامعتبر',
      strongPassword: 'گذرواژه ضعیف است',
      date: 'تاریخ نامعتبر',
      json: 'ساختار JSON نامعتبر',
      tableName: 'نام جدول نامعتبر'
    };

    return messages[ruleName] || 'مقدار نامعتبر';
  },

  /**
   * فیلتر ورودی
   */
  sanitize(value, options = {}) {
    if (value === null || value === undefined) return '';

    let result = String(value);

    if (options.trim !== false) result = result.trim();
    if (options.lowercase) result = result.toLowerCase();
    if (options.uppercase) result = result.toUpperCase();
    if (options.removeHtml) result = result.replace(/<[^>]*>/g, '');
    if (options.removeScripts) result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    if (options.removeSpecial) result = result.replace(/[^\w\s\u0600-\u06FF.,-]/g, '');
    if (options.maxLength) result = result.substring(0, options.maxLength);
    if (options.persianToEnglish) result = StringUtils.persianToEnglishDigits(result);

    return result;
  }
};

window.ValidationUtils = ValidationUtils;