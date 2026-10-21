/**
 * Console Viewer Component
 * Provides a visible floating trigger button and a modal to display raw logs.
 */

import { el, icon, lockBodyScroll, unlockBodyScroll } from '../utils/dom.js';

let consoleStore = null;
let activeBackdrop = null;
let triggerBtn = null;

export function initConsoleViewer() {
  consoleStore = window.__consoleStore__;
  
  if (!consoleStore) {
    console.warn('Console store not found. Log viewer will not work.');
    return;
  }

  triggerBtn = el('button', {
    class: 'console-trigger',
    title: 'ابزار عیب‌یابی (کنسول)',
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    on: { click: openConsoleViewer }
  });

  document.body.appendChild(triggerBtn);

  window.addEventListener('console:new', (e) => {
    if (e.detail && e.detail.type === 'error') {
      triggerBtn.classList.add('has-error');
    }
  });
}

function openConsoleViewer() {
  if (!consoleStore) return;

  if (activeBackdrop) {
    close();
    return;
  }

  triggerBtn.classList.remove('has-error');

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

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try { document.execCommand('copy'); } catch (err) { console.error(err); }
      textArea.remove();
      return Promise.resolve();
    }
  }

  function render() {
    list.innerHTML = '';
    const logs = consoleStore.getLogs();

    if (logs.length === 0) {
      list.appendChild(el('div', { class: 'console-empty' }, ['هیچ پیامی در کنسول ثبت نشده است.']));
      return;
    }

    logs.forEach(log => {
      const copyBtn = el('button', {
        class: 'console-item__copy',
        title: 'کپی این پیام',
        html: icon('copy').innerHTML,
      });

      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(log.msg).then(() => {
          copyBtn.innerHTML = icon('check').innerHTML;
          copyBtn.style.color = '#4caf50';
          setTimeout(() => {
            copyBtn.innerHTML = icon('copy').innerHTML;
            copyBtn.style.color = '';
          }, 1500);
        });
      });

      const item = el('div', { class: `console-item console-item--${log.type}` }, [
        el('div', { class: 'console-item__time' }, [log.time.toLocaleTimeString('fa-IR')]),
        el('pre', { class: 'console-item__msg' }, [log.msg]),
        copyBtn
      ]);
      
      list.appendChild(item);
    });

    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 10);
  }

  closeBtn.addEventListener('click', close);
  clearBtn.addEventListener('click', () => { consoleStore.clear(); render(); });
  
  copyAllBtn.addEventListener('click', () => {
    const text = consoleStore.getLogs().map(l => `[${l.type.toUpperCase()}] ${l.msg}`).join('\n\n');
    if (text) {
      copyToClipboard(text).then(() => {
        const oldHtml = copyAllBtn.innerHTML;
        copyAllBtn.innerHTML = icon('check').innerHTML + ' کپی شد';
        setTimeout(() => { copyAllBtn.innerHTML = oldHtml; }, 1500);
      });
    }
  });

  window.addEventListener('console:new', handleNewLog);

  document.body.appendChild(backdrop);
  lockBodyScroll();
  activeBackdrop = backdrop;

  render();
}