/**
 * Application-wide constants.
 */

export const APP_NAME = "ردیاب فعالیت روزانه";
export const APP_VERSION = "2.0.0";

/* Meal slots */
export const MEALS = [
  { id: "breakfast", label: "صبحانه",   icon: "sunrise", order: 1 },
  { id: "snack1",    label: "میان‌وعده", icon: "coffee",  order: 2 },
  { id: "lunch",     label: "ناهار",     icon: "sun",     order: 3 },
  { id: "snack2",    label: "میان‌وعده", icon: "coffee",  order: 4 },
  { id: "dinner",    label: "شام",       icon: "moon",    order: 5 },
  { id: "snack3",    label: "میان‌وعده", icon: "coffee",  order: 6 },
];

/* -------------------------------------------------------------
   Subjects — the top-level sections the app is organized around.
   Each subject has:
     id       — matches ROUTES + page module + route hash
     label    — Persian label
     icon     — icon name from components/icons.js
     gradient — CSS gradient used for the subject button + menu tile
     accent   — single accent color (for small chips, borders)
   ------------------------------------------------------------- */
export const SUBJECTS = [
  {
    id: "dashboard",
    label: "داشبورد",
    icon: "dashboard",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    accent: "#6366f1",
  },
  {
    id: "food",
    label: "غذا",
    icon: "utensils",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
    accent: "#f59e0b",
  },
  {
    id: "health",
    label: "سلامت",
    icon: "heartPulse",
    gradient: "linear-gradient(135deg, #10b981 0%, #22d3ee 100%)",
    accent: "#10b981",
  },
  {
    id: "sleep",
    label: "خواب",
    icon: "moon",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
    accent: "#8b5cf6",
  },
  {
    id: "activity",
    label: "فعالیت",
    icon: "activity",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
    accent: "#22d3ee",
  },
  {
    id: "reports",
    label: "گزارش‌ها",
    icon: "barChart",
    gradient: "linear-gradient(135deg, #ec4899 0%, #ef4444 100%)",
    accent: "#ec4899",
  },
];

export function getSubject(id) {
  return SUBJECTS.find((s) => s.id === id) || SUBJECTS[0];
}

/* Health entry kinds */
export const HEALTH_KINDS = {
  INSULIN: "insulin",
  GLUCOSE: "glucose",
  BP: "bp",
  WEIGHT: "weight",
};

export const INSULIN_TYPES = [
  { id: "rapid", label: "سریع‌الاثر" },
  { id: "short", label: "کوتاه‌اثر" },
  { id: "inter", label: "متوسط‌اثر" },
  { id: "long", label: "طولانی‌اثر" },
  { id: "mixed", label: "مخلوط" },
  { id: "other", label: "سایر" },
];

export const INSULIN_SITES = [
  { id: "abdomen", label: "شکم" },
  { id: "thigh", label: "ران" },
  { id: "arm", label: "بازو" },
  { id: "buttock", label: "باسن" },
];

export const SLEEP_QUALITY = [
  { id: 1, label: "بسیار بد", emoji: "😫", score: 1 },
  { id: 2, label: "بد",       emoji: "😔", score: 2 },
  { id: 3, label: "متوسط",    emoji: "😐", score: 3 },
  { id: 4, label: "خوب",      emoji: "🙂", score: 4 },
  { id: 5, label: "بسیار خوب", emoji: "😄", score: 5 },
];

export const ACTIVITY_TYPES = [
  { id: "walk",  label: "پیاده‌روی", icon: "walk",  hasKm: true },
  { id: "run",   label: "دویدن",     icon: "run",   hasKm: true },
  { id: "bike",  label: "دوچرخه",    icon: "bike",  hasKm: true },
  { id: "gym",   label: "باشگاه",    icon: "dumbbell", hasKm: false },
  { id: "swim",  label: "شنا",       icon: "droplet",  hasKm: false },
  { id: "yoga",  label: "یوگا",      icon: "heart", hasKm: false },
  { id: "other", label: "سایر",      icon: "activity", hasKm: false },
];

export const DEFAULT_GOALS = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  fiber: 30,
  water: 8,
  steps: 8000,
  sleepHours: 8,
};

export const STORAGE_KEYS = {
  THEME: "app.theme",
  LAST_PAGE: "app.lastPage",
  SELECTED_DATE: "app.selectedDate",
  GOALS: "app.goals",
  USER_PREFS: "app.userPrefs",
};

export const TOAST_DEFAULTS = {
  duration: 4200,
  max: 5,
};

export const ROUTES = {
  DASHBOARD: "dashboard",
  FOOD: "food",
  HEALTH: "health",
  SLEEP: "sleep",
  ACTIVITY: "activity",
  REPORTS: "reports",
  SETTINGS: "settings",
};

export const SORT = { ASC: "asc", DESC: "desc" };

export const REPORT_RANGES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};