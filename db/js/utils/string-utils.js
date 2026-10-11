/**
 * ابزارهای رشته‌ای
 * توابع کمکی برای کار با رشته‌ها
 */
const StringUtils = {
  /**
   * بزرگ کردن حرف اول
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * کوچک کردن حرف اول
   */
  uncapitalize(str) {
    if (!str) return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  /**
   * تبدیل به camelCase
   */
  camelCase(str) {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  },

  /**
   * تبدیل به snake_case
   */
  snakeCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  },

  /**
   * تبدیل به kebab-case
   */
  kebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
  },

  /**
   * تبدیل به PascalCase
   */
  pascalCase(str) {
    const camel = this.camelCase(str);
    return this.capitalize(camel);
  },

  /**
   * کوتاه کردن متن
   */
  truncate(str, length, suffix = '...') {
    if (!str || str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },

  /**
   * کوتاه کردن از وسط
   */
  truncateMiddle(str, length, separator = '...') {
    if (!str || str.length <= length) return str;
    const half = Math.floor((length - separator.length) / 2);
    return str.substring(0, half) + separator + str.substring(str.length - half);
  },

  /**
   * پاک‌سازی HTML
   */
  stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  },

  /**
   * فرار دادن HTML
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * رفع فرار HTML
   */
  unescapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || '';
  },

  /**
   * تکرار رشته
   */
  repeat(str, count) {
    return str.repeat(count);
  },

  /**
   * پر کردن ابتدای رشته
   */
  padStart(str, length, char = ' ') {
    return String(str).padStart(length, char);
  },

  /**
   * پر کردن انتهای رشته
   */
  padEnd(str, length, char = ' ') {
    return String(str).padEnd(length, char);
  },

  /**
   * حذف فاصله‌های اضافی
   */
  normalizeWhitespace(str) {
    return str.replace(/\s+/g, ' ').trim();
  },

  /**
   * حذف کاراکترهای خاص
   */
  removeSpecialChars(str, keepSpaces = true) {
    const pattern = keepSpaces
      ? /[^a-zA-Z0-9\u0600-\u06FF\s]/g
      : /[^a-zA-Z0-9\u0600-\u06FF]/g;
    return str.replace(pattern, '');
  },

  /**
   * فقط اعداد
   */
  onlyNumbers(str) {
    return str.replace(/\D/g, '');
  },

  /**
   * فقط حروف
   */
  onlyLetters(str) {
    return str.replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
  },

  /**
   * شمارش کاراکترها
   */
  count(str, char) {
    if (!str || !char) return 0;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === char) count++;
    }
    return count;
  },

  /**
   * شمارش کلمات
   */
  wordCount(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).length;
  },

  /**
   * شمارش کاراکترها بدون فاصله
   */
  charCountNoSpaces(str) {
    if (!str) return 0;
    return str.replace(/\s/g, '').length;
  },

  /**
   * تبدیل اعداد فارسی به انگلیسی
   */
  persianToEnglishDigits(str) {
    if (!str) return '';
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    const englishDigits = '0123456789';

    return String(str).replace(/[۰-۹٠-٩]/g, (char) => {
      const pIndex = persianDigits.indexOf(char);
      if (pIndex >= 0) return englishDigits[pIndex];
      const aIndex = arabicDigits.indexOf(char);
      if (aIndex >= 0) return englishDigits[aIndex];
      return char;
    });
  },

  /**
   * تبدیل اعداد انگلیسی به فارسی
   */
  englishToPersianDigits(str) {
    if (!str) return '';
    const englishDigits = '0123456789';
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

    return String(str).replace(/[0-9]/g, (char) => {
      const index = englishDigits.indexOf(char);
      return index >= 0 ? persianDigits[index] : char;
    });
  },

  /**
   * تشخیص متن فارسی
   */
  isPersian(str) {
    if (!str) return false;
    const persianRegex = /[\u0600-\u06FF]/;
    return persianRegex.test(str);
  },

  /**
   * تشخیص متن انگلیسی
   */
  isEnglish(str) {
    if (!str) return false;
    const englishRegex = /^[a-zA-Z0-9\s.,!?;:'"()\-\[\]{}]*$/;
    return englishRegex.test(str);
  },

  /**
   * تشخیص URL
   */
  isUrl(str) {
    try {
      new URL(str);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * تشخیص ایمیل
   */
  isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  },

  /**
   * تشخیص عدد
   */
  isNumeric(str) {
    if (typeof str === 'number') return !isNaN(str);
    if (typeof str !== 'string') return false;
    return !isNaN(parseFloat(str)) && isFinite(str);
  },

  /**
   * تشخیص عدد صحیح
   */
  isInteger(str) {
    return /^-?\d+$/.test(str);
  },

  /**
   * تشخیص اعشاری
   */
  isFloat(str) {
    return /^-?\d*\.\d+$/.test(str);
  },

  /**
   * تشخیص JSON
   */
  isJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * تشخیص تاریخ
   */
  isDate(str) {
    const date = new Date(str);
    return !isNaN(date.getTime());
  },

  /**
   * تولید UUID v4
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * تولید شناسه تصادفی
   */
  randomId(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * تولید رنگ تصادفی
   */
  randomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  },

  /**
   * لیست به رشته
   */
  listToString(list, separator = ', ', lastSeparator = ' و ') {
    if (!list || list.length === 0) return '';
    if (list.length === 1) return String(list[0]);
    if (list.length === 2) return `${list[0]}${lastSeparator}${list[1]}`;

    const allButLast = list.slice(0, -1).join(separator);
    return `${allButLast}${lastSeparator}${list[list.length - 1]}`;
  },

  /**
   * مقایسه طبیعی
   */
  naturalCompare(a, b) {
    return String(a).localeCompare(String(b), 'fa', {
      numeric: true,
      sensitivity: 'base'
    });
  },

  /**
   * slug URL
   */
  slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  /**
   * فاصله‌گذاری اعداد
   */
  formatNumber(num, separator = ',') {
    if (num === null || num === undefined) return '';
    const parts = String(num).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return parts.join('.');
  },

  /**
   * اختصار
   */
  abbreviate(str, maxLength = 30) {
    if (!str) return '';
    if (str.length <= maxLength) return str;

    const words = str.split(/\s+/);
    let result = '';
    for (const word of words) {
      if ((result + ' ' + word).trim().length > maxLength - 3) break;
      result = (result + ' ' + word).trim();
    }
    return result + '...';
  },

  /**
   * هایلایت
   */
  highlight(text, term, className = 'highlight') {
    if (!text || !term) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const escapedTerm = this.escapeHtml(term);
    const regex = new RegExp(`(${this.escapeRegex(escapedTerm)})`, 'gi');

    return escaped.replace(regex, `<span class="${className}">$1</span>`);
  },

  /**
   * فرار دادن Regex
   */
  escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * مقایسه fuzzy
   */
  fuzzyMatch(str, pattern) {
    if (!str || !pattern) return false;
    str = str.toLowerCase();
    pattern = pattern.toLowerCase();

    let patternIdx = 0;
    for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
      if (str[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === pattern.length;
  },

  /**
   * امتیاز fuzzy
   */
  fuzzyScore(str, pattern) {
    if (!str || !pattern) return 0;

    str = str.toLowerCase();
    pattern = pattern.toLowerCase();

    let score = 0;
    let patternIdx = 0;
    let consecutive = 0;

    for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
      if (str[i] === pattern[patternIdx]) {
        score += 1 + consecutive * 2;
        consecutive++;
        patternIdx++;
      } else {
        consecutive = 0;
      }
    }

    if (patternIdx < pattern.length) return 0;
    return score;
  },

  /**
   * شماره‌گذاری
   */
  ordinal(num) {
    const n = parseInt(num, 10);
    if (isNaN(n)) return String(num);

    const suffixes = ['ام', 'اُم'];
    return `${this.englishToPersianDigits(n)}${suffixes[0]}`;
  },

  /**
   * تبدیل بایت به رشته
   */
  bytesToString(bytes, decimals = 2) {
    if (bytes === 0) return '0 بایت';
    if (!bytes) return '-';

    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  },

  /**
   * تبدیل ثانیه به زمان
   */
  secondsToTime(seconds) {
    if (!seconds && seconds !== 0) return '-';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}س ${m}د ${s}ث`;
    }
    if (m > 0) {
      return `${m}د ${s}ث`;
    }
    return `${s}ث`;
  },

  /**
   * تبدیل میلی‌ثانیه
   */
  msToString(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return this.secondsToTime(ms / 1000);
  }
};

window.StringUtils = StringUtils;