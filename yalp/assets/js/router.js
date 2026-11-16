/**
 * بازاربان — مسیریاب
 * ---------------------------------------------------------------------------
 * مسیریاب هش‌محور ساده و قابل پیش‌بینی:
 *   #/vendors?kind=platform   →  مسیر + کوئری
 *   #/vendor/snappfood        →  پارامتر مسیر
 *   #/guide#levels            →  لنگر درون‌صفحه
 *
 * هر صفحه یک شیء با شکل زیر است:
 *   { title, requiresAuth?, render(ctx) → string|Promise<string>, mount?(ctx, root) }
 * `mount` می‌تواند تابع پاک‌سازی برگرداند تا پیش از رفتن به صفحهٔ بعد اجرا شود.
 */

import { CONFIG } from './config.js';
import { esc } from './utils.js';

let routes = [];
let notFoundView = null;
let onRouteChange = null;
let current = null;
let cleanup = null;
let navToken = 0;
let started = false;

/* --------------------------------------------------------------------------
   پارس مسیر
   -------------------------------------------------------------------------- */
export function parseHash(hash = window.location.hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [pathAndQuery, anchor = ''] = raw.split('#');
  const [pathname, search = ''] = pathAndQuery.split('?');
  const query = Object.fromEntries(new URLSearchParams(search).entries());
  const path = normalizePath(decodeURI(pathname));
  return { path, query, anchor, raw };
}

export function normalizePath(path) {
  let value = String(path || '/').trim();
  if (!value.startsWith('/')) value = `/${value}`;
  value = value.replace(/\/{2,}/g, '/');
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
  return value || '/';
}

export function buildHash(path, query = null) {
  const clean = normalizePath(path);
  if (!query) return `#${clean}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  const qs = params.toString();
  return `#${clean}${qs ? `?${qs}` : ''}`;
}

/* --------------------------------------------------------------------------
   تطبیق مسیر
   -------------------------------------------------------------------------- */
function matchRoute(path) {
  for (const route of routes) {
    const pattern = route.path === '/' ? [''] : route.path.split('/').filter(Boolean);
    const parts = path === '/' ? [''] : path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i += 1) {
      const segment = pattern[i];
      const value = parts[i];
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(value);
      } else if (segment !== value) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

/* --------------------------------------------------------------------------
   ثبت و راه‌اندازی
   -------------------------------------------------------------------------- */
export function registerRoutes(list) {
  routes = list.filter((route) => route && route.path && route.view);
  return routes;
}

export function setNotFoundView(view) {
  notFoundView = view;
}

export function setRouteListener(listener) {
  onRouteChange = listener;
}

export function currentRoute() {
  return current;
}

export function navigate(path, { replace = false, query = null } = {}) {
  const target = path.startsWith('#') ? path.slice(1) : path;
  const hash = query ? buildHash(target, query) : `#${normalizePath(target)}`;
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    return renderRoute();
  }
  if (window.location.hash === hash) {
    renderRoute();
    return Promise.resolve();
  }
  window.location.hash = hash;
  return Promise.resolve();
}

/** به‌روزرسانی کوئری بدون رندر دوبارهٔ کامل صفحه */
export function updateQuery(patch, { replace = true } = {}) {
  const { path, query } = parseHash();
  const next = { ...query, ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] === null || next[key] === undefined || next[key] === '') delete next[key];
  }
  const hash = buildHash(path, next);
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  if (onRouteChange && current) {
    current = { ...current, query: next };
    onRouteChange(current);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function start({ listener } = {}) {
  if (started) return;
  started = true;
  if (listener) onRouteChange = listener;
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

/* --------------------------------------------------------------------------
   چرخهٔ رندر
   -------------------------------------------------------------------------- */
function showLoading(main) {
  if (!main) return;
  main.innerHTML = `
    <div class="container page">
      <div class="sk sk--title"></div>
      <div class="sk sk--line"></div>
      <div class="sk-grid">
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
      </div>
    </div>`;
}

function renderError(main, error, path) {
  if (!main) return;
  console.error('[bb/router] رندر صفحه ناموفق بود:', error);
  main.innerHTML = `
    <div class="container page">
      <div class="empty" style="max-width:640px;margin-inline:auto;margin-top:8vh">
        <div class="empty__icon">${'⚠'}</div>
        <p class="empty__title">این صفحه بالا نیامد</p>
        <p class="empty__text">
          یک خطای پیش‌بینی‌نشده رخ داد. می‌توانی دوباره تلاش کنی یا به خانه برگردی.
          <br />
          <span class="mono t-faint" style="font-size:11px">${esc(path)}</span>
        </p>
        <pre style="text-align:start;direction:ltr;max-width:100%;overflow:auto;font-size:11px">${esc(
          String(error?.stack || error?.message || error),
        )}</pre>
        <div class="empty__actions">
          <button class="btn btn--primary" type="button" onclick="location.reload()">تلاش دوباره</button>
          <a class="btn btn--outline" href="#/" data-link>بازگشت به خانه</a>
        </div>
      </div>
    </div>`;
}

/** رندر مسیر فعلی. اگر از قبل در حال رندر باشیم، درخواست‌های قدیمی نادیده گرفته می‌شوند. */
export async function renderRoute() {
  const main = document.getElementById('main');
  if (!main) return;
  const token = ++navToken;
  const parsed = parseHash();
  const matched = matchRoute(parsed.path);
  const view = matched?.route.view || notFoundView;

  // پاک‌سازی صفحهٔ قبلی
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (error) {
      console.warn('[bb/router] پاک‌سازی صفحهٔ قبلی خطا داد:', error);
    }
    cleanup = null;
  }

  const ctx = {
    ...parsed,
    params: matched?.params || {},
    route: matched?.route || null,
    name: matched?.route?.name || 'notfound',
    view: matched?.route?.view || null,
    isNotFound: !matched,
  };

  current = ctx;
  if (onRouteChange) onRouteChange(ctx);

  if (!view) {
    main.innerHTML = `<div class="container page"><div class="empty"><p class="empty__title">مسیر پیدا نشد</p></div></div>`;
    return;
  }

  if (view.requiresAuth && !isReadyToGuard()) {
    navigate('/login', { replace: true, query: { next: parsed.path } });
    return;
  }

  if (view.loading !== false) {
    // صفحه‌های سریع (همگام) را با اسکلت آزار نمی‌دهیم؛ فقط تأخیر محسوس
    window.setTimeout(() => {
      if (token === navToken && main.dataset.rendering === 'true') showLoading(main);
    }, 220);
  }
  main.dataset.rendering = 'true';

  try {
    const html = await view.render(ctx);
    if (token !== navToken) return;
    main.innerHTML = html || '';
    main.dataset.rendering = 'false';

    if (typeof view.mount === 'function') {
      const result = view.mount(ctx, main);
      cleanup = typeof result === 'function' ? result : null;
    }

    document.title = view.title
      ? `${view.title} · ${CONFIG.APP_NAME}`
      : `${CONFIG.APP_NAME} — ${CONFIG.TAGLINE}`;

    // لنگر درون‌صفحه
    if (parsed.anchor) {
      const target = document.getElementById(parsed.anchor);
      if (target) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('comment-highlight');
        });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }

    window.dispatchEvent(new CustomEvent('bb:route-rendered', { detail: ctx }));
  } catch (error) {
    if (token !== navToken) return;
    renderError(main, error, parsed.path);
    main.dataset.rendering = 'false';
  }
}

/** بررسی زودهنگام ورود برای صفحه‌های محافظت‌شده (بدون وابستگی چرخه‌ای) */
let guardFn = () => true;
export function setAuthGuard(fn) {
  guardFn = fn;
}
function isReadyToGuard() {
  try {
    return guardFn();
  } catch {
    return true;
  }
}

/** پیوندهای داخلی: هر <a data-link> نباید صفحه را کامل بار کند */
export function bindLinks(root = document) {
  root.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[data-link]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    // اجازه بده مرورگر هش را عوض کند؛ مسیریاب گوش می‌دهد.
  });
}

export const Router = {
  register: registerRoutes,
  start,
  navigate,
  current: currentRoute,
  parse: parseHash,
  showLoading,
};
