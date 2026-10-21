/**
 * Console Viewer Component
 * A floating button that opens a modal displaying raw console logs.
 * Includes individual copy buttons and a "Copy All" button.
 */

import { el, icon } from '../utils/dom.js';

export function initConsoleViewer(store) {
  // --- Trigger Button ---
  const triggerBtn = el('button', {
    class: 'console-trigger',
    title: 'کنسول پیام‌ها (لاگ‌ها)',
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'
  });

  // --- Modal ---
  const modal = el('div', { class: 'console-modal', hidden: true });
  const list = el('div', { class: 'console-list' });
  
  // --- Actions ---
  const copyAllBtn = el('button', { class: 'btn btn--secondary btn--sm', style: { fontSize: '11px', padding: '0 8px', height: '28px' } }, [icon('copy'), 'کپی همه']);
  const clearBtn = el('button', { class: 'btn btn--secondary btn--sm', style: { fontSize: '11px', padding: '0 8px', height: '28px' } }, [icon('trash'), 'پاک کردن']);
  const closeBtn = el('button', { class: 'btn btn--ghost btn--icon btn--sm', style: { color: '#fff' } }, [icon('x')]);

  const header = el('div', { class: 'console-header' }, [
    el('div', { class: 'console-title' }, ['Raw Console Messages']),
    el('div', { class: 'console-actions' }, [copyAllBtn, clearBtn, closeBtn])
  ]);

  modal.appendChild(header);
  modal.appendChild(list);

  // --- Logic ---
  function render() {
    list.innerHTML = '';
    const logs = store.getLogs();
    
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
            const oldIcon = item.querySelector('.console-item__copy').innerHTML;
            item.querySelector('.console-item__copy').innerHTML = icon('check').innerHTML;
            setTimeout(() => { item.querySelector('.console-item__copy').innerHTML = oldIcon; }, 1500);
          }
        }, [icon('copy')])
      ]);
      list.appendChild(item);
    });
    
    // Scroll to bottom
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 10);
  }

  // --- Events ---
  triggerBtn.addEventListener('click', () => {
    modal.hidden = false;
    render();
  });

  closeBtn.addEventListener('click', () => { modal.hidden = true; });
  
  clearBtn.addEventListener('click', () => {
    store.clear();
    render();
  });

  copyAllBtn.addEventListener('click', () => {
    const text = store.getLogs().map(l => `[${l.type.toUpperCase()}] ${l.msg}`).join('\n\n');
    if (text) {
      navigator.clipboard.writeText(text);
      const oldText = copyAllBtn.innerHTML;
      copyAllBtn.innerHTML = icon('check').innerHTML + ' کپی شد';
      setTimeout(() => { copyAllBtn.innerHTML = oldText; }, 1500);
    }
  });

  window.addEventListener('console:new', () => {
    if (!modal.hidden) render();
  });

  document.body.appendChild(triggerBtn);
  document.body.appendChild(modal);
}