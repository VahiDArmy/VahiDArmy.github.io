/**
 * ابزارهای عددی
 */
const NumberUtils = {
  /**
   * فرمت عدد با جداکننده
   */
  format(num, decimals = 0, separator = ',') {
    if (num === null || num === undefined) return '';
    const n = Number(num);
    if (isNaN(n)) return String(num);

    const parts = n.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    return parts.join('.');
  },

  /**
   * فرمت فارسی
   */
  formatPersian(num, decimals = 0) {
    const formatted = this.format(num, decimals, '٬');
    return StringUtils.englishToPersianDigits(formatted);
  },

  /**
   * فرمت درصد
   */
  formatPercent(num, decimals = 1) {
    if (num === null || num === undefined) return '';
    return this.formatPersian(Number(num) * 100, decimals) + '٪';
  },

  /**
   * فرمت ارز
   */
  formatCurrency(num, currency = 'تومان') {
    if (num === null || num === undefined) return '';
    return `${this.formatPersian(num)} ${currency}`;
  },

  /**
   * فرمت علمی
   */
  formatScientific(num, precision = 2) {
    if (num === null || num === undefined) return '';
    return Number(num).toExponential(precision);
  },

  /**
   * گرد کردن
   */
  round(num, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  /**
   * حذف اعشار
   */
  floor(num, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
  },

  /**
   * سقف
   */
  ceil(num, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.ceil(num * factor) / factor;
  },

  /**
   * محدودسازی
   */
  clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  },

  /**
   * نقشه‌برداری از یک بازه به بازه دیگر
   */
  map(num, inMin, inMax, outMin, outMax) {
    return ((num - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  },

  /**
   * عدد تصادفی در بازه
   */
  random(min = 0, max = 1, integer = false) {
    const value = Math.random() * (max - min) + min;
    return integer ? Math.floor(value) : value;
  },

  /**
   * عدد تصادفی صحیح
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * انتخاب تصادفی از آرایه
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  },

  /**
   * مقایسه تقریبی
   */
  almostEqual(a, b, epsilon = 1e-10) {
    return Math.abs(a - b) < epsilon;
  },

  /**
   * تشخیص عدد صحیح
   */
  isInteger(num) {
    return Number.isInteger(Number(num));
  },

  /**
   * تشخیص عدد اعشاری
   */
  isFloat(num) {
    const n = Number(num);
    return !isNaN(n) && !Number.isInteger(n);
  },

  /**
   * تشخیص عدد مثبت
   */
  isPositive(num) {
    return Number(num) > 0;
  },

  /**
   * تشخیص عدد منفی
   */
  isNegative(num) {
    return Number(num) < 0;
  },

  /**
   * تشخیص عدد زوج
   */
  isEven(num) {
    return Number(num) % 2 === 0;
  },

  /**
   * تشخیص عدد فرد
   */
  isOdd(num) {
    return Math.abs(Number(num) % 2) === 1;
  },

  /**
   * تشخیص توان دو
   */
  isPowerOfTwo(num) {
    const n = Number(num);
    return n > 0 && (n & (n - 1)) === 0;
  },

  /**
   * مجموع آرایه
   */
  sum(array) {
    return array.reduce((a, b) => a + Number(b || 0), 0);
  },

  /**
   * میانگین
   */
  average(array) {
    if (!array.length) return 0;
    return this.sum(array) / array.length;
  },

  /**
   * میانه
   */
  median(array) {
    if (!array.length) return 0;
    const sorted = [...array].map(Number).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  },

  /**
   * نما (مقدار پرتکرار)
   */
  mode(array) {
    if (!array.length) return null;
    const counts = new Map();
    let maxCount = 0;
    let modes = [];

    array.forEach(v => {
      const key = String(v);
      const count = (counts.get(key) || 0) + 1;
      counts.set(key, count);

      if (count > maxCount) {
        maxCount = count;
        modes = [v];
      } else if (count === maxCount) {
        modes.push(v);
      }
    });

    return modes.length === 1 ? modes[0] : modes;
  },

  /**
   * انحراف معیار
   */
  standardDeviation(array) {
    if (array.length < 2) return 0;
    const mean = this.average(array);
    const squaredDiffs = array.map(v => Math.pow(Number(v) - mean, 2));
    const variance = this.sum(squaredDiffs) / (array.length - 1);
    return Math.sqrt(variance);
  },

  /**
   * واریانس
   */
  variance(array) {
    if (array.length < 2) return 0;
    const mean = this.average(array);
    const squaredDiffs = array.map(v => Math.pow(Number(v) - mean, 2));
    return this.sum(squaredDiffs) / (array.length - 1);
  },

  /**
   * صدک
   */
  percentile(array, p) {
    if (!array.length) return 0;
    const sorted = [...array].map(Number).sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  },

  /**
   * چارک‌ها
   */
  quartiles(array) {
    return {
      q1: this.percentile(array, 25),
      q2: this.percentile(array, 50),
      q3: this.percentile(array, 75),
      iqr: this.percentile(array, 75) - this.percentile(array, 25)
    };
  },

  /**
   * کمینه
   */
  min(array) {
    if (!array.length) return null;
    return Math.min(...array.map(Number).filter(n => !isNaN(n)));
  },

  /**
   * بیشینه
   */
  max(array) {
    if (!array.length) return null;
    return Math.max(...array.map(Number).filter(n => !isNaN(n)));
  },

  /**
   * دامنه
   */
  range(array) {
    const min = this.min(array);
    const max = this.max(array);
    if (min === null || max === null) return null;
    return max - min;
  },

  /**
   * هیستوگرام
   */
  histogram(array, bins = 10) {
    if (!array.length) return [];

    const nums = array.map(Number).filter(n => !isNaN(n));
    if (!nums.length) return [];

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min;
    const binWidth = range / bins;

    const result = Array.from({ length: bins }, (_, i) => ({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      count: 0
    }));

    nums.forEach(n => {
      const index = Math.min(Math.floor((n - min) / binWidth), bins - 1);
      result[index].count++;
    });

    return result;
  },

  /**
   * فراوانی
   */
  frequency(array) {
    const freq = new Map();
    array.forEach(v => {
      const key = String(v);
      freq.set(key, (freq.get(key) || 0) + 1);
    });

    return Array.from(freq.entries())
      .map(([value, count]) => ({ value, count, percentage: (count / array.length) * 100 }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * ضریب تغییرات
   */
  coefficientOfVariation(array) {
    const mean = this.average(array);
    if (mean === 0) return 0;
    return (this.standardDeviation(array) / Math.abs(mean)) * 100;
  },

  /**
   * همبستگی
   */
  correlation(x, y) {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const meanX = this.average(x);
    const meanY = this.average(y);

    let numerator = 0;
    let sumXSq = 0;
    let sumYSq = 0;

    for (let i = 0; i < n; i++) {
      const dx = Number(x[i]) - meanX;
      const dy = Number(y[i]) - meanY;
      numerator += dx * dy;
      sumXSq += dx * dx;
      sumYSq += dy * dy;
    }

    const denominator = Math.sqrt(sumXSq * sumYSq);
    return denominator === 0 ? 0 : numerator / denominator;
  },

  /**
   * تبدیل به فارسی
   */
  toPersian(num) {
    return StringUtils.englishToPersianDigits(String(num));
  },

  /**
   * تبدیل به انگلیسی
   */
  toEnglish(num) {
    return StringUtils.persianToEnglishDigits(String(num));
  },

  /**
   * تجزیه عدد
   */
  parse(str, defaultValue = 0) {
    if (typeof str === 'number') return str;
    const cleaned = StringUtils.persianToEnglishDigits(String(str))
      .replace(/[٬,\s]/g, '')
      .replace(/[۰-۹]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? defaultValue : num;
  },

  /**
   * کوتاه کردن عدد بزرگ
   */
  abbreviate(num, decimals = 1) {
    const n = Number(num);
    if (isNaN(n)) return '';

    const abs = Math.abs(n);
    if (abs < 1000) return this.formatPersian(n);
    if (abs < 1e6) return StringUtils.englishToPersianDigits((n / 1000).toFixed(decimals)) + ' هزار';
    if (abs < 1e9) return StringUtils.englishToPersianDigits((n / 1e6).toFixed(decimals)) + ' میلیون';
    if (abs < 1e12) return StringUtils.englishToPersianDigits((n / 1e9).toFixed(decimals)) + ' میلیارد';
    return StringUtils.englishToPersianDigits((n / 1e12).toFixed(decimals)) + ' تریلیون';
  },

  /**
   * مبدل بایت
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '۰ بایت';
    if (!bytes) return '-';

    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

    return StringUtils.englishToPersianDigits(value) + ' ' + sizes[i];
  },

  /**
   * فیبوناچی
   */
  fibonacci(n) {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  },

  /**
   * فاکتوریل
   */
  factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
};

window.NumberUtils = NumberUtils;