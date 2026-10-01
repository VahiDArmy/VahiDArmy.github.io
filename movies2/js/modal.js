/* =========================================================
   سیستم مودال — با قفل اسکرول پس‌زمینه
   ========================================================= */
window.Modal = (function () {
  const root = function () { return document.getElementById('modal-root'); };
  const stack = [];
  let current = null;
  let scrollLocked = false;

  /* =========================================================
     قفل/بازکردن اسکرول پس‌زمینه
     ========================================================= */
  function lockScroll() {
    if (scrollLocked) return;

    /* محاسبه‌ی عرض اسکرول‌بار */
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollbarWidth > 0) {
      /* در RTL، اسکرول‌بار سمت چپ است. paddingInlineEnd = padding-left */
      document.body.style.paddingInlineEnd = scrollbarWidth + 'px';
    }

    document.body.classList.add('modal-open');
    scrollLocked = true;
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    document.body.style.paddingInlineEnd = '';
    document.body.classList.remove('modal-open');
    scrollLocked = false;
  }

  /* =========================================================
     باز کردن مودال
     ========================================================= */
  function open(opts) {
    const title = opts.title || '';
    const icon = opts.icon || '';
    const body = opts.body || null;
    const footer = opts.footer || null;
    const size = opts.size || 'md';
    const closable = opts.closable !== false;
    const onClose = opts.onClose || null;
    const className = opts.className || '';

    const modal = Utils.el('div', {
      class: ('modal modal-' + size + ' ' + className).trim(),
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
        onclick: function () { close(); }
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
      onclick: function () { if (closable) close(); }
    });

    const wrapper = Utils.el('div', { class: 'modal-wrapper' });
    wrapper.appendChild(backdrop);
    wrapper.appendChild(modal);

    root().appendChild(wrapper);
    root().classList.add('is-open');
    root().setAttribute('aria-hidden', 'false');

    stack.push({
      wrapper: wrapper,
      modal: modal,
      onClose: onClose,
      previousFocus: document.activeElement
    });

    /* ---- قفل اسکرول پس‌زمینه ---- */
    lockScroll();

    /* ---- فوکوس اولیه ---- */
    setTimeout(function () {
      const focusable = modal.querySelector(
        'input:not([type="hidden"]), textarea, select, button:not([disabled])'
      );
      if (focusable) focusable.focus();
    }, 40);

    current = modal;

    document.addEventListener('keydown', onKeyDown);
    return { modal: modal, bodyEl: bodyEl, close: close };
  }

  /* =========================================================
     بستن مودال
     ========================================================= */
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
      'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])'
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

  function close() {
    if (!stack.length) return;
    const item = stack.pop();
    const wrapper = item.wrapper;
    const modal = item.modal;
    const onClose = item.onClose;
    const previousFocus = item.previousFocus;

    modal.classList.add('is-closing');
    wrapper.style.transition = 'opacity 220ms';
    wrapper.style.opacity = '0';

    setTimeout(function () {
      wrapper.remove();

      if (!stack.length) {
        root().classList.remove('is-open');
        root().setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKeyDown);

        /* ---- بازکردن اسکرول پس‌زمینه ---- */
        unlockScroll();
      }

      if (typeof onClose === 'function') onClose();

      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus(); } catch (e) {}
      }
    }, 200);

    current = stack.length ? stack[stack.length - 1].modal : null;
  }

  function closeAll() {
    while (stack.length) close();
  }

  /* =========================================================
     مودال تایید
     ========================================================= */
  function confirm(opts) {
    opts = opts || {};
    const title = opts.title || 'آیا مطمئن هستید؟';
    const message = opts.message || '';
    const confirmText = opts.confirmText || 'تایید';
    const cancelText = opts.cancelText || 'انصراف';
    const danger = !!opts.danger;
    const icon = opts.icon || '⚠️';
    const onConfirm = opts.onConfirm || null;
    const onCancel = opts.onCancel || null;

    const body = Utils.el('div', { class: 'confirm-text' }, [
      Utils.el('div', { class: 'confirm-icon' }, [icon]),
      Utils.el('h3', {}, [title]),
      message ? Utils.el('p', {}, [message]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'flex gap-3' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () {
          close();
          if (onCancel) onCancel();
        }
      }, [cancelText]),
      Utils.el('button', {
        class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'),
        onclick: function () {
          close();
          if (onConfirm) onConfirm();
        }
      }, [confirmText])
    ]);

    return open({
      title: 'تایید',
      body: body,
      footer: footer,
      size: 'sm',
      icon: '🔔'
    });
  }

  /* =========================================================
     مودال هشدار
     ========================================================= */
  function alert(opts) {
    opts = opts || {};
    const title = opts.title || 'توجه';
    const message = opts.message || '';
    const okText = opts.okText || 'فهمیدم';

    const body = Utils.el('div', { class: 'confirm-text' }, [
      Utils.el('h3', {}, [title]),
      message ? Utils.el('p', {}, [message]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', {}, [
      Utils.el('button', {
        class: 'btn btn-primary',
        onclick: function () { close(); }
      }, [okText])
    ]);

    return open({ title: '', body: body, footer: footer, size: 'sm', icon: '' });
  }

  return {
    open: open,
    close: close,
    closeAll: closeAll,
    confirm: confirm,
    alert: alert
  };
})();