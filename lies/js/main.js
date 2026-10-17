/* ============================================================
   js/main.js
   FIXED: Added a global window.onerror handler that prints 
          a visible red box if any code fails to load.
   ============================================================ */

import { ready, byId } from './utils/dom.js';
import { initTheme } from './ui/theme.js';
import { isSupabaseConfigured } from './config/supabase.config.js';
import { initSession, isAuthenticated } from './core/session.js';
import { mountAppShell, showAppShell, showAuthScreen } from './layout/app-shell.js';
import { mountAuthPage } from './pages/auth.page.js';
import { router } from './core/router.js';
import { shortcuts } from './core/shortcuts.js';
import { bus } from './core/event-bus.js';
import { EVENTS, SHORTCUT_SCOPES } from './config/constants.js';
import { APP, ROUTES, LS_KEYS, NAV_ITEMS, FEATURES } from './config/app.config.js';
import { get as lsGet, set as lsSet } from './utils/storage.js';
import { showLoader, hideLoader } from './ui/loader.js';
import { initErrorBoundary } from './core/error-boundary.js';
import { initCommandPalette } from './core/command-palette.js';

// 🛡️ GLOBAL ERROR HANDLER (Shows error on screen)
window.addEventListener('error', function(e) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:10px;z-index:99999;font-family:monospace;font-size:12px;direction:ltr;text-align:left;';
  box.textContent = 'ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno;
  document.body.appendChild(box);
});

ready(async () => {
  try { mountAuthPage(); } catch(e) { console.error('Auth mount failed', e); }

  setTimeout(() => {
    const splash = byId('boot-splash');
    if (splash && splash.style.display !== 'none') {
      console.warn('Boot taking too long. Forcing UI.');
      showAuthScreen();
      hideBootSplash();
    }
  }, 1500);

  try {
    try { localStorage.removeItem('az:sidebar:collapsed'); } catch(e){}

    initErrorBoundary();
    initTheme();

    if (!isSupabaseConfigured()) return fatalConfig();
    if (FEATURES.commandPalette) initCommandPalette();

    const outcome = await initSession();

    if (outcome.user) {
      await startApp();
    } else {
      showAuthScreen();
      hideBootSplash();
    }

    bus.on(EVENTS.AUTH_SIGNED_IN, async () => {
      if (byId('app-shell')?.hidden !== false) await startApp();
    });
    bus.on(EVENTS.AUTH_SIGNED_OUT, () => stopApp());

  } catch (err) {
    console.error('EXCEPTION IN BOOT:', err);
    showAuthScreen();
    hideBootSplash();
  }
});

async function startApp() {
  showLoader('در حال آماده‌سازی…');
  try {
    await registerRoutes();
    mountAppShell();
    showAppShell();

    const container = byId('page-container');
    if (container) {
      container.innerHTML = '';
      router.start(container);
    }

    registerGlobalShortcuts();
    shortcuts.start();
  } catch (err) {
    console.error('EXCEPTION IN STARTAPP:', err);
  } finally {
    hideBootSplash();
    hideLoader();
  }
}

function stopApp() {
  shortcuts.stop();
  router.stop();
  if (byId('page-container')) byId('page-container').innerHTML = '';
  showAuthScreen();
}

async function registerRoutes() {
  const routes = [
    { path: `/${ROUTES.DASHBOARD}`, title: 'داشبورد', load: () => import('./pages/dashboard.page.js').then((m) => m.renderDashboard) },
    { path: `/${ROUTES.LIES}`,      title: 'دروغ‌ها', load: () => import('./pages/lies.page.js').then((m) => m.renderLies) },
    { path: '/lie/:id',             title: 'جزئیات', load: () => import('./pages/lie-detail.page.js').then((m) => m.renderLieDetail) },
    { path: `/${ROUTES.ANALYTICS}`, title: 'تحلیل', load: () => import('./pages/analytics.page.js').then((m) => m.renderAnalytics) },
    { path: `/${ROUTES.TAGS}`,      title: 'دسته‌ها', load: () => import('./pages/tags.page.js').then((m) => m.renderTags) },
    { path: `/${ROUTES.ARCHIVE}`,   title: 'بایگانی', load: () => import('./pages/archive.page.js').then((m) => m.renderArchive) },
    { path: `/${ROUTES.TRASH}`,     title: 'زباله', load: () => import('./pages/trash.page.js').then((m) => m.renderTrash) },
    { path: `/${ROUTES.SETTINGS}`,  title: 'تنظیمات', load: () => import('./pages/settings.page.js').then((m) => m.renderSettings) },
    { path: `/${ROUTES.ABOUT}`,     title: 'درباره', load: () => import('./pages/about.page.js').then((m) => m.renderAbout) },
  ];

  for (const r of routes) {
    router.register(r.path, {
      title: r.title,
      render: async (container, params, query) => {
        const renderFn = await r.load();
        return renderFn(container, params, query);
      },
    });
  }

  router.beforeEach(async ({ route }) => {
    if (route?.public) return true;
    if (isAuthenticated()) return true;
    showAuthScreen();
    return false;
  });
}

function registerGlobalShortcuts() {
  shortcuts.register({ combo: 'n', scope: SHORTCUT_SCOPES.GLOBAL, label: 'ثبت جدید', group: 'عملیات', handler: () => { location.hash = '#/lies?new=1'; } });
  for (const item of NAV_ITEMS) {
    if (!item.shortcut) continue;
    const letter = item.shortcut.split(/\s+/)[1] || '';
    if (!letter) continue;
    shortcuts.register({ combo: `g ${letter.toLowerCase()}`, scope: SHORTCUT_SCOPES.GLOBAL, label: `رفتن به ${item.label}`, group: 'ناوبری', handler: () => { location.hash = `#/${item.id}`; } });
  }
}

function hideBootSplash() {
  const splash = byId('boot-splash');
  if (!splash) return;
  splash.style.display = 'none';
  splash.classList.add('is-hidden');
  setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 700);
}

function fatalConfig() {
  const splash = byId('boot-splash');
  if (splash) splash.remove();
  document.body.innerHTML = '<h1 style="color:red; text-align:center; margin-top:50px;">خطا: تنظیمات Supabase یافت نشد.</h1>';
}