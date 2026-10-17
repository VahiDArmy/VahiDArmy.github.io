/* ============================================================
   js/core/store.js
   UPDATED: Added lieTypes and moods to dataStore.
   ============================================================ */

export class Store {
  constructor(initialState, opts = {}) {
    this._state = Object.freeze({ ...initialState });
    this._subs = new Set();
    this._name = opts.name || 'store';
  }
  getState() { return this._state; }
  get(key) { return this._state[key]; }
  set(patch) {
    const next = typeof patch === 'function' ? patch(this._state) : patch;
    this._state = Object.freeze({ ...this._state, ...next });
    for (const fn of [...this._subs]) fn(this._state);
  }
  update(key, value) {
    const nextVal = typeof value === 'function' ? value(this._state[key]) : value;
    if (Object.is(this._state[key], nextVal)) return;
    this._state = Object.freeze({ ...this._state, [key]: nextVal });
    for (const fn of [...this._subs]) fn(this._state);
  }
  subscribe(fn, opts = {}) {
    this._subs.add(fn);
    if (opts.immediate) fn(this._state);
    return () => this._subs.delete(fn);
  }
  select(selector, fn, opts = {}) {
    let prev = selector(this._state);
    const wrapped = (state) => {
      const next = selector(state);
      if (!Object.is(prev, next)) { prev = next; fn(next); }
    };
    this._subs.add(wrapped);
    if (opts.immediate) fn(prev);
    return () => this._subs.delete(wrapped);
  }
}

export const uiStore = new Store({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  theme: 'dark',
  accent: 'violet',
  fontSize: 'md',
  currentRoute: 'dashboard',
  loading: false,
  commandPaletteOpen: false,
}, { name: 'ui' });

export const sessionStore = new Store({
  user: null,
  profile: null,
  status: 'booting',
  error: null,
}, { name: 'session' });

export const dataStore = new Store({
  lies: [],
  categories: [],
  tags: [],
  lieTypes: [], // 🛡️ NEW
  moods: [],    // 🛡️ NEW
  reflections: [],
  stats: null,
  selection: new Set(),
  filters: {
    query: '',
    type: 'all',
    status: 'active',
    categoryIds: [],
    tagIds: [],
    mood: 'all',
    intensityMin: 0,
    intensityMax: 10,
    beliefMin: 0,
    beliefMax: 10,
    dateFrom: null,
    dateTo: null,
  },
  sort: 'created_desc',
  view: 'grid',
  page: 1,
  pageSize: 12,
  total: 0,
  loading: false,
}, { name: 'data' });