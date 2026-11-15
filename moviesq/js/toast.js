/* =========================================================
   سیستم نوتیفیکیشن (Toast) — بالا، لمس/کلیک برای بستن
   ========================================================= */
window.Toast = (function () {
  const root = () => document.getElementById('toast-root');
  const queue = [];
  const ICONS = {
    success: '✅',
    error: '⛔',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳'
  };

  function show(message, type = 'info', options = {}) {
    const duration = options.duration ?? (CONFIG.TOAST && CONFIG.TOAST.DURATION) ?? 4200;
    const title = options.title || '';
    const action = options.action || null;
    const dismissOnTap = options.dismissOnTap !== false;

    if (queue.length >= ((CONFIG.TOAST && CONFIG.TOAST.MAX) || 4)) {
      const oldest = queue.shift();
      if (oldest && oldest.parentNode) remove(oldest);
    }

    const node = Utils.el('div', {
      class: `toast toast-${type}`,
      role: 'status',
      tabindex: '0'
    }, [
      Utils.el('div', { class: 'toast-icon' }, [ICONS[type] || 'ℹ️']),
      Utils.el('div', { class: 'toast-content' }, [
        title ? Utils.el('div', { class: 'toast-title' }, [title]) : null,
        Utils.el('div', { class: 'toast-msg' }, [message])
      ].filter(Boolean)),
      action ? Utils.el('button', {
        class: 'toast-action',
        onclick: (e) => { e.stopPropagation(); try { action.onClick(); } finally { remove(node); } }
      }, [action.label]) : null,
      Utils.el('button', {
        class: 'toast-close',
        'aria-label': 'بستن',
        onclick: (e) => { e.stopPropagation(); remove(node); }
      }, ['×'])
    ].filter(Boolean));

    /* لمس یا کلیک روی خود توست آن را می‌بندد (به جز دکمه‌های داخلی) */
    if (dismissOnTap) {
      const dismiss = (e) => {
        if (e.target.closest('.toast-action, .toast-close')) return;
        remove(node);
      };
      node.addEventListener('click', dismiss);
      node.addEventListener('touchend', (e) => {
        if (e.target.closest('.toast-action, .toast-close')) return;
        e.preventDefault();
        remove(node);
      }, { passive: false });
    }

    const r = root();
    if (r) {
      r.appendChild(node);
      queue.push(node);
      requestAnimationFrame(() => node.classList.add('is-visible'));
    }

    if (duration > 0) {
      setTimeout(() => remove(node), duration);
    }
    return node;
  }

  function remove(node) {
    if (!node || node.dataset.removing) return;
    node.dataset.removing = '1';
    node.classList.remove('is-visible');
    node.classList.add('is-leaving');
    setTimeout(() => {
      const i = queue.indexOf(node);
      if (i > -1) queue.splice(i, 1);
      if (node.parentNode) node.remove();
    }, 320);
  }

  function success(msg, opts) { return show(msg, 'success', opts); }
  function error(msg, opts)   { return show(msg, 'error', opts); }
  function warning(msg, opts) { return show(msg, 'warning', opts); }
  function info(msg, opts)    { return show(msg, 'info', opts); }

  function loading(msg, opts) {
    return show(msg, 'loading', { duration: 0, ...opts });
  }

  function update(node, msg, type = 'success', duration) {
    if (!node) return;
    const iconEl = node.querySelector('.toast-icon');
    const msgEl = node.querySelector('.toast-msg');
    if (iconEl) iconEl.textContent = ICONS[type] || 'ℹ️';
    if (msgEl) msgEl.textContent = msg;
    node.classList.remove('toast-info', 'toast-success', 'toast-error', 'toast-warning', 'toast-loading');
    node.classList.add(`toast-${type}`);
    const d = duration ?? ((CONFIG.TOAST && CONFIG.TOAST.DURATION) || 4200);
    if (d > 0) setTimeout(() => remove(node), d);
  }

  function clear() {
    queue.slice().forEach(remove);
  }

  return { show, success, error, warning, info, loading, update, clear, remove };
})();
