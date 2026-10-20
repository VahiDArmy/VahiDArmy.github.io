/**
 * Application entry point.
 * Boots theme, auth, header/footer, routes, then hides the splash.
 */

import { initTheme } from './core/theme.js';
import { initAuth } from './core/auth.js';
import { router } from './core/router.js';
import { appStore } from './core/store.js';
import { bus } from './utils/events.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';
import { toast } from './ui/toast.js';
import { attachTooltips } from './ui/tooltip.js';
import { ROUTES } from './config/constants.js';
import './ui/icons.js'; // register icons eagerly

/* ---- Splash helpers ---- */
function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  setTimeout(() => splash.remove(), 500);
}

/* ---- Router outlet helpers ---- */
function getOutlet() {
  return document.getElementById('app-main');
}

function showLoading() {
  const outlet = getOutlet();
  if (!outlet) return;
  outlet.innerHTML = `
    <div class="container">
      <div class="page-loading" aria-hidden="true">
        <div class="page-loading__row">
          <div class="skeleton skeleton--circle" style="width:56px;height:56px"></div>
          <div class="page-loading__col">
            <div class="skeleton skeleton--line" style="width:40%"></div>
            <div class="skeleton skeleton--line" style="width:70%"></div>
          </div>
        </div>
        <div class="skeleton skeleton--block"></div>
        <div class="skeleton skeleton--block"></div>
      </div>
    </div>`;
}

/* ---- Lazy page loaders (top-level await import) ---- */
const pages = {
  home: () => import('./pages/home.page.js'),
  people: () => import('./pages/people.page.js'),
  person: () => import('./pages/person.page.js'),
  theories: () => import('./pages/theories.page.js'),
  theory: () => import('./pages/theory.page.js'),
  rankings: () => import('./pages/rankings.page.js'),
  ranking: () => import('./pages/ranking.page.js'),
  tables: () => import('./pages/tables.page.js'),
  table: () => import('./pages/table.page.js'),
  login: () => import('./pages/login.page.js'),
  signup: () => import('./pages/signup.page.js'),
  forgot: () => import('./pages/forgot-password.page.js'),
  reset: () => import('./pages/reset-password.page.js'),
  callback: () => import('./pages/auth-callback.page.js'),
  profile: () => import('./pages/profile.page.js'),
  notFound: () => import('./pages/not-found.page.js'),
};

/* ---- Route registration ---- */
function registerRoutes() {
  const outlet = getOutlet();

  router.add(ROUTES.HOME, async (info) => {
    const mod = await pages.home();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.PEOPLE, async (info) => {
    const mod = await pages.people();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.PERSON(':id'), async (info) => {
    const mod = await pages.person();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.THEORIES, async (info) => {
    const mod = await pages.theories();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.THEORY(':id'), async (info) => {
    const mod = await pages.theory();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.RANKINGS, async (info) => {
    const mod = await pages.rankings();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.RANKING(':id'), async (info) => {
    const mod = await pages.ranking();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.TABLES, async (info) => {
    const mod = await pages.tables();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.TABLE(':id'), async (info) => {
    const mod = await pages.table();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.LOGIN, async (info) => {
    const mod = await pages.login();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.SIGNUP, async (info) => {
    const mod = await pages.signup();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.FORGOT_PASSWORD, async (info) => {
    const mod = await pages.forgot();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.RESET_PASSWORD, async (info) => {
    const mod = await pages.reset();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.AUTH_CALLBACK, async (info) => {
    const mod = await pages.callback();
    return mod.default(info, outlet);
  });
  router.add(ROUTES.PROFILE, async (info) => {
    const mod = await pages.profile();
    return mod.default(info, outlet);
  });

  // Catch-all
  router.add('/:rest*', async (info) => {
    const mod = await pages.notFound();
    return mod.default(info, outlet);
  });
}

/* ---- Global error surface ---- */
function installErrorSurface() {
  window.addEventListener('unhandledrejection', (e) => {
    // eslint-disable-next-line no-console
    console.error('[unhandled]', e.reason);
    if (e.reason?.message === 'AUTH_REQUIRED') return;
    toast.error(e.reason?.message || 'خطای غیرمنتظره‌ای رخ داد.');
  });
  window.addEventListener('error', (e) => {
    if (String(e.message || '').includes('ResizeObserver')) return;
  });
}

/* ---- Route-level flash feedback ---- */
function wireRouteFeedback() {
  bus.on('route:error', ({ error }) => {
    toast.error(error?.message || 'بارگذاری صفحه ناموفق بود.');
  });
  bus.on('route:notfound', () => {
    // The catch-all handler renders the 404 page, nothing more to do.
  });
  bus.on('route:after', () => {
    // Re-bind tooltips for freshly rendered DOM.
    attachTooltips(document.body);
  });
}

/* ---- Boot sequence ---- */
async function boot() {
  initTheme();
  installErrorSurface();

  // Mount chrome
  const headerRoot = document.getElementById('app-header');
  const footerRoot = document.getElementById('app-footer');
  if (headerRoot) mountHeader(headerRoot);
  if (footerRoot) mountFooter(footerRoot);

  // Initialise auth in parallel with router registration
  registerRoutes();
  wireRouteFeedback();

  try {
    await initAuth();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[boot] auth init failed', err);
  }

  // Route-level loading feedback
  const outlet = getOutlet();
  if (outlet) {
    // Show a lightweight skeleton on very first navigation only
    // (subsequent navigations render their own states).
    if (!window.location.hash) showLoading();
  }

  await router.start();

  // Small grace period so entrance transitions finish
  setTimeout(hideSplash, 60);
}

// Kick off
boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] fatal', err);
  hideSplash();
  toast.error('راه‌اندازی برنامه با خطا مواجه شد.');
});

/* Re-attach tooltips on theme/data changes */
bus.on('theme:toggled', () => attachTooltips(document.body));

/* Expose store/session for debugging (harmless, no secrets) */
window.__office__ = { store: appStore };