/* ==========================================================================
   Config — Constants
   App-wide fixed values. Do not put mutable state here.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  App.Constants = {
    APP_NAME: 'تحلیل‌گر داده',
    APP_VERSION: '1.0.0',
    APP_DESCRIPTION: 'ابزار حرفه‌ای برازش منحنی و تحلیل داده',

    /* ---------- Storage keys ---------- */
    STORAGE_KEYS: {
      DATA: 'app.data.v1',
      DATA_META: 'app.data.meta.v1',
      SETTINGS: 'app.settings.v1',
      LAST_FIT: 'app.lastFit.v1',
      SAVED_FITS: 'app.savedFits.v1'
    },

    /* ---------- Defaults ---------- */
    DEFAULTS: {
      TABLE_ROWS: 10,
      TABLE_COLS: 2,
      NEW_ROW_CELLS: 2,
      MAX_UNDO_STACK: 50,
      AUTOSAVE_DEBOUNCE_MS: 800,
      SEARCH_DEBOUNCE_MS: 180,
      TOAST_DEFAULT_DURATION: 4500,
      DEFAULT_DECIMALS: 4,
      DEFAULT_POLY_ORDER: 2,
      DEFAULT_MA_WINDOW: 3,
      MAX_POLY_ORDER: 10,
      MIN_MA_WINDOW: 2,
      MAX_MA_WINDOW: 100,
      DEFAULT_COL_WIDTH: 110,
      MIN_COL_WIDTH: 60,
      MAX_COL_WIDTH: 400,
      ROW_NUMBER_WIDTH: 44
    },

    /* ---------- Limits ---------- */
    LIMITS: {
      MAX_ROWS: 10000,
      MAX_COLS: 200,
      MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB
      MAX_PREVIEW_ROWS: 500,
      MAX_PLOT_POINTS: 2000
    },

    /* ---------- Event names (pub/sub) ---------- */
    EVENTS: {
      // Data
      DATA_CHANGED: 'data:changed',
      DATA_LOADED: 'data:loaded',
      DATA_CLEARED: 'data:cleared',
      DATA_CELL_EDITED: 'data:cellEdited',
      DATA_ROW_ADDED: 'data:rowAdded',
      DATA_ROW_REMOVED: 'data:rowRemoved',
      DATA_COL_ADDED: 'data:colAdded',
      DATA_COL_REMOVED: 'data:colRemoved',
      DATA_SELECTION_CHANGED: 'data:selectionChanged',

      // Fits
      FIT_RUN: 'fit:run',
      FIT_COMPLETE: 'fit:complete',
      FIT_ERROR: 'fit:error',
      FIT_CONFIG_CHANGED: 'fit:configChanged',

      // UI
      TOAST_SHOW: 'ui:toastShow',
      MODAL_OPEN: 'ui:modalOpen',
      MODAL_CLOSE: 'ui:modalClose',
      TAB_CHANGED: 'ui:tabChanged',

      // Settings
      SETTINGS_CHANGED: 'settings:changed',

      // Misc
      EXPORT_START: 'export:start',
      EXPORT_DONE: 'export:done',
      EXPORT_ERROR: 'export:error'
    },

    /* ---------- Tab ids ---------- */
    TABS: ['data', 'fitting', 'results', 'settings'],

    /* ---------- Column data types ---------- */
    COLUMN_TYPES: {
      NUMBER: 'number',
      TEXT: 'text',
      EMPTY: 'empty',
      MIXED: 'mixed'
    },

    /* ---------- Keyboard shortcuts ---------- */
    SHORTCUTS: [
      { keys: ['Ctrl', 'S'], action: 'save', label: 'ذخیره در حافظه' },
      { keys: ['Ctrl', 'Z'], action: 'undo', label: 'واگرد' },
      { keys: ['Ctrl', 'Y'], action: 'redo', label: 'ازنو' },
      { keys: ['Ctrl', 'O'], action: 'import', label: 'ورود از اکسل' },
      { keys: ['Ctrl', 'E'], action: 'export', label: 'خروجی اکسل' },
      { keys: ['Ctrl', 'Enter'], action: 'runFit', label: 'اجرای برازش' },
      { keys: ['Ctrl', 'K'], action: 'search', label: 'جستجو' },
      { keys: ['Delete'], action: 'deleteSelection', label: 'حذف سلول‌های انتخاب‌شده' },
      { keys: ['Escape'], action: 'closeOverlay', label: 'بستن پنجره' },
      { keys: ['?'], action: 'help', label: 'راهنما' }
    ]
  };
})(window);