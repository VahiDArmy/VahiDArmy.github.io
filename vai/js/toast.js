import { icon } from './icons.js';
import { escapeHtml, uid } from './utils.js';

const TYPE_ICON = {
  success: 'checkCircle',
  error: 'xCircle',
  warning: 'warning',
  info: 'info'
};
const TYPE_COLOR = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--accent-2)'
};

export function toast({ title = '', message = '', type = 'info', duration = 4000, actions = null } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return null;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.dataset.id = uid();

  el.innerHTML = `
    <span class="toast-icon" style="color:${TYPE_COLOR[type] || TYPE_COLOR.info}">
      ${icon(TYPE_ICON[type] || TYPE_ICON.info)}
    </span>
    <div class="toast-body">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">${icon('close')}</button>
  `;

  const close = () => {
    if (!el.isConnected) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 340);
  };

  el.querySelector('.toast-close').addEventListener('click', close);

  if (Array.isArray(actions) && actions.length) {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        try { a.onClick?.(); } finally { close(); }
      });
      bar.appendChild(btn);
    }
    el.querySelector('.toast-body')?.appendChild(bar);
  }

  root.appendChild(el);

  if (duration > 0) {
    setTimeout(close, duration);
  }
  return el;
}

export const toastSuccess = (title, message, opts = {}) => toast({ title, message, type: 'success', ...opts });
export const toastError = (title, message, opts = {}) => toast({ title, message, type: 'error', duration: 7000, ...opts });
export const toastWarning = (title, message, opts = {}) => toast({ title, message, type: 'warning', duration: 5500, ...opts });
export const toastInfo = (title, message, opts = {}) => toast({ title, message, type: 'info', ...opts });
