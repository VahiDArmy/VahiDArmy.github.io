/* ============================================================
   js/ui/confirm.js
   Promise-based confirm/prompt/alert dialogs
   ============================================================ */

import { confirmModal, openModal, MODAL_SIZES } from './modal.js';
import { el } from '../utils/dom.js';

/**
 * Yes/No confirmation.
 * @param {string|{title?:string,message:string,confirmLabel?:string,cancelLabel?:string,variant?:string,icon?:string,requireTyping?:string}} arg
 * @returns {Promise<boolean>}
 */
export function confirm(arg) {
  const opts = typeof arg === 'string' ? { message: arg } : arg;
  return confirmModal(opts);
}

/**
 * Destructive confirmation with typing requirement.
 * @param {{title?:string, message:string, confirmLabel?:string, phrase?:string, icon?:string}} opts
 * @returns {Promise<boolean>}
 */
export function confirmDanger(opts) {
  const { phrase = 'حذف', ...rest } = opts;
  return confirmModal({
    variant: 'danger',
    icon: '⚠️',
    confirmLabel: 'حذف قطعی',
    requireTyping: phrase,
    ...rest,
  });
}

/**
 * Alert dialog (single OK button).
 * @param {string|{title?:string,message:string,okLabel?:string,icon?:string}} arg
 * @returns {Promise<void>}
 */
export function alert(arg) {
  const opts = typeof arg === 'string' ? { message: arg } : arg;
  const { title = 'توجه', message, okLabel = 'متوجه شدم', icon = 'ℹ️' } = opts;
  return new Promise((resolve) => {
    const okBtn = el('button', { class: 'btn btn--primary' }, { children: [okLabel] });
    const footer = el('div', { class: 'confirm-foot' }, { children: [okBtn] });
    const body = el('div', { class: 'confirm-body' });
    body.appendChild(el('p', { class: 'confirm-body__message' }, { children: [message] }));

    const handle = openModal({
      title, icon, size: MODAL_SIZES.SM, content: body, footer,
      onClose: () => resolve(),
    });
    okBtn.addEventListener('click', () => handle.close('ok'));
    requestAnimationFrame(() => okBtn.focus());
  });
}

/**
 * Text prompt dialog.
 * @param {{title?:string, message?:string, defaultValue?:string, placeholder?:string, okLabel?:string, cancelLabel?:string, multiline?:boolean, maxLength?:number, validate?:(v:string)=>(string|null)}} opts
 * @returns {Promise<string|null>}
 */
export function prompt(opts = {}) {
  const {
    title = 'ورود مقدار',
    message = '',
    defaultValue = '',
    placeholder = '',
    okLabel = 'تأیید',
    cancelLabel = 'لغو',
    multiline = false,
    maxLength = 200,
    validate,
  } = opts;

  return new Promise((resolve) => {
    const body = el('div', { class: 'prompt-body' });
    if (message) body.appendChild(el('p', { class: 'prompt-body__message' }, { children: [message] }));

    const field = multiline
      ? el('textarea', { class: 'input textarea', attrs: { rows: 4, placeholder, maxlength: maxLength } })
      : el('input', { class: 'input', attrs: { type: 'text', placeholder, maxlength: maxLength } });
    field.value = defaultValue;
    body.appendChild(field);
    const errorEl = el('p', { class: 'field__error' });
    body.appendChild(errorEl);

    const okBtn = el('button', { class: 'btn btn--primary' }, { children: [okLabel] });
    const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: [cancelLabel] });
    const footer = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, okBtn] });

    let resolved = false;
    const handle = openModal({
      title, size: MODAL_SIZES.SM, content: body, footer,
      onClose: () => { if (!resolved) { resolved = true; resolve(null); } },
    });

    function tryOk() {
      const v = field.value.trim();
      if (validate) {
        const msg = validate(v);
        if (msg) {
          errorEl.textContent = msg;
          errorEl.classList.add('is-visible');
          field.classList.add('anim-shake');
          setTimeout(() => field.classList.remove('anim-shake'), 450);
          return;
        }
      }
      resolved = true;
      handle.close('ok');
      resolve(v);
    }

    okBtn.addEventListener('click', tryOk);
    cancelBtn.addEventListener('click', () => handle.close('cancel'));
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); tryOk(); }
    });
    requestAnimationFrame(() => { field.focus(); field.select?.(); });
  });
}

export default { confirm, confirmDanger, alert, prompt };