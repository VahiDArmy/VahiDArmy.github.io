/* ============================================================
   js/config/app.config.js
   Application-level configuration
   ============================================================ */

export const APP = Object.freeze({
  name: 'آینهٔ درون',
  fullName: 'دروغ‌هایی که به خودمان می‌گوییم',
  version: '0.1.0',
  build: 'dev',
  defaultLocale: 'fa-IR',
  defaultDir: 'rtl',
  storagePrefix: 'az:',
});

export const ROUTES = Object.freeze({
  DASHBOARD: 'dashboard',
  LIES: 'lies',
  LIE: 'lie',
  ANALYTICS: 'analytics',
  TAGS: 'tags',
  ARCHIVE: 'archive',
  TRASH: 'trash',
  SETTINGS: 'settings',
  ABOUT: 'about',
});

export const DEFAULT_ROUTE = ROUTES.DASHBOARD;

/** Sidebar navigation definition. */
export const NAV_ITEMS = Object.freeze([
  { id: ROUTES.DASHBOARD, label: 'داشبورد',      icon: '🏠', shortcut: 'G D', group: 'main' },
  { id: ROUTES.LIES,      label: 'دروغ‌ها',      icon: '🎭', shortcut: 'G L', group: 'main', badgeKey: 'lies' },
  { id: ROUTES.ANALYTICS, label: 'تحلیل و آمار', icon: '📊', shortcut: 'G A', group: 'main' },
  { id: ROUTES.TAGS,      label: 'دسته‌ها و برچسب‌ها', icon: '🏷️', shortcut: 'G T', group: 'organize' },
  { id: ROUTES.ARCHIVE,   label: 'بایگانی',      icon: '📦', shortcut: 'G R', group: 'organize' },
  { id: ROUTES.TRASH,     label: 'سطل زباله',    icon: '🗑️', shortcut: 'G X', group: 'organize', badgeKey: 'trash' },
  { id: ROUTES.SETTINGS,  label: 'تنظیمات',      icon: '⚙️', shortcut: 'G S', group: 'system' },
  { id: ROUTES.ABOUT,     label: 'درباره',       icon: 'ℹ️', shortcut: 'G H', group: 'system' },
]);

/** Lie "type" taxonomy — used in the editor and analytics. */
export const LIE_TYPES = Object.freeze([
  { id: 'self_doubt',   label: 'تردید به خود',        icon: '🪞', color: 'var(--cat-1)' },
  { id: 'procrastination', label: 'به تعویق انداختن', icon: '⏳', color: 'var(--cat-4)' },
  { id: 'denial',       label: 'انکار واقعیت',        icon: '🙈', color: 'var(--cat-7)' },
  { id: 'excuse',       label: 'بهانه‌تراشی',         icon: '🧩', color: 'var(--cat-6)' },
  { id: 'comparison',   label: 'مقایسه با دیگران',    icon: '⚖️', color: 'var(--cat-5)' },
  { id: 'perfectionism',label: 'کمال‌گرایی افراطی',   icon: '💎', color: 'var(--cat-8)' },
  { id: 'avoidance',    label: 'اجتناب',              icon: '🚪', color: 'var(--cat-2)' },
  { id: 'control',      label: 'توهم کنترل',          icon: '🎛️', color: 'var(--cat-3)' },
  { id: 'deserving',    label: 'ناشایستگی',           icon: '🕳️', color: 'var(--cat-1)' },
  { id: 'other',        label: 'دیگر',                icon: '✳️', color: 'var(--text-tertiary)' },
]);

/** Emotional tones that can be attached to a lie. */
export const MOODS = Object.freeze([
  { id: 'calm',     label: 'آرام',       icon: '😌', score:  2 },
  { id: 'neutral',  label: 'خنثی',       icon: '😐', score:  0 },
  { id: 'anxious',  label: 'مضطرب',      icon: '😰', score: -2 },
  { id: 'sad',      label: 'غمگین',      icon: '😔', score: -1 },
  { id: 'angry',    label: 'خشمگین',     icon: '😠', score: -2 },
  { id: 'ashamed',  label: 'شرمنده',     icon: '😖', score: -3 },
  { id: 'hopeful',  label: 'امیدوار',    icon: '🌤️', score:  3 },
  { id: 'proud',    label: 'سربلند',     icon: '🌟', score:  3 },
]);

/** Statuses a lie can be in. */
export const LIE_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  TRASHED: 'trashed',
});

/** Sorting options for the lies list. */
export const SORT_OPTIONS = Object.freeze([
  { id: 'created_desc',  label: 'جدیدترین' },
  { id: 'created_asc',   label: 'قدیمی‌ترین' },
  { id: 'updated_desc',  label: 'آخرین ویرایش' },
  { id: 'occurred_desc', label: 'تاریخ رخداد (نزولی)' },
  { id: 'occurred_asc',  label: 'تاریخ رخداد (صعودی)' },
  { id: 'intensity_desc',label: 'شدت (بیشترین)' },
  { id: 'intensity_asc', label: 'شدت (کمترین)' },
  { id: 'belief_desc',   label: 'باور (بیشترین)' },
  { id: 'belief_asc',    label: 'باور (کمترین)' },
  { id: 'title_asc',     label: 'عنوان (الفبا)' },
]);

/** Page sizes available in the lies list. */
export const PAGE_SIZES = Object.freeze([12, 24, 48, 96]);

/** View modes for the lies list. */
export const VIEW_MODES = Object.freeze({
  GRID: 'grid',
  LIST: 'list',
  COMPACT: 'compact',
  TIMELINE: 'timeline',
});

/** Toast default durations (ms). */
export const TOAST_DURATION = Object.freeze({
  short: 2600,
  normal: 4200,
  long: 7000,
  sticky: 0,
});

/** LocalStorage keys (prefixed). */
export const LS_KEYS = Object.freeze({
  THEME: 'theme',
  ACCENT: 'accent',
  FONT_SIZE: 'fontsize',
  SIDEBAR_COLLAPSED: 'sidebar:collapsed',
  LIES_VIEW: 'lies:view',
  LIES_SORT: 'lies:sort',
  LIES_PAGE_SIZE: 'lies:pagesize',
  LIES_FILTERS: 'lies:filters',
  LAST_ROUTE: 'route:last',
  ONBOARDED: 'onboarded',
  REMEMBER_EMAIL: 'auth:remember-email',
});

/** Feature flags — flip to enable/disable subsystems. */
export const FEATURES = Object.freeze({
  realtime: false,
  reminders: true,
  exportImport: true,
  keyboardShortcuts: true,
  commandPalette: true,
  dragAndDrop: true,
  heatmap: true,
  charts: true,
  autoSave: true,
  offlineQueue: false,
});

/** Limits to keep the UI sane & protect the DB. */
export const LIMITS = Object.freeze({
  titleMax: 140,
  bodyMax: 12000,
  truthMax: 2000,
  reflectionMax: 4000,
  tagNameMax: 32,
  categoryNameMax: 40,
  displayNameMax: 40,
  maxTagsPerLie: 12,
  maxCategories: 24,
  maxTags: 80,
  searchDebounceMs: 280,
  autosaveDebounceMs: 900,
  globalSearchLimit: 8,
});

/** Storage quota assumption for the sidebar progress meter (bytes). */
export const STORAGE_QUOTA_BYTES = 50 * 1024 * 1024;