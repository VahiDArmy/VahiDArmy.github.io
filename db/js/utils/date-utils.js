/**
 * ابزارهای تاریخ و زمان
 * پشتیبانی کامل از تاریخ شمسی و میلادی
 */
const DateUtils = {
  PERSIAN_MONTHS: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
  PERSIAN_WEEKDAYS: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  PERSIAN_WEEKDAYS_SHORT: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],

  /**
   * تبدیل میلادی به شمسی
   */
  toPersian(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;

    let gy = d.getFullYear();
    let gm = d.getMonth() + 1;
    const gd = d.getDate();

    let jy, jm, jd;

    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    let gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];

    jy = -1595 + (33 * Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;

    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    if (days < 186) {
      jm = 1 + Math.floor(days / 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + Math.floor((days - 186) / 30);
      jd = 1 + ((days - 186) % 30);
    }

    return { year: jy, month: jm, day: jd };
  },

  /**
   * تبدیل شمسی به میلادی
   */
  toGregorian(jy, jm, jd) {
    let gy, gm, gd;

    jy += 1595;
    let days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);

    gy = 400 * Math.floor(days / 146097);
    days %= 146097;

    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }

    gy += 4 * Math.floor(days / 1461);
    days %= 1461;

    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    gd = days + 1;

    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) {
      gd -= sal_a[gm];
    }

    return new Date(gy, gm - 1, gd);
  },

  /**
   * فرمت شمسی
   */
  formatPersian(date, format = 'YYYY/MM/DD') {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const persian = this.toPersian(d);
    if (!persian) return '';

    const { year, month, day } = persian;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    const map = {
      'YYYY': year,
      'YY': String(year).slice(-2),
      'MM': String(month).padStart(2, '0'),
      'M': month,
      'MMM': this.PERSIAN_MONTHS[month - 1],
      'MMMM': this.PERSIAN_MONTHS[month - 1],
      'DD': String(day).padStart(2, '0'),
      'D': day,
      'HH': hours,
      'H': d.getHours(),
      'mm': minutes,
      'm': d.getMinutes(),
      'ss': seconds,
      's': d.getSeconds(),
      'dddd': this.PERSIAN_WEEKDAYS[d.getDay()],
      'ddd': this.PERSIAN_WEEKDAYS_SHORT[d.getDay()]
    };

    return format.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D|HH|H|mm|m|ss|s|dddd|ddd/g, (match) => map[match]);
  },

  /**
   * فرمت میلادی
   */
  formatGregorian(date, format = 'YYYY-MM-DD') {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();

    const map = {
      'YYYY': year,
      'YY': String(year).slice(-2),
      'MM': String(month).padStart(2, '0'),
      'M': month,
      'DD': String(day).padStart(2, '0'),
      'D': day,
      'HH': String(hours).padStart(2, '0'),
      'H': hours,
      'mm': String(minutes).padStart(2, '0'),
      'm': minutes,
      'ss': String(seconds).padStart(2, '0'),
      's': seconds
    };

    return format.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, (match) => map[match]);
  },

  /**
   * فرمت نسبی (چند لحظه پیش)
   */
  formatRelative(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const diff = Date.now() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 5) return 'همین الان';
    if (seconds < 60) return `${StringUtils.englishToPersianDigits(seconds)} ثانیه پیش`;
    if (minutes < 60) return `${StringUtils.englishToPersianDigits(minutes)} دقیقه پیش`;
    if (hours < 24) return `${StringUtils.englishToPersianDigits(hours)} ساعت پیش`;
    if (days < 30) return `${StringUtils.englishToPersianDigits(days)} روز پیش`;
    if (months < 12) return `${StringUtils.englishToPersianDigits(months)} ماه پیش`;
    return `${StringUtils.englishToPersianDigits(years)} سال پیش`;

    return '';
  },

  /**
   * فرمت هوشمند
   */
  formatSmart(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diff = now - d;
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && d.getDate() === now.getDate()) {
      return `امروز ${this.formatPersian(d, 'HH:mm')}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
      return `دیروز ${this.formatPersian(d, 'HH:mm')}`;
    }

    if (diff < 7 * oneDay) {
      return this.formatPersian(d, 'dddd HH:mm');
    }

    return this.formatPersian(d, 'YYYY/MM/DD');
  },

  /**
   * تاریخ امروز شمسی
   */
  today() {
    return this.toPersian(new Date());
  },

  /**
   * زمان فعلی
   */
  now() {
    return new Date();
  },

  /**
   * زمان فعلی به فرمت
   */
  nowFormatted(format = 'YYYY/MM/DD HH:mm:ss') {
    return this.formatPersian(new Date(), format);
  },

  /**
   * مدت زمان بین دو تاریخ
   */
  duration(from, to = new Date()) {
    const f = from instanceof Date ? from : new Date(from);
    const t = to instanceof Date ? to : new Date(to);

    const diff = Math.abs(t - f);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return { days, hours, minutes, seconds, milliseconds: diff };
  },

  /**
   * افزودن روز
   */
  addDays(date, days) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  /**
   * افزودن ماه
   */
  addMonths(date, months) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },

  /**
   * افزودن سال
   */
  addYears(date, years) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  },

  /**
   * ابتدای روز
   */
  startOfDay(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * پایان روز
   */
  endOfDay(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  /**
   * ابتدای ماه
   */
  startOfMonth(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * پایان ماه
   */
  endOfMonth(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  /**
   * تعداد روزهای ماه شمسی
   */
  persianDaysInMonth(year, month) {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    return this.isPersianLeapYear(year) ? 30 : 29;
  },

  /**
   * سال کبیسه شمسی
   */
  isPersianLeapYear(year) {
    const mod = year % 33;
    return [1, 5, 9, 13, 17, 22, 26, 30].includes(mod);
  },

  /**
   * تبدیل timestamp به فرمت
   */
  fromTimestamp(timestamp, format = 'YYYY/MM/DD HH:mm') {
    return this.formatPersian(new Date(timestamp), format);
  },

  /**
   * فرمت ISO
   */
  toISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString();
  },

  /**
   * تجزیه تاریخ ISO
   */
  fromISO(iso) {
    return new Date(iso);
  },

  /**
   * زمان خوانا
   */
  humanizeDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${StringUtils.englishToPersianDigits(days)} روز و ${StringUtils.englishToPersianDigits(hours % 24)} ساعت`;
    if (hours > 0) return `${StringUtils.englishToPersianDigits(hours)} ساعت و ${StringUtils.englishToPersianDigits(minutes % 60)} دقیقه`;
    if (minutes > 0) return `${StringUtils.englishToPersianDigits(minutes)} دقیقه`;
    if (seconds > 0) return `${StringUtils.englishToPersianDigits(seconds)} ثانیه`;
    return `${StringUtils.englishToPersianDigits(ms)} میلی‌ثانیه`;
  },

  /**
   * مدت زمان اجرا
   */
  formatExecutionTime(ms) {
    if (ms < 1) return '< ۱ میلی‌ثانیه';
    if (ms < 1000) return `${StringUtils.englishToPersianDigits(ms.toFixed(2))} میلی‌ثانیه`;
    return `${StringUtils.englishToPersianDigits((ms / 1000).toFixed(3))} ثانیه`;
  }
};

window.DateUtils = DateUtils;