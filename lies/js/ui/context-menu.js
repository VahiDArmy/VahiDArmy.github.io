/* ============================================================
   js/ui/context-menu.js
   Global right-click / long-press context menu with submenus,
   keyboard nav, icons, danger items, and checkmarks.
   ============================================================ */

import { el, clampToViewport, on } from '../utils/dom.js';

/**
 * @typedef {Object} MenuItem
 * @property {string} [id]
 * @property {string} [label]
 * @property {string} [icon]
 * @property {string} [shortcut]
 * @property {() => void} [action]
 * @property {boolean} [danger]
 * @property {boolean} [disabled]
 * @property {boolean} [checked]
 * @property {boolean} [divider]
 * @property {string} [group]
 * @property {MenuItem[]} [submenu]
 */

let activeMenu = null;
let activeCleanup = null;

/**
 * Open a context menu at (x, y).
 * @param {MouseEvent|{clientX:number, clientY:number}} ev
 * @param {MenuItem[]} items
 * @param {{anchor?:HTMLElement}} [opts]
 */
export function openContextMenu(ev, items, opts = {}) {
  closeContextMenu();

  const menu = el('div', {
    class: 'context-menu',
    attrs: { role: 'menu', 'aria-orientation': 'vertical' },
  });

  buildItems(menu, items);

  document.body.appendChild(menu);

  // Position
  let x = ev.clientX ?? 0;
  let y = ev.clientY ?? 0;
  menu.style.position = 'fixed';
  menu.style.top = `${y}px`;
  menu.style.left = `${x}px`;
  menu.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + r.width > vw - 8) x = vw - r.width - 8;
    if (y + r.height > vh - 8) y = vh - r.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = '';
    clampToViewport(menu);
    menu.classList.add('is-open');
    // Focus first item for keyboard nav
    const first = menu.querySelector('.context-menu__item:not(.is-disabled)');
    first?.focus();
  });

  activeMenu = menu;

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeContextMenu(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(menu, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(menu, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      menu.querySelector('.context-menu__item')?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const list = menu.querySelectorAll('.context-menu__item');
      list[list.length - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      const focused = document.activeElement;
      if (focused && menu.contains(focused) && focused.classList.contains('context-menu__item')) {
        e.preventDefault();
        focused.click();
      }
    } else if (e.key === 'ArrowRight') {
      // Open submenu
      const focused = document.activeElement;
      if (focused?.parentElement?.querySelector(':scope > .context-menu__submenu')) {
        focused.parentElement.classList.add('is-open');
      }
    } else if (e.key === 'ArrowLeft') {
      const openSub = menu.querySelector('.context-menu__sub.is-open');
      if (openSub) {
        openSub.classList.remove('is-open');
        openSub.querySelector(':scope > .context-menu__item')?.focus();
      }
    }
  };

  const onPointerDown = (e) => {
    if (menu.contains(e.target)) return;
    closeContextMenu();
  };

  const onScroll = () => closeContextMenu();
  const onResize = () => closeContextMenu();
  const onBlur = () => closeContextMenu();

  setTimeout(() => {
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('contextmenu', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);
  }, 0);

  activeCleanup = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onPointerDown, true);
    document.removeEventListener('contextmenu', onPointerDown, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('blur', onBlur);
  };
}

/**
 * Close the active context menu.
 */
export function closeContextMenu() {
  if (!activeMenu) return;
  activeCleanup?.();
  const menu = activeMenu;
  activeMenu = null;
  activeCleanup = null;
  menu.classList.remove('is-open');
  setTimeout(() => menu.remove(), 120);
}

/**
 * Open a native-feeling menu anchored to an element.
 * @param {HTMLElement} anchor
 * @param {MenuItem[]} items
 * @param {{placement?: 'bottom-start'|'bottom-end'|'top-start'|'top-end'}} [opts]
 */
export function openMenuAt(anchor, items, opts = {}) {
  const { placement = 'bottom-start' } = opts;
  const r = anchor.getBoundingClientRect();
  const isBottom = placement.startsWith('bottom');
  const isEnd = placement.endsWith('end');
  const fakeEv = {
    clientX: isEnd ? r.right : r.left,
    clientY: isBottom ? r.bottom + 4 : r.top - 4,
  };
  openContextMenu(fakeEv, items, { anchor });
}

/* ── Internals ──────────────────────────────────────────── */

function buildItems(menu, items) {
  let lastGroup = null;
  for (const item of items) {
    if (item.divider) {
      menu.appendChild(el('div', { class: 'context-menu__divider' }));
      lastGroup = null;
      continue;
    }
    if (item.group && item.group !== lastGroup) {
      if (lastGroup !== null) menu.appendChild(el('div', { class: 'context-menu__divider' }));
      menu.appendChild(el('div', { class: 'context-menu__label' }, { children: [item.group] }));
      lastGroup = item.group;
      continue;
    }
    menu.appendChild(buildItem(item));
  }
}

function buildItem(item) {
  const wrap = el('div', { class: 'context-menu__sub' });
  const hasSub = Array.isArray(item.submenu) && item.submenu.length > 0;

  const btn = el('button', {
    class: ['context-menu__item', item.danger ? 'is-danger' : '', item.disabled ? 'is-disabled' : ''].filter(Boolean),
    attrs: {
      type: 'button',
      role: 'menuitem',
      'aria-disabled': item.disabled ? 'true' : 'false',
      tabindex: '-1',
    },
  });

  if (item.icon) {
    btn.appendChild(el('span', { class: 'context-menu__icon' }, { children: [item.icon] }));
  } else {
    btn.appendChild(el('span', { class: 'context-menu__icon' }));
  }

  btn.appendChild(el('span', { class: 'context-menu__label-text' }, { children: [item.label || ''] }));

  if (item.checked) {
    btn.appendChild(el('span', { class: 'context-menu__check' }, { children: ['✓'] }));
  } else if (item.shortcut) {
    btn.appendChild(el('span', { class: 'context-menu__shortcut' }, { children: [item.shortcut] }));
  } else if (hasSub) {
    btn.appendChild(el('span', { class: 'context-menu__arrow' }, { children: ['‹'] }));
  }

  if (!item.disabled && !hasSub && typeof item.action === 'function') {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeContextMenu();
      try { item.action(); } catch (e) { console.error('[context-menu]', e); }
    });
  }

  if (hasSub) {
    const sub = el('div', { class: 'context-menu context-menu--sub', attrs: { role: 'menu' } });
    buildItems(sub, item.submenu);
    wrap.appendChild(btn);
    wrap.appendChild(sub);

    wrap.addEventListener('mouseenter', () => {
      // Close siblings
      wrap.parentElement?.querySelectorAll('.context-menu__sub.is-open').forEach((s) => {
        if (s !== wrap) s.classList.remove('is-open');
      });
      wrap.classList.add('is-open');
    });
  } else {
    wrap.appendChild(btn);
  }

  return wrap;
}

function moveFocus(menu, direction) {
  const list = Array.from(menu.querySelectorAll('.context-menu__item:not(.is-disabled)'))
    .filter((node) => node.offsetParent !== null);
  if (!list.length) return;
  const current = document.activeElement;
  const idx = list.indexOf(current);
  const next = idx < 0
    ? (direction > 0 ? list[0] : list[list.length - 1])
    : list[(idx + direction + list.length) % list.length];
  next?.focus();
}

/**
 * Attach a right-click handler with a menu factory.
 * @param {HTMLElement} target
 * @param {(ev:MouseEvent) => MenuItem[]} factory
 * @returns {() => void} detach
 */
export function attachContextMenu(target, factory) {
  const handler = (ev) => {
    const items = factory(ev);
    if (!items || !items.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    openContextMenu(ev, items);
  };
  target.addEventListener('contextmenu', handler);

  // Long-press for touch devices
  let touchTimer = null;
  let startX = 0;
  let startY = 0;
  const onTouchStart = (ev) => {
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    touchTimer = setTimeout(() => {
      const items = factory({ clientX: startX, clientY: startY });
      if (items?.length) {
        ev.preventDefault();
        openContextMenu({ clientX: startX, clientY: startY }, items);
      }
    }, 520);
  };
  const cancel = () => { if (touchTimer) clearTimeout(touchTimer); touchTimer = null; };
  const onTouchMove = (ev) => {
    if (!touchTimer) return;
    const t = ev.touches[0];
    if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) cancel();
  };
  target.addEventListener('touchstart', onTouchStart, { passive: true });
  target.addEventListener('touchmove', onTouchMove, { passive: true });
  target.addEventListener('touchend', cancel);
  target.addEventListener('touchcancel', cancel);

  return () => {
    target.removeEventListener('contextmenu', handler);
    target.removeEventListener('touchstart', onTouchStart);
    target.removeEventListener('touchmove', onTouchMove);
    target.removeEventListener('touchend', cancel);
    target.removeEventListener('touchcancel', cancel);
  };
}

/* Auto-close on route change */
import('../core/event-bus.js').then(({ bus }) => {
  import('../config/constants.js').then(({ EVENTS }) => {
    bus.on(EVENTS.ROUTE_CHANGED, closeContextMenu);
  });
});

export default { openContextMenu, closeContextMenu, openMenuAt, attachContextMenu };