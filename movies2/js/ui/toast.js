/* =========================================================
   Toasts — engine-compatible API (show/success/error/…)
   ========================================================= */
window.Toast = (function () {
  'use strict';

  var root = null;
  var LIMIT = (CONFIG.TOAST && CONFIG.TOAST.MAX) || 4;

  function host() {
    if (!root || !document.body.contains(root)) root = document.getElementById('toast-root');
    return root;
  }

  function dismiss(node) {
    if (!node || !node.parentNode) return;
    node.classList.add('is-out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
  }

  function show(message, type, options) {
    options = options || {};
    var mount = host();
    if (!mount) return null;
    type = type || 'info';

    while (mount.children.length >= LIMIT) {
      mount.removeChild(mount.firstElementChild);
    }

    var node = UI.nodeFromHTML(
      '<div class="toast toast--' + type + '" role="status">' +
        '<span class="toast__mark">' + markFor(type) + '</span>' +
        '<div class="toast__text">' +
          (options.title ? '<strong>' + UI.esc(options.title) + '</strong>' : '') +
          '<span>' + UI.esc(message) + '</span>' +
        '</div>' +
        '<button class="toast__close" type="button" aria-label="بستن">' + UI.icon('close') + '</button>' +
      '</div>'
    );

    if (options.action && options.action.label) {
      var act = UI.el('button', { class: 'toast__act', type: 'button', text: options.action.label });
      act.addEventListener('click', function () {
        try { options.action.onClick && options.action.onClick(); } finally { dismiss(node); }
      });
      node.querySelector('.toast__text').appendChild(act);
    }

    node.querySelector('.toast__close').addEventListener('click', function () { dismiss(node); });
    mount.appendChild(node);

    var ms = options.duration != null ? options.duration : (CONFIG.TOAST.DURATION || 3800);
    if (ms > 0) node._timer = setTimeout(function () { dismiss(node); }, ms);
    return node;
  }

  function markFor(type) {
    if (type === 'success') return UI.icon('check');
    if (type === 'error') return UI.icon('alert');
    if (type === 'warning') return UI.icon('alert');
    if (type === 'loading') return '<span class="spin"></span>';
    return UI.icon('info');
  }

  function success(msg, opts) { return show(msg, 'success', opts); }
  function error(msg, opts) { return show(msg, 'error', opts); }
  function warning(msg, opts) { return show(msg, 'warning', opts); }
  function info(msg, opts) { return show(msg, 'info', opts); }
  function loading(msg, opts) { return show(msg, 'loading', Object.assign({ duration: 0 }, opts || {})); }
  function update(node, msg, type, duration) {
    if (!node) return;
    var text = node.querySelector('.toast__text span');
    if (text) text.textContent = msg;
    node.className = 'toast toast--' + (type || 'success');
    var mark = node.querySelector('.toast__mark');
    if (mark) mark.innerHTML = markFor(type || 'success');
    clearTimeout(node._timer);
    var ms = duration != null ? duration : (CONFIG.TOAST.DURATION || 3800);
    if (ms > 0) node._timer = setTimeout(function () { dismiss(node); }, ms);
  }
  function clear() {
    var mount = host();
    if (!mount) return;
    while (mount.firstChild) mount.removeChild(mount.firstChild);
  }

  return { show: show, success: success, error: error, warning: warning, info: info, loading: loading, update: update, clear: clear, remove: dismiss };
})();
