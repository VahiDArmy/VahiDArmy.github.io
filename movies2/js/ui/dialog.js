/* =========================================================
   Dialogs — engine-compatible API (open/close/confirm/alert)
   ========================================================= */
window.Modal = (function () {
  'use strict';

  var stack = [];
  var locked = false;
  var escHandler = null;

  function host() { return document.getElementById('dlg-root'); }

  function lock() {
    if (locked) return;
    var gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingInlineEnd = gap + 'px';
    document.body.classList.add('has-dialog');
    locked = true;
  }

  function unlock() {
    if (!locked) return;
    document.body.style.paddingInlineEnd = '';
    document.body.classList.remove('has-dialog');
    locked = false;
  }

  function open(options) {
    options = options || {};
    var size = options.size || 'md';
    var closable = options.closable !== false;

    var body = UI.el('div', { class: 'dlg__body' });
    if (options.body instanceof HTMLElement) body.appendChild(options.body);
    else if (typeof options.body === 'string') body.innerHTML = options.body;

    var shell = UI.el('div', { class: 'dlg dlg--' + size + ' ' + (options.className || ''), role: 'dialog', 'aria-modal': 'true' });
    if (options.title || closable) {
      var head = UI.el('div', { class: 'dlg__head' });
      var title = UI.el('div', { class: 'dlg__title' });
      if (options.icon) title.appendChild(UI.nodeFromHTML('<span class="dlg__icon">' + UI.icon(options.icon) + '</span>'));
      title.appendChild(UI.el('h2', { text: options.title || '' }));
      head.appendChild(title);
      if (closable) {
        var closeBtn = UI.el('button', { class: 'iconbtn dlg__close', type: 'button', 'aria-label': 'بستن' }, [UI.nodeFromHTML(UI.icon('close'))]);
        closeBtn.addEventListener('click', close);
        head.appendChild(closeBtn);
      }
      shell.appendChild(head);
    }

    shell.appendChild(body);

    if (options.footer) {
      var foot = UI.el('div', { class: 'dlg__foot' });
      if (options.footer instanceof HTMLElement) foot.appendChild(options.footer);
      else foot.innerHTML = options.footer;
      shell.appendChild(foot);
    }

    var scrim = UI.el('div', { class: 'dlg__scrim' });
    scrim.addEventListener('click', function () { if (closable) close(); });

    var wrap = UI.el('div', { class: 'dlg__wrap' }, [scrim, shell]);
    host().appendChild(wrap);
    host().classList.add('is-open');
    host().setAttribute('aria-hidden', 'false');

    UI.focusTrap(shell);
    stack.push({ wrap: wrap, shell: shell, onClose: options.onClose, previous: document.activeElement });
    lock();
    requestAnimationFrame(function () { wrap.classList.add('is-in'); });

    setTimeout(function () {
      var target = shell.querySelector('[data-autofocus]') ||
        shell.querySelector('.dlg__body input:not([type=hidden]):not([disabled]), .dlg__body textarea, .dlg__body select, .dlg__body button') ||
        shell.querySelector('.dlg__foot button');
      if (target) target.focus();
    }, 40);

    if (!escHandler) {
      escHandler = function (ev) { if (ev.key === 'Escape' && stack.length) close(); };
      document.addEventListener('keydown', escHandler);
    }

    return { modal: shell, bodyEl: body, close: close };
  }

  function close() {
    if (!stack.length) return;
    var item = stack.pop();
    item.wrap.classList.remove('is-in');
    item.wrap.classList.add('is-out');
    setTimeout(function () {
      if (item.wrap.parentNode) item.wrap.parentNode.removeChild(item.wrap);
      if (!stack.length) {
        host().classList.remove('is-open');
        host().setAttribute('aria-hidden', 'true');
        unlock();
        if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
      }
      if (typeof item.onClose === 'function') item.onClose();
      if (item.previous && item.previous.focus) { try { item.previous.focus(); } catch (e) {} }
    }, 180);
  }

  function closeAll() { while (stack.length) close(); }

  function confirm(options) {
    options = options || {};
    var body = UI.el('div', { class: 'confirm' }, [
      UI.el('div', { class: 'confirm__icon' + (options.danger ? ' is-danger' : '') }, [UI.nodeFromHTML(UI.icon(options.danger ? 'alert' : 'info'))]),
      UI.el('h3', { text: options.title || 'مطمئنی؟' }),
      options.message ? UI.el('p', { text: options.message }) : null
    ]);

    var foot = UI.el('div', { class: 'dlg__actions' });
    var cancel = UI.el('button', { class: 'btn is-quiet', type: 'button', text: options.cancelText || 'انصراف' });
    var ok = UI.el('button', {
      class: 'btn ' + (options.danger ? 'is-danger' : 'is-primary'),
      type: 'button',
      text: options.confirmText || 'تایید'
    });
    cancel.addEventListener('click', function () { close(); if (options.onCancel) options.onCancel(); });
    ok.addEventListener('click', function () { close(); if (options.onConfirm) options.onConfirm(); });
    foot.appendChild(cancel);
    foot.appendChild(ok);

    return open({ title: '', body: body, footer: foot, size: 'sm' });
  }

  function alert(options) {
    options = options || {};
    var body = UI.el('div', { class: 'confirm' }, [
      UI.el('h3', { text: options.title || 'توجه' }),
      options.message ? UI.el('p', { text: options.message }) : null
    ]);
    var foot = UI.el('div', { class: 'dlg__actions' });
    var ok = UI.el('button', { class: 'btn is-primary', type: 'button', text: options.okText || 'باشه' });
    ok.addEventListener('click', close);
    foot.appendChild(ok);
    return open({ title: '', body: body, footer: foot, size: 'sm' });
  }

  return { open: open, close: close, closeAll: closeAll, confirm: confirm, alert: alert };
})();
