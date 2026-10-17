/* ============================================================
   js/layout/sidebar.js
   Sidebar renderer: nav, collapse, user block, storage meter
   FIXED: Replaced custom user menu popover with the standard
          openDropdown utility to prevent RTL layout breaks.
   ============================================================ */

import { el, byId, on } from '../utils/dom.js';
import { NAV_ITEMS, ROUTES, LS_KEYS, LIMITS } from '../config/app.config.js';
import { EVENTS, CLS } from '../config/constants.js';
import { bus } from '../core/event-bus.js';
import { sessionStore, dataStore } from '../core/store.js';
import { get as lsGet, set as lsSet, estimateUsage } from '../utils/storage.js';
import { toFaDigits, formatBytes, initials, formatNumber } from '../utils/format.js';
import { STORAGE_QUOTA_BYTES } from '../config/app.config.js';
import { colorFromString } from '../utils/id.js';
import { openDropdown } from '../ui/dropdown.js';

let navEl = null;
let userEl = null;
let storageLabelEl = null;
let storageBarEl = null;
let collapsed = false;

export function mountSidebar() {
  navEl = byId('sidebar-nav');
  userEl = byId('sidebar-user');
  storageLabelEl = document.querySelector('[data-storage-label]');
  storageBarEl = document.querySelector('[data-storage-bar]');

  collapsed = !!lsGet(LS_KEYS.SIDEBAR_COLLAPSED, false);
  applyCollapsed(collapsed, { persist: false });

  renderNav();
  renderUser();
  renderStorage();

  bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => updateActive(path));
  bus.on(EVENTS.LIES_REFRESHED, () => refreshBadges());
  bus.on(EVENTS.AUTH_SIGNED_OUT, () => { renderUser(); });
  bus.on(EVENTS.AUTH_SIGNED_IN, () => { renderUser(); refreshBadges(); });
  
  sessionStore.select((s) => s.profile, () => renderUser(), { immediate: false });
  dataStore.select((s) => s.total, () => renderStorage());

  updateActive(location.hash.replace(/^#/, '/') || '/dashboard');
  refreshBadges();

  on(window, 'app:storage', () => renderStorage());
}

export function toggleCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !collapsed;
  applyCollapsed(next, { persist: true });
  bus.emit(EVENTS.SIDEBAR_TOGGLED, { collapsed: next });
}

export function isCollapsed() { return collapsed; }

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

      if (item.badgeKey) {
        link.appendChild(el('span', { class: 'sidebar__item-badge', dataset: { badge: item.badgeKey }, attrs: { hidden: true }, style: { background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' } }));
      }
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

function renderStorage() {
  if (!storageBarEl || !storageLabelEl) return;
  const used = estimateUsage();
  const pct = Math.min(100, Math.round((used / STORAGE_QUOTA_BYTES) * 100));
  storageBarEl.style.width = `${Math.max(2, pct)}%`;
  storageLabelEl.textContent = `${formatBytes(used, 1)}`;
}

async function refreshBadges() {
  if (!navEl) return;
  try {
    const { counts } = await import('../services/lies.service.js');
    const c = await counts();
    setBadge('lies', c.active);
    setBadge('trash', c.trashed);
  } catch { /* noop */ }
}

function setBadge(key, value) {
  const el0 = navEl?.querySelector(`[data-badge="${key}"]`);
  if (!el0) return;
  if (!value) { el0.hidden = true; el0.textContent = ''; return; }
  el0.hidden = false;
  el0.textContent = value > 99 ? '۹۹+' : toFaDigits(value);
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

export function openMobileSidebar() {
  const shell = byId('app-shell');
  const backdrop = byId('sidebar-backdrop');
  shell?.classList.add('is-mobile-sidebar-open');
  if (backdrop) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  }
  document.body.classList.add('has-drawer');
}

export function closeMobileSidebar() {
  const shell = byId('app-shell');
  const backdrop = byId('sidebar-backdrop');
  shell?.classList.remove('is-mobile-sidebar-open');
  if (backdrop) {
    backdrop.classList.remove('is-visible');
    setTimeout(() => { backdrop.hidden = true; }, 250);
  }
  document.body.classList.remove('has-drawer');
}

export function isMobileSidebarOpen() {
  return byId('app-shell')?.classList.contains('is-mobile-sidebar-open') || false;
}

export default { mountSidebar, toggleCollapsed, isCollapsed, openMobileSidebar, closeMobileSidebar, isMobileSidebarOpen };