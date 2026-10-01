/* =========================================================
   سیستم نوتیفیکیشن (Toast)
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
    const duration = options.duration ?? CONFIG.TOAST.DURATION;
    const title = options.title || '';
    const action = options.action || null;

    if (queue.length >= CONFIG.TOAST.MAX) {
      const oldest = queue.shift();
      if (oldest && oldest.parentNode) remove(oldest);
    }

    const node = Utils.el('div', {
      class: `toast toast-${type}`,
      role: 'status'
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
        onclick: () => remove(node)
      }, ['×'])
    ].filter(Boolean));

    root().appendChild(node);
    queue.push(node);

    requestAnimationFrame(() => node.classList.add('is-visible'));

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
      node.remove();
    }, 320);
  }

  function success(msg, opts) { return show(msg, 'success', opts); }
  function error(msg, opts)   { return show(msg, 'error', opts); }
  function warning(msg, opts) { return show(msg, 'warning', opts); }
  function info(msg, opts)    { return show(msg, 'info', opts); }

  function loading(msg, opts) {
    return show(msg, 'loading', { duration: 0, ...opts });
  }

  function update(node, msg, type = 'success', duration = CONFIG.TOAST.DURATION) {
    if (!node) return;
    const iconEl = node.querySelector('.toast-icon');
    const msgEl = node.querySelector('.toast-msg');
    if (iconEl) iconEl.textContent = ICONS[type];
    if (msgEl) msgEl.textContent = msg;
    node.classList.remove('toast-info', 'toast-success', 'toast-error', 'toast-warning', 'toast-loading');
    node.classList.add(`toast-${type}`);
    if (duration > 0) setTimeout(() => remove(node), duration);
  }

  function clear() {
    queue.slice().forEach(remove);
  }

  return { show, success, error, warning, info, loading, update, clear, remove };
})();