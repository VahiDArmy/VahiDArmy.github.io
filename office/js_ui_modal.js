/**
 * Modal / dialog system with focus trap, stacking, and Escape handling.
 *
 *   const { close, setBody, update } = modal.open({
 *     title: 'ویرایش',
 *     body: node,
 *     footer: node,
 *     size: 'md', // sm | md | lg | xl | full
 *     dismissible: true,
 *     onClose: () => {},
 *   });
 */

import { el, icon, lockBodyScroll, unlockBodyScroll, trapFocus, focusFirst } from '../utils/dom.js';

let modalRoot = null;
let stack = [];

function ensureRoot() {
  if (modalRoot && document.body.contains(modalRoot)) return modalRoot;
  modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = el('div', { id: 'modal-root', class: 'portal-root' });
    document.body.appendChild(modalRoot);
  }
  return modalRoot;
}

function handleKeydown(e) {
  if (e.key === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if (top && top.dismissible) {
      e.preventDefault();
      top.close();
    }
  }
}

function registerDocumentListener() {
  if (registerDocumentListener._done) return;
  document.addEventListener('keydown', handleKeydown);
  registerDocumentListener._done = true;
}

export function open(options = {}) {
  const {
    title,
    subtitle,
    body,
    footer,
    size = 'md',
    dismissible = true,
    className,
    onClose,
    initialFocus,
  } = options;

  ensureRoot();
  registerDocumentListener();

  const closeBtn = dismissible
    ? el('button', {
        type: 'button',
        class: 'modal__close',
        'aria-label': 'بستن',
        on: { click: () => close() },
      }, [icon('x')])
    : null;

  const header = el('div', { class: 'modal__header' }, [
    el('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
      title
        ? el('h2', { class: 'modal__title', id: 'modal-title' }, [title])
        : null,
      subtitle ? el('p', { class: 'modal__subtitle' }, [subtitle]) : null,
    ]),
    closeBtn,
  ]);

  const bodyNode = el('div', { class: 'modal__body' });
  if (body != null) bodyNode.appendChild(body instanceof Node ? body : document.createTextNode(String(body)));

  const footerNode = footer ? el('div', { class: 'modal__footer' }) : null;
  if (footerNode && footer != null) footerNode.appendChild(footer instanceof Node ? footer : document.createTextNode(String(footer)));

  const modalNode = el(
    'div',
    {
      class: `modal modal--${size}${className ? ' ' + className : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': title ? 'modal-title' : undefined,
      tabindex: '-1',
    },
    [header, bodyNode, footerNode]
  );

  const backdrop = el(
    'div',
    {
      class: 'modal-backdrop',
      on: {
        mousedown: (e) => {
          if (!dismissible) return;
          if (e.target === backdrop) close();
        },
      },
    },
    [modalNode]
  );

  ensureRoot().appendChild(backdrop);

  // Focus management
  const releaseFocus = trapFocus(modalNode);
  lockBodyScroll();
  requestAnimationFrame(() => {
    if (initialFocus && typeof initialFocus.focus === 'function') initialFocus.focus();
    else focusFirst(modalNode);
  });

  const handle = {
    backdrop,
    modalNode,
    bodyNode,
    footerNode,
    close,
    setBody(node) {
      bodyNode.innerHTML = '';
      if (node != null) bodyNode.appendChild(node instanceof Node ? node : document.createTextNode(String(node)));
    },
    setFooter(node) {
      if (!footerNode) return;
      footerNode.innerHTML = '';
      if (node != null) footerNode.appendChild(node instanceof Node ? node : document.createTextNode(String(node)));
    },
    setTitle(text) {
      const t = modalNode.querySelector('.modal__title');
      if (t) t.textContent = text;
    },
  };

  stack.push({ ...handle, dismissible });

  backdrop.addEventListener('animationend', () => {
    /* noop */
  }, { once: true });

  function close() {
    if (!backdrop.parentNode) return;
    releaseFocus();
    unlockBodyScroll();
    backdrop.classList.add('is-closing');
    const remove = () => {
      backdrop.remove();
      stack = stack.filter((s) => s.backdrop !== backdrop);
      onClose?.();
    };
    setTimeout(remove, 160);
  }

  return handle;
}

/** Convenience: simple alert-like modal. */
export function alertDialog({ title = 'توجه', message, buttonLabel = 'باشه' } = {}) {
  return new Promise((resolve) => {
    const closeBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: { click: () => { handle.close(); resolve(); } },
    }, [buttonLabel]);

    const handle = open({
      title,
      body: el('p', { style: { color: 'var(--text-secondary)', lineHeight: '1.7' } }, [message || '']),
      footer: closeBtn,
      size: 'sm',
      onClose: () => resolve(),
    });
  });
}

export const modal = { open, alert: alertDialog };
export default modal;