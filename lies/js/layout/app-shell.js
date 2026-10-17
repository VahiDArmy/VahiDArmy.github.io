/* ============================================================
   js/layout/app-shell.js
   FIXED: Ensured that when showing the Auth screen, the 
   app-shell is completely hidden, and vice versa.
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
  if (shell) shell.hidden = false;
}

export function showAuthScreen() {
  const shell = byId('app-shell');
  const auth = byId('auth-screen');
  if (shell) shell.hidden = true;
  if (auth) auth.hidden = false; // Make sure it's visible!
}

export function mountAppShell() {
  if (mounted) return;
  mounted = true;

  mountSidebar();
  mountTopbar();

  const versionEls = document.querySelectorAll('[data-app-version]');
  versionEls.forEach((el0) => { el0.textContent = `${APP.version}`; });

  bus.on(EVENTS.ROUTE_CHANGED, () => {
    if (window.innerWidth < 900) closeMobileSidebar();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && byId('app-shell')?.classList.contains('is-mobile-sidebar-open')) {
      closeMobileSidebar();
    }
  });

  window.addEventListener('online', () => bus.emit(EVENTS.ONLINE));
  window.addEventListener('offline', () => bus.emit(EVENTS.OFFLINE));

  bus.on(EVENTS.ONLINE, () => document.body.classList.remove('is-offline'));
  bus.on(EVENTS.OFFLINE, () => document.body.classList.add('is-offline'));

  if (!navigator.onLine) document.body.classList.add('is-offline');
}

export default { mountAppShell, showAppShell, showAuthScreen };