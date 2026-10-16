/* ============================================================
   js/layout/sidebar.js
   Sidebar renderer: nav, collapse, user block, storage meter
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

/** @type {HTMLElement|null} */
let navEl = null;
let userEl = null;
let storageLabelEl = null;
let storageBarEl = null;
let collapsed = false;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Mount the sidebar UI (does not handle the collapse button — app-shell does).
 */
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

  // React to state changes
  bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => updateActive(path));
  bus.on(EVENTS.LIES_REFRESHED, () => refreshBadges());
  bus.on(EVENTS.AUTH_SIGNED_OUT, () => { renderUser(); });
  bus.on(EVENTS.AUTH_SIGNED_IN, () => { renderUser(); refreshBadges(); });
  sessionStore.select(
    (s) => s.profile,
    () => renderUser(),
    { immediate: false }
  );
  dataStore.select(
    (s) => s.total,
    () => renderStorage()
  );

  // Initial active state
  updateActive(location.hash.replace(/^#/, '/') || '/dashboard');

  // Initial badges
  refreshBadges();

  // Recompute storage when a write happens
  on(window, 'app:storage', () => renderStorage());
}

/**
 * Toggle the collapsed state.
 * @param {boolean} [force]
 */
export function toggleCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !collapsed;
  applyCollapsed(next, { persist: true });
  bus.emit(EVENTS.SIDEBAR_TOGGLED, { collapsed: next });
}

/** @returns {boolean} */
export function isCollapsed() { return collapsed; }

/* ── Rendering ───────────────────────────────────────────── */

function renderNav() {
  if (!navEl) return;
  navEl.innerHTML = '';

  const groups = new Map();
  for (const item of NAV_ITEMS) {
    const g = item.group || 'main';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(item);
  }

  const groupLabels = {
    main: '',
    organize: 'سازمان‌دهی',
    system: 'سیستم',
  };

  for (const [g, items] of groups.entries()) {
    if (groupLabels[g]) {
      navEl.appendChild(el('div', { class: 'sidebar__group-label' }, { children: [groupLabels[g]] }));
    }
    for (const item of items) {
      navEl.appendChild(renderNavItem(item));
    }
  }
}

/**
 * @param {typeof NAV_ITEMS[number]} item
 * @returns {HTMLElement}
 */
function renderNavItem(item) {
  const link = el('a', {
    class: 'sidebar__item',
    attrs: {
      href: `#/${item.id}`,
      'data-route': item.id,
      title: item.label,
      'data-shortcut': item.shortcut || '',
    },
    dataset: { route: item.id },
  });

  link.appendChild(el('span', { class: 'sidebar__item-icon', attrs: { 'aria-hidden': 'true' } }, { children: [item.icon] }));
  link.appendChild(el('span', { class: 'sidebar__item-label' }, { children: [item.label] }));

  if (item.badgeKey) {
    const badge = el('span', {
      class: 'sidebar__item-badge',
      dataset: { badge: item.badgeKey },
      attrs: { hidden: true },
    });
    link.appendChild(badge);
  }

  if (item.shortcut) {
    link.appendChild(el('span', { class: 'sidebar__item-shortcut' }, { children: [item.shortcut] }));
  }

  return link;
}

function renderUser() {
  if (!userEl) return;
  userEl.innerHTML = '';

  const s = sessionStore.getState();
  const user = s.user;
  const profile = s.profile;

  if (!user) {
    // anonymous state
    userEl.appendChild(el('div', { class: 'sidebar__user-guest' }, {
      children: [
        el('span', { class: 'sidebar__user-avatar' }, { children: ['؟'] }),
        el('span', { class: 'sidebar__user-name' }, { children: ['مهمان'] }),
      ],
    }));
    return;
  }

  const name = profile?.display_name || user.email?.split('@')[0] || 'کاربر';
  const email = user.email || '';
  const avatarColor = profile?.avatar_color || colorFromString(email || name);

  const avatar = el('span', {
    class: 'sidebar__user-avatar',
    style: { background: avatarColor },
    attrs: { 'aria-hidden': 'true' },
  }, { children: [initials(name)] });

  const info = el('div', { class: 'sidebar__user-info' }, {
    children: [
      el('span', { class: 'sidebar__user-name', title: name }, { children: [name] }),
      el('span', { class: 'sidebar__user-email', title: email }, { children: [email] }),
    ],
  });

  const menuBtn = el('button', {
    class: 'sidebar__user-menu icon-btn',
    attrs: { type: 'button', title: 'منوی کاربر', 'aria-label': 'منوی کاربر' },
  }, { children: ['⋯'] });

  menuBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openUserMenu(menuBtn);
  });

  userEl.appendChild(avatar);
  userEl.appendChild(info);
  userEl.appendChild(menuBtn);
}

function renderStorage() {
  if (!storageBarEl || !storageLabelEl) return;
  const used = estimateUsage();
  const pct = Math.min(100, Math.round((used / STORAGE_QUOTA_BYTES) * 100));
  storageBarEl.style.width = `${Math.max(2, pct)}%`;
  storageBarEl.parentElement?.setAttribute('data-level', pct > 85 ? 'danger' : pct > 65 ? 'warn' : 'ok');
  storageLabelEl.textContent = `${formatBytes(used, 1)} از ${formatBytes(STORAGE_QUOTA_BYTES, 0)}`;
}

async function refreshBadges() {
  if (!navEl) return;
  // Use dataStore for lies count
  const s = dataStore.getState();
  const badges = {
    lies: s.total || (s.lies?.length ?? 0),
    trash: s.trashed || 0,
  };
  // Trash count needs a dedicated fetch — do it lazily
  try {
    const { counts } = await import('../services/lies.service.js');
    const c = await counts();
    badges.lies = c.active;
    badges.trash = c.trashed;
    setBadge('lies', c.active);
    setBadge('trash', c.trashed);
  } catch {
    setBadge('lies', badges.lies);
    setBadge('trash', badges.trash);
  }
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
    const r = a.dataset.route;
    a.classList.toggle(CLS.ACTIVE, r === clean);
  });
}

/* ── Collapse ────────────────────────────────────────────── */

function applyCollapsed(value, opts = {}) {
  collapsed = !!value;
  const shell = byId('app-shell');
  const btn = byId('sidebar-collapse-btn');
  shell?.classList.toggle('is-sidebar-collapsed', collapsed);
  if (btn) {
    btn.textContent = collapsed ? '⟩' : '⟨';
    btn.setAttribute('aria-label', collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری');
  }
  if (opts.persist !== false) {
    lsSet(LS_KEYS.SIDEBAR_COLLAPSED, collapsed);
  }
}

/* ── User menu popover ───────────────────────────────────── */

function openUserMenu(anchor) {
  const existing = document.getElementById('user-menu-popover');
  if (existing) { existing.remove(); return; }

  const menu = el('div', {
    class: 'user-menu glass-strong',
    attrs: { id: 'user-menu-popover', role: 'menu' },
  });

  const items = [
    { label: 'تنظیمات', icon: '⚙️', route: ROUTES.SETTINGS },
    { label: 'درباره', icon: 'ℹ️', route: ROUTES.ABOUT },
    { divider: true },
    { label: 'خروج از حساب', icon: '🚪', action: 'logout', danger: true },
  ];

  for (const it of items) {
    if (it.divider) { menu.appendChild(el('div', { class: 'user-menu__divider' })); continue; }
    const b = el('button', {
      class: ['user-menu__item', it.danger ? 'is-danger' : ''],
      attrs: { type: 'button', role: 'menuitem' },
    }, { children: [el('span', { class: 'user-menu__icon' }, { children: [it.icon] }), el('span', {}, { children: [it.label] })] });
    b.addEventListener('click', async () => {
      menu.remove();
      if (it.action === 'logout') {
        const { signOut } = await import('../services/auth.service.js');
        const { confirm } = await import('../ui/confirm.js');
        const ok = await confirm({ title: 'خروج', message: 'از حساب خود خارج می‌شوید؟', confirmLabel: 'خروج', icon: '🚪' });
        if (!ok) return;
        await signOut().catch(() => {});
      } else if (it.route) {
        location.hash = `#/${it.route}`;
      }
    });
    menu.appendChild(b);
  }

  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${r.top - 8}px`;
  menu.style.left = `${r.left}px`;
  menu.style.transform = 'translateY(-100%)';
  menu.style.minWidth = '200px';
  menu.style.zIndex = '500';

  // Reposition to fit
  requestAnimationFrame(() => {
    const mr = menu.getBoundingClientRect();
    if (mr.left < 8) menu.style.left = '8px';
    if (mr.right > window.innerWidth - 8) {
      menu.style.left = `${window.innerWidth - mr.width - 8}px`;
    }
    if (mr.top < 8) menu.style.transform = 'none';
  });

  const close = (ev) => {
    if (menu.contains(ev.target) || anchor.contains(ev.target)) return;
    menu.remove();
    document.removeEventListener('mousedown', close);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('scroll', close, true);
  };
  const onKey = (ev) => {
    if (ev.key === 'Escape') {
      menu.remove();
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', close, true);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', close, true);
  }, 0);
}

/* ── Mobile drawer ───────────────────────────────────────── */

/**
 * Open the sidebar as a drawer on mobile.
 */
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

/**
 * Close the mobile drawer.
 */
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

/** @returns {boolean} */
export function isMobileSidebarOpen() {
  return byId('app-shell')?.classList.contains('is-mobile-sidebar-open') || false;
}

export default {
  mountSidebar, toggleCollapsed, isCollapsed,
  openMobileSidebar, closeMobileSidebar, isMobileSidebarOpen,
};