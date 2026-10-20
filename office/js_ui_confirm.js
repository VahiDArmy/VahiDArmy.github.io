/**
 * Promise-based confirmation dialog built on modal.
 *
 *   const ok = await confirm({
 *     title: 'حذف آیتم',
 *     message: 'این عملیات قابل بازگشت نیست.',
 *     confirmLabel: 'حذف',
 *     variant: 'danger', // danger | primary
 *   });
 */

import { el } from '../utils/dom.js';
import { open as openModal } from './modal.js';

export function confirm({
  title = 'تأیید',
  message = 'آیا مطمئن هستید؟',
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  variant = 'primary',
  size = 'sm',
  dismissible = true,
  requireTyping = null, // e.g. "DELETE" — user must type it to enable confirm
} = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const messageNode = el('div', { style: { color: 'var(--text-secondary)', lineHeight: '1.7' } }, [message]);

    let typingInput = null;
    let confirmBtn;

    if (requireTyping) {
      typingInput = el('input', {
        type: 'text',
        class: 'input',
        placeholder: requireTyping,
        style: { marginBlockStart: '12px', fontFamily: 'var(--font-mono)' },
        'aria-label': `برای تأیید «${requireTyping}» را تایپ کنید`,
      });
      confirmBtn = el('button', {
        type: 'button',
        class: `btn btn--${variant}`,
        disabled: true,
        on: { click: handleConfirm },
      }, [confirmLabel]);

      typingInput.addEventListener('input', () => {
        confirmBtn.disabled = typingInput.value.trim() !== requireTyping;
      });

      messageNode.appendChild(typingInput);
    } else {
      confirmBtn = el('button', {
        type: 'button',
        class: `btn btn--${variant}`,
        on: { click: handleConfirm },
      }, [confirmLabel]);
    }

    const cancelBtn = el('button', {
      type: 'button',
      class: 'btn btn--secondary',
      on: { click: () => { handle.close(); done(false); } },
    }, [cancelLabel]);

    function handleConfirm() {
      handle.close();
      done(true);
    }

    const handle = openModal({
      title,
      body: messageNode,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, confirmBtn]),
      size,
      dismissible,
      className: `modal--confirm`,
      initialFocus: typingInput || confirmBtn,
      onClose: () => done(false),
    });
  });
}

export default confirm;