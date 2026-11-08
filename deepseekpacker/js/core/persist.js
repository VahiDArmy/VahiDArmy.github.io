// AURORA OS — Persistence Layer

import { bus } from './bus.js';

const NS = 'aurora:';
const WRITE_DELAY = 300;
let _timer = null;
const _pending = new Map();

function _flush() {
  for (const [k, v] of _pending) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); }
    catch (e) { console.warn('[persist] write failed', k, e); }
  }
  _pending.clear();
  if (_timer) clearTimeout(_timer);
  _timer = null;
  bus.emit('persist:flushed');
}

function _schedule() {
  if (_timer) return;
  _timer = setTimeout(_flush, WRITE_DELAY);
}

export const persist = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[persist] read failed', key, e);
      return fallback;
    }
  },
  set(key, value) {
    _pending.set(key, value);
    _schedule();
  },
  remove(key) {
    try { localStorage.removeItem(NS + key); } catch (e) {}
  },
  clear() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      bus.emit('persist:cleared');
    } catch (e) { console.warn('[persist] clear failed', e); }
  },
  flush() {
    if (_timer) { clearTimeout(_timer); _flush(); }
  },
  size() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) {
          total += k.length + (localStorage.getItem(k)?.length || 0);
        }
      }
    } catch (e) {}
    return total;
  },
  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
      }
    } catch (e) {}
    return out;
  },
};

window.addEventListener('beforeunload', () => persist.flush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist.flush();
});

export default persist;
