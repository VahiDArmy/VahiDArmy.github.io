/**
 * modal.js — سیستم مودال، Confirm، Prompt و Drawer
 * - یکتا: در هر لحظه فقط یک مودال باز می‌شود (مگر با stack)
 * - دسترس‌پذیر: aria-modal, focus trap, ESC, بازگشت فوکوس
 */

import { $, el, svg, show, hide, clear, lockScroll, unlockScroll, trapFocus } from '../utils/dom.js';
import { toast } from './toast.js';

const modalRoot = () => $('#modal-root') || document.body;

/* =========================================================================
   Modal پایه
   ========================================================================= */

export function openModal({
  title,
  subtitle,
  icon = null,
  body,                     // Node | string | (container) => void
  footer = null,            // Node | (closeFn) => Node
  size = 'md',              // sm | md | lg | xl | full
  closeOnEsc = true,
  closeOnOverlay = true,
  onClose = null,
  className = '',
  hideCloseBtn = false,
} = {}) {
  const root = modalRoot();

  const overlay = el('div', { class: 'modal-overlay', role: 'presentation' });
  const modal = el('div', {
    class: `modal modal--${size} ${className}`,
    role: 'dialog',
    'aria-modal': 'true',
  });

  /* ---------- Header ---------- */
  if (title || !hideCloseBtn) {
    const header = el('div', { class: 'modal__header' });
    const titleWrap = el('div', { class: 'modal__title-wrapper' });
    if (title) {
      const titleEl = el('div', { class: 'modal__title' });
      if (icon) titleEl.appendChild(el('span', { class: 'modal__title-icon' }, [icon]));
      titleEl.appendChild(el('span', {}, [title]));
      titleWrap.appendChild(titleEl);
    }
    if (subtitle) titleWrap.appendChild(el('div', { class: 'modal__subtitle' }, [subtitle]));
    header.appendChild(titleWrap);

    if (!hideCloseBtn) {
      const closeBtn = el('button', {
        class: 'modal__close', type: 'button', 'aria-label': 'بستن',
      }, ['✕']);
      closeBtn.addEventListener('click', () => close());
      header.appendChild(closeBtn);
    }
    modal.appendChild(header);
  }

  /* ---------- Body ---------- */
  const bodyEl = el('div', { class: 'modal__body' });
  if (body instanceof Node) bodyEl.appendChild(body);
  else if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (typeof body === 'function') body(bodyEl);
  modal.appendChild(bodyEl);

  /* ---------- Footer ---------- */
  if (footer) {
    const footerEl = el('div', { class: 'modal__footer' });
    const content = typeof footer === 'function' ? footer(() => close()) : footer;
    if (content instanceof Node) footerEl.appendChild(content);
    else if (typeof content === 'string') footerEl.innerHTML = content;
    modal.appendChild(footerEl);
  }

  overlay.appendChild(modal);
  root.appendChild(overlay);
  lockScroll();

  /* ---------- Behavior ---------- */
  const previousFocus = document.activeElement;
  const releaseTrap = trapFocus(modal);

  function handleEsc(e) {
    if (closeOnEsc && e.key === 'Escape') { e.stopPropagation(); close(); }
  }
  function handleOverlayClick(e) {
    if (closeOnOverlay && e.target === overlay) close();
  }

  document.addEventListener('keydown', handleEsc, true);
  overlay.addEventListener('click', handleOverlayClick);

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', handleEsc, true);
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      releaseTrap();
      unlockScroll();
      if (previousFocus instanceof HTMLElement) previousFocus.focus?.();
      onClose?.(result);
    }, 180);
  }

  // Focus first interactive element
  requestAnimationFrame(() => {
    const first = modal.querySelector(
      'input:not([type="hidden"]), select, textarea, button:not(.modal__close), [tabindex]:not([tabindex="-1"])'
    );
    first?.focus?.();
  });

  return { close, el: modal, overlay };
}

/* =========================================================================
   Confirm
   ========================================================================= */

export function openConfirm({
  title = 'تأیید عملیات',
  text = 'آیا از انجام این عملیات مطمئن هستید؟',
  type = 'warning',          // danger | warning | info | success
  confirmText = 'بله، انجام بده',
  cancelText = 'انصراف',
  confirmVariant = null,     // اگر null باشد بر اساس type انتخاب می‌شود
  onConfirm = null,
} = {}) {
  const icons = {
    danger:  { symbol: '⚠', cls: 'confirm-modal__icon--danger' },
    warning: { symbol: '⚠', cls: 'confirm-modal__icon--warning' },
    info:    { symbol: 'ℹ', cls: 'confirm-modal__icon--info' },
    success: { symbol: '✓', cls: 'confirm-modal__icon--info' },
  };
  const icon = icons[type] || icons.warning;
  const variant = confirmVariant || (type === 'danger' ? 'danger' : 'primary');

  return new Promise((resolve) => {
    const ref = openModal({
      size: 'sm',
      className: 'confirm-modal',
      hideCloseBtn: true,
      closeOnOverlay: false,
      body: (container) => {
        container.appendChild(el('div', { class: `confirm-modal__icon ${icon.cls}` }, [icon.symbol]));
        container.appendChild(el('div', { class: 'confirm-modal__title' }, [title]));
        container.appendChild(el('div', { class: 'confirm-modal__text' }, [text]));
      },
      footer: (close) => {
        const wrap = el('div', { class: 'flex gap-3', style: { width: '100%', justifyContent: 'center' } });

        const cancelBtn = el('button', { class: 'btn btn--outline', type: 'button' }, [cancelText]);
        cancelBtn.addEventListener('click', () => { close(); resolve(false); });

        const confirmBtn = el('button', { class: `btn btn--${variant}`, type: 'button' }, [confirmText]);
        confirmBtn.addEventListener('click', async () => {
          try {
            confirmBtn.classList.add('is-loading');
            await onConfirm?.();
            close();
            resolve(true);
          } catch (e) {
            toast.error('خطا', e?.message || 'انجام عملیات با خطا مواجه شد.');
            confirmBtn.classList.remove('is-loading');
            resolve(false);
          }
        });

        wrap.appendChild(cancelBtn);
        wrap.appendChild(confirmBtn);
        return wrap;
      },
      onClose: () => resolve(false),
    });

    // تنظیم فوکوس روی دکمه تأیید
    requestAnimationFrame(() => {
      const btns = ref.el.querySelectorAll('.modal__footer button');
      btns[1]?.focus();
    });
  });
}

/* =========================================================================
   Prompt
   ========================================================================= */

export function openPrompt({
  title = 'ورود مقدار',
  label = 'مقدار',
  placeholder = '',
  defaultValue = '',
  type = 'text',
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  validator = null,   // (value) => string|null (خطا)
} = {}) {
  return new Promise((resolve) => {
    let input;
    let errorEl;

    openModal({
      size: 'sm',
      className: 'modal-prompt',
      title,
      body: (container) => {
        const field = el('div', { class: 'field' });
        field.appendChild(el('label', { class: 'field__label' }, [label]));
        input = el('input', {
          class: 'field__input',
          type, value: defaultValue, placeholder,
        });
        field.appendChild(input);
        errorEl = el('span', { class: 'field__error' });
        field.appendChild(errorEl);
        container.appendChild(field);
      },
      footer: (close) => {
        const wrap = el('div', { class: 'flex gap-2', style: { width: '100%', justifyContent: 'flex-end' } });
        const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, [cancelText]);
        cancel.addEventListener('click', () => { close(); resolve(null); });

        const ok = el('button', { class: 'btn btn--primary', type: 'button' }, [confirmText]);
        const submit = () => {
          const value = input.value.trim();
          if (validator) {
            const err = validator(value);
            if (err) {
              errorEl.textContent = err;
              input.closest('.field').classList.add('is-invalid');
              input.focus();
              return;
            }
          }
          close();
          resolve(value);
        };
        ok.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });

        wrap.appendChild(cancel);
        wrap.appendChild(ok);
        return wrap;
      },
      onClose: () => resolve(null),
    });

    requestAnimationFrame(() => input?.focus());
  });
}

/* =========================================================================
   Drawer (پنل کناری)
   ========================================================================= */

export function openDrawer({ title, body, footer = null, size = 400 } = {}) {
  const root = modalRoot();
  const overlay = el('div', { class: 'drawer-overlay' });
  const drawer = el('aside', {
    class: 'drawer',
    role: 'dialog',
    'aria-modal': 'true',
    style: { width: `min(${size}px, 92vw)` },
  });

  const header = el('div', { class: 'modal__header' });
  const titleWrap = el('div', { class: 'modal__title-wrapper' });
  titleWrap.appendChild(el('div', { class: 'modal__title' }, [title || '']));
  header.appendChild(titleWrap);
  const closeBtn = el('button', { class: 'modal__close', type: 'button' }, ['✕']);
  closeBtn.addEventListener('click', () => close());
  header.appendChild(closeBtn);
  drawer.appendChild(header);

  const bodyEl = el('div', { class: 'modal__body', style: { flex: 1 } });
  if (body instanceof Node) bodyEl.appendChild(body);
  else if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (typeof body === 'function') body(bodyEl);
  drawer.appendChild(bodyEl);

  if (footer) {
    const fEl = el('div', { class: 'modal__footer' });
    const content = typeof footer === 'function' ? footer(() => close()) : footer;
    if (content instanceof Node) fEl.appendChild(content);
    else if (typeof content === 'string') fEl.innerHTML = content;
    drawer.appendChild(fEl);
  }

  overlay.appendChild(drawer);
  root.appendChild(overlay);
  lockScroll();

  const releaseTrap = trapFocus(drawer);
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onEsc);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onEsc);
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      releaseTrap();
      unlockScroll();
    }, 220);
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { close, el: drawer };
}