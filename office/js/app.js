/**
 * Application entry point.
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
import { initConsoleInterceptor } from './utils/console-interceptor.js';
import { initConsoleViewer } from './components/console-viewer.js';
import './ui/icons.js';

const consoleStore = initConsoleInterceptor();
initConsoleViewer(consoleStore);

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  setTimeout(() => splash.remove(), 500);
}

function getOutlet() { return document.getElementById('app-main'); }

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

const pages = {
  home:       () => import('./pages/home.page.js'),
  people:     () => import('./pages/people.page.js'),
  person:     () => import('./pages/person.page.js'),
  
  theories:   () => import('./pages/theories.page.js'),
  theoriesNew:() => import('./pages/theories-new.page.js'),
  theoriesEdit:() => import('./pages/theories-edit.page.js'),
  theory:     () => import('./pages/theory.page.js'),

  tellalls:   () => import('./pages/tellalls.page.js'),
  tellallsNew:() => import('./pages/tellalls-new.page.js'),
  tellallsEdit:() => import('./pages/tellalls-edit.page.js'),
  tellall:    () => import('./pages/tellall.page.js'),
  
  characterology:() => import('./pages/characterology.page.js'),
  characterologyNew:() => import('./pages/characterology-new.page.js'),
  characterologyDetail:() => import('./pages/characterology-detail.page.js'),

  rankings:   () => import('./pages/rankings.page.js'),
  ranking:    () => import('./pages/ranking.page.js'),
  tables:     () => import('./pages/tables.page.js'),
  table:      () => import('./pages/table.page.js'),
  login:      () => import('./pages/login.page.js'),
  signup:     () => import('./pages/signup.page.js'),
  forgot:     () => import('./pages/forgot-password.page.js'),
  reset:      () => import('./pages/reset-password.page.js'),
  callback:   () => import('./pages/auth-callback.page.js'),
  profile:    () => import('./pages/profile.page.js'),
  settings:   () => import('./pages/settings.page.js'),
  notFound:   () => import('./pages/not-found.page.js'),
};

function registerRoutes() {
  const outlet = getOutlet();

  router.add(ROUTES.HOME, async (info) => { const mod = await pages.home(); return mod.default(info, outlet); });

  // --- People ---
  router.add(ROUTES.PEOPLE, async (info) => { const mod = await pages.people(); return mod.default(info, outlet); });
  router.add(ROUTES.PERSON(':id'), async (info) => { const mod = await pages.person(); return mod.default(info, outlet); });

  // --- Theories ---
  router.add(ROUTES.THEORIES, async (info) => { const mod = await pages.theories(); return mod.default(info, outlet); });
  router.add('/theories/new', async (info) => { const mod = await pages.theoriesNew(); return mod.default(info, outlet); });
  router.add('/theories/:id/edit', async (info) => { const mod = await pages.theoriesEdit(); return mod.default(info, outlet); });
  router.add(ROUTES.THEORY(':id'), async (info) => { const mod = await pages.theory(); return mod.default(info, outlet); });

  // --- Tellalls ---
  router.add('/tellalls', async (info) => { const mod = await pages.tellalls(); return mod.default(info, outlet); });
  router.add('/tellalls/new', async (info) => { const mod = await pages.tellallsNew(); return mod.default(info, outlet); });
  router.add('/tellalls/:id/edit', async (info) => { const mod = await pages.tellallsEdit(); return mod.default(info, outlet); });
  router.add('/tellalls/:id', async (info) => { const mod = await pages.tellall(); return mod.default(info, outlet); });

  // --- Characterology (New) ---
  router.add(ROUTES.CHARACTEROLOGY, async (info) => { const mod = await pages.characterology(); return mod.default(info, outlet); });
  router.add('/characterology/new', async (info) => { const mod = await pages.characterologyNew(); return mod.default(info, outlet); });
  router.add(ROUTES.CHARACTEROLOGY_DETAIL(':id'), async (info) => { const mod = await pages.characterologyDetail(); return mod.default(info, outlet); });

  // --- Rankings ---
  router.add(ROUTES.RANKINGS, async (info) => { const mod = await pages.rankings(); return mod.default(info, outlet); });
  router.add('/rankings/new', async (info) => { toast.warning('به زودی...'); router.navigate(ROUTES.RANKINGS, { replace: true }); return () => {}; });
  router.add(ROUTES.RANKING(':id'), async (info) => { const mod = await pages.ranking(); return mod.default(info, outlet); });

  // --- Tables ---
  router.add(ROUTES.TABLES, async (info) => { const mod = await pages.tables(); return mod.default(info, outlet); });
  router.add('/tables/new', async (info) => { toast.warning('به زودی...'); router.navigate(ROUTES.TABLES, { replace: true }); return () => {}; });
  router.add(ROUTES.TABLE(':id'), async (info) => { const mod = await pages.table(); return mod.default(info, outlet); });

  // --- Auth & Profile ---
  router.add(ROUTES.LOGIN, async (info) => { const mod = await pages.login(); return mod.default(info, outlet); });
  router.add(ROUTES.SIGNUP, async (info) => { const mod = await pages.signup(); return mod.default(info, outlet); });
  router.add(ROUTES.FORGOT_PASSWORD, async (info) => { const mod = await pages.forgot(); return mod.default(info, outlet); });
  router.add(ROUTES.RESET_PASSWORD, async (info) => { const mod = await pages.reset(); return mod.default(info, outlet); });
  router.add(ROUTES.AUTH_CALLBACK, async (info) => { const mod = await pages.callback(); return mod.default(info, outlet); });
  router.add(ROUTES.PROFILE, async (info) => { const mod = await pages.profile(); return mod.default(info, outlet); });
  router.add('/settings', async (info) => { const mod = await pages.settings(); return mod.default(info, outlet); });

  // Catch-all
  router.add('/:rest*', async (info) => { const mod = await pages.notFound(); return mod.default(info, outlet); });
}

function installErrorSurface() {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled]', e.reason);
    if (e.reason?.message === 'AUTH_REQUIRED') return;
    toast.error(e.reason?.message || 'خطای غیرمنتظره‌ای رخ داد.');
  });
  window.addEventListener('error', (e) => {
    if (String(e.message || '').includes('ResizeObserver')) return;
  });
}

function wireRouteFeedback() {
  bus.on('route:error', ({ error }) => { toast.error(error?.message || 'بارگذاری صفحه ناموفق بود.'); });
  bus.on('route:after', () => { attachTooltips(document.body); });
}

async function boot() {
  initTheme();
  installErrorSurface();

  const headerRoot = document.getElementById('app-header');
  const footerRoot = document.getElementById('app-footer');
  if (headerRoot) mountHeader(headerRoot);
  if (footerRoot) mountFooter(footerRoot);

  registerRoutes();
  wireRouteFeedback();

  try { await initAuth(); } catch (err) { console.error('[boot] auth init failed', err); }

  import('./core/boot-extras.js').then((m) => m.installExtras()).catch((err) => console.warn('[boot] extras failed', err));

  const outlet = getOutlet();
  if (outlet && !window.location.hash) showLoading();

  await router.start();
  setTimeout(hideSplash, 60);
}

boot().catch((err) => {
  console.error('[boot] fatal', err);
  hideSplash();
  toast.error('راه‌اندازی برنامه با خطا مواجه شد.');
});

bus.on('theme:toggled', () => attachTooltips(document.body));
window.__office__ = { store: appStore };