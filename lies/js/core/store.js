/* ============================================================
   js/core/store.js
   Tiny reactive store with selectors & subscriptions
   ============================================================ */

/**
 * @template T
 * @typedef {(state:T) => void} Subscriber
 */

/**
 * @template T
 */
class Store {
  /**
   * @param {T} initialState
   * @param {{name?:string}} [opts]
   */
  constructor(initialState, opts = {}) {
    /** @type {T} */
    this._state = Object.freeze({ ...initialState });
    /** @type {Set<Subscriber<T>>} */
    this._subs = new Set();
    /** @type {Map<string, Set<Subscriber<any>>>} */
    this._selectors = new Map();
    this._name = opts.name || 'store';
    this._notifying = false;
    this._pending = false;
  }

  /** @returns {T} */
  getState() {
    return this._state;
  }

  /**
   * Get a slice.
   * @template K @param {K} key @returns {T[K]}
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Replace entire state (shallow merge).
   * @param {Partial<T>|((s:T)=>Partial<T>)} patch
   */
  set(patch) {
    const next = typeof patch === 'function' ? patch(this._state) : patch;
    const prev = this._state;
    this._state = Object.freeze({ ...prev, ...next });
    this._notify(prev, this._state);
  }

  /**
   * Update a single key.
   * @template K @param {K} key @param {T[K]|((v:T[K])=>T[K])} value
   */
  update(key, value) {
    const prev = this._state;
    const nextVal = typeof value === 'function' ? value(prev[key]) : value;
    if (Object.is(prev[key], nextVal)) return;
    this._state = Object.freeze({ ...prev, [key]: nextVal });
    this._notify(prev, this._state);
  }

  /**
   * Reset to a state.
   * @param {T} state
   */
  reset(state) {
    const prev = this._state;
    this._state = Object.freeze({ ...state });
    this._notify(prev, this._state);
  }

  /**
   * Subscribe to all changes.
   * @param {Subscriber<T>} fn
   * @param {{immediate?:boolean}} [opts]
   * @returns {() => void}
   */
  subscribe(fn, opts = {}) {
    this._subs.add(fn);
    if (opts.immediate) {
      try { fn(this._state, undefined); } catch (err) { console.error(err); }
    }
    return () => this._subs.delete(fn);
  }

  /**
   * Subscribe to a selected slice.
   * @template R
   * @param {(s:T)=>R} selector
   * @param {(value:R, prev:R|undefined) => void} fn
   * @param {{immediate?:boolean, equals?:(a:R,b:R)=>boolean}} [opts]
   * @returns {() => void}
   */
  select(selector, fn, opts = {}) {
    const { immediate = true, equals = Object.is } = opts;
    let prev = selector(this._state);
    let first = true;
    const wrapped = (state) => {
      const next = selector(state);
      if (first || !equals(prev, next)) {
        const old = prev;
        prev = next;
        first = false;
        try { fn(next, old); } catch (err) { console.error(err); }
      }
    };
    this._subs.add(wrapped);
    if (immediate) {
      try { fn(prev, undefined); } catch (err) { console.error(err); }
    }
    return () => this._subs.delete(wrapped);
  }

  /** @private */
  _notify(prev, next) {
    if (this._notifying) {
      this._pending = true;
      return;
    }
    this._notifying = true;
    for (const fn of [...this._subs]) {
      try { fn(next, prev); }
      catch (err) { console.error(`[${this._name}] subscriber error`, err); }
    }
    this._notifying = false;
    if (this._pending) {
      this._pending = false;
      // A nested set() happened; run again with fresh state
      this._notify(prev, this._state);
    }
  }
}

/* ── App-level store slices ──────────────────────────────── */

/** UI store */
export const uiStore = new Store(
  {
    sidebarCollapsed: false,
    sidebarMobileOpen: false,
    theme: 'dark',
    accent: 'violet',
    fontSize: 'md',
    currentRoute: 'dashboard',
    loading: false,
    commandPaletteOpen: false,
  },
  { name: 'ui' }
);

/** Session store */
export const sessionStore = new Store(
  {
    user: null,
    profile: null,
    status: 'booting', // booting | anonymous | authenticating | authenticated | error
    error: null,
  },
  { name: 'session' }
);

/** Data cache store */
export const dataStore = new Store(
  {
    lies: [],
    categories: [],
    tags: [],
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
  },
  { name: 'data' }
);

export { Store };