/**
 * Theme manager — light/dark with system-preference fallback.
 * Applies `data-theme` on <html> and persists choice in localStorage.
 */

import { STORAGE_KEYS, THEMES } from '../config/constants.js';
import { storage } from '../utils/storage.js';
import { appStore } from './store.js';

const mql = window.matchMedia('(prefers-color-scheme: dark)');

function systemPref() {
  return mql.matches ? THEMES.DARK : THEMES.LIGHT;
}

function apply(theme) {
  const t = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.documentElement.setAttribute('data-theme', t);
  appStore.set('theme', t);
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || THEMES.LIGHT;
}

export function setTheme(theme) {
  const t = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  storage.set(STORAGE_KEYS.THEME, t);
  apply(t);
}

export function toggleTheme() {
  const next = getTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  setTheme(next);
  return next;
}

export function initTheme() {
  // Priority: saved → system
  const saved = storage.get(STORAGE_KEYS.THEME);
  if (saved === THEMES.LIGHT || saved === THEMES.DARK) {
    apply(saved);
  } else {
    apply(systemPref());
  }

  // Follow system changes when the user hasn't explicitly chosen
  mql.addEventListener('change', (e) => {
    const explicit = storage.get(STORAGE_KEYS.THEME);
    if (explicit === THEMES.LIGHT || explicit === THEMES.DARK) return;
    apply(e.matches ? THEMES.DARK : THEMES.LIGHT);
  });
}

export const theme = { init: initTheme, get: getTheme, set: setTheme, toggle: toggleTheme };
export default theme;