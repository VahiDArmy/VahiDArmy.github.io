/* ============================================================================
   GLOBAL STORE (lightweight pub/sub state)
   ============================================================================ */

(function (window) {
  "use strict";

  const Helpers = window.Helpers;

  const state = {
    user: null,
    products: [],
    orders: [],
    customers: [],
    suppliers: [],
    warehouses: [],
    categories: [],
    cart: [],
    notifications: [],
    filters: {},
    ui: {
      sidebarCollapsed: false,
      theme: "dark",
      commandPaletteOpen: false,
      currentRoute: "dashboard",
    },
  };

  const listeners = new Set();

  const Store = {
    /* ---------- Subscribe ---------- */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    notify(changedKeys = []) {
      listeners.forEach((fn) => {
        try { fn(state, changedKeys); } catch (e) { console.error(e); }
      });
    },

    /* ---------- Get / Set ---------- */
    get(key) {
      return key ? state[key] : { ...state };
    },

    set(key, value) {
      const prev = state[key];
      state[key] = value;
      if (prev !== value) this.notify([key]);
      return value;
    },

    /* ---------- Patch ---------- */
    patch(partial) {
      const keys = [];
      Object.entries(partial).forEach(([k, v]) => {
        if (state[k] !== v) {
          state[k] = v;
          keys.push(k);
        }
      });
      if (keys.length) this.notify(keys);
    },

    /* ---------- UI helpers ---------- */
    setUI(patch) {
      const keys = [];
      Object.entries(patch).forEach(([k, v]) => {
        if (state.ui[k] !== v) {
          state.ui[k] = v;
          keys.push(`ui.${k}`);
        }
      });
      if (keys.length) this.notify(keys);
    },

    /* ---------- Cart ---------- */
    addToCart(item) {
      const existing = state.cart.find((i) => i.id === item.id);
      if (existing) existing.qty += item.qty || 1;
      else state.cart.push({ ...item, qty: item.qty || 1 });
      this.notify(["cart"]);
    },

    removeFromCart(id) {
      state.cart = state.cart.filter((i) => i.id !== id);
      this.notify(["cart"]);
    },

    clearCart() {
      state.cart = [];
      this.notify(["cart"]);
    },

    cartTotal() {
      return state.cart.reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    },

    /* ---------- Filters ---------- */
    setFilter(scope, filters) {
      state.filters[scope] = { ...(state.filters[scope] || {}), ...filters };
      this.notify([`filters.${scope}`]);
    },

    getFilter(scope) {
      return state.filters[scope] || {};
    },

    clearFilter(scope) {
      delete state.filters[scope];
      this.notify([`filters.${scope}`]);
    },

    /* ---------- Reset ---------- */
    reset() {
      state.user = null;
      state.products = [];
      state.orders = [];
      state.customers = [];
      state.suppliers = [];
      state.warehouses = [];
      state.categories = [];
      state.cart = [];
      state.filters = {};
      this.notify(["*"]);
    },
  };

  window.Store = Store;
})(window);