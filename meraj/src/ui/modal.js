/** Accessible modal stack with focus trapping, plus confirm and prompt dialogs. */
import { escapeHtml, uid } from '../utils.js';
import { icon } from './icons.js';

const stack = [];

function tabbables(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => node.offsetParent !== null || node === document.activeElement);
}

function lockScroll() {
  document.body.classList.add('has-modal');
}
function unlockScroll() {
  if (!stack.length) document.body.classList.remove('has-modal');
}

/**
 * @param {object} options
 * @returns {{id:string, root:HTMLElement, dialog:HTMLElement, close:Function, setBusy:Function}}
 */
export function openModal({
  title = '',
  subtitle = '',
  body = '',
  actions = [],
  size = 'md',
  className = '',
  dismissible = true,
  showClose = true,
  onClose = null,
  onMount = null,
  initialFocus = null,
  footerNote = '',
}) {
  const id = `modal-${uid()}`;
  const root = document.createElement('div');
  root.className = 'modal-layer';
  root.dataset.modalId = id;
  const titleId = `${id}-title`;
  const descriptionId = subtitle ? `${id}-desc` : '';

  root.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop="true"></div>
    <section class="modal modal--${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" ${descriptionId ? `aria-describedby="${descriptionId}"` : ''}>
      <header class="modal__head">
        <div class="modal__heading">
          <h2 class="modal__title" id="${titleId}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal__subtitle" id="${descriptionId}">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${showClose && dismissible ? `<button type="button" class="icon-btn modal__close" data-modal-close aria-label="Close dialog">${icon('close', { size: 18 })}</button>` : ''}
      </header>
      <div class="modal__body"></div>
      ${actions.length || footerNote ? `<footer class="modal__foot">${footerNote ? `<p class="modal__note">${footerNote}</p>` : '<span></span>'}<div class="modal__actions"></div></footer>` : ''}
    </section>
  `;

  const bodyEl = root.querySelector('.modal__body');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = body;

  const actionEl = root.querySelector('.modal__actions');
  if (actionEl) {
    for (const [index, action] of actions.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn--${action.variant || 'ghost'} ${action.className || ''}`;
      button.dataset.actionIndex = String(index);
      button.innerHTML = `${action.icon ? icon(action.icon, { size: 16 }) : ''}<span>${escapeHtml(action.label)}</span>`;
      if (action.disabled) button.disabled = true;
      button.addEventListener('click', async (event) => {
        if (typeof action.onClick !== 'function') {
          close();
          return;
        }
        const original = button.innerHTML;
        try {
          if (action.busyLabel) {
            button.disabled = true;
            button.innerHTML = `${icon('loader', { size: 16, className: 'spin' })}<span>${escapeHtml(action.busyLabel)}</span>`;
          }
          const result = await action.onClick({ root, body: bodyEl, close, event });
          if (result !== false && action.close !== false) close();
        } catch (error) {
          console.error('[معراج] modal action failed', error);
          if (action.onError) action.onError(error);
        } finally {
          if (document.body.contains(button) && action.busyLabel) {
            button.disabled = Boolean(action.disabled);
            button.innerHTML = original;
          }
        }
      });
      actionEl.appendChild(button);
    }
  }

  const previousFocus = document.activeElement;
  const record = { id, root, dialog: root.querySelector('.modal'), close, onClose, previousFocus };

  function close() {
    if (!stack.includes(record)) return;
    const index = stack.indexOf(record);
    stack.splice(index, 1);
    root.classList.remove('is-open');
    unlockScroll();
    window.setTimeout(() => {
      root.remove();
      if (typeof onClose === 'function') onClose();
      if (previousFocus && document.body.contains(previousFocus)) {
        try {
          previousFocus.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    }, 180);
  }

  function setBusy(isBusy) {
    root.querySelectorAll('.modal__actions button, .modal__close').forEach((button) => {
      button.disabled = Boolean(isBusy);
    });
  }

  root.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', close));
  root.querySelector('[data-modal-backdrop="true"]')?.addEventListener('click', () => {
    if (dismissible) close();
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dismissible && stack[stack.length - 1] === record) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = tabbables(root);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.body.appendChild(root);
  stack.push(record);
  lockScroll();

  requestAnimationFrame(() => {
    root.classList.add('is-open');
    const target =
      (typeof initialFocus === 'string' ? root.querySelector(initialFocus) : null) ||
      tabbables(root)[0] ||
      root.querySelector('.modal');
    target?.focus?.({ preventScroll: true });
    if (typeof onMount === 'function') onMount({ root, body: bodyEl, close, setBusy });
  });

  return { ...record, body: bodyEl, setBusy };
}

export function closeAllModals() {
  while (stack.length) stack[stack.length - 1].close();
}

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  details = '',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const modal = openModal({
      title,
      size: 'sm',
      body: `<p class="dialog-text">${escapeHtml(message)}</p>${details ? `<pre class="verbatim verbatim--small">${escapeHtml(details)}</pre>` : ''}`,
      actions: [
        {
          label: cancelLabel,
          variant: 'ghost',
          onClick: () => {
            settled = true;
            resolve(false);
          },
        },
        {
          label: confirmLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: () => {
            settled = true;
            resolve(true);
          },
        },
      ],
      onClose: () => {
        if (!settled) resolve(false);
      },
    });
    modal.body.querySelector('button, input, textarea')?.focus();
  });
}

/**
 * A small form dialog. Returns the entered string, or null if cancelled.
 */
export function promptDialog({
  title = 'Enter a value',
  label = '',
  value = '',
  placeholder = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  multiline = false,
  help = '',
  maxLength = 4000,
  validate = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const fieldId = `field-${uid()}`;
    const field = multiline
      ? `<textarea id="${fieldId}" class="input textarea" rows="6" maxlength="${maxLength}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
      : `<input id="${fieldId}" class="input" type="text" maxlength="${maxLength}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />`;
    const modal = openModal({
      title,
      size: 'sm',
      body: `
        <form class="form" data-prompt-form>
          ${label ? `<label class="field-label" for="${fieldId}">${escapeHtml(label)}</label>` : ''}
          ${field}
          ${help ? `<p class="field-help">${escapeHtml(help)}</p>` : ''}
          <p class="field-error" data-field-error hidden></p>
        </form>`,
      actions: [
        {
          label: cancelLabel,
          variant: 'ghost',
          onClick: () => {
            settled = true;
            resolve(null);
          },
        },
        {
          label: confirmLabel,
          variant: 'primary',
          close: false,
          onClick: () => {
            const input = modal.body.querySelector(`#${CSS.escape(fieldId)}`);
            const text = input?.value?.trim() || '';
            const error = validate ? validate(text) : null;
            if (error) {
              const errorEl = modal.body.querySelector('[data-field-error]');
              if (errorEl) {
                errorEl.textContent = error;
                errorEl.hidden = false;
              }
              input?.focus();
              return false;
            }
            settled = true;
            resolve(text);
            modal.close();
            return false;
          },
        },
      ],
      onMount: () => {
        const input = modal.body.querySelector(`#${CSS.escape(fieldId)}`);
        input?.focus();
        if (input?.setSelectionRange && input.value) input.setSelectionRange(input.value.length, input.value.length);
      },
      onClose: () => {
        if (!settled) resolve(null);
      },
    });

    modal.body.querySelector('[data-prompt-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      modal.root.querySelector('[data-action-index="1"]')?.click();
    });
  });
}
