/* ============================================================
   js/ui/toast.js
   FIXED: Removed all inline styles. Rely strictly on CSS classes.
          Removed the inline z-index (use var(--z-toast)).
   ============================================================ */

import { el, byId, remove } from '../utils/dom.js';
import { TOAST_TYPES } from '../config/constants.js';
import { TOAST_DURATION } from '../config/app.config.js';

let root = null;
const queue = [];

function ensureRoot() {
  if (!root) root = byId('toast-root');
  if (!root) { root = el('div', { class: 'toast-root', attrs: { id: 'toast-root', 'aria-live': 'polite' } }); document.body.appendChild(root); }
  return root;
}

const ICONS = { [TOAST_TYPES.SUCCESS]: '✓', [TOAST_TYPES.ERROR]: '✕', [TOAST_TYPES.WARNING]: '⚠', [TOAST_TYPES.INFO]: 'ℹ', [TOAST_TYPES.LOADING]: '' };

export function toast(arg) {
  const opts = typeof arg === 'string' ? { message: arg } : arg;
  const { message = '', title = '', type = TOAST_TYPES.INFO, duration = TOAST_DURATION.normal, action = null, dismissible = true, progress = false } = opts;
  const container = ensureRoot();
  const node = el('div', { class: ['toast', `toast--${type}`] });

  const icon = el('div', { class: 'toast__icon' });
  if (type === TOAST_TYPES.LOADING) icon.appendChild(el('span', { class: 'toast__spinner' }));
  else icon.textContent = ICONS[type] || '·';
  node.appendChild(icon);

  const content = el('div', { class: 'toast__content' });
  if (title) content.appendChild(el('div', { class: 'toast__title' }, { children: [title] }));
  if (message) content.appendChild(el('div', { class: 'toast__message' }, { children: [message] }));
  if (action) {
    const btn = el('button', { class: 'toast__action', attrs: { type: 'button' } }, { children: [action.label] });
    btn.addEventListener('click', (e) => { e.stopPropagation(); action.onClick(); dismiss(); });
    content.appendChild(btn);
  }
  node.appendChild(content);

  if (dismissible) {
    const closeBtn = el('button', { class: 'toast__close', attrs: { type: 'button', 'aria-label': 'بستن' } }, { children: ['✕'] });
    closeBtn.addEventListener('click', () => dismiss());
    node.appendChild(closeBtn);
  }

  let timer = null;
  function dismiss() {
    if (timer) clearTimeout(timer);
    node.classList.add('toast--leaving');
    setTimeout(() => { remove(node); const idx = queue.indexOf(handle); if (idx >= 0) queue.splice(idx, 1); }, 220);
  }

  container.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--entering'));
  if (duration > 0) timer = setTimeout(() => dismiss(), duration);
  
  const handle = { dismiss };
  queue.push(handle);
  return handle;
}

toast.success = (msg, o = {}) => toast({ message: msg, type: TOAST_TYPES.SUCCESS, ...o });
toast.error = (msg, o = {}) => toast({ message: msg, type: TOAST_TYPES.ERROR, duration: TOAST_DURATION.long, ...o });
toast.warning = (msg, o = {}) => toast({ message: msg, type: TOAST_TYPES.WARNING, ...o });
toast.info = (msg, o = {}) => toast({ message: msg, type: TOAST_TYPES.INFO, ...o });
toast.loading = (msg, o = {}) => toast({ message: msg, type: TOAST_TYPES.LOADING, duration: 0, dismissible: false, ...o });