/* ============================================================================
   HELPERS — Misc utilities used across the app
   ============================================================================ */

(function (window) {
  "use strict";

  const Helpers = {
    /* ---------- Unique ID ---------- */
    uid(prefix = "id") {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).slice(2, 8);
      return `${prefix}_${ts}${rand}`;
    },

    uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    },

    /* ---------- Random ---------- */
    randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomFrom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },

    /* ---------- Sleep ---------- */
    sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },

    /* ---------- Clone ---------- */
    clone(obj) {
      if (obj == null || typeof obj !== "object") return obj;
      if (typeof structuredClone === "function") {
        try { return structuredClone(obj); } catch (_) {}
      }
      return JSON.parse(JSON.stringify(obj));
    },

    /* ---------- Deep merge ---------- */
    merge(target, ...sources) {
      if (!sources.length) return target;
      const source = sources.shift();
      if (this.isObject(target) && this.isObject(source)) {
        for (const key in source) {
          if (this.isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            this.merge(target[key], source[key]);
          } else {
            Object.assign(target, { [key]: source[key] });
          }
        }
      }
      return this.merge(target, ...sources);
    },

    isObject(item) {
      return item && typeof item === "object" && !Array.isArray(item);
    },

    /* ---------- Array ---------- */
    chunk(arr, size = 20) {
      const out = [];
      for (let i = 0; i < (arr || []).length; i += size) {
        out.push(arr.slice(i, i + size));
      }
      return out;
    },

    unique(arr, keyFn) {
      const seen = new Set();
      return (arr || []).filter((item) => {
        const k = keyFn ? keyFn(item) : item;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },

    groupBy(arr, keyFn) {
      const out = {};
      (arr || []).forEach((item) => {
        const k = keyFn(item);
        if (!out[k]) out[k] = [];
        out[k].push(item);
      });
      return out;
    },

    sum(arr, keyFn) {
      return (arr || []).reduce((acc, item) => acc + (keyFn ? +keyFn(item) || 0 : +item || 0), 0);
    },

    average(arr, keyFn) {
      const a = arr || [];
      return a.length ? this.sum(a, keyFn) / a.length : 0;
    },

    /* ---------- Sort ---------- */
    sortBy(arr, keyFn, direction = "asc") {
      const dir = direction === "desc" ? -1 : 1;
      return [...(arr || [])].sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        if (ka == null && kb == null) return 0;
        if (ka == null) return 1;
        if (kb == null) return -1;
        if (typeof ka === "number" && typeof kb === "number") return (ka - kb) * dir;
        return String(ka).localeCompare(String(kb), "fa") * dir;
      });
    },

    /* ---------- Filter / search ---------- */
    search(arr, term, keys) {
      if (!term) return arr || [];
      const norm = window.Persian ? window.Persian.normalize(term).toLowerCase() : String(term).toLowerCase();
      return (arr || []).filter((item) => {
        return (keys || Object.keys(item)).some((k) => {
          const v = item[k];
          if (v == null) return false;
          const s = window.Persian ? window.Persian.normalize(String(v)) : String(v);
          return s.toLowerCase().includes(norm);
        });
      });
    },

    /* ---------- Percentage change ---------- */
    pctChange(current, previous) {
      const c = Number(current) || 0;
      const p = Number(previous) || 0;
      if (p === 0) return c === 0 ? 0 : 100;
      return ((c - p) / Math.abs(p)) * 100;
    },

    /* ---------- Trend ---------- */
    trend(current, previous) {
      const c = Number(current) || 0;
      const p = Number(previous) || 0;
      if (c > p) return "up";
      if (c < p) return "down";
      return "flat";
    },

    /* ---------- Debounced promise resolution ---------- */
    withTimeout(promise, ms, message = "زمان اجرا به پایان رسید") {
      return Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error(message)), ms)),
      ]);
    },

    /* ---------- Retry ---------- */
    async retry(fn, attempts = 3, delay = 400) {
      let last;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (e) {
          last = e;
          if (i < attempts - 1) await this.sleep(delay * (i + 1));
        }
      }
      throw last;
    },

    /* ---------- Safe JSON parse ---------- */
    parse(json, fallback = null) {
      try {
        return JSON.parse(json);
      } catch (_) {
        return fallback;
      }
    },

    /* ---------- Env feature flag ---------- */
    flag(name) {
      const env = window.ENV || {};
      return !!(env.FEATURES && env.FEATURES[name]);
    },

    /* ---------- App version ---------- */
    version() {
      return (window.ENV && window.ENV.APP_VERSION) || "0.0.0";
    },

    /* ---------- Pick ---------- */
    pick(obj, keys) {
      if (!obj) return {};
      const out = {};
      keys.forEach((k) => {
        if (k in obj) out[k] = obj[k];
      });
      return out;
    },

    /* ---------- Omit ---------- */
    omit(obj, keys) {
      if (!obj) return {};
      const out = { ...obj };
      keys.forEach((k) => delete out[k]);
      return out;
    },

    /* ---------- Pick truthy only ---------- */
    compact(obj) {
      if (!obj) return {};
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        if (v !== "" && v != null) out[k] = v;
      });
      return out;
    },

    /* ---------- Stable reference formatting ---------- */
    ref(prefix, num, pad = 5) {
      return `${prefix}-${String(num).padStart(pad, "0")}`;
    },

    /* ---------- Order ID generator ---------- */
    orderId() {
      const d = new Date();
      const y = d.getFullYear().toString().slice(-2);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const rand = this.randomInt(1000, 9999);
      return `ORD-${y}${m}${day}-${rand}`;
    },

    /* ---------- Percentage helper ---------- */
    pct(part, total) {
      const p = Number(part) || 0;
      const t = Number(total) || 0;
      if (t === 0) return 0;
      return (p / t) * 100;
    },

    /* ---------- Random color ---------- */
    randomColor(sat = 65, light = 55) {
      const h = this.randomInt(0, 360);
      return `hsl(${h}, ${sat}%, ${light}%)`;
    },

    /* ---------- Deterministic color from string ---------- */
    colorFromString(str) {
      let hash = 0;
      const s = String(str || "");
      for (let i = 0; i < s.length; i++) {
        hash = s.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = hash % 360;
      return `hsl(${Math.abs(h)}, 65%, 55%)`;
    },

    /* ---------- CSV encoder ---------- */
    toCSV(rows, headers) {
      if (!rows || !rows.length) return "";
      const cols = headers || Object.keys(rows[0]);
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const lines = [cols.join(",")];
      rows.forEach((r) => {
        lines.push(cols.map((c) => escape(r[c])).join(","));
      });
      return "\uFEFF" + lines.join("\n");
    },

    /* ---------- Localized date-time for filenames ---------- */
    timestampForFile() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    },

    /* ---------- Notify via console in dev ---------- */
    log(...args) {
      if (!window.ENV || window.ENV.APP_ENV !== "production") {
        console.log("[CRM]", ...args);
      }
    },
  };

  window.Helpers = Helpers;
})(window);