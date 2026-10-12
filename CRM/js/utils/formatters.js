/* ============================================================================
   FORMATTERS — Numbers, currency, bytes, strings
   ============================================================================ */

(function (window) {
  "use strict";

  const Persian = window.Persian || {};

  const Formatters = {
    /* ---------- Number ---------- */
    number(value, opts = {}) {
      if (value == null || value === "" || isNaN(value)) return "—";
      const n = Number(value);
      return n.toLocaleString("fa-IR", {
        maximumFractionDigits: 2,
        ...opts,
      });
    },

    int(value) {
      if (value == null || value === "" || isNaN(value)) return "—";
      return Math.round(Number(value)).toLocaleString("fa-IR");
    },

    /* ---------- Currency ---------- */
    money(value, opts = {}) {
      if (value == null || value === "" || isNaN(value)) return "—";
      const env = window.ENV || {};
      const cfg = env.CURRENCY || { symbol: "تومان", decimals: 0 };
      const n = Number(value);
      const formatted = n.toLocaleString("fa-IR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: cfg.decimals ?? 0,
        ...opts,
      });
      return opts.plain ? formatted : `${formatted} ${cfg.symbol}`;
    },

    moneyShort(value) {
      if (value == null || isNaN(value)) return "—";
      const n = Number(value);
      const abs = Math.abs(n);
      if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} میلیارد`;
      if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} میلیون`;
      if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} هزار`;
      return n.toLocaleString("fa-IR");
    },

    /* ---------- Percentage ---------- */
    percent(value, digits = 1) {
      if (value == null || isNaN(value)) return "—";
      return `${Number(value).toFixed(digits)}٪`;
    },

    delta(value, digits = 1) {
      if (value == null || isNaN(value)) return "—";
      const n = Number(value);
      const sign = n > 0 ? "+" : n < 0 ? "−" : "";
      return `${sign}${Math.abs(n).toFixed(digits)}٪`;
    },

    /* ---------- Bytes ---------- */
    bytes(bytes, decimals = 1) {
      if (!bytes || bytes < 0) return "0 بایت";
      const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      const value = bytes / Math.pow(1024, i);
      return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
    },

    /* ---------- Strings ---------- */
    truncate(str, max = 40, suffix = "…") {
      if (str == null) return "";
      const s = String(str);
      if (s.length <= max) return s;
      return s.slice(0, max).trimEnd() + suffix;
    },

    initials(name, max = 2) {
      if (!name) return "؟";
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "؟";
      return parts.slice(0, max).map((p) => p[0]).join("");
    },

    titleCase(str) {
      if (!str) return "";
      return str.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    },

    capitalize(str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    slugify(str) {
      if (!str) return "";
      return String(str)
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^\w\u0600-\u06FF-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    },

    /* ---------- Phone ---------- */
    phone(str) {
      if (!str) return "—";
      const s = String(str).replace(/\D/g, "");
      if (s.length === 11 && s.startsWith("0")) {
        return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
      }
      if (s.length === 10) {
        return `0${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}`;
      }
      return str;
    },

    /* ---------- SKU ---------- */
    sku(str) {
      return str ? String(str).toUpperCase() : "—";
    },

    /* ---------- File name ---------- */
    filename(name, max = 32) {
      if (!name) return "";
      const dot = name.lastIndexOf(".");
      if (dot < 0) return this.truncate(name, max);
      const ext = name.slice(dot);
      const base = name.slice(0, dot);
      const allowed = Math.max(6, max - ext.length - 1);
      return this.truncate(base, allowed) + ext;
    },

    /* ---------- Full name ---------- */
    fullName(first, last) {
      return [first, last].filter(Boolean).join(" ").trim() || "—";
    },

    /* ---------- Ordinal ---------- */
    ordinal(n) {
      if (!n && n !== 0) return "";
      return Persian.toPersianDigits ? `${Persian.toPersianDigits(n)}اُم` : `${n}`;
    },

    /* ---------- Pluralize (Persian doesn't pluralize; suffix item) ---------- */
    count(n, unit) {
      const v = Number(n) || 0;
      const fa = Persian.toPersianDigits ? Persian.toPersianDigits(v) : String(v);
      return `${fa} ${unit}`;
    },

    /* ---------- Relative time ---------- */
    relative(date) {
      if (!date) return "—";
      try {
        if (window.dayjs) {
          window.dayjs.extend?.(window.dayjs_plugin_relativeTime || {});
          return window.dayjs(date).fromNow();
        }
      } catch (_) {}
      return String(date);
    },

    /* ---------- Status label ---------- */
    statusLabel(status) {
      const map = (window.C && window.C.ORDER_STATUS_LABEL) || {};
      return map[status] || status || "—";
    },

    roleLabel(role) {
      const map = (window.C && window.C.ROLE_LABEL) || {};
      return map[role] || role || "—";
    },

    movementLabel(type) {
      const map = (window.C && window.C.MOVEMENT_TYPE_LABEL) || {};
      return map[type] || type || "—";
    },

    logActionLabel(action) {
      const map = (window.C && window.C.LOG_ACTION_LABEL) || {};
      return map[action] || action || "—";
    },

    productStatusLabel(status) {
      const map = (window.C && window.C.PRODUCT_STATUS_LABEL) || {};
      return map[status] || status || "—";
    },

    customerTypeLabel(type) {
      const map = (window.C && window.C.CUSTOMER_TYPE_LABEL) || {};
      return map[type] || type || "—";
    },
  };

  window.Formatters = Formatters;
})(window);