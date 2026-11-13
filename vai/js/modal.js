import { uid, escapeHtml } from './utils.js';
import { icon } from './icons.js';

let stack = [];

export function openModal({ title = '', body = '', footer = '', size = '', onClose = null, dismissible = true } = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return null;

  const id = uid();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.dataset.modalId = id;

  const modal = document.createElement('div');
  modal.className = `modal${size === 'wide' ? ' modal-wide' : ''}`;
  modal.dataset.modalId = id;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${escapeHtml(title)}</div>
      <button class="btn btn-ghost btn-icon btn-sm modal-close" aria-label="Close">
        ${icon('close')}
      </button>
    </div>
    <div class="modal-body"></div>
    ${footer || footer === '' ? '<div class="modal-footer"></div>' : ''}
  `;

  const bodyEl = modal.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);

  const footerEl = modal.querySelector('.modal-footer');
  if (footerEl) {
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) footerEl.appendChild(footer);
  }

  root.appendChild(backdrop);
  root.appendChild(modal);

  requestAnimationFrame(() => {
    backdrop.classList.add('visible');
    modal.classList.add('visible');
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('visible');
    modal.classList.remove('visible');
    setTimeout(() => {
      backdrop.remove();
      modal.remove();
      stack = stack.filter(m => m.id !== id);
      try { onClose?.(); } catch (e) { console.error(e); }
    }, 340);
  };

  modal.querySelector('.modal-close').addEventListener('click', close);
  if (dismissible) backdrop.addEventListener('click', close);

  const handle = { id, close, modal, backdrop, body: bodyEl, footer: footerEl };
  stack.push(handle);
  return handle;
}

export function closeAllModals() {
  [...stack].forEach(m => m.close());
}

export function hasOpenModal() {
  return stack.length > 0;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});
