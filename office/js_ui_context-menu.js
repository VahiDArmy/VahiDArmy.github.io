/**
 * Right-click context menu (and programmatic dropdowns anywhere).
 *
 *   openContextMenu(x, y, [
 *     { header: 'عملیات' },
 *     { label: 'ویرایش', icon: 'edit', onClick: fn },
 *     { divider: true },
 *     { label: 'حذف', icon: 'trash', danger: true, onClick: fn, shortcut: 'Del' },
 *   ]);
 */

import { el, icon, lockBodyScroll, unlockBodyScroll } from '../utils/dom.js';

let root = null;
let activeMenu = null;
let activeBackdrop = null;
let releaseScroll = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById('context-menu-root');
  if (!root) {
    root = el('div', { id: 'context-menu-root', class: 'context-menu-root' });
    document.body.appendChild(root);
  }
  return root;
}

function close() {
  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
  }
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  if (releaseScroll) {
    releaseScroll();
    releaseScroll = null;
  }
  document.removeEventListener('keydown', handleKey, true);
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
}

function handleKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); }
}

function handleMouseDown(e) {
  if (activeMenu && !activeMenu.contains(e.target)) close();
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<Object>} items
 */
export function openContextMenu(x, y, items = []) {
  close();
  ensureRoot();

  const menu = el('div', {
    class: 'context-menu',
    role: 'menu',
    tabindex: '-1',
  });

  for (const item of items) {
    if (!item) continue;

    if (item.header) {
      menu.appendChild(el('div', { class: 'context-menu__header' }, [item.header]));
      continue;
    }
    if (item.divider) {
      menu.appendChild(el('div', { class: 'context-menu__divider' }));
      continue;
    }

    const classes = ['context-menu__item'];
    if (item.danger) classes.push('context-menu__item--danger');

    const node = el(
      'button',
      {
        type: 'button',
        class: classes.join(' '),
        role: 'menuitem',
        disabled: !!item.disabled,
        on: {
          click: (e) => {
            e.stopPropagation();
            close();
            try { item.onClick?.(e); } catch (err) { console.error(err); }
          },
        },
      },
      [
        item.icon ? el('span', { class: 'context-menu__icon' }, [icon(item.icon)]) : null,
        el('span', { class: 'context-menu__label' }, [item.label || '']),
        item.shortcut ? el('span', { class: 'context-menu__shortcut' }, [item.shortcut]) : null,
        item.badge ? el('span', { class: 'context-menu__shortcut' }, [String(item.badge)]) : null,
      ]
    );

    menu.appendChild(node);
  }

  // Backdrop for outside clicks (pointer-events on root covers all)
  const backdrop = el('div', {
    style: {
      position: 'fixed',
      inset: '0',
      background: 'transparent',
      zIndex: 'var(--z-context)',
    },
  });

  document.body.appendChild(backdrop);
  ensureRoot().appendChild(menu);

  // Position (avoid overflow)
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';

  const rect = menu.getBoundingClientRect();
  const pad = 8;
  let left = x;
  let top = y;
  if (left + rect.width + pad > window.innerWidth) left = window.innerWidth - rect.width - pad;
  if (top + rect.height + pad > window.innerHeight) top = window.innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  // In RTL: prefer opening toward start-of-screen (right side) — X stays as-is.
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';

  activeMenu = menu;
  activeBackdrop = backdrop;

  // Close on outside click / scroll / resize / Escape
  document.addEventListener('keydown', handleKey, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  requestAnimationFrame(() => {
    const first = menu.querySelector('.context-menu__item:not([disabled])');
    first?.focus({ preventScroll: true });
  });

  return { close, menu };
}

/** Attach a context menu to an element (right-click handler). */
export function attachContextMenu(target, getItems) {
  if (!target) return () => {};
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const items = typeof getItems === 'function' ? getItems(e) : getItems;
    openContextMenu(e.clientX, e.clientY, items || []);
  };
  target.addEventListener('contextmenu', handler);
  return () => target.removeEventListener('contextmenu', handler);
}

export const contextMenu = { open: openContextMenu, attach: attachContextMenu, close };
export default contextMenu;