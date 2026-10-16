/* ============================================================
   js/utils/storage.js
   Namespaced localStorage / sessionStorage helpers with JSON,
   TTL, quota handling, and change events.
   ============================================================ */

import { APP } from '../config/app.config.js';

const PREFIX = APP.storagePrefix || 'app:';

/* ── Safe wrappers (Safari private mode etc.) ─────────────── */

function safeLocal() {
  try {
    const k = '__test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return memoryStore();
  }
}

function safeSession() {
  try {
    const k = '__test__';
    window.sessionStorage.setItem(k, '1');
    window.sessionStorage.removeItem(k);
    return window.sessionStorage;
  } catch {
    return memoryStore();
  }
}

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

const LS = safeLocal();
const SS = safeSession();

/* ── Key building ─────────────────────────────────────────── */

/**
 * Build a fully-qualified storage key.
 * @param {string} key
 * @returns {string}
 */
function fullKey(key) {
  return PREFIX + key;
}

/**
 * Emit a storage change event for internal listeners.
 * @param {string} key
 * @param {any} value
 */
function notify(key, value) {
  window.dispatchEvent(
    new CustomEvent('app:storage', { detail: { key, value } })
  );
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Read & parse a JSON value from localStorage.
 * @template T
 * @param {string} key
 * @param {T} [fallback=null]
 * @returns {T}
 */
export function get(key, fallback = null) {
  try {
    const raw = LS.getItem(fullKey(key));
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} success
 */
export function set(key, value) {
  try {
    const raw = JSON.stringify(value);
    LS.setItem(fullKey(key), raw);
    notify(key, value);
    return true;
  } catch (err) {
    // QuotaExceededError — try to free up space by evicting soft keys
    if (err && /quota/i.test(err.name || err.message || '')) {
      evictSoft();
      try {
        LS.setItem(fullKey(key), JSON.stringify(value));
        notify(key, value);
        return true;
      } catch { /* give up */ }
    }
    return false;
  }
}

/**
 * Remove a key.
 * @param {string} key
 */
export function remove(key) {
  LS.removeItem(fullKey(key));
  notify(key, undefined);
}

/**
 * Check if a key exists.
 * @param {string} key
 * @returns {boolean}
 */
export function has(key) {
  return LS.getItem(fullKey(key)) !== null;
}

/**
 * List all app-namespaced keys (without prefix).
 * @returns {string[]}
 */
export function keys() {
  const out = [];
  for (let i = 0; i < LS.length; i++) {
    const k = LS.key(i);
    if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
  }
  return out;
}

/**
 * Remove every namespaced key.
 */
export function clearAll() {
  for (const k of keys()) LS.removeItem(fullKey(k));
}

/**
 * Set a value with TTL (ms). Reads check expiry.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 */
export function setWithTTL(key, value, ttlMs) {
  set(key, { __v: value, __exp: Date.now() + Number(ttlMs) });
}

/**
 * Get a TTL-wrapped value.
 * @template T
 * @param {string} key
 * @param {T} [fallback=null]
 * @returns {T}
 */
export function getWithTTL(key, fallback = null) {
  const wrapped = get(key);
  if (!wrapped || typeof wrapped !== 'object') return fallback;
  if (wrapped.__exp && Date.now() > wrapped.__exp) {
    remove(key);
    return fallback;
  }
  return wrapped.__v ?? fallback;
}

/**
 * Update a key atomically via an updater function.
 * @template T
 * @param {string} key
 * @param {(prev:T)=>T} updater
 * @param {T} [fallback]
 * @returns {T}
 */
export function update(key, updater, fallback = null) {
  const prev = get(key, fallback);
  const next = updater(prev);
  set(key, next);
  return next;
}

/**
 * Append to an array-valued key.
 * @param {string} key
 * @param {any} value
 * @param {number} [maxLen=200]
 */
export function push(key, value, maxLen = 200) {
  const arr = get(key, []);
  const next = Array.isArray(arr) ? [...arr, value] : [value];
  set(key, next.slice(-maxLen));
}

/* ── Session storage helpers ─────────────────────────────── */

export const session = {
  /**
   * @template T
   * @param {string} k @param {T} [f=null] @returns {T}
   */
  get(k, f = null) {
    try {
      const raw = SS.getItem(fullKey(k));
      return raw === null ? f : JSON.parse(raw);
    } catch { return f; }
  },
  /**
   * @param {string} k @param {any} v @returns {boolean}
   */
  set(k, v) {
    try { SS.setItem(fullKey(k), JSON.stringify(v)); return true; }
    catch { return false; }
  },
  /** @param {string} k */
  remove(k) { SS.removeItem(fullKey(k)); },
  clear() {
    for (let i = SS.length - 1; i >= 0; i--) {
      const k = SS.key(i);
      if (k && k.startsWith(PREFIX)) SS.removeItem(k);
    }
  },
};

/* ── Soft eviction ────────────────────────────────────────── */

const SOFT_KEYS = new Set([
  'search:history',
  'ui:recent',
  'lies:filters',
]);

function evictSoft() {
  for (const k of SOFT_KEYS) {
    if (has(k)) remove(k);
  }
}

/* ── Cross-tab broadcast ─────────────────────────────────── */

/**
 * Subscribe to storage changes made by our own `set` calls or
 * by other tabs (via the native `storage` event).
 * @param {(key:string, value:any) => void} handler
 * @returns {() => void}
 */
export function onStorageChange(handler) {
  const onLocal = (e) => handler(e.detail?.key, e.detail?.value);
  const onCross = (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const k = e.key.slice(PREFIX.length);
    let v = null;
    try { v = e.newValue ? JSON.parse(e.newValue) : null; } catch { /* noop */ }
    handler(k, v);
  };
  window.addEventListener('app:storage', onLocal);
  window.addEventListener('storage', onCross);
  return () => {
    window.removeEventListener('app:storage', onLocal);
    window.removeEventListener('storage', onCross);
  };
}

/**
 * Estimate used bytes by our namespace.
 * @returns {number}
 */
export function estimateUsage() {
  let bytes = 0;
  for (let i = 0; i < LS.length; i++) {
    const k = LS.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const v = LS.getItem(k) || '';
    // 2 bytes/char for UTF-16
    bytes += (k.length + v.length) * 2;
  }
  return bytes;
}