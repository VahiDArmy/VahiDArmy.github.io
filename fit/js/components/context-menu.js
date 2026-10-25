/* ==========================================================================
   Component — Context Menu
   Usage:
     App.ContextMenu.open(event, [
       { icon, label, shortcut, onClick, danger, disabled },
       { type: 'separator' },
       { header: 'عنوان' },
     ])
   ========================================================================== */

(function (window, document) {
  'use strict';

  const App = (window.App = window.App || {});
  const DOM = App.DOM;

  let root = null;
  let current = null;

  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.getElementById('context-menu-root');
    if (!root) {
      root = DOM.el('div', { id: 'context-menu-root', class: 'context-menu-root' });
      document.body.appendChild(root);
    }
    return root;
  }

  function close() {
    if (!current) return;
    const toRemove = current;
    current = null;
    toRemove.classList.add('is-closing');
    setTimeout(() => {
      DOM.remove(toRemove);
    }, 120);
  }

  /**
   * Build a single menu item element.
   */
  function buildItem(item) {
    if (item.type === 'separator') {
      return DOM.el('div', { class: 'context-menu__separator' });
    }
    if (item.header) {
      return DOM.el('div', { class: 'context-menu__header', text: item.header });
    }
    const el = DOM.el('button', {
      type: 'button',
      class:
        'context-menu__item' +
        (item.danger ? ' is-danger' : '') +
        (item.accent ? ' is-accent' : '') +
        (item.disabled ? ' is-disabled' : '')
    });
    if (item.icon) {
      const iconWrap = DOM.el('span', { class: 'context-menu__icon' });
      iconWrap.innerHTML = item.icon;
      el.appendChild(iconWrap);
    }
    el.appendChild(DOM.el('span', { class: 'context-menu__label', text: item.label }));
    if (item.shortcut) {
      el.appendChild(
        DOM.el('span', { class: 'context-menu__shortcut', text: item.shortcut })
      );
    }
    if (!item.disabled && typeof item.onClick === 'function') {
      el.addEventListener('click', () => {
        close();
        // Run after menu closes so modals stack cleanly
        setTimeout(() => item.onClick(), 10);
      });
    }
    return el;
  }

  function open(ev, items) {
    close();
    if (!Array.isArray(items) || items.length === 0) return;

    const menu = DOM.el('div', { class: 'context-menu', role: 'menu' });
    items.forEach((it) => menu.appendChild(buildItem(it)));

    ensureRoot().appendChild(menu);
    current = menu;

    // Position within viewport
    const margin = 8;
    const rect = menu.getBoundingClientRect();
    let x = ev.clientX;
    let y = ev.clientY;
    // RTL — shift to the left of pointer if it doesn't fit
    if (x + rect.width + margin > window.innerWidth) {
      x = window.innerWidth - rect.width - margin;
    }
    if (x < margin) x = margin;
    if (y + rect.height + margin > window.innerHeight) {
      y = window.innerHeight - rect.height - margin;
    }
    if (y < margin) y = margin;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Stop bubbling so nothing closes us
    return menu;
  }

  /* ---------- Global dismiss ---------- */

  document.addEventListener('mousedown', (ev) => {
    if (!current) return;
    if (current.contains(ev.target)) return;
    close();
  });

  document.addEventListener('scroll', () => {
    if (current) close();
  }, true);

  window.addEventListener('resize', () => {
    if (current) close();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && current) {
      close();
      ev.stopPropagation();
    }
  });

  /* ---------- Icon library used by menu builders ---------- */

  const ICONS = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>'
  };

  App.ContextMenu = {
    open,
    close,
    ICONS
  };
})(window, document);