/* ============================================================
   THEORIES STUDIO — Global app state
   ============================================================ */
import { store } from './utils.js';

const listeners = new Map();
const KEYS = {
  theme: 'theories.theme',
  accent: 'theories.accent',
  font: 'theories.font',
  density: 'theories.density',
  radius: 'theories.radius',
  sidebarCollapsed: 'theories.sidebarCollapsed',
  recentSearches: 'theories.recentSearches',
  prefs: 'theories.prefs'
};

const defaultState = {
  user: null,
  session: null,
  profile: null,
  authReady: false,
  theme: store.get(KEYS.theme, 'light'),
  accent: store.get(KEYS.accent, 'violet'),
  font: store.get(KEYS.font, 'md'),
  density: store.get(KEYS.density, 'comfortable'),
  radius: store.get(KEYS.radius, 'normal'),
  sidebarCollapsed: store.get(KEYS.sidebarCollapsed, false),
  recentSearches: store.get(KEYS.recentSearches, []),
  theoriesCount: 0,
  objectsCount: 0,
  galleryCount: 0,
  timelineCount: 0,
  bookmarksCount: 0,
  activityCount: 0,
  route: { name: 'home', params: {} },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true
};

export const state = { ...defaultState };

/* ---------- Subscribe ---------- */
export const subscribe = (event, fn) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
};

export const emit = (event, payload) => {
  const set = listeners.get(event);
  if (set) set.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  const all = listeners.get('*');
  if (all) all.forEach(fn => { try { fn(event, payload); } catch (e) { console.error(e); } });
};

/* ---------- Setters ---------- */
export const setState = (patch, event = 'state') => {
  Object.assign(state, patch);
  emit(event, patch);
};

export const setUser = (user, session) => {
  setState({ user, session }, 'auth');
};

export const setProfile = (profile) => {
  setState({ profile }, 'profile');
};

export const setCounts = (counts) => {
  setState(counts, 'counts');
};

export const setTheme = (theme) => {
  state.theme = theme;
  store.set(KEYS.theme, theme);
  applyTheme();
  emit('theme', theme);
};

export const setAccent = (accent) => {
  state.accent = accent;
  store.set(KEYS.accent, accent);
  applyTheme();
  emit('accent', accent);
};

export const setFont = (font) => {
  state.font = font;
  store.set(KEYS.font, font);
  applyTheme();
  emit('font', font);
};

export const setDensity = (density) => {
  state.density = density;
  store.set(KEYS.density, density);
  applyTheme();
  emit('density', density);
};

export const setRadius = (radius) => {
  state.radius = radius;
  store.set(KEYS.radius, radius);
  applyTheme();
  emit('radius', radius);
};

export const setSidebarCollapsed = (v) => {
  state.sidebarCollapsed = v;
  store.set(KEYS.sidebarCollapsed, v);
  emit('sidebar', v);
};

export const addRecentSearch = (q) => {
  q = String(q || '').trim();
  if (!q) return;
  const next = [q, ...state.recentSearches.filter(x => x !== q)].slice(0, 8);
  state.recentSearches = next;
  store.set(KEYS.recentSearches, next);
  emit('recentSearches', next);
};

export const clearRecentSearches = () => {
  state.recentSearches = [];
  store.set(KEYS.recentSearches, []);
  emit('recentSearches', []);
};

/* ---------- Theme application ---------- */
export const applyTheme = () => {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const effectiveTheme = state.theme === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : state.theme;
  html.dataset.theme = effectiveTheme;
  html.dataset.accent = state.accent;
  html.dataset.font = state.font;
  html.dataset.density = state.density;
  html.dataset.radius = state.radius;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const color = effectiveTheme === 'dark' ? '#0d0a1f' : '#f8f7ff';
    meta.setAttribute('content', color);
  }
};

export const toggleTheme = () => {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};

export const initTheme = () => {
  applyTheme();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => { if (state.theme === 'system') applyTheme(); });
  }
  window.addEventListener('online', () => setState({ online: true }, 'network'));
  window.addEventListener('offline', () => setState({ online: false }, 'network'));
};
