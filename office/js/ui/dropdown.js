/**
 * Click-to-toggle dropdown menus.
 * Wraps a trigger button with a menu of items.
 *
 *   const dd = createDropdown(triggerEl, [
 *     { label: 'ویرایش', icon: 'edit', onClick },
 *     { divider: true },
 *     { label: 'حذف', danger: true, onClick },
 *   ], { align: 'end' });
 *   dd.open(); dd.close(); dd.destroy();
 */

import { el, icon } from '../utils/dom.js';

let openDropdowns = new Set();

function closeAll(except = null) {
  for (const dd of openDropdowns) {
    if (dd === except) continue;
    dd.close();
  }
}

function handleDocClick(e) {
  for (const dd of Array.from(openDropdowns)) {
    if (!dd.contains(e.target)) dd.close();
  }
}

function handleKey(e) {
  if (e.key === 'Escape') closeAll();
}

export function createDropdown(trigger, items = [], options = {}) {
  const { align = 'end', className = '' } = options;

  const menu = el(
    'div',
    {
      class: `dropdown__menu dropdown__menu--${align === 'start' ? 'start' : 'end'}${className ? ' ' + className : ''}`,
      role: 'menu',
      hidden: true,
    }
  );

  for (const item of items) {
    if (!item) continue;
    if (item.header) {
      menu.appendChild(el('div', { class: 'dropdown__header' }, [item.header]));
      continue;
    }
    if (item.divider) {
      menu.appendChild(el('div', { class: 'dropdown__divider' }));
      continue;
    }
    const node = el(
      'button',
      {
        type: 'button',
        class: `dropdown__item${item.danger ? ' dropdown__item--danger' : ''}`,
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
        item.icon ? el('span', { class: 'dropdown__icon' }, [icon(item.icon)]) : null,
        el('span', { class: 'dropdown__label' }, [item.label || '']),
        item.badge != null ? el('span', { class: 'dropdown__badge badge' }, [String(item.badge)]) : null,
      ]
    );
    menu.appendChild(node);
  }

  // Wrap the trigger so positioning is reliable
  const wrapper = el('div', { class: 'dropdown' }, [menu]);
  trigger.parentNode?.insertBefore(wrapper, trigger.nextSibling);
  wrapper.insertBefore(trigger, menu);

  let isOpen = false;

  function open() {
    if (isOpen) return;
    closeAll(api);
    isOpen = true;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openDropdowns.add(api);
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleKey);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openDropdowns.delete(api);
    if (!openDropdowns.size) {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    }
  }

  function toggle() { isOpen ? close() : open(); }

  const onTriggerClick = (e) => { e.stopPropagation(); toggle(); };
  trigger.addEventListener('click', onTriggerClick);
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const api = {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    contains: (node) => wrapper.contains(node),
    destroy() {
      close();
      trigger.removeEventListener('click', onTriggerClick);
      wrapper.parentNode?.insertBefore(trigger, wrapper);
      wrapper.remove();
    },
    menu,
  };

  return api;
}

export const dropdown = { create: createDropdown, closeAll };
export default dropdown;