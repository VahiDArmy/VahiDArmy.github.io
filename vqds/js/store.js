/* ==========================================================================
   store.js — مخزن حالت واکنشی سبک (Redux-like، بدون وابستگی)
   ========================================================================== */

/**
 * @typedef {Object} AppState
 * @property {object|null} user
 * @property {object|null} profile
 * @property {number} counter1
 * @property {number} counter2
 * @property {string|null} profile1Id
 * @property {string|null} profile2Id
 * @property {string} activeView
 * @property {boolean} ready
 * @property {string} theme
 */

/** @type {AppState} */
const INITIAL = {
  user: null,
  profile: null,
  counter1: 0,
  counter2: 0,
  profile1Id: null,
  profile2Id: null,
  activeView: 'surah',
  ready: false,
  theme: 'pink',
};

let state = { ...INITIAL };
const listeners = new Set();

export const store = {
  getState: () => state,

  set(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    const merged = { ...state, ...next };
    const changed = Object.keys(merged).some((k) => merged[k] !== state[k]);
    if (!changed) return state;
    const prev = state;
    state = merged;
    listeners.forEach((fn) => {
      try {
        fn(state, prev);
      } catch (e) {
        console.error('[store] listener error', e);
      }
    });
    return state;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  reset() {
    return store.set(INITIAL);
  },
};

/* اتصال به window برای دیباگ */
if (typeof window !== 'undefined') {
  window.__quranStore = store;
}

export default store;