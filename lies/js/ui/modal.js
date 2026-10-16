/* ============================================================
   js/ui/modal.js
   Accessible modal system with sizes, focus trap, ESC, backdrop
   ============================================================ */

import { el, byId, trapFocus, remove } from '../utils/dom.js';
import { MODAL_SIZES } from '../config/constants.js';
import { uuid } from '../utils/id.js';

/** @type {HTMLElement|null} */
let root = null;
/** @type {Set<{close:Function}>} */
const stack = [];

function ensureRoot() {
  if (!root) root = byId('modal-root');
  if (!root) {
    root = el('div', { class: 'modal-root', attrs: { id: 'modal-root' } });
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Open a modal.
 * @param {{
 *   title?: string,
 *   content?: string|Node|((ctx:{close:Function, modal:HTMLElement})=>Node),
 *   footer?: string|Node|((ctx:{close:Function, modal:HTMLElement})=>Node),
 *   size?: 'sm'|'md'|'lg'|'xl'|'full',
 *   closable?: boolean,
 *   dismissOnBackdrop?: boolean,
 *   dismissOnEsc?: boolean,
 *   className?: string,
 *   onOpen?: (modal:HTMLElement)=>void,
 *   onClose?: (reason:string)=>void,
 *   icon?: string,
 * }} opts
 * @returns {{close:Function, modal:HTMLElement, id:string}}
 */
export function openModal(opts = {}) {
  const {
    title = '',
    content = '',
    footer = '',
    size = MODAL_SIZES.MD,
    closable = true,
    dismissOnBackdrop = true,
    dismissOnEsc = true,
    className = '',
    onOpen,
    onClose,
    icon = '',
  } = opts;

  const container = ensureRoot();
  const id = `modal_${uuid().slice(0, 8)}`;

  const backdrop = el('div', {
    class: ['modal-backdrop', `modal-backdrop--${size}`, className].filter(Boolean),
    attrs: { 'data-modal-id': id },
  });

  const modal = el('div', {
    class: ['modal', `modal--${size}`],
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `modal-title-${id}`, tabindex: '-1' },
  });

  // Header
  if (title || icon) {
    const head = el('header', { class: 'modal__head' });
    if (icon) head.appendChild(el('span', { class: 'modal__icon' }, { children: [icon] }));
    const titleEl = el('h2', {
      class: 'modal__title',
      attrs: { id: `modal-title-${id}` },
    }, { children: [title] });
    head.appendChild(titleEl);

    if (closable) {
      head.appendChild(el('button', {
        class: 'modal__close icon-btn',
        attrs: { type: 'button', 'aria-label': 'بستن' },
        on: { click: () => close('close-button') },
      }, { children: ['✕'] }));
    }
    modal.appendChild(head);
  }

  // Body
  const body = el('div', { class: 'modal__body' });
  modal.appendChild(body);

  // Footer
  const footerWrap = el('footer', { class: 'modal__foot' });
  modal.appendChild(footerWrap);

  backdrop.appendChild(modal);
  container.appendChild(backdrop);

  const ctx = { close: (reason = 'manual') => close(reason), modal };
  const setContent = (target, val) => {
    if (!val) return;
    if (typeof val === 'string') target.innerHTML = val;
    else if (val instanceof Node) target.appendChild(val);
    else if (typeof val === 'function') {
      const out = val(ctx);
      if (out instanceof Node) target.appendChild(out);
      else if (typeof out === 'string') target.innerHTML = out;
    }
  };
  setContent(body, content);
  setContent(footerWrap, footer);
  if (!footerWrap.children.length) footerWrap.hidden = true;

  let releaseFocus = null;
  let closed = false;

  function close(reason = 'manual') {
    if (closed) return;
    closed = true;
    if (releaseFocus) releaseFocus();
    backdrop.classList.add('modal-backdrop--leaving');
    document.removeEventListener('keydown', onKeydown, true);
    setTimeout(() => {
      remove(backdrop);
      const idx = stack.findIndex((h) => h.close === close);
      if (idx >= 0) stack.splice(idx, 1);
      if (stack.length === 0) document.body.classList.remove('has-modal');
      try { onClose?.(reason); } catch (e) { console.error(e); }
    }, 200);
  }

  function onKeydown(ev) {
    if (ev.key === 'Escape' && dismissOnEsc) {
      // Only close the topmost modal
      if (stack[stack.length - 1]?.close === close) {
        ev.stopPropagation();
        close('escape');
      }
    }
  }

  if (dismissOnBackdrop) {
    backdrop.addEventListener('mousedown', (ev) => {
      if (ev.target === backdrop) close('backdrop');
    });
  }

  // Animate in
  requestAnimationFrame(() => {
    backdrop.classList.add('modal-backdrop--entering');
    releaseFocus = trapFocus(modal);
    document.addEventListener('keydown', onKeydown, true);
    try { onOpen?.(modal); } catch (e) { console.error(e); }
  });

  stack.push({ close });
  document.body.classList.add('has-modal');

  return { close, modal, id };
}

/**
 * Close all open modals.
 */
export function closeAllModals() {
  [...stack].reverse().forEach((h) => h.close('close-all'));
}

/**
 * Confirm dialog built on top of openModal.
 * @param {{
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: 'default'|'danger'|'warning'|'success',
 *   icon?: string,
 *   requireTyping?: string,
 * }} opts
 * @returns {Promise<boolean>}
 */
export function confirmModal(opts = {}) {
  const {
    title = 'تأیید عملیات',
    message = 'آیا مطمئن هستید؟',
    confirmLabel = 'تأیید',
    cancelLabel = 'لغو',
    variant = 'default',
    icon = '❓',
    requireTyping = '',
  } = opts;

  return new Promise((resolve) => {
    let resolved = false;
    const body = el('div', { class: 'confirm-body' });
    body.appendChild(el('p', { class: 'confirm-body__message' }, { children: [message] }));

    let typedInput = null;
    if (requireTyping) {
      body.appendChild(
        el('p', { class: 'confirm-body__hint' }, {
          children: [`برای تأیید عبارت «${requireTyping}» را وارد کنید:`],
        })
      );
      typedInput = el('input', {
        class: 'input',
        attrs: { type: 'text', placeholder: requireTyping, autocomplete: 'off' },
      });
      body.appendChild(typedInput);
    }

    const confirmBtn = el('button', {
      class: ['btn', variant === 'danger' ? 'btn--danger' : 'btn--primary'],
      attrs: { type: 'button', 'data-confirm': '1' },
    }, { children: [confirmLabel] });

    const cancelBtn = el('button', {
      class: 'btn btn--ghost',
      attrs: { type: 'button', 'data-cancel': '1' },
    }, { children: [cancelLabel] });

    const footer = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, confirmBtn] });

    const handle = openModal({
      title,
      icon,
      size: MODAL_SIZES.SM,
      content: body,
      footer,
      onClose: () => {
        if (!resolved) { resolved = true; resolve(false); }
      },
    });

    function tryConfirm() {
      if (typedInput) {
        if (typedInput.value.trim() !== requireTyping) {
          typedInput.classList.add('anim-shake');
          typedInput.focus();
          setTimeout(() => typedInput.classList.remove('anim-shake'), 450);
          return;
        }
      }
      resolved = true;
      handle.close('confirm');
      resolve(true);
    }

    confirmBtn.addEventListener('click', tryConfirm);
    cancelBtn.addEventListener('click', () => handle.close('cancel'));
    if (typedInput) {
      typedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryConfirm();
      });
      requestAnimationFrame(() => typedInput.focus());
    } else {
      requestAnimationFrame(() => confirmBtn.focus());
    }
  });
}

export { MODAL_SIZES };