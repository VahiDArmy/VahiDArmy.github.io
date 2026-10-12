/* ============================================================================
   APP CONSTANTS
   ============================================================================ */

(function (window) {
  "use strict";

  const C = {
    /* ---------- Routes ---------- */
    ROUTES: {
      DASHBOARD: "dashboard",
      PRODUCTS: "products",
      INVENTORY: "inventory",
      ORDERS: "orders",
      CUSTOMERS: "customers",
      SUPPLIERS: "suppliers",
      WAREHOUSES: "warehouses",
      REPORTS: "reports",
      ACTIVITY_LOG: "activity-log",
      SETTINGS: "settings",
      NOT_FOUND: "not-found",
    },

    /* ---------- Order status ---------- */
    ORDER_STATUS: {
      DRAFT: "draft",
      PENDING: "pending",
      CONFIRMED: "confirmed",
      SHIPPED: "shipped",
      DELIVERED: "delivered",
      CANCELLED: "cancelled",
      RETURNED: "returned",
    },

    ORDER_STATUS_LABEL: {
      draft: "پیش‌نویس",
      pending: "در انتظار",
      confirmed: "تأیید شده",
      shipped: "ارسال شده",
      delivered: "تحویل شده",
      cancelled: "لغو شده",
      returned: "مرجوعی",
    },

    ORDER_STATUS_TONE: {
      draft: "neutral",
      pending: "warning",
      confirmed: "info",
      shipped: "info",
      delivered: "success",
      cancelled: "danger",
      returned: "danger",
    },

    /* ---------- Movement types ---------- */
    MOVEMENT_TYPE: {
      IN: "in",
      OUT: "out",
      ADJUST: "adjust",
      TRANSFER: "transfer",
      RETURN: "return",
    },

    MOVEMENT_TYPE_LABEL: {
      in: "ورود کالا",
      out: "خروج کالا",
      adjust: "تعدیل موجودی",
      transfer: "انتقال بین انبار",
      return: "مرجوعی",
    },

    /* ---------- User roles ---------- */
    ROLES: {
      ADMIN: "admin",
      MANAGER: "manager",
      OPERATOR: "operator",
      VIEWER: "viewer",
    },

    ROLE_LABEL: {
      admin: "مدیر کل",
      manager: "مدیر",
      operator: "اپراتور",
      viewer: "بازدیدکننده",
    },

    /* ---------- Product status ---------- */
    PRODUCT_STATUS: {
      ACTIVE: "active",
      INACTIVE: "inactive",
      DISCONTINUED: "discontinued",
    },

    PRODUCT_STATUS_LABEL: {
      active: "فعال",
      inactive: "غیرفعال",
      discontinued: "متوقف‌شده",
    },

    /* ---------- Customer types ---------- */
    CUSTOMER_TYPE: {
      INDIVIDUAL: "individual",
      COMPANY: "company",
      GOVERNMENT: "government",
    },

    CUSTOMER_TYPE_LABEL: {
      individual: "شخص حقیقی",
      company: "شرکت",
      government: "دولتی",
    },

    /* ---------- Activity log actions ---------- */
    LOG_ACTION: {
      CREATE: "create",
      UPDATE: "update",
      DELETE: "delete",
      LOGIN: "login",
      LOGOUT: "logout",
      EXPORT: "export",
      IMPORT: "import",
      ADJUST: "adjust",
      TRANSFER: "transfer",
    },

    LOG_ACTION_LABEL: {
      create: "ایجاد",
      update: "ویرایش",
      delete: "حذف",
      login: "ورود به سیستم",
      logout: "خروج از سیستم",
      export: "خروجی گرفتن",
      import: "ورود اطلاعات",
      adjust: "تعدیل",
      transfer: "انتقال",
    },

    /* ---------- Report types ---------- */
    REPORT_TYPE: {
      SALES: "sales",
      INVENTORY: "inventory",
      CUSTOMERS: "customers",
      SUPPLIERS: "suppliers",
      PROFIT: "profit",
    },

    /* ---------- Local storage keys ---------- */
    STORAGE_KEYS: {
      THEME: "crm:theme",
      SIDEBAR: "crm:sidebar",
      LOCALE: "crm:locale",
      DENSITY: "crm:density",
      CONTRAST: "crm:contrast",
      RECENT_SEARCH: "crm:recent-search",
      NOTIFICATIONS_READ: "crm:notif-read",
      TABLE_COLUMNS: "crm:table-columns",
      LAST_ROUTE: "crm:last-route",
      USER_PREFS: "crm:user-prefs",
      DRAFT_PREFIX: "crm:draft:",
    },

    /* ---------- Notification types ---------- */
    NOTIF_TYPE: {
      INFO: "info",
      SUCCESS: "success",
      WARNING: "warning",
      DANGER: "danger",
    },

    /* ---------- Keyboard shortcuts ---------- */
    SHORTCUTS: {
      COMMAND_PALETTE: "k",
      SEARCH: "/",
      NEW: "n",
      SAVE: "s",
      ESCAPE: "Escape",
      DELETE: "Delete",
      REFRESH: "r",
    },

    /* ---------- Chart periods ---------- */
    CHART_PERIOD: {
      DAY: "7",
      WEEK: "30",
      MONTH: "90",
      YEAR: "365",
    },

    /* ---------- Date formats ---------- */
    DATE_FORMAT: {
      FULL: "YYYY/MM/DD HH:mm",
      DATE: "YYYY/MM/DD",
      TIME: "HH:mm",
      ISO: "YYYY-MM-DDTHH:mm:ss.SSSZ",
      MONTH_DAY: "MM/DD",
    },

    /* ---------- Regex patterns ---------- */
    PATTERNS: {
      EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      PHONE_IR: /^(\+98|0)?9\d{9}$/,
      NATIONAL_ID: /^\d{10}$/,
      POSTAL_CODE: /^\d{10}$/,
      SKU: /^[A-Za-z0-9\-_]{3,32}$/,
      PERSIAN: /^[\u0600-\u06FF\s]+$/,
      URL: /^https?:\/\/.+/,
      IBAN: /^IR\d{24}$/,
    },

    /* ---------- Table column definitions ---------- */
    TABLE_COLUMNS: {
      PRODUCTS: ["select", "image", "name", "sku", "category", "price", "stock", "status", "actions"],
      ORDERS: ["select", "id", "customer", "amount", "status", "date", "actions"],
      CUSTOMERS: ["select", "name", "phone", "email", "orders", "total", "actions"],
      SUPPLIERS: ["select", "name", "contact", "phone", "products", "actions"],
      WAREHOUSES: ["select", "name", "location", "capacity", "used", "actions"],
      MOVEMENTS: ["type", "product", "warehouse", "qty", "user", "date"],
      ACTIVITY: ["icon", "title", "user", "ip", "time"],
    },

    /* ---------- Colors for charts / status ---------- */
    TONE_COLORS: {
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      info: "#3b82f6",
      neutral: "#6b7280",
      brand: "#598eff",
      violet: "#8b5cf6",
    },

    /* ---------- Empty states ---------- */
    EMPTY: {
      PRODUCTS: {
        icon: "ri-archive-2-line",
        title: "هنوز محصولی ثبت نشده",
        text: "برای شروع، اولین محصول خود را اضافه کنید.",
      },
      ORDERS: {
        icon: "ri-shopping-bag-3-line",
        title: "سفارشی موجود نیست",
        text: "سفارشات ثبت‌شده اینجا نمایش داده می‌شوند.",
      },
      CUSTOMERS: {
        icon: "ri-group-line",
        title: "هنوز مشتری‌ای ثبت نشده",
        text: "مشتریان خود را برای پیگیری بهتر اضافه کنید.",
      },
      SUPPLIERS: {
        icon: "ri-truck-line",
        title: "تأمین‌کننده‌ای ثبت نشده",
        text: "زنجیره تأمین خود را از اینجا مدیریت کنید.",
      },
      WAREHOUSES: {
        icon: "ri-building-4-line",
        title: "انباری تعریف نشده",
        text: "برای مدیریت مکان کالا، انبار تعریف کنید.",
      },
      ACTIVITY: {
        icon: "ri-history-line",
        title: "فعالیتی ثبت نشده",
        text: "تمام رخدادهای سیستم در این بخش قابل مشاهده است.",
      },
      SEARCH: {
        icon: "ri-search-line",
        title: "نتیجه‌ای یافت نشد",
        text: "عبارت جستجو را تغییر دهید.",
      },
    },
  };

  window.C = Object.freeze(C);
})(window);