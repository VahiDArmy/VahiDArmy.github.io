/**
 * Namespaced, safe localStorage wrapper.
 *
 *  - Namespaces every key so we never collide with other apps on the same
 *    origin (GitHub Pages share `username.github.io`).
 *  - Handles quota errors and JSON serialization transparently.
 *  - Falls back to an in-memory store when localStorage is unavailable
 *    (private mode, iframe sandbox, etc.).
 *  - Optional session-scope methods (`session.get/set`) for per-tab data.
 */

const NS = "activity-tracker:";

const memory = new Map();
const memorySession = new Map();

let localOk = (() => {
  try {
    const k = NS + "__test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

let sessionOk = (() => {
  try {
    const k = NS + "__test__";
    window.sessionStorage.setItem(k, "1");
    window.sessionStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

function parse(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function stringify(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const storage = {
  get(key, fallback = null) {
    const k = NS + key;
    if (!localOk) return memory.has(k) ? memory.get(k) : fallback;
    const raw = window.localStorage.getItem(k);
    if (raw == null) return fallback;
    return parse(raw);
  },

  set(key, value) {
    const k = NS + key;
    if (!localOk) {
      memory.set(k, value);
      return true;
    }
    try {
      window.localStorage.setItem(k, stringify(value));
      return true;
    } catch {
      // quota exceeded — fall back to memory for the rest of this session
      memory.set(k, value);
      return false;
    }
  },

  remove(key) {
    const k = NS + key;
    memory.delete(k);
    if (localOk) window.localStorage.removeItem(k);
  },

  clear() {
    memory.clear();
    if (!localOk) return;
    const prefix = NS;
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  },

  /* Session (per-tab) --------------------------------------------------- */
  session: {
    get(key, fallback = null) {
      const k = NS + key;
      if (!sessionOk) return memorySession.has(k) ? memorySession.get(k) : fallback;
      const raw = window.sessionStorage.getItem(k);
      if (raw == null) return fallback;
      return parse(raw);
    },
    set(key, value) {
      const k = NS + key;
      if (!sessionOk) {
        memorySession.set(k, value);
        return true;
      }
      try {
        window.sessionStorage.setItem(k, stringify(value));
        return true;
      } catch {
        memorySession.set(k, value);
        return false;
      }
    },
    remove(key) {
      const k = NS + key;
      memorySession.delete(k);
      if (sessionOk) window.sessionStorage.removeItem(k);
    },
  },
};