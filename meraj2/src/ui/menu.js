/** Lightweight anchored menus used by chats, messages, and model cards. */
import { escapeHtml } from '../utils.js';
import { icon } from './icons.js';

let activeMenu = null;

function closeActive() {
  if (!activeMenu) return;
  const { root, cleanup, onClose } = activeMenu;
  activeMenu = null;
  cleanup();
  root.classList.add('is-closing');
  window.setTimeout(() => root.remove(), 120);
  if (typeof onClose === 'function') onClose();
}

export function closeMenu() {
  closeActive();
}

/**
 * @param {HTMLElement} anchor
 * @param {Array<{label?:string, icon?:string, action?:Function, danger?:boolean, disabled?:boolean, separator?:boolean, heading?:boolean, keepOpen?:boolean, note?:string}>} items
 */
export function openMenu(anchor, items, { align = 'end', width = 224, onClose = null } = {}) {
  closeMenu();
  if (!anchor) return null;

  const root = document.createElement('div');
  root.className = 'menu';
  root.setAttribute('role', 'menu');
  root.style.minWidth = `${width}px`;

  for (const item of items) {
    if (!item) continue;
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'menu__separator';
      root.appendChild(sep);
      continue;
    }
    if (item.heading) {
      const heading = document.createElement('p');
      heading.className = 'menu__heading';
      heading.textContent = item.heading;
      root.appendChild(heading);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `menu__item ${item.danger ? 'menu__item--danger' : ''}`;
    button.setAttribute('role', 'menuitem');
    button.disabled = Boolean(item.disabled);
    button.innerHTML = `
      <span class="menu__icon">${item.icon ? icon(item.icon, { size: 16 }) : ''}</span>
      <span class="menu__label">${escapeHtml(item.label || '')}</span>
      ${item.note ? `<span class="menu__note">${escapeHtml(item.note)}</span>` : ''}
    `;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (button.disabled) return;
      if (item.keepOpen) {
        item.action?.(event);
      } else {
        closeMenu();
        item.action?.(event);
      }
    });
    root.appendChild(button);
  }

  document.body.appendChild(root);

  const rect = anchor.getBoundingClientRect();
  const menuRect = root.getBoundingClientRect();
  let left = align === 'start' ? rect.left : rect.right - menuRect.width;
  left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, left));
  let top = rect.bottom + 6;
  if (top + menuRect.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuRect.height - 6);
  }
  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;

  const onPointer = (event) => {
    if (!root.contains(event.target) && event.target !== anchor) closeMenu();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      anchor.focus?.();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(root.querySelectorAll('.menu__item:not(:disabled)'));
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const onScroll = () => closeMenu();
  const onResize = () => closeMenu();

  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
  };

  activeMenu = { root, cleanup, onClose };
  root.querySelector('.menu__item:not(:disabled)')?.focus({ preventScroll: true });
  return { root, close: closeMenu };
}
