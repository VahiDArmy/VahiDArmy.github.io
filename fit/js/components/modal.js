/* ==========================================================================
   Component — Modal
   Usage:
     App.Modal.alert({ title, message })
     App.Modal.confirm({ title, message, confirmLabel, cancelLabel, danger })
       → Promise<boolean>
     App.Modal.prompt({ title, message, value, placeholder, validate })
       → Promise<string|null>
     App.Modal.custom({ title, subtitle, icon, size, body, footer, onOpen })
       → { close, setBody, el }
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const DOM = App.DOM;

  let root = null;
  const openModals = [];

  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const ICON_TYPES = {
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    danger:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    question:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.getElementById('modal-root');
    if (!root) {
      root = DOM.el('div', { id: 'modal-root', class: 'modal-root' });
      document.body.appendChild(root);
    }
    return root;
  }

  function buildModal(cfg) {
    const overlay = DOM.el('div', { class: 'modal-overlay', role: 'presentation' });
    const modal = DOM.el('div', {
      class: `modal modal--${cfg.size || 'md'}${cfg.danger ? ' modal--confirm' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': cfg.title || 'پنجره'
    });

    // Header
    if (cfg.title) {
      const header = DOM.el('div', { class: 'modal__header' });
      const iconType = cfg.icon || (cfg.danger ? 'danger' : 'info');
      if (ICON_TYPES[iconType]) {
        const iconWrap = DOM.el('div', {
          class: `modal__header-icon is-${iconType}`
        });
        iconWrap.innerHTML = ICON_TYPES[iconType];
        header.appendChild(iconWrap);
      }
      const headerText = DOM.el('div', { class: 'modal__header-text' });
      headerText.appendChild(
        DOM.el('div', { class: 'modal__title', text: cfg.title })
      );
      if (cfg.subtitle) {
        headerText.appendChild(
          DOM.el('div', { class: 'modal__subtitle', text: cfg.subtitle })
        );
      }
      header.appendChild(headerText);

      if (cfg.dismissible !== false) {
        const close = DOM.el('button', {
          type: 'button',
          class: 'modal__close',
          'aria-label': 'بستن'
        });
        close.innerHTML = CLOSE_ICON;
        close.addEventListener('click', () => controller.close());
        header.appendChild(close);
      }
      modal.appendChild(header);
    }

    // Body
    const body = DOM.el('div', { class: 'modal__body' });
    if (cfg.body instanceof Node) body.appendChild(cfg.body);
    else if (typeof cfg.body === 'string') body.innerHTML = cfg.body;
    modal.appendChild(body);

    // Footer
    if (Array.isArray(cfg.footer) && cfg.footer.length) {
      const footer = DOM.el('div', { class: 'modal__footer' });
      cfg.footer.forEach((btnCfg) => {
        const btn = DOM.el('button', {
          type: 'button',
          class: `btn btn--${btnCfg.variant || 'secondary'}`
        });
        btn.textContent = btnCfg.label;
        btn.addEventListener('click', () => {
          if (typeof btnCfg.onClick === 'function') {
            const ret = btnCfg.onClick();
            if (ret === false) return; // cancel close
          }
          if (btnCfg.close !== false) controller.close();
        });
        footer.appendChild(btn);
      });
      modal.appendChild(footer);
    }

    overlay.appendChild(modal);

    const controller = {
      el: modal,
      overlay,
      body,
      closed: false,
      close() {
        if (this.closed) return;
        this.closed = true;
        overlay.classList.add('is-closing');
        setTimeout(() => {
          DOM.remove(overlay);
          const idx = openModals.indexOf(controller);
          if (idx >= 0) openModals.splice(idx, 1);
          if (typeof cfg.onClose === 'function') cfg.onClose();
        }, 160);
      },
      setBody(node) {
        DOM.empty(body);
        if (node instanceof Node) body.appendChild(node);
        else if (typeof node === 'string') body.innerHTML = node;
      }
    };

    // Overlay click
    if (cfg.dismissible !== false) {
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) controller.close();
      });
    }

    return controller;
  }

  function open(cfg) {
    cfg = cfg || {};
    const r = ensureRoot();
    const controller = buildModal(cfg);
    r.appendChild(controller.overlay);
    openModals.push(controller);

    // Focus first
    setTimeout(() => DOM.focusFirst(controller.el), 30);

    if (typeof cfg.onOpen === 'function') cfg.onOpen(controller);
    return controller;
  }

  /* ---------- Convenience methods ---------- */

  function alert(opts) {
    const cfg = typeof opts === 'string' ? { message: opts } : opts || {};
    return new Promise((resolve) => {
      open({
        title: cfg.title || 'اطلاع',
        subtitle: cfg.subtitle,
        icon: cfg.icon || 'info',
        size: cfg.size || 'sm',
        body: cfg.message ? DOM.el('p', { text: cfg.message }) : cfg.body,
        footer: [
          {
            label: cfg.confirmLabel || 'باشه',
            variant: 'primary',
            onClick: () => resolve(true)
          }
        ],
        onClose: () => resolve(false)
      });
    });
  }

  function confirm(opts) {
    const cfg = typeof opts === 'string' ? { message: opts } : opts || {};
    return new Promise((resolve) => {
      let result = false;
      open({
        title: cfg.title || 'تأیید',
        subtitle: cfg.subtitle,
        icon: cfg.danger ? 'danger' : 'question',
        danger: !!cfg.danger,
        size: cfg.size || 'sm',
        body: cfg.message ? DOM.el('p', { text: cfg.message }) : cfg.body,
        footer: [
          {
            label: cfg.confirmLabel || 'تأیید',
            variant: cfg.danger ? 'danger' : 'primary',
            onClick: () => {
              result = true;
            }
          },
          {
            label: cfg.cancelLabel || 'انصراف',
            variant: 'ghost',
            onClick: () => {
              result = false;
            }
          }
        ],
        onClose: () => resolve(result)
      });
    });
  }

  function prompt(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let resolved = false;
      const input = DOM.el('input', {
        type: 'text',
        class: 'input',
        placeholder: opts.placeholder || ''
      });
      input.value = opts.value || '';

      const errorMsg = DOM.el('div', { class: 'field__error', style: { display: 'none' } });
      const field = DOM.el('div', { class: 'field' }, [
        opts.message ? DOM.el('label', { class: 'field__label', text: opts.message }) : null,
        input,
        errorMsg
      ]);

      const submit = () => {
        const value = input.value;
        if (typeof opts.validate === 'function') {
          const v = opts.validate(value);
          if (v !== true) {
            errorMsg.textContent = v || 'مقدار نامعتبر است';
            errorMsg.style.display = 'flex';
            input.focus();
            return false;
          }
        }
        resolved = true;
        resolve(value);
        return true;
      };

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          submit();
        }
      });

      const controller = open({
        title: opts.title || 'ورود مقدار',
        subtitle: opts.subtitle,
        icon: 'question',
        size: opts.size || 'sm',
        body: field,
        footer: [
          {
            label: opts.confirmLabel || 'تأیید',
            variant: 'primary',
            onClick: submit
          },
          {
            label: opts.cancelLabel || 'انصراف',
            variant: 'ghost'
          }
        ],
        onClose: () => {
          if (!resolved) resolve(null);
        }
      });
      return controller;
    });
  }

  function custom(cfg) {
    return open(cfg || {});
  }

  /* ---------- Escape handler ---------- */

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (openModals.length === 0) return;
    const top = openModals[openModals.length - 1];
    top.close();
    ev.stopPropagation();
  });

  App.Modal = {
    open,
    custom,
    alert,
    confirm,
    prompt
  };
})(window);