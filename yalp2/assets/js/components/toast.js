/* ============================================================
   Toast notifications
   ============================================================ */
import { el, uid } from '../utils.js';
import { icon } from './icons.js';

let container = null;
const activeToasts = new Map();

export function initToast() {
  if (container && document.body.contains(container)) return;
  container = document.getElementById('toast-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-root';
    container.className = 'toast-root';
    document.body.appendChild(container);
  }
  injectToastStyles();
}

function injectToastStyles() {
  if (document.getElementById('toast-styles')) return;
  const s = document.createElement('style');
  s.id = 'toast-styles';
  s.textContent = `
    .toast-root {
      position: fixed;
      bottom: 24px;
      inset-inline: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      z-index: 600;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 240px;
      max-width: 440px;
      padding: 10px 14px;
      border-radius: 12px;
      background: #16161f;
      color: var(--text-1);
      border: 1px solid var(--border-2);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      transform: translateY(0);
      animation: toast-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
      backdrop-filter: blur(8px);
    }
    .toast.is-leaving { animation: toast-out 200ms ease-in forwards; }
    .toast__icon { width: 20px; height: 20px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; }
    .toast__icon svg { width: 16px; height: 16px; }
    .toast__msg { flex: 1; word-break: break-word; }
    .toast__close {
      width: 22px; height: 22px;
      display: grid; place-items: center;
      border-radius: 6px;
      color: var(--text-3);
      flex-shrink: 0;
    }
    .toast__close:hover { background: var(--surface-2); color: var(--text-1); }
    .toast__close svg { width: 12px; height: 12px; }

    .toast--info    .toast__icon { color: var(--violet-1); background: var(--brand-soft); }
    .toast--success .toast__icon { color: var(--good-2); background: var(--good-soft); }
    .toast--error   .toast__icon { color: var(--shit-2); background: var(--shit-soft); }
    .toast--warn    .toast__icon { color: var(--bad-2); background: var(--bad-soft); }

    .toast--success { border-color: var(--good-border); }
    .toast--error   { border-color: var(--shit-border); }
    .toast--warn    { border-color: var(--bad-border); }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(20px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(10px) scale(0.96); }
    }
  `;
  document.head.appendChild(s);
}

const ICON_BY_TYPE = {
  info: 'info',
  success: 'checkCircle',
  error: 'xCircle',
  warn: 'alert',
};

export function toast(message, type = 'info', duration = 3400) {
  initToast();
  const id = uid();
  const typeCls = `toast--${type}`;

  const closeBtn = el('button', {
    class: 'toast__close',
    'aria-label': 'بستن',
    html: icon('close', 12),
    onclick: () => dismiss(id),
  });

  const node = el('div', {
    class: `toast ${typeCls}`,
    role: 'status',
  }, [
    el('div', { class: 'toast__icon', html: icon(ICON_BY_TYPE[type] || 'info', 16) }),
    el('div', { class: 'toast__msg', text: String(message ?? '') }),
    closeBtn,
  ]);

  container.appendChild(node);
  activeToasts.set(id, node);

  if (duration > 0) {
    const timer = setTimeout(() => dismiss(id), duration);
    node._timer = timer;
  }

  return id;
}

function dismiss(id) {
  const node = activeToasts.get(id);
  if (!node) return;
  clearTimeout(node._timer);
  node.classList.add('is-leaving');
  setTimeout(() => {
    node.remove();
    activeToasts.delete(id);
  }, 220);
}

export const notify = {
  info: (m, d) => toast(m, 'info', d),
  success: (m, d) => toast(m, 'success', d),
  error: (m, d) => toast(m, 'error', d ?? 5000),
  warn: (m, d) => toast(m, 'warn', d),
};
