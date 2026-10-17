/* ============================================================
   js/main.js
   FIXED: Wrapped the entire boot process in a super-safe 
          try/catch block that prints errors directly to the 
          index.html inline error box.
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
import { toast } from './ui/toast.js';
import { settingsService } from './services/index.js';
import { showLoader, hideLoader } from './ui/loader.js';
import { initErrorBoundary } from './core/error-boundary.js';
import { initCommandPalette } from './core/command-palette.js';

// Safe Error Printer for Boot
function printBootError(msg) {
  console.error(msg);
  const errDiv = byId('inline-error-log');
  if (errDiv) {
    errDiv.style.display = 'block';
    errDiv.textContent += `❌ BOOT ERROR: ${msg}\n\n`;
  }
}

ready(async () => {
  try {
    printBootError('1. Starting boot sequence...');
    
    initErrorBoundary();
    initTheme();

    if (!isSupabaseConfigured()) {
      printBootError('Supabase config missing!');
      return fatalConfig();
    }

    if (FEATURES.commandPalette) initCommandPalette();

    printBootError('2. Initializing Session (awaiting network)...');
    const outcome = await initSession();
    
    printBootError('3. Session initialized. Mounting auth page...');
    mountAuthPage();

    if (outcome.user) {
      printBootError('4. User found. Starting App...');
      await startApp();
    } else {
      printBootError('4. No user. Showing auth screen.');
      showAuthScreen();
      hideBootSplash();
    }

    bus.on(EVENTS.AUTH_SIGNED_IN, async () => {
      if (byId('app-shell')?.hidden !== false) await startApp();
    });
    bus.on(EVENTS.AUTH_SIGNED_OUT, () => stopApp());

  } catch (err) {
    printBootError(`FATAL EXCEPTION IN BOOT: ${err.message}\n${err.stack}`);
  }
});

async function startApp() {
  showLoader('در حال آماده‌سازی فضای شخصی…');
  try {
    printBootError('5. Registering routes...');
    await registerRoutes();

    printBootError('6. Mounting App Shell...');
    mountAppShell();

    printBootError('7. Fetching user settings...');
    const server = await settingsService.fetch().catch(() => null);

    printBootError('8. Showing App Shell...');
    showAppShell();

    const container = byId('page-container');
    if (container) {
      container.innerHTML = '';
      router.start(container);
    }

    registerGlobalShortcuts();
    shortcuts.start();
    printBootError('9. App Started Successfully!');
  } catch (err) {
    printBootError(`FATAL EXCEPTION IN STARTAPP: ${err.message}\n${err.stack}`);
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
  splash.classList.add('is-hidden');
  setTimeout(() => { splash.hidden = true; }, 700);
}

function fatalConfig() {
  const splash = byId('boot-splash');
  if (splash) splash.hidden = true;
  document.body.innerHTML = '<h1 style="color:red; text-align:center; margin-top:50px;">خطا: تنظیمات Supabase یافت نشد.</h1>';
}