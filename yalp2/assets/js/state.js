/* ============================================================
   Global app state — tiny observable store
   ============================================================ */
import { createSignal, normalizeFa } from './utils.js';
import { CONFIG } from './config.js';

/** Loaded entities (cached from Supabase) */
export const store = {
  user: createSignal(null),
  session: createSignal(null),
  ready: createSignal(false),

  platforms: createSignal([]),   // sm_platforms
  shops: createSignal([]),       // sm_shops
  products: createSignal([]),    // sm_products
  purchases: createSignal([]),   // sm_purchases (joined)
  comments: createSignal([]),    // sm_comments

  /** Filter state (home page) */
  filters: createSignal({
    query: '',
    ratings: new Set(),          // subset of ['good','bad','shit']
    platformIds: new Set(),      // Set<uuid>
    shopIds: new Set(),          // Set<uuid>
    productIds: new Set(),       // Set<uuid>
    sort: 'recent',              // recent | oldest | rating | price-desc | price-asc | shop
  }),

  /** UI state */
  ui: createSignal({
    addModalOpen: false,
    shopDrawerOpen: null,        // shop id
    productDrawerOpen: null,     // product id
    loginModalOpen: false,
    busy: false,
  }),
};

/** Derived helpers (recomputed on demand) */
export function getPlatformById(id) {
  return store.platforms.get().find((p) => p.id === id) || null;
}
export function getShopById(id) {
  return store.shops.get().find((s) => s.id === id) || null;
}
export function getProductById(id) {
  return store.products.get().find((p) => p.id === id) || null;
}

/** Persist last-selected filter keys for UX (optional) */
const LS_KEY = 'smyar.filters.v1';
export function saveFiltersToStorage() {
  try {
    const f = store.filters.get();
    localStorage.setItem(LS_KEY, JSON.stringify({
      sort: f.sort,
    }));
  } catch {}
}
export function restoreFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const f = store.filters.get();
    store.filters.set({ ...f, ...data });
  } catch {}
}

/* Ratings helper */
export const RATINGS = CONFIG.ratings;
export const RATING_ORDER = CONFIG.ratingOrder;
