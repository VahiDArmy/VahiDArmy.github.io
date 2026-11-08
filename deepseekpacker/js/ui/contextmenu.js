// AURORA OS — Context Menu

import { h, $, clear } from '../core/dom.js';

let _active = null;

function close() {
  if (_active) { _active.remove(); _active = null; }
  document.removeEventListener('click', close, true);
  document.removeEventListener('contextmenu', close, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('scroll', close, true);
}

function onKey(e) { if (e.key === 'Escape') close(); }

export function contextMenu(items, x, y) {
  close();
  const menu = h('div', { class: 'ctxmenu', role: 'menu' });
  for (const it of items) {
    if (it.sep) { menu.append(h('div', { class: 'ctxmenu__sep' })); continue; }
    const el = h('div', {
      class: 'ctxmenu__item' + (it.disabled ? ' is-disabled' : ''),
      role: 'menuitem',
      tabindex: it.disabled ? '-1' : '0',
    });
    if (it.icon) el.append(h('span', { text: it.icon }));
    el.append(h('span', { text: it.label }));
    if (it.shortcut) el.append(h('span', { class: 'ctxmenu__shortcut', text: it.shortcut }));
    if (!it.disabled) {
      el.addEventListener('click', () => { close(); it.onClick?.(); });
    }
    menu.append(el);
  }
  menu.style.left = '0px';
  menu.style.top = '0px';
  document.body.append(menu);

  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  menu.style.left = Math.min(x, vw - rect.width - 8) + 'px';
  menu.style.top = Math.min(y, vh - rect.height - 8) + 'px';

  _active = menu;
  setTimeout(() => {
    document.addEventListener('click', close, true);
    document.addEventListener('contextmenu', close, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
  }, 0);
  return menu;
}

contextMenu.close = close;
export default contextMenu;
