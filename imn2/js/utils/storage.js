/**
 * storage.js — لایه امن روی localStorage با پارس JSON و fallback
 */

const PREFIX = 'sh:';

function key(k) { return `${PREFIX}${k}`; }

export const storage = {
  get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  },

  set(k, value) {
    try { localStorage.setItem(key(k), JSON.stringify(value)); return true; }
    catch { return false; }
  },

  remove(k) {
    try { localStorage.removeItem(key(k)); } catch {}
  },

  clear() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const kk = localStorage.key(i);
        if (kk && kk.startsWith(PREFIX)) keys.push(kk);
      }
      keys.forEach((kk) => localStorage.removeItem(kk));
    } catch {}
  },

  /** کلیدهای زیر namespace این اپ */
  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const kk = localStorage.key(i);
        if (kk && kk.startsWith(PREFIX)) out.push(kk.slice(PREFIX.length));
      }
    } catch {}
    return out;
  },
};

/* ---------- Wrapper با انقضا (TTL) ---------- */

export const cache = {
  set(k, value, ttlMs) {
    storage.set(k, { v: value, e: ttlMs ? Date.now() + ttlMs : null });
  },
  get(k, fallback = null) {
    const data = storage.get(k);
    if (!data) return fallback;
    if (data.e && Date.now() > data.e) {
      storage.remove(k);
      return fallback;
    }
    return data.v;
  },
  remove: storage.remove,
};