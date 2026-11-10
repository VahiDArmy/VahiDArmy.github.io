import { supabase } from './supabase.js';
import { state, resetState } from './state.js';
import { toast, applyTheme, closeAllModals } from './ui.js';
import { loadAll, saveSettings } from './db.js';
import { registerViews, initRouter, navigate, rerender } from './router.js';
import { bindAuthForms, showAuthScreen, hideAuthScreen } from './auth.js';
import { $ } from './utils.js';

import * as dashboard from './views/dashboard.js';
import * as karma from './views/karma.js';
import * as add from './views/add.js';
import * as journal from './views/journal.js';
import * as calendar from './views/calendar.js';
import * as analytics from './views/analytics.js';
import * as goals from './views/goals.js';
import * as wishlist from './views/wishlist.js';
import * as reflections from './views/reflections.js';
import * as settings from './views/settings.js';

function applyUserTheme() {
  const saved = localStorage.getItem('joy-theme');
  const dbTheme = state.settings?.theme;
  
  let preferred = saved;
  if (!preferred && dbTheme) preferred = dbTheme;
  if (!preferred) preferred = 'system';

  applyTheme(preferred);
}

function bindChrome() {
  $('#theme-btn')?.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    toast(next === 'dark' ? 'حالت شب فعال شد 🌙' : 'حالت روز فعال شد ☀️', 'info', 1800);
    try {
      await saveSettings({ theme: next });
      state.settings = { ...state.settings, theme: next };
    } catch(err) { /* silent fail */ }
  });

  $('#fab')?.addEventListener('click', () => navigate('add'));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllModals();
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      navigate('journal');
      setTimeout(() => $('#journal-search-input')?.focus(), 120);
    }
  });

  window.addEventListener('online', () => toast('اتصال برقرار شد ✅', 'success', 2000));
  window.addEventListener('offline', () => toast('اتصال قطع شد. حالت آفلاین.', 'warning', 3000));
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('joy-theme')) {
      applyTheme('system');
    }
  });
}

function updateUserChrome() {
  const name = state.displayName || 'کاربر';
  const email = state.email || '';
  const avatarEl = $('#user-avatar');
  const nameEl = $('#user-name');
  const emailEl = $('#user-email');
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = name.trim().slice(0, 1) || '✨';
}

async function handleSession(session) {
  if (!session || !session.user) {
    resetState();
    showAuthScreen();
    return;
  }
  state.session = session;
  state.user = session.user;
  state.email = session.user.email || '';
  state.displayName = session.user.user_metadata?.display_name
    || (session.user.email || '').split('@')[0]
    || 'کاربر';

  hideAuthScreen();
  updateUserChrome();
  applyUserTheme();

  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    toast('بارگذاری داده‌ها با خطا مواجه شد', 'error');
  }

  if (state.settings?.theme) applyTheme(state.settings.theme);

  navigate('dashboard', { force: true });
}

async function boot() {
  registerViews({ dashboard, karma, add, journal, calendar, analytics, goals, wishlist, reflections, settings });
  initRouter();
  bindAuthForms();
  bindChrome();

  try {
    const { data } = await supabase.auth.getSession();
    await handleSession(data?.session || null);
  } catch (err) {
    console.error(err);
    showAuthScreen();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      resetState();
      showAuthScreen();
    }
    if (event === 'SIGNED_IN' && session && state.user?.id !== session.user.id) {
      await handleSession(session);
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      state.session = session;
    }
    if (event === 'PASSWORD_RECOVERY') {
      toast('برای تنظیم رمز جدید، ایمیلت را بررسی کن.', 'info', 5000);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user && Date.now() - (state.lastLoadedAt || 0) > 120000) {
      loadAll().then(rerender).catch(() => {});
    }
  });
}

boot();
