/**
 * toast.js — سیستم اعلان‌های شناور
 * API: toast.show / toast.success / toast.error / toast.warning / toast.info
 */

import { $, el, clear } from '../utils/dom.js';

const DEFAULT_DURATION = 4200;

let root = null;

function ensureRoot() {
  if (root) return root;
  root = $('#toast-root');
  if (!root) {
    root = el('div', { id: 'toast-root', class: 'toast-root' });
    document.body.appendChild(root);
  }
  return root;
}

/* ---------- پایه ---------- */

function show({ type = 'info', title, message, duration = DEFAULT_DURATION, actions = null } = {}) {
  const container = ensureRoot();

  const icons = {
    success: '✓', error: '✕', warning: '!', info: 'i',
  };

  const toast = el('div', {
    class: `toast toast--${type}`,
    role: 'status',
    'aria-live': type === 'error' ? 'assertive' : 'polite',
  });

  toast.appendChild(el('div', { class: 'toast__icon' }, [icons[type] || 'i']));

  const content = el('div', { class: 'toast__content' });
  if (title) content.appendChild(el('div', { class: 'toast__title' }, [title]));
  if (message) content.appendChild(el('div', { class: 'toast__message' }, [message]));

  if (actions?.length) {
    for (const a of actions) {
      const btn = el('button', { class: 'toast__action', type: 'button' }, [a.label]);
      btn.addEventListener('click', () => { a.onClick?.(); close(); });
      content.appendChild(btn);
    }
  }
  toast.appendChild(content);

  const closeBtn = el('button', { class: 'toast__close', type: 'button', 'aria-label': 'بستن' }, ['✕']);
  closeBtn.addEventListener('click', () => close());
  toast.appendChild(closeBtn);

  const progress = el('span', { class: 'toast__progress' });
  if (duration > 0) {
    progress.style.animationDuration = `${duration}ms`;
    toast.appendChild(progress);
  }

  container.appendChild(toast);

  let timer = null;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    toast.classList.add('is-closing');
    setTimeout(() => toast.remove(), 240);
  }

  if (duration > 0) timer = setTimeout(close, duration);

  // pause on hover
  toast.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    progress.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    if (duration > 0) {
      progress.style.animationPlayState = 'running';
      timer = setTimeout(close, 1200);
    }
  });

  return { close, el: toast };
}

export const toast = {
  show,
  success: (title, message, opts) => show({ type: 'success', title, message, ...opts }),
  error:   (title, message, opts) => show({ type: 'error',   title, message, duration: 6000, ...opts }),
  warning: (title, message, opts) => show({ type: 'warning', title, message, ...opts }),
  info:    (title, message, opts) => show({ type: 'info',    title, message, ...opts }),
  clear() { if (root) clear(root); },
};