/* =========================================================
   سیستم مودال
   ========================================================= */
window.Modal = (function () {
  const root = () => document.getElementById('modal-root');
  const stack = [];
  let current = null;

  function open(opts) {
    const {
      title = '',
      icon = '',
      body = null,            // HTMLElement | string
      footer = null,          // HTMLElement | string | null
      size = 'md',            // sm | md | lg | xl
      closable = true,
      onClose = null,
      className = ''
    } = opts;

    const modal = Utils.el('div', {
      class: `modal modal-${size} ${className}`.trim(),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title
    });

    const header = Utils.el('div', { class: 'modal-header' }, [
      Utils.el('div', { class: 'modal-title' }, [
        icon ? Utils.el('span', { class: 'modal-icon' }, [icon]) : null,
        Utils.el('span', {}, [title])
      ].filter(Boolean)),
      closable ? Utils.el('button', {
        class: 'modal-close',
        'aria-label': 'بستن',
        onclick: () => close()
      }, ['✕']) : null
    ].filter(Boolean));

    const bodyEl = Utils.el('div', { class: 'modal-body' });
    if (body instanceof HTMLElement) bodyEl.appendChild(body);
    else if (typeof body === 'string') bodyEl.innerHTML = body;

    modal.appendChild(header);
    modal.appendChild(bodyEl);

    if (footer) {
      const footEl = Utils.el('div', { class: 'modal-footer' });
      if (footer instanceof HTMLElement) footEl.appendChild(footer);
      else if (typeof footer === 'string') footEl.innerHTML = footer;
      modal.appendChild(footEl);
    }

    const backdrop = Utils.el('div', {
      class: 'modal-backdrop',
      onclick: () => { if (closable) close(); }
    });

    const wrapper = Utils.el('div', { class: 'modal-wrapper' });
    wrapper.appendChild(backdrop);
    wrapper.appendChild(modal);

    root().appendChild(wrapper);
    root().classList.add('is-open');
    root().setAttribute('aria-hidden', 'false');

    stack.push({ wrapper, modal, onClose, previousFocus: document.activeElement });

    // focus trap
    setTimeout(() => {
      const focusable = modal.querySelector('input:not([type="hidden"]), textarea, select, button:not([disabled])');
      if (focusable) focusable.focus();
    }, 40);

    current = modal;

    document.addEventListener('keydown', onKeyDown);
    return { modal, bodyEl, close };
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && stack.length) {
      const top = stack[stack.length - 1];
      const closeBtn = top.modal.querySelector('.modal-close');
      if (closeBtn) close();
    }
    if (e.key === 'Tab' && stack.length) {
      trapFocus(e, stack[stack.length - 1].modal);
    }
  }

  function trapFocus(e, modal) {
    const focusables = modal.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function close() {
    if (!stack.length) return;
    const item = stack.pop();
    const { wrapper, modal, onClose, previousFocus } = item;

    modal.classList.add('is-closing');
    wrapper.style.transition = 'opacity 220ms';
    wrapper.style.opacity = '0';

    setTimeout(() => {
      wrapper.remove();
      if (!stack.length) {
        root().classList.remove('is-open');
        root().setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKeyDown);
      }
      if (typeof onClose === 'function') onClose();
      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus(); } catch {}
      }
    }, 200);

    current = stack.length ? stack[stack.length - 1].modal : null;
  }

  function closeAll() {
    while (stack.length) close();
  }

  /* ---- مودال تایید ---- */
  function confirm(opts = {}) {
    const {
      title = 'آیا مطمئن هستید؟',
      message = '',
      confirmText = 'تایید',
      cancelText = 'انصراف',
      danger = false,
      icon = '⚠️',
      onConfirm = null,
      onCancel = null
    } = opts;

    const body = Utils.el('div', { class: 'confirm-text' }, [
      Utils.el('div', { class: 'confirm-icon' }, [icon]),
      Utils.el('h3', {}, [title]),
      message ? Utils.el('p', {}, [message]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'flex gap-3' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: () => { close(); onCancel && onCancel(); }
      }, [cancelText]),
      Utils.el('button', {
        class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
        onclick: () => { close(); onConfirm && onConfirm(); }
      }, [confirmText])
    ]);

    return open({ title: 'تایید', body, footer, size: 'sm', icon: '🔔' });
  }

  /* ---- مودال هشدار ساده ---- */
  function alert(opts = {}) {
    const { title = 'توجه', message = '', okText = 'فهمیدم' } = opts;
    const body = Utils.el('div', { class: 'confirm-text' }, [
      Utils.el('h3', {}, [title]),
      message ? Utils.el('p', {}, [message]) : null
    ].filter(Boolean));
    const footer = Utils.el('div', {}, [
      Utils.el('button', { class: 'btn btn-primary', onclick: () => close() }, [okText])
    ]);
    return open({ title: '', body, footer, size: 'sm', icon: '' });
  }

  return { open, close, closeAll, confirm, alert };
})();