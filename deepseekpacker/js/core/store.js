// AURORA OS — Reactive Store

import { bus } from './bus.js';

const clone = (v) => {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(clone);
  if (v instanceof Date) return new Date(v);
  if (v instanceof Map) return new Map(v);
  if (v instanceof Set) return new Set(v);
  const out = {};
  for (const k of Object.keys(v)) out[k] = clone(v[k]);
  return out;
};

function getPath(obj, path) {
  if (!path) return obj;
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return cur;
    cur = cur[k];
  }
  return cur;
}

function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = val;
}

export class Store {
  constructor(initial = {}) {
    this._state = initial;
    this._subs = new Set();
    this._pathSubs = new Map();
  }
  get(path) {
    return path ? getPath(this._state, path) : this._state;
  }
  has(path) {
    return getPath(this._state, path) !== undefined;
  }
  set(path, val) {
    if (path && typeof path === 'object') {
      for (const [k, v] of Object.entries(path)) this.set(k, v);
      return;
    }
    const prev = getPath(this._state, path);
    if (prev === val) return;
    setPath(this._state, path, val);
    this._notify(path, val, prev);
  }
  update(path, fn) {
    const cur = this.get(path);
    const next = fn(clone(cur));
    if (next !== undefined) this.set(path, next);
    return next;
  }
  toggle(path) {
    this.set(path, !this.get(path));
    return this.get(path);
  }
  push(path, ...vals) {
    const arr = this.get(path);
    const next = Array.isArray(arr) ? [...arr, ...vals] : [...vals];
    this.set(path, next);
    return next;
  }
  unshift(path, ...vals) {
    const arr = this.get(path);
    const next = Array.isArray(arr) ? [...vals, ...arr] : [...vals];
    this.set(path, next);
    return next;
  }
  remove(path, predicate) {
    const arr = this.get(path);
    if (!Array.isArray(arr)) return [];
    const next = arr.filter(predicate);
    this.set(path, next);
    return next;
  }
  inc(path, by = 1) {
    const cur = Number(this.get(path)) || 0;
    this.set(path, cur + by);
    return cur + by;
  }
  subscribe(fn, path = null) {
    if (path) {
      if (!this._pathSubs.has(path)) this._pathSubs.set(path, new Set());
      this._pathSubs.get(path).add(fn);
      return () => this._pathSubs.get(path)?.delete(fn);
    }
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }
  subscribePath(path, fn) {
    return this.subscribe(fn, path);
  }
  _notify(path, val, prev) {
    for (const fn of [...this._subs]) {
      try { fn(path, val, prev); }
      catch (e) { console.error('[store]', e); }
    }
    if (path && this._pathSubs.has(path)) {
      for (const fn of [...this._pathSubs.get(path)]) {
        try { fn(val, prev); }
        catch (e) { console.error('[store]', e); }
      }
    }
    bus.emit('store:change', { path, val, prev });
    if (path) bus.emit('store:' + path, val);
  }
  snapshot() { return clone(this._state); }
  reset(initial = {}) {
    this._state = initial;
    this._notify(null, null, null);
  }
  keys() { return Object.keys(this._state); }
}

export const store = new Store({
  user: { name: 'Explorer', avatar: null, status: 'online' },
  theme: 'dark',
  accent: null,
  density: 'default',
  windows: [],
  activeWindow: null,
  notifications: [],
  settings: {
    reduceMotion: false,
    showSeconds: false,
    soundEnabled: true,
    clock24: true,
    wallpaper: 'aurora',
  },
  apps: {
    dashboard: { open: false }, kanban: { open: false }, datagrid: { open: false },
    analytics: { open: false }, calendar: { open: false }, notes: { open: false },
    chat: { open: false }, files: { open: false }, terminal: { open: false },
    music: { open: false }, settings: { open: false }, codepad: { open: false },
  },
  boot: { complete: false, startedAt: null },
  palette: { open: false, query: '', selected: 0 },
  notif: { open: false, unread: 0 },
});

export default store;
