/* ============================================================
   THEORIES STUDIO — Application bootstrap
   Wires router, shell, auth, and view renderers together.
   ============================================================ */
import { sb, getSupabase } from './supabase.js';
import { state, initTheme, subscribe, setState, emit } from './state.js';
import { startRouter, installLinkInterceptor, registerRoute, setBreadcrumbs } from './router.js';
import { initAuth, loadProfile } from './auth.js';
import { initShell } from './shell.js';
import { showLoading, hideLoading, toastError, toastInfo } from './ui.js';
import { $, sleep } from './utils.js';
import { loadCounts } from './data.js';

import { renderHome } from './views/home.js';
import { renderTheories } from './views/theories.js';
import { renderTheoryDetail } from './views/theory-detail.js';
import { renderTheoryForm } from './views/theory-form.js';
import { renderObjects, renderObjectDetail } from './views/objects.js';
import { renderGallery } from './views/gallery.js';
import { renderTimeline } from './views/timeline.js';
import { renderBookmarks } from './views/bookmarks.js';
import { renderSearch } from './views/search.js';
import { renderSettings } from './views/settings.js';
import { renderAuth } from './views/auth.js';
import { renderNotFound } from './views/not-found.js';

/* ---------------- Render wrapper ---------------- */
const root = () => document.getElementById('view-root');

const safeRender = (renderFn, opts = {}) => async (ctx = {}) => {
  showLoading();
  try {
    await renderFn(root(), ctx);
  } catch (err) {
    console.error('[render]', err);
    root().innerHTML = '';
    const box = document.createElement('div');
    box.className = 'page';
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__art" aria-hidden="true">
          <svg viewBox="0 0 200 160" fill="none"><circle cx="100" cy="80" r="42" stroke="currentColor" stroke-width="2" opacity=".5"/><path d="M84 76l10 12 22-22" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>
        </div>
        <h3 class="empty-state__title">خطایی رخ داد</h3>
        <p class="empty-state__desc">${(err && err.message) ? String(err.message).replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s])) : 'مشکلی در بارگذاری صفحه پیش آمد.'}</p>
        <div class="empty-state__actions">
          <button class="btn btn--primary" onclick="location.hash='#/home'">بازگشت به خانه</button>
          <button class="btn" onclick="location.reload()">تلاش دوباره</button>
        </div>
      </div>
    `;
    root().appendChild(box);
  } finally {
    hideLoading();
  }
};

/* ---------------- Register routes ---------------- */
const registerAll = () => {
  registerRoute('home', safeRender(renderHome));
  registerRoute('theories', safeRender(renderTheories));
  registerRoute('theory', safeRender(renderTheoryDetail));
  registerRoute('theory-new', safeRender(renderTheoryForm));
  registerRoute('theory-edit', safeRender(renderTheoryForm));
  registerRoute('objects', safeRender(renderObjects));
  registerRoute('object', safeRender(renderObjectDetail));
  registerRoute('gallery', safeRender(renderGallery));
  registerRoute('timeline', safeRender(renderTimeline));
  registerRoute('bookmarks', safeRender(renderBookmarks));
  registerRoute('search', safeRender(renderSearch));
  registerRoute('settings', safeRender(renderSettings));
  registerRoute('auth', safeRender(renderAuth));
  registerRoute('not-found', safeRender(renderNotFound));
};

/* ---------------- URL → route params passthrough ---------------- */
const attachQueryParamsToRender = () => {
  // router already passes `query`, but views like theories also look at
  // window.location; nothing extra needed here. Kept for future extension.
};

/* ---------------- Hot-route breadcrumbs ---------------- */
const breadcrumbsForRoute = (route) => {
  switch (route.name) {
    case 'home': return [{ label: 'خانه', href: '#/home' }];
    case 'theories': return [{ label: 'خانه', href: '#/home' }, { label: 'نظریه‌ها' }];
    case 'theory-new': return [{ label: 'خانه', href: '#/home' }, { label: 'نظریه‌ها', href: '#/theories' }, { label: 'نظریه جدید' }];
    case 'theory-edit': return [{ label: 'خانه', href: '#/home' }, { label: 'نظریه‌ها', href: '#/theories' }, { label: 'ویرایش' }];
    case 'objects': return [{ label: 'خانه', href: '#/home' }, { label: 'اشیاء' }];
    case 'object': return [{ label: 'خانه', href: '#/home' }, { label: 'اشیاء', href: '#/objects' }, { label: 'جزئیات' }];
    case 'gallery': return [{ label: 'خانه', href: '#/home' }, { label: 'گالری' }];
    case 'timeline': return [{ label: 'خانه', href: '#/home' }, { label: 'خط زمان' }];
    case 'bookmarks': return [{ label: 'خانه', href: '#/home' }, { label: 'نشان‌شده‌ها' }];
    case 'search': return [{ label: 'خانه', href: '#/home' }, { label: 'جستجو' }];
    case 'settings': return [{ label: 'خانه', href: '#/home' }, { label: 'تنظیمات' }];
    case 'auth': return [{ label: 'خانه', href: '#/home' }, { label: 'ورود' }];
    default: return [{ label: 'خانه', href: '#/home' }];
  }
};

/* ---------------- Refresh counts on auth ---------------- */
const refreshCounts = async () => {
  try {
    const counts = await loadCounts();
    if (counts && Object.keys(counts).length) {
      setState(counts, 'counts');
      updateBadges(counts);
    }
  } catch (e) { /* silent */ }
};

const updateBadges = (counts) => {
  const map = {
    theories: counts.theoriesCount,
    objects: counts.objectsCount,
    gallery: counts.galleryCount,
    timeline: counts.timelineCount,
    bookmarks: counts.bookmarksCount
  };
  Object.entries(map).forEach(([key, value]) => {
    const badge = document.querySelector(`[data-badge="${key}"]`);
    if (!badge) return;
    if (!value || value === 0) {
      badge.hidden = true;
      badge.textContent = '';
    } else {
      badge.hidden = false;
      badge.textContent = new Intl.NumberFormat('fa-IR').format(value);
    }
  });
  // Sidebar activity meter
  const meter = document.querySelector('[data-meter="activity"]');
  const stat = document.querySelector('[data-stat="month-activity"]');
  const activity = (counts.theoriesCount || 0) + (counts.objectsCount || 0) + (counts.galleryCount || 0);
  if (meter) meter.style.width = `${Math.min(100, Math.round((activity / 50) * 100))}%`;
  if (stat) stat.textContent = new Intl.NumberFormat('fa-IR').format(activity);
};

/* ---------------- Subscription to app events ---------------- */
const wireSubscriptions = () => {
  subscribe('route', (route) => {
    setBreadcrumbs(breadcrumbsForRoute(route));
    // keep sidebar collapsed state on mobile after navigation
    const app = document.getElementById('app');
    if (window.innerWidth < 1080) app.classList.remove('is-mobile-open');
  });

  subscribe('auth:change', async (ev) => {
    if (ev?.event === 'SIGNED_IN') {
      toastInfo('ورود موفق', 'خوش برگشتید');
      await refreshCounts();
    }
    if (ev?.event === 'SIGNED_OUT') {
      updateBadges({});
    }
  });

  subscribe('counts', (c) => updateBadges(c));

  // Refresh counts after any theory/object change
  subscribe('theories:changed', () => refreshCounts());
  subscribe('objects:changed', () => refreshCounts());
  subscribe('images:changed', () => refreshCounts());
};

/* ---------------- Boot sequence ---------------- */
const boot = async () => {
  const splash = document.getElementById('boot-splash');
  const app = document.getElementById('app');

  document.body.classList.add('is-booting');

  // Small artificial delay so splash feels intentional
  await sleep(280);

  try {
    const client = getSupabase();
    if (!client) {
      console.warn('[boot] Supabase client could not be initialised.');
    }
  } catch (e) {
    console.error('[boot] Supabase init failed:', e);
  }

  // Theme must apply before showing app to avoid flash
  initTheme();

  // Auth (session hydration)
  try {
    await initAuth();
  } catch (e) {
    console.warn('[boot] auth init failed', e);
  }

  // Register routes
  registerAll();
  attachQueryParamsToRender();
  installLinkInterceptor();

  // Shell
  initShell();
  wireSubscriptions();

  // Try load profile
  if (state.user) {
    try { await loadProfile(); } catch {}
  }

  // Refresh counters
  refreshCounts();

  // Reveal app
  app.hidden = false;
  document.body.classList.remove('is-booting');

  if (splash) {
    splash.classList.add('is-hiding');
    setTimeout(() => splash.remove(), 700);
  }

  // Start router
  startRouter();

  // Focus main content on route change (a11y)
  subscribe('route', () => {
    setTimeout(() => {
      const v = document.getElementById('view-root');
      if (v) { v.setAttribute('tabindex', '-1'); v.focus({ preventScroll: true }); }
    }, 60);
  });

  // Periodic counts refresh every 3 minutes when logged in
  setInterval(() => { if (state.user) refreshCounts(); }, 3 * 60 * 1000);

  // Passive stat ping on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.user) refreshCounts();
  });

  // Handle hash deep-links to edit path when signed out
  window.addEventListener('hashchange', () => {
    const h = window.location.hash || '';
    if (!state.user && /^#\/theories\/[^/]+\/edit/.test(h)) {
      window.location.hash = '#/auth';
    }
  });

  // Global error boundary
  window.addEventListener('error', (e) => {
    console.error('[global]', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[unhandled]', e.reason);
  });

  console.info('%cنظریه‌ها v3.0', 'font-weight:700;color:#7c3aed;font-size:14px;', 'آماده است.');
};

/* ---------------- Kick off ---------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

/* ---------------- External API for quick scripts ---------------- */
window.TheoriesApp = {
  state,
  navigate: (path) => { window.location.hash = path.startsWith('#') ? path : `#${path.startsWith('/') ? '' : '/'}${path}`; },
  signOut: async () => { const { signOut } = await import('./auth.js'); await signOut(); },
  refresh: () => refreshCounts()
};
