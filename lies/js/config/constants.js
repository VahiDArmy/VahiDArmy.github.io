/* ============================================================
   js/config/constants.js
   COMPLETE FILE - NO TRUNCATION.
   Added new events for suggestions.
   ============================================================ */

export const EVENTS = Object.freeze({
  AUTH_READY: 'auth:ready',
  AUTH_SIGNED_IN: 'auth:signed-in',
  AUTH_SIGNED_OUT: 'auth:signed-out',
  AUTH_ERROR: 'auth:error',
  ROUTE_CHANGED: 'route:changed',
  ROUTE_BEFORE_CHANGE: 'route:before-change',
  LIE_CREATED: 'lie:created',
  LIE_UPDATED: 'lie:updated',
  LIE_DELETED: 'lie:deleted',
  LIE_RESTORED: 'lie:restored',
  LIE_ARCHIVED: 'lie:archived',
  LIE_UNARCHIVED: 'lie:unarchived',
  LIES_REFRESHED: 'lies:refreshed',
  LIES_SELECTION_CHANGED: 'lies:selection-changed',
  TAG_CREATED: 'tag:created',
  TAG_UPDATED: 'tag:updated',
  TAG_DELETED: 'tag:deleted',
  CATEGORY_CREATED: 'category:created',
  CATEGORY_UPDATED: 'category:updated',
  CATEGORY_DELETED: 'category:deleted',
  REFLECTION_CREATED: 'reflection:created',
  REFLECTION_DELETED: 'reflection:deleted',
  THEME_CHANGED: 'ui:theme-changed',
  ACCENT_CHANGED: 'ui:accent-changed',
  FONTSIZE_CHANGED: 'ui:fontsize-changed',
  SIDEBAR_TOGGLED: 'ui:sidebar-toggled',
  TOAST: 'ui:toast',
  MODAL_OPEN: 'ui:modal-open',
  MODAL_CLOSE: 'ui:modal-close',
  LOADING_START: 'ui:loading-start',
  LOADING_END: 'ui:loading-end',
  COMMAND_PALETTE_OPEN: 'ui:command-palette-open',
  ONLINE: 'net:online',
  OFFLINE: 'net:offline',
  SYNC_START: 'sync:start',
  SYNC_END: 'sync:end',
  SUGGESTION_RECEIVED: 'suggestion:received',
  SUGGESTION_ACCEPTED: 'suggestion:accepted',
  SUGGESTION_REJECTED: 'suggestion:rejected',
});

export const TOAST_TYPES = Object.freeze({
  SUCCESS: 'success', ERROR: 'error', WARNING: 'warning', INFO: 'info', LOADING: 'loading',
});

export const MODAL_SIZES = Object.freeze({
  SM: 'sm', MD: 'md', LG: 'lg', XL: 'xl', FULL: 'full',
});

export const CONFIRM_VARIANTS = Object.freeze({
  DEFAULT: 'default', DANGER: 'danger', WARNING: 'warning', SUCCESS: 'success',
});

export const SHORTCUT_SCOPES = Object.freeze({
  GLOBAL: 'global', LIES: 'lies', EDITOR: 'editor', MODAL: 'modal',
});

export const REGEX = Object.freeze({
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  NAME: /^[\p{L}\p{M}\u200c\s'\-_.]{1,60}$/u,
  TAG: /^[\p{L}\p{M}\u200c\s\d_\-]{1,32}$/u,
  URL: /^https?:\/\/[^\s]+$/i,
  PERSIAN_DIGITS: /[۰-۹]/g,
  ARABIC_DIGITS: /[٠-٩]/g,
  HAS_HTML: /<[^>]*>/,
  WHITESPACE: /\s+/g,
});

export const DIGIT_MAP = Object.freeze({
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
});

export const PERSIAN_DIGITS = Object.freeze(['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']);

export const COLOR_PALETTE = Object.freeze([
  '#7c5cff', '#f0619a', '#3ec7a8', '#f0a63e', '#58b3ff', '#c66bf0', '#ff6b6b', '#8fbf4a', '#e0b64a', '#4ad6e0', '#a06bff', '#ff9f5c',
]);

export const FA_WEEKDAYS = Object.freeze(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']);
export const FA_WEEKDAYS_SHORT = Object.freeze(['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']);
export const FA_MONTHS = Object.freeze(['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']);

export const ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: 'invalid_credentials', EMAIL_NOT_CONFIRMED: 'email_not_confirmed', USER_ALREADY_EXISTS: 'user_already_exists',
  WEAK_PASSWORD: 'weak_password', RATE_LIMITED: 'over_request_rate_limit', NETWORK: 'network_error', UNKNOWN: 'unknown_error',
  UNAUTHORIZED: 'unauthorized', NOT_FOUND: 'not_found',
});

export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_CREDENTIALS]: 'ایمیل یا رمز عبور اشتباه است.',
  [ERROR_CODES.EMAIL_NOT_CONFIRMED]: 'ایمیل شما تأیید نشده است. صندوق ورودی خود را بررسی کنید.',
  [ERROR_CODES.USER_ALREADY_EXISTS]: 'این ایمیل قبلاً ثبت شده است.',
  [ERROR_CODES.WEAK_PASSWORD]: 'رمز عبور ضعیف است. حداقل ۸ کاراکتر با ترکیب حروف و اعداد.',
  [ERROR_CODES.RATE_LIMITED]: 'تلاش‌های بیش از حد. لطفاً چند دقیقه صبر کنید.',
  [ERROR_CODES.NETWORK]: 'اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.',
  [ERROR_CODES.UNKNOWN]: 'خطای ناشناخته رخ داد. دوباره تلاش کنید.',
  [ERROR_CODES.UNAUTHORIZED]: 'دسترسی غیرمجاز. لطفاً دوباره وارد شوید.',
  [ERROR_CODES.NOT_FOUND]: 'موردی یافت نشد.',
});

export const TABLES = Object.freeze({
  PROFILES: 'profiles', LIES: 'lies', CATEGORIES: 'categories', TAGS: 'tags', LIE_TAGS: 'lie_tags',
  REFLECTIONS: 'reflections', SETTINGS: 'user_settings', ACTIVITY: 'activity_log', SUGGESTIONS: 'lie_suggestions',
});

export const CLS = Object.freeze({
  SELECTED: 'is-selected', ACTIVE: 'is-active', OPEN: 'is-open', LOADING: 'is-loading',
  DISABLED: 'is-disabled', DRAGGING: 'is-dragging', DROP_TARGET: 'is-drop-target', COLLAPSED: 'is-collapsed', HIDDEN: 'is-hidden',
});