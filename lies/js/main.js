/* ============================================================
   js/main.js
   Entry point: boot sequence, session, router, layout, shortcuts.
   FIXED: Added initDebugLogger and auto-open log on timeout.
   ============================================================ */

import { ready, byId } from './utils/dom.js';
import { initTheme, setTheme, setAccent, setFontSize } from './ui/theme.js';
import { isSupabaseConfigured } from './config/supabase.config.js';
import { initSession, refreshSession, isAuthenticated } from './core/session.js';
import { mountAppShell, showAppShell, showAuthScreen } from './layout/app-shell.js';
import { mountAuthPage } from './pages/auth.page.js';
import { router } from './core/router.js';
import { shortcuts } from './core/shortcuts.js';
import { bus } from './core/event-bus.js';
import { EVENTS, SHORTCUT_SCOPES } from './config/constants.js';
import { APP, ROUTES, DEFAULT_ROUTE, LS_KEYS, NAV_ITEMS, FEATURES } from './config/app.config.js';
import { get as lsGet, set as lsSet } from './utils/storage.js';
import { toast, toastPromise } from './ui/toast.js';
import { settingsService } from './services/index.js';
import { emptyState } from './ui/empty-state.js';
import { skeletonPage } from './ui/skeleton.js';
import { showLoader, hideLoader } from './ui/loader.js';
import { initErrorBoundary, reportError } from './core/error-boundary.js';
import { initCommandPalette } from './core/command-palette.js';
import { getSnapshot, observeInteractions, observeLongTasks } from './utils/performance.js';
import { initDebugLogger, showDebugLog } from './utils/debug-logger.js';

/* ══════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════ */

ready(boot);

async function boot() {
  // 0. Init Logger FIRST
  initDebugLogger();
  console.info('[boot] Starting boot sequence...');

  // Safety net: force-open logs and hide splash after 5 seconds
  const bootTimeout = setTimeout(() => {
    console.warn('[boot] Boot sequence took too long (5s). Opening logs...');
    showDebugLog();
    hideBootSplash();
    hideLoader();
    if (!isAuthenticated()) {
      showAuthScreen();
    } else {
      const container = byId('page-container');
      if (container && container.innerHTML.trim() === '') {
        renderFatalError(container, new Error('اتصال به سرور طول کشید. لطفاً لاگ را بررسی کنید.'));
      }
    }
  }, 5000);

  try {
    try { initErrorBoundary(); } catch (err) { console.error('[boot] error-boundary', err); }
    try { initTheme(); } catch (err) { console.error('[boot] theme', err); }

    if (!isSupabaseConfigured()) {
      clearTimeout(bootTimeout);
      console.error('[boot] Supabase is not configured properly.');
      return fatalConfig();
    }

    wireGlobalEvents();

    try {
      if (FEATURES.commandPalette) initCommandPalette();
    } catch (err) { console.warn('[boot] command-palette', err); }

    console.info('[boot] Initializing session...');
    let outcome;
    try {
      outcome = await initSession();
    } catch (err) {
      console.error('[boot] session error', err);
      reportError(err, { silent: true, context: 'session-init' });
      outcome = { user: null };
    }

    console.info('[boot] Mounting auth page...');
    mountAuthPage();

    if (outcome.user) {
      console.info('[boot] User found. Starting app...');
      await startApp();
    } else {
      console.info('[boot] No user session. Showing auth screen.');
      showAuthScreen();
      hideBootSplash();
    }

    bus.on(EVENTS.AUTH_READY, async ({ user }) => {
      if (user && byId('app-shell')?.hidden !== false) {
        await startApp();
      }
    });
    bus.on(EVENTS.AUTH_SIGNED_IN, async () => {
      if (byId('app-shell')?.hidden !== false) {
        await startApp();
      }
    });
    bus.on(EVENTS.AUTH_SIGNED_OUT, () => {
      stopApp();
    });

    registerServiceWorker();

    try {
      observeInteractions();
      observeLongTasks();
    } catch { /* silent */ }
    
    console.info('[boot] Boot sequence completed.');
  } finally {
    clearTimeout(bootTimeout);
  }
}

/* ══════════════════════════════════════════════════════════
   Auth → App transition
   ══════════════════════════════════════════════════════════ */

async function startApp() {
  showLoader('در حال آماده‌سازی فضای شخصی…');
  try {
    console.info('[startApp] Registering routes...');
    await registerRoutes();
    
    console.info('[startApp] Mounting app shell...');
    mountAppShell();
    
    console.info('[startApp] Applying settings...');
    await applyUserSettings();
    
    console.info('[startApp] Showing app shell...');
    showAppShell();

    const container = byId('page-container');
    if (container) {
      container.innerHTML = '';
      try {
        console.info('[startApp] Starting router...');
        router.start(container);
      } catch (err) {
        console.error('[startApp] router.start threw', err);
        renderFatalError(container, err);
      }
    }

    registerGlobalShortcuts();
    shortcuts.start();

    try {
      const { initScheduledReminders } = await import('./ui/notifications.js');
      initScheduledReminders();
    } catch { /* silent */ }

    bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => {
      try { lsSet(LS_KEYS.LAST_ROUTE, path); } catch { /* noop */ }
    });

    window.addEventListener('scroll', onScrollForShadow, { passive: true });

    if (!lsGet(LS_KEYS.ONBOARDED, false)) {
      lsSet(LS_KEYS.ONBOARDED, true);
      setTimeout(() => {
        toast({
          title: 'به آینهٔ درون خوش آمدید ✨',
          message: 'هر چه می‌نویسید فقط برای شما قابل دیدن است. هیچ چیز به اشتراک گذاشته نمی‌شود.',
          duration: 8000,
        });
      }, 600);
    }
  } catch (err) {
    console.error('[startApp] fatal', err);
    const container = byId('page-container');
    if (container) renderFatalError(container, err);
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
  try { lsSet(LS_KEYS.ONBOARDED, false); } catch { /* noop */ }
}

function onScrollForShadow() {
  const scrolled = window.scrollY > 4;
  document.body.classList.toggle('is-scrolled', scrolled);
}

function renderFatalError(container, err) {
  const msg = err?.message || String(err) || 'خطای نامشخص';
  container.innerHTML = `
    <div class="page-error" style="margin: 40px auto; max-width: 600px;">
      <div class="page-error__icon">⚠️</div>
      <h2 class="page-error__title">خطا در بارگذاری صفحه</h2>
      <p class="page-error__message" style="color: var(--text-secondary); font-family: monospace; direction: ltr; text-align: left; background: var(--bg-inset); padding: 12px; border-radius: 8px; margin-top: 12px; word-break: break-all;">${msg}</p>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn btn--primary" onclick="location.reload()">بارگذاری دوباره</button>
        <button class="btn btn--ghost" onclick="document.getElementById('show-logs-btn')?.click()">مشاهده لاگ</button>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   Routes
   ══════════════════════════════════════════════════════════ */

async function registerRoutes() {
  const routes = [
    { path: `/${ROUTES.DASHBOARD}`, title: 'داشبورد', load: () => import('./pages/dashboard.page.js').then((m) => m.renderDashboard) },
    { path: `/${ROUTES.LIES}`,      title: 'دروغ‌ها', load: () => import('./pages/lies.page.js').then((m) => m.renderLies) },
    { path: '/lie/:id',             title: 'جزئیات', load: () => import('./pages/lie-detail.page.js').then((m) => m.renderLieDetail) },
    { path: `/${ROUTES.ANALYTICS}`, title: 'تحلیل و آمار', load: () => import('./pages/analytics.page.js').then((m) => m.renderAnalytics) },
    { path: `/${ROUTES.TAGS}`,      title: 'دسته‌ها و برچسب‌ها', load: () => import('./pages/tags.page.js').then((m) => m.renderTags) },
    { path: `/${ROUTES.ARCHIVE}`,   title: 'بایگانی', load: () => import('./pages/archive.page.js').then((m) => m.renderArchive) },
    { path: `/${ROUTES.TRASH}`,     title: 'سطل زباله', load: () => import('./pages/trash.page.js').then((m) => m.renderTrash) },
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

/* ══════════════════════════════════════════════════════════
   Shortcuts
   ══════════════════════════════════════════════════════════ */

function registerGlobalShortcuts() {
  shortcuts.register({ combo: 'ctrl+k', scope: SHORTCUT_SCOPES.GLOBAL, label: 'پالت دستور', group: 'ناوبری', allowInInput: true, handler: () => bus.emit(EVENTS.COMMAND_PALETTE_OPEN) });
  shortcuts.register({ combo: 'meta+k', scope: SHORTCUT_SCOPES.GLOBAL, label: 'پالت دستور (⌘K)', group: 'ناوبری', allowInInput: true, handler: () => bus.emit(EVENTS.COMMAND_PALETTE_OPEN) });
  shortcuts.register({ combo: 'ctrl+p', scope: SHORTCUT_SCOPES.GLOBAL, label: 'جست‌وجوی سراسری', group: 'ناوبری', allowInInput: true, handler: () => bus.emit('ui:focus-search') });
  shortcuts.register({ combo: '/', scope: SHORTCUT_SCOPES.GLOBAL, label: 'فوکوس روی جست‌وجو', group: 'ناوبری', handler: () => bus.emit('ui:focus-search') });
  shortcuts.register({ combo: 'n', scope: SHORTCUT_SCOPES.GLOBAL, label: 'ثبت دروغ جدید', group: 'عملیات', handler: () => { location.hash = '#/lies?new=1'; } });
  shortcuts.register({ combo: 'shift+?', scope: SHORTCUT_SCOPES.GLOBAL, label: 'راهنمای میان‌برها', group: 'کمک', handler: () => byId('help-btn')?.click() });
  shortcuts.register({ combo: '?', scope: SHORTCUT_SCOPES.GLOBAL, label: 'راهنمای میان‌برها', group: 'کمک', handler: () => byId('help-btn')?.click() });
  shortcuts.register({ combo: 'esc', scope: SHORTCUT_SCOPES.GLOBAL, label: 'بستن پنجره/کشو', group: 'عمومی', handler: async () => {
      const { isMobileSidebarOpen, closeMobileSidebar } = await import('./layout/sidebar.js');
      if (isMobileSidebarOpen()) closeMobileSidebar();
  } });
  for (const item of NAV_ITEMS) {
    if (!item.shortcut) continue;
    const letter = item.shortcut.split(/\s+/)[1] || '';
    if (!letter) continue;
    shortcuts.register({ combo: `g ${letter.toLowerCase()}`, scope: SHORTCUT_SCOPES.GLOBAL, label: `رفتن به ${item.label}`, group: 'ناوبری سریع', handler: () => { location.hash = `#/${item.id}`; } });
  }
}

/* ══════════════════════════════════════════════════════════
   Global event wiring
   ══════════════════════════════════════════════════════════ */

function wireGlobalEvents() {
  bus.on(EVENTS.THEME_CHANGED, (t) => {
    if (!isAuthenticated()) return;
    settingsService.update({ theme: t.theme, accent: t.accent, font_size: t.fontSize }).catch(() => { /* silent */ });
  });
  bus.on(EVENTS.ACCENT_CHANGED, (a) => setAccent(a.id || a));
  bus.on(EVENTS.FONTSIZE_CHANGED, (s) => setFontSize(s));
  bus.on(EVENTS.OFFLINE, () => toast.warning('اتصال اینترنت قطع شد.'));
  bus.on(EVENTS.ONLINE, () => toast.success('اتصال برقرار شد.', { duration: 1800 }));
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('is-standalone');
  }
  let lastTouch = 0;
  document.addEventListener('touchend', (ev) => {
    const now = Date.now();
    if (now - lastTouch <= 300) ev.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

async function applyUserSettings() {
  const s = settingsService.getLocal();
  if (!s) return;
  try {
    const server = await settingsService.fetch();
    if (server) {
      setTheme(server.theme);
      setAccent(server.accent);
      setFontSize(server.font_size);
    }
  } catch { /* keep local */ }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { scope: './' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => { console.warn('[SW] registration failed', err); });
  });
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

  const box = document.createElement('div');
  box.className = 'fatal-config';
  box.innerHTML = `
    <div class="fatal-config__card">
      <div class="fatal-config__icon">⚠️</div>
      <h1 class="fatal-config__title">اتصال به Supabase تنظیم نشده است</h1>
      <p class="fatal-config__message">
        لطفاً مقادیر <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> را در فایل
        <code>js/config/supabase.config.js</code> وارد کنید و صفحه را دوباره بارگذاری کنید.
      </p>
    </div>
  `;
  document.body.appendChild(box);
}

window.__app = Object.freeze({
  version: APP.version,
  build: APP.build,
  router,
  bus,
  refreshSession,
  toast,
  toastPromise,
  getSnapshot,
  reportError,
});