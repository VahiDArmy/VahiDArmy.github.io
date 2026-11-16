/* ============================================================
   Base modal — backdrop, header, body, footer, close, ESC
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';

export function mountModal(opts) {
  const {
    title = '',
    subtitle = '',
    size = 'md',
    body,
    footer,
    onClose,
    closeOnBackdrop = true,
    showHeader = true,
  } = opts;

  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', {
    class: `modal modal--${size}`,
    role: 'dialog',
    'aria-modal': 'true',
  });

  const closeBtn = el('button', {
    type: 'button',
    class: 'modal__close',
    'aria-label': 'بستن',
    html: icon('close', 18),
  });

  if (showHeader) {
    const header = el('div', { class: 'modal__header' }, [
      el('div', { style: { flex: '1', minWidth: '0' } }, [
        title ? el('div', { class: 'modal__title', text: title }) : null,
        subtitle ? el('div', { class: 'modal__subtitle', text: subtitle }) : null,
      ].filter(Boolean)),
      closeBtn,
    ]);
    modal.appendChild(header);
  }

  const bodyEl = el('div', { class: 'modal__body' });
  appendContent(bodyEl, body);

  const footerEl = footer ? el('div', { class: 'modal__footer' }) : null;
  if (footerEl) appendContent(footerEl, footer);

  modal.appendChild(bodyEl);
  if (footerEl) modal.appendChild(footerEl);
  backdrop.appendChild(modal);

  const portal = document.getElementById('portal-root') || document.body;
  portal.appendChild(backdrop);
  document.body.classList.add('has-modal');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.classList.add('is-closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      backdrop.remove();
      if (!document.querySelector('.modal-backdrop')) {
        document.body.classList.remove('has-modal');
      }
      onClose?.();
    }, 160);
  }

  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
  }

  return { modal, body: bodyEl, footer: footerEl, close, backdrop, closeBtn };
}

function appendContent(host, content) {
  if (content == null) return;
  if (typeof content === 'string') { host.innerHTML = content; return; }
  if (Array.isArray(content)) {
    for (const c of content) {
      if (!c) continue;
      if (typeof c === 'string') host.appendChild(document.createTextNode(c));
      else if (c.nodeType) host.appendChild(c);
    }
    return;
  }
  if (content.nodeType) host.appendChild(content);
}
