/* ==========================================================================
   store.js — وضعیت مرکزی اپ با اشتراک رویدادمحور
   ========================================================================== */

const EMPTY_DATA = {
  reviews: [],
  products: [],
  shops: [],
  vendors: [],
  comments: [],
  lists: [],
  listItems: [],
  profile: null,
};

const initialState = {
  phase: 'boot', // boot | ready | error
  mode: 'supabase', // supabase | demo
  user: null,
  profile: null,
  data: { ...EMPTY_DATA },
  error: null,
  tablesReady: true,
  lastLoadedAt: null,
  ui: {
    busy: false,
    query: '',
  },
};

let state = structuredCloneSafe(initialState);
const listeners = new Set();

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function getState() {
  return state;
}

export function getData() {
  return state.data;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(keys = []) {
  for (const fn of Array.from(listeners)) {
    try {
      fn(state, keys);
    } catch (err) {
      console.error('[store] listener failed', err);
    }
  }
}

export function setState(patch, keys = Object.keys(patch)) {
  state = { ...state, ...patch };
  emit(keys);
  return state;
}

export function patchData(patch, keys = Object.keys(patch)) {
  state = { ...state, data: { ...state.data, ...patch } };
  emit(keys);
  return state;
}

export function setUi(patch) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit(['ui']);
  return state;
}

export function resetState() {
  state = structuredCloneSafe(initialState);
  emit(['*']);
  return state;
}

export function isDemo() {
  return state.mode === 'demo';
}

export function isAuthenticated() {
  return Boolean(state.user);
}

export function currentUserId() {
  return state.user?.id || null;
}

/** انتخابگرهای پرکاربرد */
export const selectors = {
  reviewById: (id) => state.data.reviews.find((r) => r.id === id),
  productById: (id) => state.data.products.find((p) => p.id === id),
  shopById: (id) => state.data.shops.find((s) => s.id === id),
  vendorById: (id) => state.data.vendors.find((v) => v.id === id),
  commentsFor: (type, id) =>
    state.data.comments.filter((c) => c.target_type === type && c.target_id === id),
  listItems: (listId) => state.data.listItems.filter((i) => i.list_id === listId),
  lists: () => state.data.lists,
};
