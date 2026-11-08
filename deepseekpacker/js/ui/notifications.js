// In-memory notification center. Real-time + persistent within session.

import { el, clear } from '../utils/dom.js';
import { subscribe } from '../core/state.js';

const MAX = 40;
const items = [];

export function notify(message, options = {}) {
  const entry = {
    id: 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    message,
    kind: options.kind || 'info',
    at: new Date(),
    read: false,
    meta: options.meta || null,
  };
  items.unshift(entry);
  while (items.length > MAX) items.pop();
  emitChange();
  return entry;
}

export function list() {
  return items.slice();
}

export function unreadCount() {
  return items.filter((i) => !i.read).length;
}

export function markAllRead() {
  for (const item of items) item.read = true;
  emitChange();
}

export function clearAllNotifications() {
  items.length = 0;
  emitChange();
}

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  for (const fn of listeners) {
    try { fn(items); } catch (err) { /* ignore */ }
  }
}

// Bridge state events into notifications
subscribe((type, payload) => {
  if (type === 'ingest' && payload && payload.entry) {
    const e = payload.entry;
    if (e.errors > 0) {
      notify('Paste #' + e.n + ' had ' + e.errors + ' error' + (e.errors === 1 ? '' : 's'),
        { kind: 'warn' });
    } else {
      notify('Paste #' + e.n + ' ingested: ' + e.fresh + ' new',
        { kind: 'ok' });
    }
  }
  if (type === 'files' && payload && payload.type === 'delete') {
    notify('Deleted ' + payload.path, { kind: 'info' });
  }
});

export function renderBell(host) {
  if (!host) return;
  clear(host);
  const count = unreadCount();
  const btn = el('button', {
    class: 'icon-btn' + (count ? ' is-active' : ''),
    type: 'button',
    title: count ? count + ' unread notifications' : 'Notifications',
    onClick: () => showPanel(),
  }, [el('span', { html: '◔' })]);
  if (count) {
    btn.appendChild(el('span', {
      style: {
        position: 'absolute',
        top: '2px',
        right: '2px',
        fontSize: '9px',
        minWidth: '12px',
        height: '12px',
        lineHeight: '12px',
        padding: '0 2px',
        borderRadius: '999px',
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        textAlign: 'center',
        fontWeight: '600',
      },
      text: count > 9 ? '9+' : String(count),
    }));
    btn.style.position = 'relative';
  }
  host.appendChild(btn);
}

function showPanel() {
  const existing = document.getElementById('notif-panel');
  if (existing) {
    existing.remove();
    return;
  }

  const panel = el('div', {
    id: 'notif-panel',
    style: {
      position: 'fixed',
      top: 'calc(var(--topbar-h) + 8px)',
      right: '16px',
      width: 'min(360px, calc(100vw - 32px))',
      maxHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--line-2)',
      borderRadius: 'var(--r-md)',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-2)',
      zIndex: '70',
      overflow: 'hidden',
    },
  });

  const head = el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      borderBottom: '1px solid var(--line)',
      background: 'var(--surface-2)',
    },
  });
  head.appendChild(el('strong', { style: { fontSize: 'var(--fs-sm)' }, text: 'Notifications' }));
  head.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm',
    style: { marginLeft: 'auto' },
    type: 'button',
    onClick: () => { markAllRead(); },
    text: 'Mark read',
  }));
  head.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm',
    type: 'button',
    onClick: () => { clearAllNotifications(); },
    text: 'Clear',
  }));
  panel.appendChild(head);

  const listEl = el('div', { style: { flex: '1 1 auto', minHeight: '0', overflowY: 'auto' } });
  if (!items.length) {
    listEl.appendChild(el('div', {
      style: { padding: '32px 16px', textAlign: 'center', color: 'var(--faint)', fontSize: 'var(--fs-sm)' },
      text: 'Nothing yet',
    }));
  } else {
    for (const item of items) {
      const row = el('div', {
        style: {
          padding: '10px 12px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        },
      });
      row.appendChild(el('div', {
        style: {
          fontSize: 'var(--fs-sm)',
          color: item.kind === 'warn' ? 'var(--warn)' : item.kind === 'ok' ? 'var(--ok)' : 'var(--ink)',
          fontWeight: item.read ? '400' : '500',
        },
        text: item.message,
      }));
      row.appendChild(el('div', {
        style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
        text: item.at.toLocaleTimeString(),
      }));
      listEl.appendChild(row);
    }
  }
  panel.appendChild(listEl);

  document.body.appendChild(panel);

  const onDocClick = (e) => {
    if (!panel.contains(e.target)) {
      panel.remove();
      document.removeEventListener('mousedown', onDocClick, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onDocClick, true), 0);
}
