/* ============================================================================
   STORAGE (localStorage + sessionStorage + IndexedDB-lite)
   ============================================================================ */

(function (window) {
  "use strict";

  const PREFIX = "crm:";

  const safeParse = (raw, fallback) => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  };

  const Storage = {
    /* ---------- LocalStorage ---------- */
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return safeParse(raw, fallback);
      } catch (_) {
        return fallback;
      }
    },

    set(key, value) {
      try {
        const str = typeof value === "string" ? value : JSON.stringify(value);
        localStorage.setItem(PREFIX + key, str);
        return true;
      } catch (e) {
        console.warn("storage.set failed:", e);
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (_) {}
    },

    has(key) {
      try {
        return localStorage.getItem(PREFIX + key) != null;
      } catch (_) {
        return false;
      }
    },

    clearAll() {
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (_) {}
    },

    /* ---------- Session ---------- */
    session: {
      get(key, fallback = null) {
        try {
          const raw = sessionStorage.getItem(PREFIX + key);
          return safeParse(raw, fallback);
        } catch (_) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          const str = typeof value === "string" ? value : JSON.stringify(value);
          sessionStorage.setItem(PREFIX + key, str);
          return true;
        } catch (_) {
          return false;
        }
      },
      remove(key) {
        try {
          sessionStorage.removeItem(PREFIX + key);
        } catch (_) {}
      },
      clearAll() {
        try {
          const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));
          keys.forEach((k) => sessionStorage.removeItem(k));
        } catch (_) {}
      },
    },

    /* ---------- Drafts ---------- */
    saveDraft(id, data) {
      return this.set(`draft:${id}`, { data, ts: Date.now() });
    },

    loadDraft(id) {
      const d = this.get(`draft:${id}`);
      if (!d) return null;
      // Expire after 7 days
      if (Date.now() - (d.ts || 0) > 7 * 86400000) {
        this.remove(`draft:${id}`);
        return null;
      }
      return d.data;
    },

    clearDraft(id) {
      this.remove(`draft:${id}`);
    },

    /* ---------- Recent searches ---------- */
    pushRecent(scope, term, max = 8) {
      if (!term) return;
      const list = this.get(`recent:${scope}`, []);
      const filtered = Array.isArray(list) ? list.filter((x) => x !== term) : [];
      filtered.unshift(term);
      this.set(`recent:${scope}`, filtered.slice(0, max));
    },

    getRecent(scope) {
      const list = this.get(`recent:${scope}`, []);
      return Array.isArray(list) ? list : [];
    },

    clearRecent(scope) {
      this.remove(`recent:${scope}`);
    },

    /* ---------- Theme ---------- */
    getTheme() {
      return this.get("theme", "dark");
    },

    setTheme(theme) {
      this.set("theme", theme);
    },

    /* ---------- Sidebar ---------- */
    getSidebarState() {
      return this.get("sidebar", "expanded");
    },

    setSidebarState(state) {
      this.set("sidebar", state);
    },

    /* ---------- Table column prefs ---------- */
    getTableColumns(table) {
      return this.get(`table-columns:${table}`, null);
    },

    setTableColumns(table, cols) {
      this.set(`table-columns:${table}`, cols);
    },

    /* ---------- Preferences ---------- */
    getPrefs() {
      return this.get("user-prefs", {});
    },

    setPref(key, value) {
      const prefs = this.getPrefs();
      prefs[key] = value;
      this.set("user-prefs", prefs);
    },

    getPref(key, fallback = null) {
      const prefs = this.getPrefs();
      return key in prefs ? prefs[key] : fallback;
    },

    /* ---------- Export / Import all ---------- */
    exportAll() {
      const all = {};
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith(PREFIX)) all[k] = localStorage.getItem(k);
        });
      } catch (_) {}
      return all;
    },

    importAll(obj) {
      if (!obj || typeof obj !== "object") return false;
      try {
        Object.entries(obj).forEach(([k, v]) => {
          if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
        });
        return true;
      } catch (_) {
        return false;
      }
    },
  };

  window.Storage = Storage;
})(window);