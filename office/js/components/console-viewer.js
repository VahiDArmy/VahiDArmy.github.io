/**
 * Console Viewer Component
 * Provides a function to open a modal displaying raw console logs.
 * No floating buttons added to the main UI.
 */

import { el, icon, lockBodyScroll, unlockBodyScroll } from '../utils/dom.js';

let consoleStore = null;
let activeBackdrop = null;

export function initConsoleViewer(store) {
  consoleStore = store;
}

export function openConsoleViewer() {
  if (!consoleStore) {
    alert('Console store not initialized.');
    return;
  }

  // Toggle close if already open
  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
    unlockBodyScroll();
    return;
  }

  const list = el('div', { class: 'console-list' });
  const copyAllBtn = el('button', { class: 'btn btn--secondary btn--sm', style: { fontSize: '11px', padding: '0 8px', height: '28px' } }, [icon('copy'), 'کپی همه']);
  const clearBtn = el('button', { class: 'btn btn--secondary btn--sm', style: { fontSize: '11px', padding: '0 8px', height: '28px' } }, [icon('trash'), 'پاک کردن']);
  const closeBtn = el('button', { class: 'btn btn--ghost btn--icon btn--sm', style: { color: '#fff' } }, [icon('x')]);

  const header = el('div', { class: 'console-header' }, [
    el('div', { class: 'console-title' }, ['Raw Console Messages']),
    el('div', { class: 'console-actions' }, [copyAllBtn, clearBtn, closeBtn])
  ]);

  const modal = el('div', { class: 'console-modal' }, [header, list]);

  const backdrop = el('div', {
    class: 'modal-backdrop',
    style: { zIndex: 99999, padding: '20px', alignItems: 'center' },
    on: { mousedown: (e) => { if (e.target === backdrop) close(); } }
  }, [modal]);

  function close() {
    backdrop.remove();
    activeBackdrop = null;
    unlockBodyScroll();
    window.removeEventListener('console:new', handleNewLog);
  }

  function handleNewLog() {
    if (activeBackdrop) render();
  }

  function render() {
    list.innerHTML = '';
    const logs = consoleStore.getLogs();

    if (logs.length === 0) {
      list.appendChild(el('div', { class: 'console-empty' }, ['هیچ پیامی در کنسول ثبت نشده است.']));
      return;
    }

    logs.forEach(log => {
      const item = el('div', { class: `console-item console-item--${log.type}` }, [
        el('div', { class: 'console-item__time' }, [log.time.toLocaleTimeString('fa-IR')]),
        el('pre', { class: 'console-item__msg' }, [log.msg]),
        el('button', {
          class: 'console-item__copy btn btn--ghost btn--icon btn--sm',
          title: 'کپی این پیام',
          onClick: () => {
            navigator.clipboard.writeText(log.msg);
            const btn = item.querySelector('.console-item__copy');
            const oldIcon = btn.innerHTML;
            btn.innerHTML = icon('check').innerHTML;
            setTimeout(() => { btn.innerHTML = oldIcon; }, 1500);
          }
        }, [icon('copy')])
      ]);
      list.appendChild(item);
    });

    // Scroll to bottom
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 10);
  }

  closeBtn.addEventListener('click', close);
  clearBtn.addEventListener('click', () => { consoleStore.clear(); render(); });
  copyAllBtn.addEventListener('click', () => {
    const text = consoleStore.getLogs().map(l => `[${l.type.toUpperCase()}] ${l.msg}`).join('\n\n');
    if (text) {
      navigator.clipboard.writeText(text);
      const btn = copyAllBtn;
      const oldText = btn.innerHTML;
      btn.innerHTML = icon('check').innerHTML + ' کپی شد';
      setTimeout(() => { btn.innerHTML = oldText; }, 1500);
    }
  });

  window.addEventListener('console:new', handleNewLog);

  document.body.appendChild(backdrop);
  lockBodyScroll();
  activeBackdrop = backdrop;

  render();
}