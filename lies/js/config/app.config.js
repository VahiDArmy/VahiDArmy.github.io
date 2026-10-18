/* ============================================================
   js/config/app.config.js
   COMPLETE FILE - NO TRUNCATION.
   Added SUGGESTIONS route and nav item.
   ============================================================ */

export const APP = Object.freeze({
  name: 'آینهٔ درون',
  fullName: 'دروغ‌هایی که به خودمان می‌گوییم',
  version: '1.0.0',
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
  SUGGESTIONS: 'suggestions', // New Inbox route
});

export const DEFAULT_ROUTE = ROUTES.DASHBOARD;

export const NAV_ITEMS = Object.freeze([
  { id: ROUTES.DASHBOARD, label: 'داشبورد',      icon: '🏠', shortcut: 'G D', group: 'main' },
  { id: ROUTES.LIES,      label: 'دروغ‌ها',      icon: '🎭', shortcut: 'G L', group: 'main', badgeKey: 'lies' },
  { id: ROUTES.SUGGESTIONS, label: 'پیشنهادها',  icon: '📥', shortcut: 'G I', group: 'main', badgeKey: 'suggestions' }, // New
  { id: ROUTES.ANALYTICS, label: 'تحلیل و آمار', icon: '📊', shortcut: 'G A', group: 'main' },
  { id: ROUTES.TAGS,      label: 'دسته‌ها و برچسب‌ها', icon: '🏷️', shortcut: 'G T', group: 'organize' },
  { id: ROUTES.ARCHIVE,   label: 'بایگانی',      icon: '📦', shortcut: 'G R', group: 'organize' },
  { id: ROUTES.TRASH,     label: 'سطل زباله',    icon: '🗑️', shortcut: 'G X', group: 'organize', badgeKey: 'trash' },
  { id: ROUTES.SETTINGS,  label: 'تنظیمات',      icon: '⚙️', shortcut: 'G S', group: 'system' },
  { id: ROUTES.ABOUT,     label: 'درباره',       icon: 'ℹ️', shortcut: 'G H', group: 'system' },
]);

export const LIE_TYPES = Object.freeze([
  { id: 'self_doubt',     label: 'تردید به خود',        icon: '🪞', color: 'var(--cat-1)', description: 'توهم ناتوانی و بی‌کفایتی در برابر چالش‌ها.', example: 'من هیچ‌وقت نمی‌تونم از پس این کار بربیام.' },
  { id: 'procrastination', label: 'به تعویق انداختن',   icon: '⏳', color: 'var(--cat-4)', description: 'فرار از سختیِ لحظه با وعده‌ی فردا.', example: 'فردا با انرژی شروع می‌کنم.' },
  { id: 'denial',         label: 'انکار واقعیت',        icon: '🙈', color: 'var(--cat-7)', description: 'چشم بستن روی حقیقتی که آزاردهنده است.', example: 'مشکلی وجود نداره، همه چیز خوبه.' },
  { id: 'excuse',         label: 'بهانه‌تراشی',         icon: '🧩', color: 'var(--cat-6)', description: 'ساختن دلیل و منطق برای توجیه فرار.', example: 'من وقت کافی برای این کار ندارم.' },
  { id: 'comparison',     label: 'مقایسه با دیگران',    icon: '⚖️', color: 'var(--cat-5)', description: 'احساس کمبود در مقایسه با موفقیت دیگران.', example: 'همه از من موفق‌ترن.' },
  { id: 'perfectionism',  label: 'کمال‌گرایی افراطی',   icon: '💎', color: 'var(--cat-8)', description: 'ترس از ناقص بودن که مانع شروع کار می‌شود.', example: 'اگه کامل نباشه، بی‌ارزشه.' },
  { id: 'avoidance',      label: 'اجتناب',              icon: '🚪', color: 'var(--cat-2)', description: 'دور ماندن از موقعیت‌هایی که ترسناک‌اند.', example: 'من برای این موقعیت ساخته نشدم.' },
  { id: 'control',        label: 'توهم کنترل',          icon: '🎛️', color: 'var(--cat-3)', description: 'باور غلط به اینکه همه‌چیز باید در کنترل ما باشد.', example: 'اگه همه چیز رو خودم مدیریت نکنم، خراب میشه.' },
  { id: 'deserving',      label: 'ناشایستگی',           icon: '🕳️', color: 'var(--cat-1)', description: 'باور ریشه‌ای به اینکه لایق عشق و موفقیت نیستیم.', example: 'من لایق خوشحال بودن نیستم.' },
  { id: 'other',          label: 'دروغ دیگر',           icon: '✳️', color: 'var(--text-tertiary)', description: 'هر دروغی که در دسته‌های بالا نگنجد.', example: 'یک دروغ تازه...' },
]);

export const MOODS = Object.freeze([
  { id: 'calm',     label: 'آرام',       icon: '😌', score:  2, description: 'احساس تعادل و نداشتن تنش.' },
  { id: 'neutral',  label: 'خنثی',       icon: '😐', score:  0, description: 'بدون احساس خاصی، نه خوب و نه بد.' },
  { id: 'anxious',  label: 'مضطرب',      icon: '😰', score: -2, description: 'احساس نگرانی و دلشوره از آینده.' },
  { id: 'sad',      label: 'غمگین',      icon: '😔', score: -1, description: 'احساس اندوه و از دست دادن انرژی.' },
  { id: 'angry',    label: 'خشمگین',     icon: '😠', score: -2, description: 'احساس نارضایتی و فشار درونی.' },
  { id: 'ashamed',  label: 'شرمنده',     icon: '😖', score: -3, description: 'احساس خجالت و قضاوت شدن توسط خود.' },
  { id: 'hopeful',  label: 'امیدوار',    icon: '🌤️', score:  3, description: 'نگاه مثبت و باور به بهتر شدن.' },
  { id: 'proud',    label: 'سربلند',     icon: '🌟', score:  3, description: 'احساس غرور و رضایت از خود.' },
]);

export const LIE_STATUS = Object.freeze({
  ACTIVE: 'active', ARCHIVED: 'archived', TRASHED: 'trashed',
});

export const SORT_OPTIONS = Object.freeze([
  { id: 'created_desc',  label: 'جدیدترین' }, { id: 'created_asc',   label: 'قدیمی‌ترین' },
  { id: 'updated_desc',  label: 'آخرین ویرایش' }, { id: 'occurred_desc', label: 'تاریخ رخداد (نزولی)' },
  { id: 'occurred_asc',  label: 'تاریخ رخداد (صعودی)' }, { id: 'intensity_desc',label: 'شدت (بیشترین)' },
  { id: 'intensity_asc', label: 'شدت (کمترین)' }, { id: 'belief_desc',   label: 'باور (بیشترین)' },
  { id: 'belief_asc',    label: 'باور (کمترین)' }, { id: 'title_asc',     label: 'عنوان (الفبا)' },
]);

export const PAGE_SIZES = Object.freeze([12, 24, 48, 96]);
export const VIEW_MODES = Object.freeze({ GRID: 'grid', LIST: 'list', COMPACT: 'compact', TIMELINE: 'timeline' });
export const TOAST_DURATION = Object.freeze({ short: 2600, normal: 4200, long: 7000, sticky: 0 });

export const LS_KEYS = Object.freeze({
  THEME: 'theme', ACCENT: 'accent', FONT_SIZE: 'fontsize', SIDEBAR_COLLAPSED: 'sidebar:collapsed',
  LIES_VIEW: 'lies:view', LIES_SORT: 'lies:sort', LIES_PAGE_SIZE: 'lies:pagesize', LIES_FILTERS: 'lies:filters',
  LAST_ROUTE: 'route:last', ONBOARDED: 'onboarded', REMEMBER_EMAIL: 'auth:remember-email',
});

export const FEATURES = Object.freeze({
  realtime: false, reminders: true, exportImport: true, keyboardShortcuts: true,
  commandPalette: true, dragAndDrop: true, heatmap: true, charts: true, autoSave: true, offlineQueue: false,
});

export const LIMITS = Object.freeze({
  titleMax: 140, bodyMax: 12000, truthMax: 2000, reflectionMax: 4000,
  tagNameMax: 32, categoryNameMax: 40, displayNameMax: 40,
  maxTagsPerLie: 12, maxCategories: 24, maxTags: 80,
  searchDebounceMs: 280, autosaveDebounceMs: 900, globalSearchLimit: 8,
});

export const STORAGE_QUOTA_BYTES = 50 * 1024 * 1024;