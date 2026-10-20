/**
 * Tiny reactive store — application-wide state.
 *
 *   const store = createStore({ user: null, theme: 'light' });
 *   store.subscribe((state, key) => { ... });
 *   store.set('user', user);
 *   store.update({ theme: 'dark', user });
 *   store.get('theme');
 */

export function createStore(initialState = {}) {
  const state = { ...initialState };
  const subscribers = new Set();

  function notify(changedKeys) {
    for (const fn of subscribers) {
      try { fn(state, changedKeys); }
      catch (err) { console.error('[store]', err); }
    }
  }

  function get(key) {
    return key === undefined ? state : state[key];
  }

  function set(key, value) {
    if (Object.is(state[key], value)) return;
    state[key] = value;
    notify([key]);
  }

  function update(patch) {
    const changed = [];
    for (const [key, value] of Object.entries(patch || {})) {
      if (Object.is(state[key], value)) continue;
      state[key] = value;
      changed.push(key);
    }
    if (changed.length) notify(changed);
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function reset() {
    const keys = Object.keys(state);
    for (const k of keys) delete state[k];
    Object.assign(state, initialState);
    notify(keys);
  }

  return { get, set, update, subscribe, reset, state };
}

/**
 * Global app store with the pieces we already know about.
 * Services/pages can extend it as needed.
 */
export const appStore = createStore({
  user: null,          // Supabase user object (or null)
  profile: null,       // Row from profiles table
  session: null,       // Supabase session
  theme: 'light',
  isAuthReady: false,
  bootedAt: Date.now(),
});

export default appStore;