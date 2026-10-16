/* ============================================================
   js/main.js
   Entry point: boot sequence, session, router, layout, shortcuts
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
import { APP, ROUTES, DEFAULT_ROUTE, LS_KEYS, NAV_ITEMS } from './config/app.config.js';
import { get as lsGet, set as lsSet } from './utils/storage.js';
import { toast, toastPromise } from './ui/toast.js';
import { settingsService } from './services/index.js';
import { emptyState } from './ui/empty-state.js';
import { skeletonPage } from './ui/skeleton.js';
import { showLoader, hideLoader } from './ui/loader.js';

/* ══════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════ */

ready(boot);

async function boot() {
  // 1. Theme first (avoid FOUC)
  try { initTheme(); } catch (err) { console.error('[boot] theme', err); }

  // 2. Verify Supabase configured
  if (!isSupabaseConfigured()) {
    return fatalConfig();
  }

  // 3. Wire global events
  wireGlobalEvents();

  // 4. Session
  let outcome;
  try {
    outcome = await initSession();
  } catch (err) {
    console.error('[boot] session error', err);
    outcome = { user: null };
  }

  // 5. Mount auth page (always, cheap)
  mountAuthPage();

  // 6. Branch on session
  if (outcome.user) {
    await startApp();
  } else {
    showAuthScreen();
    hideBootSplash();
  }

  // 7. React to future sign-in/out
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
}

/* ══════════════════════════════════════════════════════════
   Auth → App transition
   ══════════════════════════════════════════════════════════ */

async function startApp() {
  showLoader('در حال آماده‌سازی فضای شخصی…');
  try {
    // Register routes BEFORE mounting app shell (so first route render has them)
    registerRoutes();

    // Mount layout
    mountAppShell();

    // Apply user settings
    await applyUserSettings();

    // Show the shell
    showAppShell();

    // Start router
    const container = byId('page-container');
    if (container) router.start(container);

    // Start shortcuts
    registerGlobalShortcuts();
    shortcuts.start();

    // Track last route (used to restore on next visit)
    bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => {
      try { lsSet(LS_KEYS.LAST_ROUTE, path); } catch { /* noop */ }
    });

    // Welcome toast (first auth only)
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
  // Reset local view state
  try { lsSet(LS_KEYS.ONBOARDED, false); } catch { /* noop */ }
}

/* ══════════════════════════════════════════════════════════
   Routes — real page modules land in later phases.
   Here we ship dashboard + placeholders so the app runs.
   ══════════════════════════════════════════════════════════ */

function registerRoutes() {
  // Dashboard
  router.register(`/${ROUTES.DASHBOARD}`, {
    title: 'داشبورد',
    render: async (container) => {
      const { renderDashboard } = await import('./pages/dashboard.page.js').catch(() => ({ renderDashboard: null }));
      if (renderDashboard) return renderDashboard(container);
      container.appendChild(skeletonPage({ variant: 'grid' }));
      await new Promise((r) => setTimeout(r, 400));
      container.innerHTML = '';
      container.appendChild(emptyState({
        icon: '🏠',
        title: 'داشبورد',
        message: 'این بخش در فاز بعدی تکمیل می‌شود. فعلاً از منوی کناری «دروغ‌ها» را باز کنید.',
      }));
    },
  });

  // Lies list
  router.register(`/${ROUTES.LIES}`, {
    title: 'دروغ‌ها',
    render: async (container, _params, query) => {
      const mod = await import('./pages/lies.page.js').catch(() => null);
      if (mod?.renderLies) return mod.renderLies(container, query);
      container.appendChild(emptyState({
        icon: '🎭',
        title: 'لیست دروغ‌ها',
        message: 'این بخش در فاز بعدی تکمیل می‌شود.',
        action: { label: 'بازگشت به داشبورد', onClick: () => { location.hash = `#/${ROUTES.DASHBOARD}`; } },
      }));
    },
  });

  // Lie detail
  router.register('/lie/:id', {
    title: 'جزئیات',
    render: async (container, params) => {
      const mod = await import('./pages/lie-detail.page.js').catch(() => null);
      if (mod?.renderLieDetail) return mod.renderLieDetail(container, params.id);
      container.appendChild(emptyState({
        icon: '🔍',
        title: 'جزئیات دروغ',
        message: `شناسه: ${params.id} — این بخش در فاز بعدی تکمیل می‌شود.`,
        action: { label: 'بازگشت', onClick: () => history.back() },
      }));
    },
  });

  // Analytics
  router.register(`/${ROUTES.ANALYTICS}`, {
    title: 'تحلیل و آمار',
    render: async (container) => {
      const mod = await import('./pages/analytics.page.js').catch(() => null);
      if (mod?.renderAnalytics) return mod.renderAnalytics(container);
      container.appendChild(emptyState({ icon: '📊', title: 'تحلیل و آمار', message: 'به‌زودی…' }));
    },
  });

  // Tags / Categories
  router.register(`/${ROUTES.TAGS}`, {
    title: 'دسته‌ها و برچسب‌ها',
    render: async (container) => {
      const mod = await import('./pages/tags.page.js').catch(() => null);
      if (mod?.renderTags) return mod.renderTags(container);
      container.appendChild(emptyState({ icon: '🏷️', title: 'دسته‌ها و برچسب‌ها', message: 'به‌زودی…' }));
    },
  });

  // Archive
  router.register(`/${ROUTES.ARCHIVE}`, {
    title: 'بایگانی',
    render: async (container) => {
      container.appendChild(emptyState({ icon: '📦', title: 'بایگانی', message: 'به‌زودی…' }));
    },
  });

  // Trash
  router.register(`/${ROUTES.TRASH}`, {
    title: 'سطل زباله',
    render: async (container) => {
      container.appendChild(emptyState({ icon: '🗑️', title: 'سطل زباله', message: 'به‌زودی…' }));
    },
  });

  // Settings
  router.register(`/${ROUTES.SETTINGS}`, {
    title: 'تنظیمات',
    render: async (container) => {
      const mod = await import('./pages/settings.page.js').catch(() => null);
      if (mod?.renderSettings) return mod.renderSettings(container);
      container.appendChild(emptyState({ icon: '⚙️', title: 'تنظیمات', message: 'به‌زودی…' }));
    },
  });

  // About
  router.register(`/${ROUTES.ABOUT}`, {
    title: 'درباره',
    render: (container) => {
      container.appendChild(emptyState({
        icon: 'ℹ️',
        title: 'آینهٔ درون',
        message: `نسخهٔ ${APP.version} — یک ژورنال کاملاً خصوصی برای رویارویی با دروغ‌هایی که به خودمان می‌گوییم.`,
      }));
    },
  });

  // Auth guard: block everything that is not public
  router.beforeEach(async ({ route }) => {
    if (route?.public) return true;
    if (isAuthenticated()) return true;
    // Not authenticated → show auth screen and cancel
    showAuthScreen();
    return false;
  });
}

/* ══════════════════════════════════════════════════════════
   Shortcuts
   ══════════════════════════════════════════════════════════ */

function registerGlobalShortcuts() {
  // Ctrl/Cmd+K → focus search
  shortcuts.register({
    combo: 'ctrl+k', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'جست‌وجوی سراسری', group: 'ناوبری', allowInInput: true,
    handler: () => bus.emit('ui:focus-search'),
  });
  shortcuts.register({
    combo: 'meta+k', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'جست‌وجوی سراسری (⌘K)', group: 'ناوبری', allowInInput: true,
    handler: () => bus.emit('ui:focus-search'),
  });

  // N → new lie
  shortcuts.register({
    combo: 'n', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'ثبت دروغ جدید', group: 'عملیات',
    handler: () => { location.hash = '#/lies?new=1'; },
  });

  // ? → help
  shortcuts.register({
    combo: 'shift+?', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'راهنمای میان‌برها', group: 'کمک',
    handler: () => byId('help-btn')?.click(),
  });
  shortcuts.register({
    combo: '?', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'راهنمای میان‌برها', group: 'کمک',
    handler: () => byId('help-btn')?.click(),
  });

  // Esc → close drawer
  shortcuts.register({
    combo: 'esc', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'بستن پنجره/کشو', group: 'عمومی',
    handler: async () => {
      const { isMobileSidebarOpen, closeMobileSidebar } = await import('./layout/sidebar.js');
      if (isMobileSidebarOpen()) closeMobileSidebar();
    },
  });

  // / → focus search
  shortcuts.register({
    combo: '/', scope: SHORTCUT_SCOPES.GLOBAL,
    label: 'فوکوس روی جست‌وجو', group: 'ناوبری',
    handler: () => bus.emit('ui:focus-search'),
  });

  // G + <letter> sequences
  for (const item of NAV_ITEMS) {
    if (!item.shortcut) continue;
    const letter = item.shortcut.split(/\s+/)[1] || '';
    if (!letter) continue;
    shortcuts.register({
      combo: `g ${letter.toLowerCase()}`,
      scope: SHORTCUT_SCOPES.GLOBAL,
      label: `رفتن به ${item.label}`,
      group: 'ناوبری سریع',
      handler: () => { location.hash = `#/${item.id}`; },
    });
  }
}

/* ══════════════════════════════════════════════════════════
   Global event wiring
   ══════════════════════════════════════════════════════════ */

function wireGlobalEvents() {
  // Persist theme changes to server
  bus.on(EVENTS.THEME_CHANGED, (t) => {
    if (!isAuthenticated()) return;
    settingsService.update({ theme: t.theme, accent: t.accent, font_size: t.fontSize })
      .catch(() => { /* silent */ });
  });

  // Settings updates
  bus.on(EVENTS.ACCENT_CHANGED, (a) => setAccent(a.id || a));
  bus.on(EVENTS.FONTSIZE_CHANGED, (s) => setFontSize(s));

  // Offline banner toast
  bus.on(EVENTS.OFFLINE, () => toast.warning('اتصال اینترنت قطع شد.'));
  bus.on(EVENTS.ONLINE, () => toast.success('اتصال برقرار شد.', { duration: 1800 }));

  // Uncaught errors
  window.addEventListener('unhandledrejection', (ev) => {
    console.error('[unhandled]', ev.reason);
  });

  // Mobile safe-area class
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('is-standalone');
  }

  // Prevent double-tap zoom on iOS
  let lastTouch = 0;
  document.addEventListener('touchend', (ev) => {
    const now = Date.now();
    if (now - lastTouch <= 300) ev.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

/* ══════════════════════════════════════════════════════════
   User settings → DOM
   ══════════════════════════════════════════════════════════ */

async function applyUserSettings() {
  const s = settingsService.getLocal();
  if (!s) return;
  // Theme is already applied from local. If server says different, update.
  try {
    const server = await settingsService.fetch();
    if (server) {
      setTheme(server.theme);
      setAccent(server.accent);
      setFontSize(server.font_size);
    }
  } catch { /* keep local */ }
}

/* ══════════════════════════════════════════════════════════
   Utils
   ══════════════════════════════════════════════════════════ */

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

/* Re-export a few globals for debugging in the console */
window.__app = Object.freeze({
  version: APP.version,
  router,
  bus,
  refreshSession,
  toast,
  toastPromise,
});