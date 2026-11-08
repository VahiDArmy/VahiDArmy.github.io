// Modal dialogs with focus trap and ESC dismissal.

import { el, clear } from '../utils/dom.js';

let activeModal = null;

export function openModal(options = {}) {
  closeModal();

  const scrim = el('div', { class: 'modal-scrim', role: 'dialog', 'aria-modal': 'true' });
  const modal = el('div', {
    class: ['modal', options.wide ? 'modal-wide' : null, options.narrow ? 'modal-narrow' : null].filter(Boolean).join(' '),
    'aria-label': options.title || 'Dialog',
  });

  const head = el('div', { class: 'modal-head' });
  head.appendChild(el('div', { class: 'modal-title', text: options.title || '' }));
  const closeBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': 'Close',
    html: '×',
    onClick: () => closeModal(),
  });
  head.appendChild(closeBtn);

  const body = el('div', { class: 'modal-body' });
  if (typeof options.body === 'string') {
    body.appendChild(el('p', { text: options.body }));
  } else if (options.body instanceof Node) {
    body.appendChild(options.body);
  } else if (Array.isArray(options.body)) {
    for (const child of options.body) {
      if (child instanceof Node) body.appendChild(child);
    }
  }

  modal.appendChild(head);
  modal.appendChild(body);

  const foot = el('div', { class: 'modal-foot' });
  const buttons = options.buttons || [];
  for (const btn of buttons) {
    const b = el('button', {
      class: ['btn', btn.variant ? 'btn-' + btn.variant : ''].filter(Boolean).join(' '),
      type: 'button',
      text: btn.label || 'OK',
      onClick: () => {
        const result = btn.onClick ? btn.onClick() : undefined;
        if (btn.keepOpen !== true) closeModal();
        return result;
      },
    });
    if (btn.icon) {
      b.insertBefore(el('span', { class: 'btn-icon', html: btn.icon }), b.firstChild);
    }
    if (btn.push) b.classList.add('push');
    foot.appendChild(b);
  }
  if (buttons.length) modal.appendChild(foot);

  scrim.appendChild(modal);
  document.getElementById('overlay-root').appendChild(scrim);
  activeModal = { scrim, modal, closeBtn, returnFocus: document.activeElement };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
    if (e.key === 'Tab') {
      trapFocus(e, modal);
    }
  };
  document.addEventListener('keydown', onKey, true);
  activeModal.onKey = onKey;

  scrim.addEventListener('mousedown', (e) => {
    if (e.target === scrim) closeModal();
  });

  setTimeout(() => {
    const focusable = modal.querySelector('input, textarea, select, button');
    if (focusable) focusable.focus();
  }, 30);

  return { modal, close: closeModal };
}

export function closeModal() {
  if (!activeModal) return;
  const { scrim, onKey, returnFocus } = activeModal;
  if (onKey) document.removeEventListener('keydown', onKey, true);
  if (scrim && scrim.parentNode) scrim.parentNode.removeChild(scrim);
  activeModal = null;
  if (returnFocus && typeof returnFocus.focus === 'function') {
    try { returnFocus.focus(); } catch (err) { /* ignore */ }
  }
}

export function isModalOpen() {
  return !!activeModal;
}

function trapFocus(e, container) {
  const focusables = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    openModal({
      title: options.title || 'Confirm',
      narrow: true,
      body: message,
      buttons: [
        {
          label: options.cancelLabel || 'Cancel',
          onClick: () => resolve(false),
        },
        {
          label: options.confirmLabel || 'Confirm',
          variant: options.variant || 'danger',
          onClick: () => resolve(true),
        },
      ],
    });
  });
}
