// AURORA OS — Toast System

import { h, $ } from '../core/dom.js';

const ICONS = { success: '✓', warning: '!', error: '×', info: 'i' };

let _container = null;
function container() {
  if (!_container) _container = $('#toasts');
  return _container;
}

export function toast(message, opts = {}) {
  const { type = 'info', duration = 3200, action } = opts;
  const root = container();
  if (!root) return;

  const el = h('div', { class: 'toast toast--' + type, role: 'status' });
  el.append(h('div', { class: 'toast__icon', text: ICONS[type] || 'i' }));
  const body = h('div', { class: 'toast__body', style: { flex: '1', minWidth: '0' } });
  body.append(h('div', { text: message }));
  el.append(body);
  if (action) {
    const btn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: action.label });
    btn.addEventListener('click', () => { action.onClick?.(); dismiss(); });
    el.append(btn);
  }

  const close = h('button', {
    class: 'btn btn--ghost btn--icon btn--sm',
    type: 'button', text: '×', 'aria-label': 'Dismiss',
  });

  const dismiss = () => {
    if (el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };

  close.addEventListener('click', dismiss);
  el.append(close);
  root.append(el);

  if (duration > 0) setTimeout(dismiss, duration);
  return { dismiss };
}

toast.success = (m, o = {}) => toast(m, { ...o, type: 'success' });
toast.warning = (m, o = {}) => toast(m, { ...o, type: 'warning' });
toast.error = (m, o = {}) => toast(m, { ...o, type: 'error' });
toast.info = (m, o = {}) => toast(m, { ...o, type: 'info' });

export default toast;
