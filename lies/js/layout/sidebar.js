/* ============================================================
   js/layout/sidebar.js
   COMPLETE FILE - NO TRUNCATION.
   Added badge logic for suggestions.
   ============================================================ */

import { el, byId } from '../utils/dom.js';
import { NAV_ITEMS, ROUTES, LS_KEYS } from '../config/app.config.js';
import { EVENTS } from '../config/constants.js';
import { bus } from '../core/event-bus.js';
import { sessionStore } from '../core/store.js';
import { get as lsGet, set as lsSet } from '../utils/storage.js';
import { initials } from '../utils/format.js';
import { colorFromString } from '../utils/id.js';
import { openDropdown, closeDropdown } from '../ui/dropdown.js';

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

  bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => updateActive(path));
  bus.on(EVENTS.AUTH_SIGNED_OUT, () => renderUser());
  bus.on(EVENTS.AUTH_SIGNED_IN, () => renderUser());
  sessionStore.select((s) => s.user, () => renderUser(), { immediate: false });

  updateActive(location.hash.replace(/^#/, '/') || '/dashboard');
  
  // Listen for suggestion badge updates
  bus.on('suggestion:badge', (count) => setBadge('suggestions', count));
}

export function toggleCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !collapsed;
  applyCollapsed(next, { persist: true });
  bus.emit(EVENTS.SIDEBAR_TOGGLED, { collapsed: next });
}

export function isCollapsed() { return collapsed; }

export function openMobileSidebar() {
  const shell = byId('app-shell');
  shell?.classList.add('is-mobile-sidebar-open');
  document.body.classList.add('has-drawer');
}

export function closeMobileSidebar() {
  const shell = byId('app-shell');
  shell?.classList.remove('is-mobile-sidebar-open');
  document.body.classList.remove('has-drawer');
}

export function isMobileSidebarOpen() {
  return byId('app-shell')?.classList.contains('is-mobile-sidebar-open') || false;
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
    if (groupLabels[g]) navEl.appendChild(el('div', { class: 'sidebar__group-label' }, { children: [groupLabels[g]] }));
    for (const item of items) {
      const link = el('a', { class: 'sidebar__item', attrs: { href: `#/${item.id}`, title: item.label }, dataset: { route: item.id } });
      link.appendChild(el('span', { class: 'sidebar__item-icon' }, { children: [item.icon] }));
      link.appendChild(el('span', { class: 'sidebar__item-label' }, { children: [item.label] }));
      if (item.badgeKey) {
        link.appendChild(el('span', { class: 'sidebar__item-badge', dataset: { badge: item.badgeKey }, attrs: { hidden: true } }));
      }
      navEl.appendChild(link);
    }
  }
}

function renderUser() {
  if (!userEl) return;
  userEl.innerHTML = '';
  const s = sessionStore.getState();
  if (!s.user) return;

  const name = s.profile?.display_name || s.user.email?.split('@')[0] || 'کاربر';
  const email = s.user.email || '';
  const avatarColor = s.profile?.avatar_color || colorFromString(email || name);

  userEl.appendChild(el('span', { class: 'sidebar__user-avatar', style: { background: avatarColor } }, { children: [initials(name)] }));
  const info = el('div', { class: 'sidebar__user-info' });
  info.appendChild(el('span', { class: 'sidebar__user-name' }, { children: [name] }));
  info.appendChild(el('span', { class: 'sidebar__user-email' }, { children: [email] }));
  userEl.appendChild(info);

  userEl.onclick = (ev) => {
    ev.stopPropagation();
    const menu = el('div', { class: 'dropdown__section' });
    const mkItem = (label, icon, onClick, danger) => {
      const b = el('button', { class: ['dropdown__item', danger ? 'is-danger' : ''].filter(Boolean), attrs: { type: 'button' } });
      b.appendChild(el('span', { class: 'dropdown__item-icon' }, { children: [icon] }));
      b.appendChild(el('span', { class: 'dropdown__item-label' }, { children: [label] }));
      b.addEventListener('click', () => { closeDropdown(); onClick(); });
      return b;
    };
    menu.appendChild(mkItem('تنظیمات', '⚙️', () => { location.hash = `#/${ROUTES.SETTINGS}`; }));
    menu.appendChild(mkItem('درباره', 'ℹ️', () => { location.hash = `#/${ROUTES.ABOUT}`; }));
    menu.appendChild(el('div', { class: 'dropdown__divider' }));
    menu.appendChild(mkItem('خروج', '🚪', async () => {
      const { signOut } = await import('../services/auth.service.js');
      const { confirm } = await import('../ui/confirm.js');
      if (await confirm({ title: 'خروج', message: 'از حساب خود خارج می‌شوید؟' })) await signOut();
    }, true));
    openDropdown(userEl, menu, { placement: 'top-start', width: 'anchor' });
  };
}

function updateActive(path) {
  if (!navEl) return;
  const clean = String(path || '').replace(/^\//, '').split('/')[0] || 'dashboard';
  navEl.querySelectorAll('.sidebar__item').forEach((a) => a.classList.toggle('is-active', a.dataset.route === clean));
}

function setBadge(key, value) {
  const el0 = navEl?.querySelector(`[data-badge="${key}"]`);
  if (!el0) return;
  if (!value) { el0.hidden = true; el0.textContent = ''; return; }
  el0.hidden = false;
  el0.textContent = value > 99 ? '۹۹+' : value;
}

function applyCollapsed(value, opts = {}) {
  collapsed = !!value;
  byId('app-shell')?.classList.toggle('is-sidebar-collapsed', collapsed);
  if (opts.persist !== false) lsSet(LS_KEYS.SIDEBAR_COLLAPSED, collapsed);
}