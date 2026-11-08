// Status bar under the main view.

import { el, clear } from '../utils/dom.js';
import { State, getStats, subscribe } from '../core/state.js';
import { fmtBytes, fmtNum } from '../utils/format.js';

let messageText = '';
let messageTimer = null;

export function initStatusbar() {
  render();
  subscribe((type) => {
    if (type === 'files' || type === 'log' || type === 'selection' || type === 'ingest') {
      render();
    }
  });
}

export function setStatusMessage(text, duration = 4000) {
  messageText = text;
  clearTimeout(messageTimer);
  render();
  if (duration > 0) {
    messageTimer = setTimeout(() => {
      messageText = '';
      render();
    }, duration);
  }
}

function render() {
  const root = document.getElementById('statusbar');
  if (!root) return;
  clear(root);

  const stats = getStats();
  const sel = State.ui.selected.size;

  root.appendChild(el('div', { class: 'status-item' }, [
    el('span', {
      class: ['status-dot', stats.failed ? 'warn' : (stats.fileCount ? '' : 'warn')].filter(Boolean).join(' '),
    }),
    el('span', { html: '<b>' + fmtNum(stats.fileCount) + '</b> file' + (stats.fileCount === 1 ? '' : 's') }),
  ]));

  root.appendChild(el('div', { class: 'status-sep' }));

  root.appendChild(el('div', { class: 'status-item' }, [
    el('span', { html: '<b>' + fmtBytes(stats.totalBytes) + '</b> packed' }),
  ]));

  if (stats.totalLines) {
    root.appendChild(el('div', { class: 'status-sep' }));
    root.appendChild(el('div', { class: 'status-item' }, [
      el('span', { html: '<b>' + fmtNum(stats.totalLines) + '</b> lines' }),
    ]));
  }

  if (stats.failed) {
    root.appendChild(el('div', { class: 'status-sep' }));
    root.appendChild(el('div', { class: 'status-item' }, [
      el('span', { class: 'status-dot bad' }),
      el('span', { html: '<b>' + fmtNum(stats.failed) + '</b> failed' }),
    ]));
  }

  if (sel) {
    root.appendChild(el('div', { class: 'status-sep' }));
    root.appendChild(el('div', { class: 'status-item' }, [
      el('span', { html: '<b>' + fmtNum(sel) + '</b> selected' }),
    ]));
  }

  root.appendChild(el('div', { class: 'status-msg', text: messageText || defaultMessage() }));
}

function defaultMessage() {
  if (!State.files.size) return 'Ready — paste blocks or load a ZIP to begin';
  if (State.failures.size) return State.failures.size + ' file(s) need re-sending — use the Log view';
  return 'All files look good — ready to download';
}
