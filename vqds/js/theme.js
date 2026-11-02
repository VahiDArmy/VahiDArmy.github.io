/* ==========================================================================
   theme.js — مدیریت تم صورتی/پسرانه با همگام‌سازی Supabase
   ========================================================================== */

import { CONFIG } from './config.js';
import { storage } from './utils.js';
import { supabase } from './supabase.js';
import { store } from './store.js';

let currentTheme = CONFIG.defaultTheme;

function setThemeMeta(themeId) {
  const theme = CONFIG.themes[themeId];
  if (!theme) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = theme.metaColor;
}

export function getStoredTheme() {
  const stored = storage.get(CONFIG.storageKeys.theme, null);
  return CONFIG.themes[stored] ? stored : CONFIG.defaultTheme;
}

export function getTheme() {
  return currentTheme;
}

export function applyTheme(themeId) {
  const id = CONFIG.themes[themeId] ? themeId : CONFIG.defaultTheme;
  currentTheme = id;
  document.documentElement.setAttribute('data-theme', id);
  document.body.dataset.theme = id;
  setThemeMeta(id);
  storage.set(CONFIG.storageKeys.theme, id);
  store.set({ theme: id });

  // رویداد برای بازسازی ذرات
  window.dispatchEvent(new CustomEvent('q56:theme-changed', { detail: { theme: id } }));
}

export function toggleTheme() {
  const next = currentTheme === 'pink' ? 'boy' : 'pink';
  applyTheme(next);
  syncThemeToProfile(next);
  return next;
}

async function syncThemeToProfile(themeId) {
  const state = store.getState();
  const userId = state.user?.id || state.profile?.user_id;
  if (!userId) return;

  try {
    await supabase
      .from(CONFIG.tables.profiles)
      .update({ theme: themeId })
      .eq('user_id', userId);
  } catch (e) {
    console.warn('[theme] sync failed', e);
  }
}

export function initTheme(initialFromProfile) {
  const id = initialFromProfile && CONFIG.themes[initialFromProfile]
    ? initialFromProfile
    : getStoredTheme();
  applyTheme(id);
  return id;
}

export default {
  getTheme,
  applyTheme,
  toggleTheme,
  initTheme,
  getStoredTheme,
};