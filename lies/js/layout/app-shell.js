/* ============================================================
   js/layout/app-shell.js
   Orchestrates sidebar + topbar + main container
   ============================================================ */

import { byId } from '../utils/dom.js';
import { mountSidebar, closeMobileSidebar } from './sidebar.js';
import { mountTopbar } from './topbar.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { APP } from '../config/app.config.js';

let mounted = false;

/**
 * Show the app shell (hide auth screen).
 */
export function showAppShell() {
  const shell = byId('app-shell');
  const auth = byId('auth-screen');
  if (auth) auth.hidden = true;
  if (shell) {
    shell.hidden = false;
    requestAnimationFrame(() => shell.classList.add('is-ready'));
  }
}

/**
 * Show the auth screen (hide app shell).
 */
export function showAuthScreen() {
  const shell = byId('app-shell');
  const auth = byId('auth-screen');
  if (shell) {
    shell.classList.remove('is-ready');
    shell.hidden = true;
  }
  if (auth) {
    auth.hidden = false;
    requestAnimationFrame(() => auth.classList.add('is-ready'));
  }
}

/**
 * Mount the app shell once (sidebar + topbar + footer version).
 */
export function mountAppShell() {
  if (mounted) return;
  mounted = true;

  mountSidebar();
  mountTopbar();

  // Version in footer
  const versionEls = document.querySelectorAll('[data-app-version]');
  versionEls.forEach((el0) => { el0.textContent = `${APP.version}`; });

  // Mobile: close drawer on route change
  bus.on(EVENTS.ROUTE_CHANGED, () => {
    if (window.innerWidth < 900) closeMobileSidebar();
  });

  // Close drawer on Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && byId('app-shell')?.classList.contains('is-mobile-sidebar-open')) {
      closeMobileSidebar();
    }
  });

  // Close drawer on resize to desktop
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth >= 900) closeMobileSidebar();
    }, 120);
  });

  // Online / offline banner
  window.addEventListener('online', () => bus.emit(EVENTS.ONLINE));
  window.addEventListener('offline', () => bus.emit(EVENTS.OFFLINE));

  bus.on(EVENTS.ONLINE, () => {
    document.body.classList.remove('is-offline');
  });
  bus.on(EVENTS.OFFLINE, () => {
    document.body.classList.add('is-offline');
  });

  if (!navigator.onLine) document.body.classList.add('is-offline');
}

export default { mountAppShell, showAppShell, showAuthScreen };