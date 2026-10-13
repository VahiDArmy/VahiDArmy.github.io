/**
 * Application-wide constants.
 * Never put secrets here — Supabase URL and anon key live in config/supabase.js
 * (loaded from a gitignored local env file, or provided at build time).
 */

export const APP_NAME = "ردیاب فعالیت روزانه";
export const APP_VERSION = "1.0.0";

/* Meal slots — order is important for display */
export const MEALS = [
  { id: "breakfast", label: "صبحانه",         icon: "sunrise",  order: 1 },
  { id: "snack1",    label: "میان وعده",       icon: "coffee",   order: 2 },
  { id: "lunch",     label: "ناهار",           icon: "sun",      order: 3 },
  { id: "snack2",    label: "میان وعده",       icon: "coffee",   order: 4 },
  { id: "dinner",    label: "شام",             icon: "moon",     order: 5 },
  { id: "snack3",    label: "میان وعده",       icon: "coffee",   order: 6 },
];

/* Health entry kinds */
export const HEALTH_KINDS = {
  INSULIN: "insulin",
  GLUCOSE: "glucose",
  BP: "bp",
  WEIGHT: "weight",
};

/* Insulin types */
export const INSULIN_TYPES = [
  { id: "rapid",   label: "سریع‌الاثر" },
  { id: "short",   label: "کوتاه‌اثر" },
  { id: "inter",   label: "متوسط‌اثر" },
  { id: "long",    label: "طولانی‌اثر" },
  { id: "mixed",   label: "مخلوط" },
  { id: "other",   label: "سایر" },
];

/* Insulin injection sites */
export const INSULIN_SITES = [
  { id: "abdomen",  label: "شکم" },
  { id: "thigh",    label: "ران" },
  { id: "arm",      label: "بازو" },
  { id: "buttock",  label: "باسن" },
];

/* Sleep quality levels */
export const SLEEP_QUALITY = [
  { id: 1, label: "بسیار بد", emoji: "😫", score: 1 },
  { id: 2, label: "بد",       emoji: "😔", score: 2 },
  { id: 3, label: "متوسط",    emoji: "😐", score: 3 },
  { id: 4, label: "خوب",      emoji: "🙂", score: 4 },
  { id: 5, label: "بسیار خوب", emoji: "😄", score: 5 },
];

/* Activity types */
export const ACTIVITY_TYPES = [
  { id: "walk",  label: "پیاده‌روی", icon: "walk",   hasKm: true },
  { id: "run",   label: "دویدن",     icon: "run",    hasKm: true },
  { id: "bike",  label: "دوچرخه",    icon: "bike",   hasKm: true },
  { id: "gym",   label: "باشگاه",    icon: "gym",    hasKm: false },
  { id: "swim",  label: "شنا",       icon: "swim",   hasKm: false },
  { id: "yoga",  label: "یوگا",      icon: "yoga",   hasKm: false },
  { id: "other", label: "سایر",      icon: "other",  hasKm: false },
];

/* Default daily goals */
export const DEFAULT_GOALS = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  fiber: 30,
  water: 8,           // glasses
  steps: 8000,
  sleepHours: 8,
};

/* Storage keys */
export const STORAGE_KEYS = {
  THEME: "app.theme",
  SIDEBAR_COLLAPSED: "app.sidebar.collapsed",
  LAST_PAGE: "app.lastPage",
  SELECTED_DATE: "app.selectedDate",
  GOALS: "app.goals",
  USER_PREFS: "app.userPrefs",
};

/* Date/time formats */
export const DATE_FORMATS = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "long" },
};

/* Toast defaults */
export const TOAST_DEFAULTS = {
  duration: 4200,
  max: 5,
};

/* Route paths */
export const ROUTES = {
  DASHBOARD: "dashboard",
  FOOD: "food",
  HEALTH: "health",
  SLEEP: "sleep",
  ACTIVITY: "activity",
  REPORTS: "reports",
  SETTINGS: "settings",
};

/* Sort directions */
export const SORT = {
  ASC: "asc",
  DESC: "desc",
};

/* Report ranges */
export const REPORT_RANGES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  CUSTOM: "custom",
};