import { el, clear } from './dom.js';

function getRoot() {
  return document.getElementById('modal-root');
}

export function closeModal() {
  const root = getRoot();
  if (root) clear(root);
}

export function openModal({ title, body, actions = [], dismissible = true }) {
  const root = getRoot();
  clear(root);

  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (e) => {
      if (dismissible && e.target === backdrop) closeModal();
    },
  });

  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h3', {}, title));

  const bodyWrap = el('div', { class: 'modal-body' });
  if (body instanceof Node) bodyWrap.appendChild(body);
  else if (typeof body === 'string') bodyWrap.innerHTML = body;
  modal.appendChild(bodyWrap);

  if (actions.length) {
    const row = el('div', { class: 'modal-actions' });
    for (const a of actions) {
      const btn = el('button', {
        class: `btn ${a.variant === 'primary' ? 'btn-primary' : a.variant === 'danger' ? 'btn-danger' : ''}`,
        onclick: async () => {
          try {
            const shouldClose = await a.onClick?.();
            if (shouldClose !== false) closeModal();
          } catch (err) {
            console.error(err);
          }
        },
      }, a.label);
      row.appendChild(btn);
    }
    modal.appendChild(row);
  }

  backdrop.appendChild(modal);
  root.appendChild(backdrop);
  return { backdrop, modal, close: closeModal };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: el('p', { class: 'dim' }, message),
      actions: [
        { label: cancelLabel, onClick: () => { resolve(false); } },
        {
          label: confirmLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: () => { resolve(true); },
        },
      ],
    });
  });
}

export function promptDialog({ title, label, defaultValue = '', placeholder = '', multiline = false }) {
  return new Promise((resolve) => {
    const input = multiline
      ? el('textarea', { class: 'textarea', placeholder, rows: 5 })
      : el('input', { class: 'input', type: 'text', placeholder });
    input.value = defaultValue;

    openModal({
      title,
      body: el('div', { class: 'form-group' }, el('label', { class: 'label' }, label), input),
      actions: [
        { label: 'Cancel', onClick: () => resolve(null) },
        { label: 'OK', variant: 'primary', onClick: () => resolve(input.value.trim() || null) },
      ],
    });
    setTimeout(() => input.focus(), 60);
  });
}
