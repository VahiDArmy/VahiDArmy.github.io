/* ============================================================
   js/features/lies/lies-selection.js
   Multi-select manager: keyboard, click, shift-range
   ============================================================ */

import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';
import {
  selectItem, clearSelection, selectAll, invertSelection,
  getSelectedItems, liesStore,
} from './lies-store.js';

/**
 * Attach keyboard listeners for selection (bound to the list container).
 * @param {HTMLElement} container
 * @returns {() => void} detach
 */
export function attachSelectionKeyboard(container) {
  const handler = (ev) => {
    // Only handle when the container (or a child) has focus
    if (!container.contains(document.activeElement) && document.activeElement !== container) return;
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;

    const key = ev.key;
    const meta = ev.ctrlKey || ev.metaKey;

    if (meta && key.toLowerCase() === 'a') {
      ev.preventDefault();
      selectAll();
      return;
    }
    if (meta && key.toLowerCase() === 'i') {
      ev.preventDefault();
      invertSelection();
      return;
    }
    if (key === 'Escape') {
      clearSelection();
      return;
    }
    if (key === ' ' || key === 'Spacebar') {
      const active = document.activeElement;
      if (active?.matches?.('[data-id]')) {
        ev.preventDefault();
        selectItem(active.dataset.id, { mode: meta ? 'toggle' : ev.shiftKey ? 'range' : 'single' });
      }
    }
    if (key === 'Delete' || key === 'Backspace') {
      const sel = getSelectedItems();
      if (sel.length) {
        ev.preventDefault();
        bus.emit('lies:request-trash', { items: sel });
      }
    }
  };

  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

/**
 * Render a floating bulk actions bar.
 * @param {HTMLElement} host
 * @param {{
 *   onClear: ()=>void,
 *   onTrash: ()=>void,
 *   onArchive: ()=>void,
 *   onRestore: ()=>void,
 *   onTag: ()=>void,
 *   onCategory: ()=>void,
 *   onPin: ()=>void,
 *   onExport: ()=>void,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderBulkBar(host, handlers) {
  // Remove any existing bar
  host.querySelector('.bulk-bar')?.remove();

  const bar = document.createElement('div');
  bar.className = 'bulk-bar glass-strong';

  const state = liesStore.getState();
  const count = state.selection.size;

  const left = document.createElement('div');
  left.className = 'bulk-bar__left';

  const checkAll = document.createElement('button');
  checkAll.className = 'icon-btn';
  checkAll.type = 'button';
  checkAll.title = 'پاک کردن انتخاب';
  checkAll.setAttribute('aria-label', 'پاک کردن انتخاب');
  checkAll.textContent = '✕';
  checkAll.addEventListener('click', handlers.onClear);
  left.appendChild(checkAll);

  const label = document.createElement('strong');
  label.className = 'bulk-bar__count';
  label.textContent = `${count} مورد انتخاب شده`;
  left.appendChild(label);

  bar.appendChild(left);

  const actions = document.createElement('div');
  actions.className = 'bulk-bar__actions';

  const mkBtn = (label, icon, onClick, opts = {}) => {
    const b = document.createElement('button');
    b.className = ['btn', 'btn--sm', opts.danger ? 'btn--danger' : 'btn--ghost'].filter(Boolean).join(' ');
    b.type = 'button';
    b.title = label;
    b.innerHTML = `<span class="btn__icon">${icon}</span><span class="btn__label">${label}</span>`;
    b.addEventListener('click', onClick);
    return b;
  };

  actions.appendChild(mkBtn('برچسب', '🏷️', handlers.onTag));
  actions.appendChild(mkBtn('دسته', '📁', handlers.onCategory));
  actions.appendChild(mkBtn('سنجاق', '📌', handlers.onPin));
  actions.appendChild(mkBtn('بایگانی', '📦', handlers.onArchive));
  actions.appendChild(mkBtn('خروجی', '📤', handlers.onExport));
  actions.appendChild(mkBtn('حذف', '🗑️', handlers.onTrash, { danger: true }));

  bar.appendChild(actions);

  host.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('is-visible'));
  return bar;
}

/* Auto-remove bar when selection is empty */
bus.on(EVENTS.LIES_SELECTION_CHANGED, ({ selection }) => {
  if (!selection || selection.size === 0) {
    document.querySelectorAll('.bulk-bar').forEach((b) => {
      b.classList.remove('is-visible');
      setTimeout(() => b.remove(), 200);
    });
  }
});

export default { attachSelectionKeyboard, renderBulkBar };