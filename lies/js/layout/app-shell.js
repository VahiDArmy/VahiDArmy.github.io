/* ============================================================
   js/layout/app-shell.js
   FIXED: Removed dead code for `sidebar-backdrop`.
   ============================================================ */

import { byId } from '../utils/dom.js';
import { mountSidebar, closeMobileSidebar, isMobileSidebarOpen } from './sidebar.js';
import { mountTopbar } from './topbar.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { APP } from '../config/app.config.js';

let mounted = false;

export function showAppShell() {
  const auth = byId('auth-screen'); if (auth) auth.hidden = true;
  const shell = byId('app-shell'); if (shell) shell.hidden = false;
}

export function showAuthScreen() {
  const shell = byId('app-shell'); if (shell) shell.hidden = true;
  const auth = byId('auth-screen'); if (auth) auth.hidden = false;
}

export function mountAppShell() {
  if (mounted) return;
  mounted = true;

  mountSidebar();
  mountTopbar();
  document.querySelectorAll('[data-app-version]').forEach(el0 => el0.textContent = APP.version);

  bus.on(EVENTS.ROUTE_CHANGED, () => { if (window.innerWidth < 900) closeMobileSidebar(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && isMobileSidebarOpen()) closeMobileSidebar(); });

  const shell = byId('app-shell');
  if (shell) {
    shell.addEventListener('click', (ev) => {
      if (isMobileSidebarOpen() && !ev.target.closest('.sidebar')) closeMobileSidebar();
    });
  }
}