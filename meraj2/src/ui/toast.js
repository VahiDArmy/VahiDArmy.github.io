/** Non-blocking notifications. Provider text is shown verbatim, never paraphrased. */
import { escapeHtml, uid } from '../utils.js';
import { icon } from './icons.js';

let root = null;
const active = new Set();

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.querySelector('#toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'false');
    document.body.appendChild(root);
  }
  return root;
}

const TYPE_ICON = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  error: 'xCircle',
  loading: 'loader',
};

/**
 * @returns {{close: Function, element: HTMLElement}}
 */
export function toast({
  title = '',
  message = '',
  type = 'info',
  duration = 5200,
  actions = [],
  dismissible = true,
} = {}) {
  const container = ensureRoot();
  const id = uid();
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.dataset.toastId = id;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const actionHtml = actions.length
    ? `<div class="toast__actions">${actions
        .map(
          (action, index) =>
            `<button type="button" class="toast__action" data-toast-action="${index}">${escapeHtml(action.label)}</button>`,
        )
        .join('')}</div>`
    : '';

  node.innerHTML = `
    <span class="toast__icon">${icon(TYPE_ICON[type] || 'info', { size: 18, className: type === 'loading' ? 'spin' : '' })}</span>
    <div class="toast__copy">
      ${title ? `<p class="toast__title">${escapeHtml(title)}</p>` : ''}
      ${message ? `<p class="toast__message">${escapeHtml(message)}</p>` : ''}
      ${actionHtml}
    </div>
    ${dismissible ? `<button type="button" class="toast__close" aria-label="Dismiss notification">${icon('close', { size: 15 })}</button>` : ''}
    <span class="toast__timer" aria-hidden="true"></span>
  `;

  const close = () => {
    if (!active.has(node)) return;
    active.delete(node);
    node.classList.add('is-leaving');
    window.setTimeout(() => node.remove(), 220);
  };

  if (dismissible) node.querySelector('.toast__close')?.addEventListener('click', close);
  node.querySelectorAll('[data-toast-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = actions[Number(button.dataset.toastAction)];
      if (typeof action?.onClick === 'function') action.onClick();
      if (action?.close !== false) close();
    });
  });

  if (duration > 0) {
    const timer = node.querySelector('.toast__timer');
    if (timer) timer.style.animationDuration = `${duration}ms`;
    node._timer = window.setTimeout(close, duration);
    node.addEventListener('mouseenter', () => {
      window.clearTimeout(node._timer);
      if (timer) timer.style.animationPlayState = 'paused';
    });
    node.addEventListener('mouseleave', () => {
      node._timer = window.setTimeout(close, Math.max(1800, duration / 2));
      if (timer) timer.style.animationPlayState = 'running';
    });
  }

  container.appendChild(node);
  active.add(node);
  while (active.size > 4) {
    const oldest = active.values().next().value;
    if (!oldest) break;
    active.delete(oldest);
    oldest.remove();
  }
  requestAnimationFrame(() => node.classList.add('is-visible'));
  return { element: node, close };
}

export function toastError(title, error, options = {}) {
  const message = error?.message || (typeof error === 'string' ? error : 'The operation did not complete.');
  return toast({
    title,
    message,
    type: 'error',
    duration: options.duration ?? 9000,
    actions: options.actions || [],
  });
}

export function toastSuccess(title, message = '', options = {}) {
  return toast({ title, message, type: 'success', duration: 3800, ...options });
}

export function clearToasts() {
  for (const node of active) node.remove();
  active.clear();
}
