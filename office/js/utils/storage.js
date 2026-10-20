/**
 * LocalStorage helpers (safe JSON, namespaced keys).
 */

const PREFIX = 'office:';

function key(k) {
  return k.startsWith(PREFIX) ? k : PREFIX + k;
}

export const storage = {
  get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch {
      return fallback;
    }
  },

  set(k, value) {
    try {
      localStorage.setItem(key(k), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(k) {
    try { localStorage.removeItem(key(k)); } catch { /* noop */ }
  },

  clear() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const name = localStorage.key(i);
        if (name && name.startsWith(PREFIX)) localStorage.removeItem(name);
      }
    } catch { /* noop */ }
  },
};

export const session = {
  get(k, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key(k));
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch {
      return fallback;
    }
  },
  set(k, value) {
    try { sessionStorage.setItem(key(k), JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(k) { try { sessionStorage.removeItem(key(k)); } catch { /* noop */ } },
};