/**
 * constants.js — ثابت‌های سراسری برنامه
 */

export const APP = {
  NAME: 'سلامت‌یار',
  VERSION: '1.0.0',
  LOCALE: 'fa-IR',
  TIMEZONE: 'Asia/Tehran',
  DATA_URL: 'data/foods.json',
};

/* ---------- نام ماه‌ها و روزهای هفته (شمسی) ---------- */
export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const JALALI_WEEKDAYS = [
  'شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه',
];

/* ---------- انواع وعده غذایی ---------- */
export const MEALS = [
  { key: 'breakfast',  title: 'صبحانه',        icon: '🍳', tone: 'amber'  },
  { key: 'snack_am',   title: 'میان‌وعده صبح', icon: '🍎', tone: 'green'  },
  { key: 'lunch',      title: 'ناهار',         icon: '🍲', tone: 'cyan'   },
  { key: 'snack_pm',   title: 'میان‌وعده عصر', icon: '🥜', tone: 'pink'   },
  { key: 'dinner',     title: 'شام',           icon: '🍽',  tone: 'violet' },
  { key: 'snack_night',title: 'میان‌وعده شب',  icon: '🥛', tone: 'teal'   },
];

/* ---------- انواع انسولین ---------- */
export const INSULIN_TYPES = [
  { key: 'rapid',        title: 'سریع‌الاثر' },
  { key: 'short',        title: 'کوتاه‌اثر'  },
  { key: 'intermediate', title: 'متوسط‌اثر'  },
  { key: 'long',         title: 'طولانی‌اثر' },
  { key: 'mixed',        title: 'مخلوط'      },
  { key: 'other',        title: 'سایر'       },
];

export const INJECTION_SITES = [
  { key: 'abdomen', title: 'شکم' },
  { key: 'arm',     title: 'بازو' },
  { key: 'thigh',   title: 'ران' },
  { key: 'other',   title: 'سایر' },
];

/* ---------- زمینه قند خون ---------- */
export const GLUCOSE_CONTEXTS = [
  { key: 'fasting',     title: 'ناشتا' },
  { key: 'before_meal', title: 'قبل غذا' },
  { key: 'after_meal',  title: 'بعد غذا' },
  { key: 'before_sleep',title: 'قبل خواب' },
  { key: 'random',      title: 'اتفاقی' },
];

/* ---------- انواع ورزش ---------- */
export const EXERCISE_TYPES = [
  { key: 'walking',  title: 'پیاده‌روی', icon: '🚶' },
  { key: 'running',  title: 'دویدن',      icon: '🏃' },
  { key: 'cycling',  title: 'دوچرخه',     icon: '🚴' },
  { key: 'swimming', title: 'شنا',        icon: '🏊' },
  { key: 'gym',      title: 'باشگاه',     icon: '🏋' },
  { key: 'yoga',     title: 'یوگا',       icon: '🧘' },
  { key: 'other',    title: 'سایر',       icon: '🎯' },
];

/* ---------- سطوح شدت ورزش ---------- */
export const EXERCISE_INTENSITY = [
  { key: 'light',    title: 'سبک' },
  { key: 'moderate', title: 'متوسط' },
  { key: 'vigorous', title: 'شدید' },
];

/* ---------- موارد دیگر ---------- */
export const OTHER_TAGS = [
  'استرس', 'درد', 'دارو', 'بیماری', 'حالت روحی', 'قاعدگی', 'سایر',
];

/* ---------- وضعیت فشار خون ---------- */
export const BP_POSITIONS = [
  { key: 'sitting',  title: 'نشسته' },
  { key: 'standing', title: 'ایستاده' },
  { key: 'lying',    title: 'خوابیده' },
];

/* ---------- دوره‌های گزارش ---------- */
export const REPORT_PERIODS = [
  { key: 'daily',   title: 'روزانه', icon: '📅' },
  { key: 'weekly',  title: 'هفتگی',  icon: '📆' },
  { key: 'monthly', title: 'ماهانه', icon: '🗓' },
];

/* ---------- واحدها ---------- */
export const UNITS = {
  kcal: 'کیلوکالری',
  g: 'گرم',
  mgdl: 'میلی‌گرم/دسی‌لیتر',
  kg: 'کیلوگرم',
  cm: 'سانتی‌متر',
  km: 'کیلومتر',
  min: 'دقیقه',
  mmhg: 'میلی‌متر جیوه',
  iu: 'واحد',
};

/* ---------- تنظیمات پیش‌فرض ---------- */
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  weekStart: 'saturday',
  activePage: 'dashboard',
  mealTimes: {
    breakfast: '08:00',
    snack_am:  '10:30',
    lunch:     '13:00',
    snack_pm:  '16:30',
    dinner:    '20:00',
    snack_night:'22:30',
  },
  targets: {
    kcal: 2000,
    protein: 100,
    carbs: 250,
    fat: 65,
    fiber: 25,
  },
};

/* ---------- Storage Keys ---------- */
export const LS_KEYS = {
  theme: 'sh-theme',
  user: 'sh-user-cache',
  settings: 'sh-settings',
  recentFoods: 'sh-recent-foods',
  dateView: 'sh-last-date',
};

/* ---------- محدوده‌های قند خون (mg/dL) ---------- */
export const GLUCOSE_RANGE = {
  low: 70,
  high: 180,
  criticalLow: 54,
  criticalHigh: 250,
};

/* ---------- محدوده‌های فشار خون ---------- */
export const BP_RANGE = {
  normalSys: 120, normalDia: 80,
  elevatedSys: 130, elevatedDia: 80,
  high1Sys: 140, high1Dia: 90,
  high2Sys: 160, high2Dia: 100,
};

/* ---------- رنگ‌ها برای نمودارها ---------- */
export const CHART_COLORS = [
  '#22d3ee', '#a855f7', '#f59e0b', '#10b981',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
];