/* ==========================================================================
   Utils — Storage
   Safe wrapper around localStorage with JSON serialisation and namespacing.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  const NS = 'app::v1::';

  function key(k) {
    return NS + k;
  }

  function isAvailable() {
    try {
      const test = '__test__';
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  const available = isAvailable();
  const memoryStore = new Map();

  /**
   * Set a value (JSON-serializable).
   */
  function set(k, value) {
    const json = JSON.stringify(value);
    if (available) {
      try {
        window.localStorage.setItem(key(k), json);
        return true;
      } catch (err) {
        // Quota exceeded, etc.
        // eslint-disable-next-line no-console
        console.warn('[Storage] set failed, falling back to memory', err);
        memoryStore.set(k, json);
        return false;
      }
    }
    memoryStore.set(k, json);
    return true;
  }

  /**
   * Get a value, returns null if missing or invalid.
   */
  function get(k, fallback) {
    const fb = fallback === undefined ? null : fallback;
    let json = null;
    if (available) {
      try {
        json = window.localStorage.getItem(key(k));
      } catch (err) {
        json = null;
      }
    }
    if (json === null) json = memoryStore.get(k) || null;
    if (json === null) return fb;
    try {
      return JSON.parse(json);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Storage] failed to parse JSON for', k);
      return fb;
    }
  }

  function remove(k) {
    if (available) {
      try {
        window.localStorage.removeItem(key(k));
      } catch (err) {
        /* noop */
      }
    }
    memoryStore.delete(k);
  }

  function clearAll() {
    if (available) {
      try {
        const toRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const lk = window.localStorage.key(i);
          if (lk && lk.startsWith(NS)) toRemove.push(lk);
        }
        toRemove.forEach((lk) => window.localStorage.removeItem(lk));
      } catch (err) {
        /* noop */
      }
    }
    memoryStore.clear();
  }

  /**
   * Approximate size of everything we've stored.
   */
  function size() {
    let bytes = 0;
    if (available) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const lk = window.localStorage.key(i);
          if (lk && lk.startsWith(NS)) {
            const val = window.localStorage.getItem(lk) || '';
            bytes += (lk.length + val.length) * 2; // rough UTF-16 estimate
          }
        }
      } catch (err) {
        /* noop */
      }
    }
    memoryStore.forEach((v, kk) => {
      bytes += (kk.length + (v || '').length) * 2;
    });
    return bytes;
  }

  App.Storage = {
    isAvailable: () => available,
    set,
    get,
    remove,
    clearAll,
    size
  };
})(window);