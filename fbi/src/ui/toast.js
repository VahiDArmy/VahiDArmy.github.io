import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/utils.js';

export function toast(message, { type = 'info', title = '', timeout = 4200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info')}
    <div class="toast-body">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${escapeHtml(message)}</div>`;
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  const remove = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(remove, timeout);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

export function toastError(message, error) {
  const detail = error?.message ? `${message}: ${error.message}` : message;
  console.error(message, error);
  toast(detail, { type: 'err', timeout: 7000 });
}
