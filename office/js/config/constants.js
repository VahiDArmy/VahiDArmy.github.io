/**
 * Global constants
 */

export const APP_NAME = 'The Office';
export const APP_NAME_FA = 'اداره';
export const APP_VERSION = '0.1.0';

export const ROUTES = Object.freeze({
  HOME: '/',
  PEOPLE: '/people',
  PERSON: (id = ':id') => `/people/${id}`,
  
  THEORIES: '/theories',
  THEORY: (id = ':id') => `/theories/${id}`,

  TELLALLS: '/tellalls',
  TELLALL: (id = ':id') => `/tellalls/${id}`,

  CHARACTEROLOGY: '/characterology',
  CHARACTEROLOGY_DETAIL: (id = ':id') => `/characterology/${id}`,
  
  RANKINGS: '/rankings',
  RANKING: (id = ':id') => `/rankings/${id}`,
  TABLES: '/tables',
  TABLE: (id = ':id') => `/tables/${id}`,
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  AUTH_CALLBACK: '/auth/callback',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  NOT_FOUND: '/404',
});

export const NAV_ITEMS = Object.freeze([
  { key: 'home',           label: 'خانه',        href: ROUTES.HOME,           icon: 'home' },
  { key: 'people',         label: 'افراد',       href: ROUTES.PEOPLE,         icon: 'users' },
  { key: 'theories',       label: 'نظریه‌ها',     href: ROUTES.THEORIES,       icon: 'lightbulb' },
  { key: 'tellalls',       label: 'بگایی‌ها',     href: ROUTES.TELLALLS,       icon: 'message' },
  { key: 'characterology', label: 'شخصیت شناسی', href: ROUTES.CHARACTEROLOGY, icon: 'user' },
  { key: 'rankings',       label: 'رتبه‌بندی',   href: ROUTES.RANKINGS,       icon: 'trophy' },
  { key: 'tables',         label: 'جدول‌ها',     href: ROUTES.TABLES,         icon: 'table' },
  // لینک جدید به مینی‌اپلیکیشن ماداکتو
  { key: 'madacto',        label: 'رزرو غذا',    href: '../madacto/index.html', icon: 'message', isExternal: true },
]);

export const THEMES = Object.freeze({ LIGHT: 'light', DARK: 'dark' });

export const STORAGE_KEYS = Object.freeze({
  THEME: 'office.theme',
  LAST_ROUTE: 'office.lastRoute',
  SIDEBAR_OPEN: 'office.sidebarOpen',
  USER_PREFS: 'office.userPrefs',
});

export const PAGE_SIZES = Object.freeze([12, 24, 48, 96]);
export const DEFAULT_PAGE_SIZE = 12;

export const SORT_DIRECTIONS = Object.freeze({ ASC: 'asc', DESC: 'desc' });

export const PEOPLE_STATUS = Object.freeze({
  IN_SITE: 'in_site',
  NOT_IN_SITE: 'not_in_site',
  FORMER: 'former',
});

export const PEOPLE_STATUS_LABELS = Object.freeze({
  in_site: 'در سایت',
  not_in_site: 'خارج از سایت',
  former: 'سابق',
});

export const THEORY_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const THEORY_STATUS_LABELS = Object.freeze({
  draft: 'پیش‌نویس',
  published: 'منتشرشده',
  archived: 'بایگانی',
});

export const COLUMN_TYPES = Object.freeze({
  TEXT: 'text',
  LONG_TEXT: 'long_text',
  NUMBER: 'number',
  DATE: 'date',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  CHECKBOX: 'checkbox',
  PERSON_REF: 'person_ref',
  URL: 'url',
});

export const COLUMN_TYPE_LABELS = Object.freeze({
  text: 'متن',
  long_text: 'متن بلند',
  number: 'عدد',
  date: 'تاریخ',
  select: 'انتخابی',
  multi_select: 'چندانتخابی',
  checkbox: 'چک‌باکس',
  person_ref: 'ارجاع به فرد',
  url: 'لینک',
});

export const TOAST_TYPES = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

export const TOAST_DURATION = 3800;

export const IMAGE_MAX_MB = 5;
export const AVATAR_BUCKET = 'avatars';
export const ATTACHMENT_BUCKET = 'attachments';