/**
 * Console Viewer Component
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

  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
    unlockBodyScroll();
    return;
  }

  const list = el('div', { class: 'console-list' });
  
  // Header Actions
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

  // Helper for copying text across different browsers/contexts
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
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
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

    // Auto-scroll to bottom
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 10);
  }

  // Events
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