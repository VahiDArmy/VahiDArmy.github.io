/* ============================================================================
   ENV CONFIGURATION
   ----------------------------------------------------------------------------
   این فایل را با مقادیر واقعی Supabase خود جایگزین کنید.
   برای امنیت بیشتر در محیط تولید، از متغیرهای محیطی یا یک پراکسی استفاده کنید.
   ============================================================================ */

(function (window) {
  "use strict";

  window.ENV = {
    /* ---------- Supabase ---------- */
    SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
    SUPABASE_ANON_KEY: "YOUR-PUBLIC-ANON-KEY",

    /* ---------- App metadata ---------- */
    APP_NAME: "سامانه CRM انبار",
    APP_SHORT_NAME: "CRM Inventory",
    APP_VERSION: "1.0.0",
    APP_LOCALE: "fa-IR",
    APP_CALENDAR: "persian",
    APP_DIRECTION: "rtl",

    /* ---------- Feature flags ---------- */
    FEATURES: {
      DEMO_MODE: true,
      REALTIME: true,
      ACTIVITY_LOG: true,
      MULTI_WAREHOUSE: true,
      LOW_STOCK_ALERTS: true,
      COMMAND_PALETTE: true,
      DARK_MODE_ONLY: false,
      EXPORT_PDF: true,
      EXPORT_EXCEL: true,
      EXPORT_CSV: true,
      FILE_UPLOAD: true,
      BARCODE_SCAN: false,
      NOTIFICATIONS: true,
    },

    /* ---------- Pagination defaults ---------- */
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],

    /* ---------- Thresholds ---------- */
    LOW_STOCK_THRESHOLD: 10,
    CRITICAL_STOCK_THRESHOLD: 5,
    DEBOUNCE_DELAY: 320,
    TOAST_DURATION: 4500,
    MODAL_CLOSE_ON_ESC: true,
    MODAL_CLOSE_ON_BACKDROP: true,

    /* ---------- Currency ---------- */
    CURRENCY: {
      code: "IRR",
      symbol: "تومان",
      locale: "fa-IR",
      decimals: 0,
    },

    /* ---------- File upload limits ---------- */
    UPLOAD_MAX_SIZE_MB: 8,
    UPLOAD_ALLOWED_TYPES: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],

    /* ---------- Chart defaults ---------- */
    CHART_COLORS: [
      "#598eff",
      "#06b6d4",
      "#8b5cf6",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#14b8a6",
    ],

    /* ---------- Demo credentials ---------- */
    DEMO_USER: {
      email: "demo@crm.local",
      password: "demo1234",
      full_name: "کاربر نمایشی",
      role: "admin",
    },
  };
})(window);