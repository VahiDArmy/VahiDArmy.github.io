// Toast notifications.

import { el } from '../utils/dom.js';

const stack = () => document.getElementById('toast-stack');
const MAX = 5;
let live = [];
let counter = 0;

const ICONS = {
  info: 'i',
  ok: '✓',
  warn: '!',
  bad: '×',
};

export function toast(message, options = {}) {
  const root = stack();
  if (!root) return () => {};
  const type = options.type || 'info';
  const duration = typeof options.duration === 'number' ? options.duration : 2600;
  const id = 'toast-' + ++counter;

  const node = el('div', {
    class: ['toast', type],
    role: 'status',
    'aria-live': 'polite',
    id,
  }, [
    el('span', { class: 'toast-ico', html: ICONS[type] || '·' }),
    el('div', { class: 'toast-msg', text: message }),
    el('div', {
      class: 'toast-bar',
      style: { animationDuration: duration + 'ms' },
    }),
  ]);

  root.appendChild(node);
  live.push(node);

  while (live.length > MAX) {
    const old = live.shift();
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  let removed = false;
  function dismiss() {
    if (removed) return;
    removed = true;
    node.classList.add('is-leaving');
    setTimeout(() => {
      if (node.parentNode) node.parentNode.removeChild(node);
      live = live.filter((n) => n !== node);
    }, 220);
  }

  const timer = setTimeout(dismiss, duration);

  node.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });

  return dismiss;
}

export function toastOk(message, options = {}) {
  return toast(message, { ...options, type: 'ok' });
}

export function toastWarn(message, options = {}) {
  return toast(message, { ...options, type: 'warn' });
}

export function toastBad(message, options = {}) {
  return toast(message, { ...options, type: 'bad' });
}

export function toastInfo(message, options = {}) {
  return toast(message, { ...options, type: 'info' });
}

export function flashPaste() {
  const node = el('div', { class: 'paste-flash', 'aria-hidden': 'true' });
  document.body.appendChild(node);
  setTimeout(() => {
    if (node.parentNode) node.parentNode.removeChild(node);
  }, 660);
}
