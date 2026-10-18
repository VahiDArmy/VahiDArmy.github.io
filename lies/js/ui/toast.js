/* ============================================================
   js/ui/toast.js
   COMPLETE FILE - NO TRUNCATION.
   Restored the missing `toastPromise` function.
   ============================================================ */

import { el, byId, remove } from '../utils/dom.js';
import { TOAST_TYPES } from '../config/constants.js';
import { TOAST_DURATION } from '../config/app.config.js';

/** @type {HTMLElement|null} */
let root = null;
const MAX_VISIBLE = 5;
const queue = [];

function ensureRoot() {
  if (!root) root = byId('toast-root');
  if (!root) {
    root = el('div', { class: 'toast-root', attrs: { id: 'toast-root', 'aria-live': 'polite' } });
    document.body.appendChild(root);
  }
  return root;
}

const ICONS = {
  [TOAST_TYPES.SUCCESS]: '✓',
  [TOAST_TYPES.ERROR]: '✕',
  [TOAST_TYPES.WARNING]: '⚠',
  [TOAST_TYPES.INFO]: 'ℹ',
  [TOAST_TYPES.LOADING]: '',
};

export function toast(arg) {
  const opts = typeof arg === 'string' ? { message: arg } : { ...arg };
  const {
    message = '',
    title = '',
    type = TOAST_TYPES.INFO,
    duration = TOAST_DURATION.normal,
    action = null,
    dismissible = true,
    progress = false,
  } = opts;

  const container = ensureRoot();
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const node = el('div', {
    class: ['toast', `toast--${type}`],
    attrs: { role: type === TOAST_TYPES.ERROR ? 'alert' : 'status', 'data-toast-id': id },
  });

  const icon = el('div', { class: 'toast__icon' });
  if (type === TOAST_TYPES.LOADING) {
    icon.appendChild(el('span', { class: 'toast__spinner' }));
  } else {
    icon.textContent = ICONS[type] || '·';
  }
  node.appendChild(icon);

  const content = el('div', { class: 'toast__content' });
  if (title) content.appendChild(el('div', { class: 'toast__title' }, { children: [title] }));
  if (message) content.appendChild(el('div', { class: 'toast__message' }, { children: [message] }));

  if (action && typeof action.onClick === 'function') {
    const btn = el('button', { class: 'toast__action', attrs: { type: 'button' } }, { children: [action.label] });
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      try { action.onClick(); } catch (e) { console.error(e); }
      dismiss();
    });
    content.appendChild(btn);
  }
  node.appendChild(content);

  if (dismissible) {
    const closeBtn = el('button', { class: 'toast__close', attrs: { type: 'button', 'aria-label': 'بستن' } }, { children: ['✕'] });
    closeBtn.addEventListener('click', () => dismiss());
    node.appendChild(closeBtn);
  }

  let progressBar = null;
  if (progress && duration > 0) {
    progressBar = el('div', { class: 'toast__progress' });
    progressBar.appendChild(el('div', { class: 'toast__progress-bar' }));
    node.appendChild(progressBar);
  }

  let timer = null;
  let remaining = duration;
  let startTs = 0;
  let paused = false;
  let dismissed = false;

  function startTimer() {
    if (!duration) return;
    startTs = Date.now();
    timer = setTimeout(() => dismiss(), remaining);
  }

  function pauseTimer() {
    if (dismissed || !timer) return;
    paused = true;
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startTs;
  }

  function resumeTimer() {
    if (dismissed || !paused) return;
    paused = false;
    startTimer();
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    node.classList.add('toast--leaving');
    setTimeout(() => {
      remove(node);
      const idx = queue.indexOf(handle);
      if (idx >= 0) queue.splice(idx, 1);
    }, 220);
  }

  node.addEventListener('mouseenter', pauseTimer);
  node.addEventListener('mouseleave', resumeTimer);

  if (container.children.length >= MAX_VISIBLE) {
    const first = container.firstElementChild;
    if (first) {
      first.classList.add('toast--leaving');
      setTimeout(() => remove(first), 220);
    }
  }

  container.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--entering'));
  startTimer();

  const handle = {
    id,
    dismiss,
    update(patch = {}) {
      if (patch.type) {
        node.classList.remove(`toast--${type}`);
        node.classList.add(`toast--${patch.type}`);
      }
      if (patch.message) {
        const m = node.querySelector('.toast__message');
        if (m) m.textContent = patch.message;
      }
    },
  };
  queue.push(handle);
  return handle;
}

toast.success = (message, opts = {}) => toast({ message, type: TOAST_TYPES.SUCCESS, ...opts });
toast.error = (message, opts = {}) => toast({ message, type: TOAST_TYPES.ERROR, duration: TOAST_DURATION.long, ...opts });
toast.warning = (message, opts = {}) => toast({ message, type: TOAST_TYPES.WARNING, ...opts });
toast.info = (message, opts = {}) => toast({ message, type: TOAST_TYPES.INFO, ...opts });
toast.loading = (message, opts = {}) => toast({ message, type: TOAST_TYPES.LOADING, duration: 0, dismissible: false, ...opts });
toast.dismissAll = () => { [...queue].forEach((t) => t.dismiss()); };

// 🛡️ RESTORED: toastPromise function
export async function toastPromise(promise, msgs = {}) {
  const handle = toast.loading(msgs.loading || 'در حال انجام…', { duration: 0 });
  try {
    const result = await promise;
    handle.dismiss();
    if (msgs.success) {
      toast.success(typeof msgs.success === 'function' ? msgs.success(result) : msgs.success);
    }
    return result;
  } catch (err) {
    handle.dismiss();
    toast.error(
      typeof msgs.error === 'function'
        ? msgs.error(err)
        : msgs.error || err?.message || 'خطایی رخ داد.'
    );
    throw err;
  }
}

export { TOAST_TYPES };