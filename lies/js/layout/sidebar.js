/* ============================================================
   js/layout/sidebar.js
   FIXED: Added direct listener to the backdrop so it can never 
          get stuck. Synced classes perfectly.
   ============================================================ */

import { el, byId, on } from '../utils/dom.js';
import { NAV_ITEMS, ROUTES, LS_KEYS, LIMITS } from '../config/app.config.js';
import { EVENTS, CLS } from '../config/constants.js';
import { bus } from '../core/event-bus.js';
import { sessionStore, dataStore } from '../core/store.js';
import { get as lsGet, set as lsSet, estimateUsage } from '../utils/storage.js';
import { toFaDigits, formatBytes, initials } from '../utils/format.js';
import { STORAGE_QUOTA_BYTES } from '../config/app.config.js';
import { colorFromString } from '../utils/id.js';
import { openDropdown } from '../ui/dropdown.js';

let navEl = null;
let userEl = null;
let collapsed = false;

export function mountSidebar() {
  navEl = byId('sidebar-nav');
  userEl = byId('sidebar-user');

  collapsed = !!lsGet(LS_KEYS.SIDEBAR_COLLAPSED, false);
  applyCollapsed(collapsed, { persist: false });

  renderNav();
  renderUser();

  // Attach backdrop click listener directly here
  const backdrop = byId('sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => {
    updateActive(path);
    // Auto-close on route change for mobile
    if (window.innerWidth < 900) {
      closeMobileSidebar();
    }
  });
  
  bus.on(EVENTS.AUTH_SIGNED_OUT, () => { renderUser(); });
  bus.on(EVENTS.AUTH_SIGNED_IN, () => { renderUser(); });
  sessionStore.select((s) => s.profile, () => renderUser(), { immediate: false });

  updateActive(location.hash.replace(/^#/, '/') || '/dashboard');
}

export function toggleCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !collapsed;
  applyCollapsed(next, { persist: true });
  bus.emit(EVENTS.SIDEBAR_TOGGLED, { collapsed: next });
}

function renderNav() {
  if (!navEl) return;
  navEl.innerHTML = '';

  const groups = new Map();
  for (const item of NAV_ITEMS) {
    const g = item.group || 'main';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(item);
  }

  const groupLabels = { main: '', organize: 'سازمان‌دهی', system: 'سیستم' };

  for (const [g, items] of groups.entries()) {
    if (groupLabels[g]) {
      navEl.appendChild(el('div', { class: 'sidebar__group-label', style: { padding: '16px 12px 8px', fontSize: '10px', color: 'var(--text-tertiary)' } }, { children: [groupLabels[g]] }));
    }
    for (const item of items) {
      const link = el('a', {
        class: 'sidebar__item',
        attrs: { href: `#/${item.id}`, title: item.label },
        dataset: { route: item.id },
      });
      link.appendChild(el('span', { class: 'sidebar__item-icon' }, { children: [item.icon] }));
      link.appendChild(el('span', { class: 'sidebar__item-label' }, { children: [item.label] }));
      navEl.appendChild(link);
    }
  }
}

function renderUser() {
  if (!userEl) return;
  userEl.innerHTML = '';
  const s = sessionStore.getState();
  const user = s.user;
  const profile = s.profile;

  if (!user) return;

  const name = profile?.display_name || user.email?.split('@')[0] || 'کاربر';
  const email = user.email || '';
  const avatarColor = profile?.avatar_color || colorFromString(email || name);

  userEl.appendChild(el('span', { class: 'sidebar__user-avatar', style: { background: avatarColor } }, { children: [initials(name)] }));
  
  const info = el('div', { class: 'sidebar__user-info' });
  info.appendChild(el('span', { class: 'sidebar__user-name' }, { children: [name] }));
  info.appendChild(el('span', { class: 'sidebar__user-email' }, { children: [email] }));
  userEl.appendChild(info);

  const menuBtn = el('button', { class: 'icon-btn', attrs: { type: 'button' }, style: { marginInlineStart: 'auto', color: 'var(--text-tertiary)' } }, { children: ['⋯'] });
  
  userEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const menu = el('div', { class: 'dropdown__section' });
    
    const mkItem = (label, icon, onClick, danger) => {
      const b = el('button', { class: ['dropdown__item', danger ? 'is-danger' : ''].filter(Boolean), attrs: { type: 'button' } });
      b.appendChild(el('span', { class: 'dropdown__item-icon' }, { children: [icon] }));
      b.appendChild(el('span', { class: 'dropdown__item-label' }, { children: [label] }));
      b.addEventListener('click', onClick);
      return b;
    };

    menu.appendChild(mkItem('تنظیمات', '⚙️', () => { location.hash = `#/${ROUTES.SETTINGS}`; }));
    menu.appendChild(mkItem('درباره', 'ℹ️', () => { location.hash = `#/${ROUTES.ABOUT}`; }));
    menu.appendChild(el('div', { class: 'dropdown__divider' }));
    menu.appendChild(mkItem('خروج از حساب', '🚪', async () => {
      const { signOut } = await import('../services/auth.service.js');
      const { confirm } = await import('../ui/confirm.js');
      const ok = await confirm({ title: 'خروج', message: 'از حساب خود خارج می‌شوید؟', confirmLabel: 'خروج', icon: '🚪' });
      if (ok) await signOut().catch(() => {});
    }, true));

    openDropdown(userEl, menu, { placement: 'top-start', width: 'anchor' });
  });
}

function updateActive(path) {
  if (!navEl) return;
  const clean = String(path || '').replace(/^\//, '').split('/')[0] || 'dashboard';
  navEl.querySelectorAll('.sidebar__item').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.route === clean);
  });
}

function applyCollapsed(value, opts = {}) {
  collapsed = !!value;
  const shell = byId('app-shell');
  shell?.classList.toggle('is-sidebar-collapsed', collapsed);
  if (opts.persist !== false) lsSet(LS_KEYS.SIDEBAR_COLLAPSED, collapsed);
}

/* ── Mobile Sidebar Logic ──────────────────────────────── */

export function openMobileSidebar() {
  const shell = byId('app-shell');
  const backdrop = byId('sidebar-backdrop');
  
  if (shell) shell.classList.add('is-mobile-sidebar-open');
  if (backdrop) {
    backdrop.classList.add('is-open');
  }
  document.body.classList.add('has-drawer');
}

export function closeMobileSidebar() {
  const shell = byId('app-shell');
  const backdrop = byId('sidebar-backdrop');
  
  if (shell) shell.classList.remove('is-mobile-sidebar-open');
  if (backdrop) {
    backdrop.classList.remove('is-open');
  }
  document.body.classList.remove('has-drawer');
}

export function isMobileSidebarOpen() {
  return byId('app-shell')?.classList.contains('is-mobile-sidebar-open') || false;
}

export default { mountSidebar, toggleCollapsed, isCollapsed, openMobileSidebar, closeMobileSidebar, isMobileSidebarOpen };