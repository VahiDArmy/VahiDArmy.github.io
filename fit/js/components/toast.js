/* ==========================================================================
   Component — Toast
   Usage:
     App.Toast.show({ type, title, message, duration, actions })
     App.Toast.success(title, message?)
     App.Toast.error(...)
     App.Toast.warning(...)
     App.Toast.info(...)
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const DOM = App.DOM;

  let container = null;

  const ICONS = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.getElementById('toast-container');
    if (!container) {
      container = DOM.el('div', {
        id: 'toast-container',
        class: 'toast-container',
        'aria-live': 'polite'
      });
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast.
   * @param {Object} opts
   *   type: 'success' | 'error' | 'warning' | 'info'
   *   title: string
   *   message: string
   *   duration: number (ms, 0 = no auto-dismiss)
   *   actions: [{ label, onClick }]
   */
  function show(opts) {
    opts = opts || {};
    const type = opts.type || 'info';
    const duration =
      typeof opts.duration === 'number'
        ? opts.duration
        : C.DEFAULTS.TOAST_DEFAULT_DURATION;

    const root = ensureContainer();

    const toast = DOM.el('div', {
      class: `toast toast--${type}`,
      role: type === 'error' ? 'alert' : 'status'
    });

    // Icon
    const iconWrap = DOM.el('div', { class: 'toast__icon' });
    iconWrap.innerHTML = ICONS[type] || ICONS.info;
    toast.appendChild(iconWrap);

    // Content
    const content = DOM.el('div', { class: 'toast__content' });
    if (opts.title) {
      content.appendChild(
        DOM.el('div', { class: 'toast__title', text: opts.title })
      );
    }
    if (opts.message) {
      content.appendChild(
        DOM.el('div', { class: 'toast__message', text: opts.message })
      );
    }
    if (Array.isArray(opts.actions) && opts.actions.length) {
      const actionsRow = DOM.el('div', { class: 'toast__actions' });
      opts.actions.forEach((action) => {
        const btn = DOM.el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          text: action.label
        });
        btn.addEventListener('click', () => {
          try {
            if (typeof action.onClick === 'function') action.onClick();
          } finally {
            dismiss(toast);
          }
        });
        actionsRow.appendChild(btn);
      });
      content.appendChild(actionsRow);
    }
    toast.appendChild(content);

    // Close button
    const closeBtn = DOM.el('button', {
      type: 'button',
      class: 'toast__close',
      'aria-label': 'بستن'
    });
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', () => dismiss(toast));
    toast.appendChild(closeBtn);

    // Progress bar
    let progressEl = null;
    if (duration > 0) {
      progressEl = DOM.el('div', { class: 'toast__progress' });
      progressEl.style.animationDuration = duration + 'ms';
      toast.appendChild(progressEl);
    }

    root.appendChild(toast);

    // Auto dismiss
    let timer = null;
    if (duration > 0) {
      timer = setTimeout(() => dismiss(toast), duration);
    }

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (progressEl) progressEl.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', () => {
      if (duration > 0 && !toast.dataset.dismissed) {
        timer = setTimeout(() => dismiss(toast), 1200);
        if (progressEl) progressEl.style.animationPlayState = 'running';
      }
    });

    function dismiss(node) {
      if (!node || node.dataset.dismissed) return;
      node.dataset.dismissed = '1';
      if (timer) clearTimeout(timer);
      node.classList.add('is-closing');
      setTimeout(() => {
        DOM.remove(node);
      }, 180);
    }

    return {
      dismiss: () => dismiss(toast),
      el: toast
    };
  }

  function success(title, message, duration) {
    return show({ type: 'success', title, message, duration });
  }
  function error(title, message, duration) {
    return show({ type: 'error', title, message, duration: duration || 6000 });
  }
  function warning(title, message, duration) {
    return show({ type: 'warning', title, message, duration });
  }
  function info(title, message, duration) {
    return show({ type: 'info', title, message, duration });
  }

  App.Toast = {
    show,
    success,
    error,
    warning,
    info
  };
})(window);