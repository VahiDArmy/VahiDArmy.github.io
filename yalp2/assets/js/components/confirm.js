/* ============================================================
   Confirm dialog (returns Promise<boolean>)
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';

export function confirmDialog({
  title = 'تأیید',
  message = '',
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const modal = el('div', { class: 'modal modal--sm confirm-dialog' });

    const inner = el('div', { class: 'confirm-dialog__inner' }, [
      el('div', {
        class: `confirm-dialog__icon ${danger ? 'is-danger' : ''}`,
        html: icon(danger ? 'alert' : 'help', 26),
      }),
      el('div', { class: 'confirm-dialog__title', text: title }),
      message ? el('div', { class: 'confirm-dialog__msg', text: message }) : null,
    ].filter(Boolean));

    const body = el('div', { class: 'modal__body' }, [inner]);

    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--lg',
      text: cancelLabel,
      onclick: () => close(false),
    });
    const okBtn = el('button', {
      type: 'button',
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'} btn--lg`,
      text: confirmLabel,
      onclick: () => close(true),
    });
    const footer = el('div', {
      class: 'modal__footer',
      style: { justifyContent: 'center', borderTop: 0, background: 'transparent' },
    }, [cancelBtn, okBtn]);

    modal.append(body, footer);
    backdrop.appendChild(modal);

    const portal = document.getElementById('portal-root') || document.body;
    portal.appendChild(backdrop);
    document.body.classList.add('has-modal');

    let resolved = false;
    function close(result) {
      if (resolved) return;
      resolved = true;
      backdrop.classList.add('is-closing');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        backdrop.remove();
        if (!document.querySelector('.modal-backdrop')) {
          document.body.classList.remove('has-modal');
        }
        resolve(result);
      }, 160);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close(false);
    });
    setTimeout(() => okBtn.focus(), 80);
  });
}
