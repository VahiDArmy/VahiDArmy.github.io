/* ==========================================================================
   router.js — مسیریابی SPA (Hash-based) برای سوره، تفسیر و ورود
   ========================================================================== */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { $, $$ } from './utils.js';

let isNavigating = false;

export function getCurrentRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (CONFIG.routes.includes(hash)) {
    return hash;
  }
  return CONFIG.defaultRoute;
}

export function navigate(route, { replace = false } = {}) {
  if (!CONFIG.routes.includes(route)) route = CONFIG.defaultRoute;
  const targetHash = `#${route}`;

  if (window.location.hash === targetHash) return;

  if (replace) {
    window.history.replaceState(null, '', targetHash);
    handleRouteChange();
  } else {
    window.location.hash = route;
  }
}

function updateActiveTab(route) {
  const tabs = $$('.tab');
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === route;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // جابه‌جایی نشانگر
  const activeTab = tabs.find((t) => t.dataset.tab === route);
  const indicator = $('#tabIndicator');
  if (activeTab && indicator) {
    indicator.style.width = `${activeTab.offsetWidth}px`;
    // محاسبه فاصله از سمت راست (به دلیل RTL)
    const parentRect = activeTab.parentElement.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    indicator.style.right = `${parentRect.right - tabRect.right}px`;
  }
}

function updateViews(route) {
  CONFIG.routes.forEach((r) => {
    const view = document.getElementById(`view-${r}`);
    if (view) {
      if (r === route) {
        view.removeAttribute('hidden');
      } else {
        view.setAttribute('hidden', '');
      }
    }
  });
}

export function handleRouteChange() {
  if (isNavigating) return;
  isNavigating = true;

  const route = getCurrentRoute();
  
  // به‌روزرسانی حالت
  store.set({ activeView: route });
  document.body.dataset.view = route;

  // به‌روزرسانی UI
  updateActiveTab(route);
  updateViews(route);

  // رویداد برای بارگذاری محتوا
  window.dispatchEvent(new CustomEvent('q56:route-changed', { detail: { route } }));

  // بازگشت به بالای صفحه
  window.scrollTo({ top: 0, behavior: 'smooth' });

  setTimeout(() => {
    isNavigating = false;
  }, 100);
}

export function initRouter() {
  // هندل کردن کلیک روی تب‌ها
  const tabs = $$('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const route = tab.dataset.tab;
      if (route) navigate(route);
    });
  });

  // هندل کردن تغییر هش
  window.addEventListener('hashchange', handleRouteChange);

  // مسیریابی اولیه
  if (!window.location.hash || !CONFIG.routes.includes(window.location.hash.replace('#', ''))) {
    navigate(CONFIG.defaultRoute, { replace: true });
  } else {
    handleRouteChange();
  }
}

export default { initRouter, navigate, getCurrentRoute };