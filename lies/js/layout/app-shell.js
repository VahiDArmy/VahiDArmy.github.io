/* ============================================================
   js/layout/app-shell.js
   FIXED: Ensure mobile sidebar closes automatically when a 
          route changes (so tapping a link closes the drawer).
   ============================================================ */

import { byId } from '../utils/dom.js';
import { mountSidebar, closeMobileSidebar } from './sidebar.js';
import { mountTopbar } from './topbar.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { APP } from '../config/app.config.js';

let mounted = false;

export function showAppShell() {
  const shell = byId('app-shell');
  const auth = byId('auth-screen');
  if (auth) auth.hidden = true;
  if (shell) {
    shell.hidden = false;
    // Removed opacity tricks, it's visible instantly now.
  }
}

export function showAuthScreen() {
  const shell = byId('app-shell');
  const auth = byId('auth-screen');
  if (shell) shell.hidden = true;
  if (auth) auth.hidden = false;
}

export function mountAppShell() {
  if (mounted) return;
  mounted = true;

  mountSidebar();
  mountTopbar();

  const versionEls = document.querySelectorAll('[data-app-version]');
  versionEls.forEach((el0) => { el0.textContent = `${APP.version}`; });

  // Close drawer on route change
  bus.on(EVENTS.ROUTE_CHANGED, () => {
    if (window.innerWidth < 900) {
      closeMobileSidebar();
    }
  });

  // Close drawer on Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && byId('app-shell')?.classList.contains('is-mobile-sidebar-open')) {
      closeMobileSidebar();
    }
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