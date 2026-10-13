/**
 * dropdown.js — منوی کشویی متصل به دکمه + context menu راست‌کلیک
 */

import { $, el, clear, rectOf, lockScroll, unlockScroll, trapFocus } from '../utils/dom.js';

const dropdownRoot = () => $('#dropdown-root') || document.body;

/* ---------- مدیریت نمونه باز ---------- */

let currentInstance = null;

function closeCurrent() {
  if (currentInstance) {
    currentInstance.close();
    currentInstance = null;
  }
}

/* =========================================================================
   Dropdown متصل
   ========================================================================= */

/**
 * @param {HTMLElement} trigger
 * @param {Object} opts
 *   - items: Array<Item> | (() => Array<Item>)
 *   - placement: 'bottom-start' | 'bottom-end' | 'auto'
 *   - align: 'start' | 'end'
 *   - onSelect
 *   - closeOnSelect
 *   - className
 *
 * Item: {
 *   type: 'item' | 'divider' | 'section' | 'header',
 *   label, icon, shortcut, disabled, danger, active,
 *   onClick, keepOpen
 * }
 */
export function attachDropdown(trigger, {
  items,
  align = 'start',
  className = '',
  closeOnSelect = true,
  onSelect = null,
} = {}) {
  let dropdown = null;
  let cleanupOutside = null;
  let releaseTrap = null;
  let isOpen = false;

  function render() {
    const list = typeof items === 'function' ? items() : items;
    const menu = el('div', {
      class: `dropdown ${className}`,
      role: 'menu',
      'aria-orientation': 'vertical',
    });

    for (const item of list || []) {
      if (item.type === 'divider') {
        menu.appendChild(el('div', { class: 'dropdown__divider', role: 'separator' }));
        continue;
      }
      if (item.type === 'section' || item.type === 'header') {
        menu.appendChild(el('div', { class: 'dropdown__section' }, [item.label]));
        continue;
      }

      const btn = el('button', {
        class: [
          'dropdown__item',
          item.danger ? 'dropdown__item--danger' : '',
          item.active ? 'is-active' : '',
          item.disabled ? 'is-disabled' : '',
        ].filter(Boolean).join(' '),
        type: 'button',
        role: 'menuitem',
        disabled: item.disabled || undefined,
      });
      if (item.icon) btn.appendChild(el('span', { class: 'dropdown__icon' }, [item.icon]));
      btn.appendChild(el('span', { class: 'dropdown__label' }, [item.label]));
      if (item.shortcut) btn.appendChild(el('span', { class: 'dropdown__shortcut' }, [item.shortcut]));

      btn.addEventListener('click', (e) => {
        if (item.disabled) return;
        e.stopPropagation();
        item.onClick?.(item, e);
        onSelect?.(item, e);
        if (closeOnSelect && !item.keepOpen) close();
      });
      menu.appendChild(btn);
    }
    return menu;
  }

  function position(menu) {
    const r = rectOf(trigger);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mr = rectOf(menu);

    let top = r.bottom + 6;
    let left = align === 'end' ? r.right - mr.width : r.left;

    // RTL: پیش‌فرض راست‌چین می‌کنیم
    if (align === 'start') left = r.left;
    else left = r.right - mr.width;

    if (left < 8) left = 8;
    if (left + mr.width > vw - 8) left = vw - mr.width - 8;

    if (top + mr.height > vh - 8) {
      // باز کردن به بالا
      const above = r.top - mr.height - 6;
      if (above > 8) top = above;
      else top = Math.max(8, vh - mr.height - 8);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  function open() {
    if (isOpen) return;
    closeCurrent();

    dropdown = render();
    dropdownRoot().appendChild(dropdown);
    isOpen = true;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');

    requestAnimationFrame(() => {
      position(dropdown);
      dropdown.classList.add('is-positioned');
    });

    // outside click
    const onDocClick = (e) => {
      if (!dropdown.contains(e.target) && !trigger.contains(e.target)) close();
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = () => close();

    setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onEsc);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
    }, 0);

    cleanupOutside = () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };

    releaseTrap = trapFocus(dropdown);

    // فوکوس اولین آیتم
    requestAnimationFrame(() => {
      const first = dropdown.querySelector('.dropdown__item:not(.is-disabled)');
      first?.focus?.();
    });

    currentInstance = { close };
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open');

    cleanupOutside?.();
    releaseTrap?.();

    const node = dropdown;
    dropdown = null;
    if (node) {
      node.classList.add('is-closing');
      setTimeout(() => node.remove(), 160);
    }
    if (currentInstance?.close === close) currentInstance = null;
  }

  function toggle() { isOpen ? close() : open(); }

  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  return { open, close, toggle, get isOpen() { return isOpen; } };
}

/* =========================================================================
   Context Menu (راست‌کلیک)
   ========================================================================= */

export function attachContextMenu(target, getItems) {
  function handler(e) {
    // در صورت نبود گزینه، منوی پیش‌فرض مرورگر باز شود
    const items = typeof getItems === 'function' ? getItems(e) : getItems;
    if (!items || !items.length) return;

    e.preventDefault();
    closeCurrent();

    const menu = el('div', { class: 'context-menu', role: 'menu' });
    for (const item of items) {
      if (item.type === 'divider') {
        menu.appendChild(el('div', { class: 'dropdown__divider' }));
        continue;
      }
      const btn = el('button', {
        class: `dropdown__item ${item.danger ? 'dropdown__item--danger' : ''}`,
        type: 'button',
      });
      if (item.icon) btn.appendChild(el('span', { class: 'dropdown__icon' }, [item.icon]));
      btn.appendChild(el('span', { class: 'dropdown__label' }, [item.label]));
      if (item.shortcut) btn.appendChild(el('span', { class: 'dropdown__shortcut' }, [item.shortcut]));
      btn.addEventListener('click', () => {
        item.onClick?.();
        close();
      });
      menu.appendChild(btn);
    }

    dropdownRoot().appendChild(menu);

    // موقعیت‌یابی
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mr = rectOf(menu);
    let left = e.clientX;
    let top = e.clientY;
    if (left + mr.width > vw - 8) left = vw - mr.width - 8;
    if (top + mr.height > vh - 8) top = vh - mr.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    const close = () => {
      cleanup();
      menu.classList.add('is-closing');
      setTimeout(() => menu.remove(), 140);
    };
    const onDocClick = () => close();
    const onEsc = (e2) => { if (e2.key === 'Escape') close(); };
    const cleanup = () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onDocClick, true);
    };
    setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onEsc);
      window.addEventListener('scroll', onDocClick, true);
    }, 0);

    currentInstance = { close };
  }

  target.addEventListener('contextmenu', handler);
  return () => target.removeEventListener('contextmenu', handler);
}

/* ---------- API ---------- */

export const dropdown = {
  attach: attachDropdown,
  contextMenu: attachContextMenu,
  closeAll: closeCurrent,
};

// بستن روی تغییر مسیر/رزولوشن
window.addEventListener('resize', closeCurrent);