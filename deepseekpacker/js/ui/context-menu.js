// Right-click context menu for file rows and other elements.

import { el, clear } from '../utils/dom.js';

let activeMenu = null;

export function openContextMenu(x, y, items) {
  closeContextMenu();

  const menu = el('div', {
    class: 'context-menu',
    role: 'menu',
    style: {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      zIndex: '80',
      minWidth: '200px',
      border: '1px solid var(--line-2)',
      borderRadius: 'var(--r-sm)',
      background: 'var(--surface-3)',
      boxShadow: 'var(--shadow-2)',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      animation: 'pp-pop 140ms var(--ease-out) both',
      fontSize: 'var(--fs-sm)',
    },
  });

  for (const item of items) {
    if (!item) continue;
    if (item.type === 'separator') {
      menu.appendChild(el('div', {
        style: { height: '1px', background: 'var(--line-2)', margin: '4px 0' },
      }));
      continue;
    }
    const row = el('button', {
      type: 'button',
      role: 'menuitem',
      disabled: !!item.disabled,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: 'var(--r-xs)',
        background: 'transparent',
        color: item.disabled ? 'var(--faint)' : (item.danger ? 'var(--bad)' : 'var(--ink-2)'),
        textAlign: 'left',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        fontSize: 'var(--fs-sm)',
        transition: 'background 120ms ease',
      },
      onMouseEnter: (e) => {
        if (!item.disabled) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 14%, transparent)';
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = 'transparent';
      },
      onClick: (e) => {
        e.stopPropagation();
        closeContextMenu();
        if (typeof item.run === 'function') item.run();
      },
    }, [
      el('span', {
        style: { width: '14px', textAlign: 'center', opacity: '0.8' },
        html: item.icon || '',
      }),
      el('span', { style: { flex: '1 1 auto' }, text: item.label }),
      item.hint ? el('kbd', { text: item.hint }) : null,
    ]);
    menu.appendChild(row);
  }

  document.body.appendChild(menu);

  // Flip if overflows
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nx = x, ny = y;
  if (nx + rect.width > vw - 8) nx = vw - rect.width - 8;
  if (ny + rect.height > vh - 8) ny = vh - rect.height - 8;
  if (nx < 8) nx = 8;
  if (ny < 8) ny = 8;
  menu.style.left = nx + 'px';
  menu.style.top = ny + 'px';

  activeMenu = menu;

  const onDoc = (e) => {
    if (!menu.contains(e.target)) closeContextMenu();
  };
  const onEsc = (e) => {
    if (e.key === 'Escape') closeContextMenu();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc, true);
  }, 0);

  menu.addEventListener('contextmenu', (e) => e.preventDefault());

  return menu;
}

export function closeContextMenu() {
  if (!activeMenu) return;
  if (activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
  activeMenu = null;
}

export function attachContextMenu(node, getItems) {
  if (!node) return () => {};
  const handler = (e) => {
    e.preventDefault();
    const items = typeof getItems === 'function' ? getItems(e) : getItems;
    if (!items || !items.length) return;
    openContextMenu(e.clientX, e.clientY, items);
  };
  node.addEventListener('contextmenu', handler);
  return () => node.removeEventListener('contextmenu', handler);
}
