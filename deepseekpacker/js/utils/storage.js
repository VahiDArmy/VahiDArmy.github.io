// Namespaced localStorage wrapper with JSON + graceful fallback.

const NS = 'pp:';
const memory = new Map();

function hasLS() {
  try {
    const key = '__pp_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
}

const available = typeof window !== 'undefined' && hasLS();

export const Storage = {
  available,
  get(key, fallback) {
    const full = NS + key;
    try {
      const raw = available ? window.localStorage.getItem(full) : memory.get(full);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    const full = NS + key;
    const raw = JSON.stringify(value);
    try {
      if (available) {
        window.localStorage.setItem(full, raw);
      } else {
        memory.set(full, raw);
      }
      return true;
    } catch (err) {
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        console.warn('[storage] quota exceeded for', key);
      }
      return false;
    }
  },
  remove(key) {
    const full = NS + key;
    try {
      if (available) window.localStorage.removeItem(full);
      else memory.delete(full);
    } catch (err) {
      // ignore
    }
  },
  clear() {
    try {
      if (available) {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(NS)) keys.push(k);
        }
        keys.forEach((k) => window.localStorage.removeItem(k));
      }
      memory.clear();
    } catch (err) {
      // ignore
    }
  },
  size() {
    try {
      if (!available) return 0;
      let total = 0;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(NS)) {
          const v = window.localStorage.getItem(k) || '';
          total += k.length + v.length;
        }
      }
      return total;
    } catch (err) {
      return 0;
    }
  },
};
