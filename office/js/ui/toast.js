/**
 * Toast notifications — auto-dismiss, stacking, optional action.
 *
 *   toast.success('ذخیره شد')
 *   toast.error('خطا', { title: 'ناموفق', duration: 5000 })
 *   toast.show('پیام', { type: 'info', action: { label: 'بازگردانی', onClick } })
 */

import { TOAST_DURATION, TOAST_TYPES } from '../config/constants.js';
import { el, icon } from '../utils/dom.js';

const ICON_BY_TYPE = {
  success: 'check',
  error:   'x',
  warning: 'alert-triangle',
  info:    'info',
};

const MAX_VISIBLE = 4;
const DEFAULT_TITLES = {
  success: 'انجام شد',
  error:   'خطا',
  warning: 'توجه',
  info:    'اطلاع',
};

let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById('toast-root');
  if (!root) {
    root = el('div', { id: 'toast-root', class: 'toast-root', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(root);
  }
  return root;
}

function dismiss(node, immediate = false) {
  if (!node || !node.parentNode) return;
  if (immediate) {
    node.remove();
    return;
  }
  node.classList.add('is-closing');
  node.addEventListener(
    'animationend',
    () => node.remove(),
    { once: true }
  );
  // Failsafe
  setTimeout(() => node.remove(), 400);
}

function createToast({ type = TOAST_TYPES.INFO, title, message, duration, action, closable = true }) {
  const container = ensureRoot();
  const iconName = ICON_BY_TYPE[type] || 'info';
  const autoClose = duration !== 0;
  const duration_ = typeof duration === 'number' ? duration : TOAST_DURATION;

  const closeBtn = closable
    ? el('button', {
        type: 'button',
        class: 'toast__close',
        'aria-label': 'بستن',
        on: { click: () => dismiss(toastNode) },
      }, [icon('x')])
    : null;

  const actionBtn = action
    ? el('button', {
        type: 'button',
        class: 'btn btn--link btn--sm',
        style: { marginBlockStart: '6px' },
        on: {
          click: () => {
            try { action.onClick?.(); } finally { dismiss(toastNode); }
          },
        },
      }, [action.label || 'انجام'])
    : null;

  const content = el('div', { class: 'toast__content' }, [
    title !== null
      ? el('div', { class: 'toast__title' }, [title || DEFAULT_TITLES[type] || ''])
      : null,
    message ? el('div', { class: 'toast__message' }, [message]) : null,
    actionBtn,
  ]);

  const toastNode = el(
    'div',
    {
      class: `toast toast--${type}`,
      role: type === TOAST_TYPES.ERROR ? 'alert' : 'status',
      style: { '--toast-duration': `${duration_}ms` },
    },
    [
      el('div', { class: 'toast__icon' }, [icon(iconName)]),
      content,
      closeBtn,
      autoClose ? el('div', { class: 'toast__progress' }) : null,
    ]
  );

  container.appendChild(toastNode);

  // Enforce stack limit
  const nodes = container.querySelectorAll('.toast');
  if (nodes.length > MAX_VISIBLE) {
    for (let i = 0; i < nodes.length - MAX_VISIBLE; i++) dismiss(nodes[i], true);
  }

  if (autoClose) {
    const t = setTimeout(() => dismiss(toastNode), duration_);
    toastNode.addEventListener('mouseenter', () => clearTimeout(t), { once: true });
  }

  return { dismiss: () => dismiss(toastNode), node: toastNode };
}

function show(message, options = {}) {
  return createToast({ message, ...options });
}

const success = (message, options = {}) => createToast({ ...options, type: 'success', message });
const error   = (message, options = {}) => createToast({ ...options, type: 'error',   message, duration: options.duration ?? 5000 });
const warning = (message, options = {}) => createToast({ ...options, type: 'warning', message });
const info    = (message, options = {}) => createToast({ ...options, type: 'info',    message });

/** Clear all visible toasts. */
function clearAll() {
  ensureRoot()
    .querySelectorAll('.toast')
    .forEach((n) => dismiss(n, true));
}

export const toast = { show, success, error, warning, info, clearAll, dismiss };
export default toast;