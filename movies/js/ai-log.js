/* =========================================================
   لاگ مینیمال AI — ۲ خط آخر پایین صفحه
   ========================================================= */
window.AILog = (function () {
  const MAX_LINES = 2;
  const AUTO_HIDE_DELAY = 7000;

  let root = null;
  let bodyEl = null;
  let autohideTimer = null;
  let firstShowDone = false;

  function nowTime() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function ensureUI() {
    if (root && document.body.contains(root)) return;

    root = Utils.el('div', { class: 'ai-log-mini', id: 'ai-log-mini' });
    bodyEl = Utils.el('div', { class: 'ai-log-mini-body' });
    root.appendChild(bodyEl);
    document.body.appendChild(root);

    // رفع اجبار به reflow برای فعال شدن transition
    void root.offsetWidth;
    firstShowDone = false;
  }

  function log(message, level = 'info') {
    ensureUI();
    clearTimeout(autohideTimer);

    const line = Utils.el('div', {
      class: 'ai-log-mini-line',
      dataset: { level }
    }, [
      Utils.el('span', { class: 'ai-log-mini-time' }, [nowTime()]),
      Utils.el('span', { class: 'ai-log-mini-msg' }, [String(message)])
    ]);

    bodyEl.appendChild(line);

    while (bodyEl.children.length > MAX_LINES) {
      bodyEl.removeChild(bodyEl.firstChild);
    }

    if (!firstShowDone) {
      firstShowDone = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.add('is-visible'));
      });
    } else {
      root.classList.add('is-visible');
    }

    autohideTimer = setTimeout(() => {
      if (root) root.classList.remove('is-visible');
    }, AUTO_HIDE_DELAY);
  }

  function show() {
    ensureUI();
    requestAnimationFrame(() => root.classList.add('is-visible'));
  }

  function hide() {
    if (root) root.classList.remove('is-visible');
  }

  function scheduleAutoHide() {
    clearTimeout(autohideTimer);
    autohideTimer = setTimeout(() => {
      if (root) root.classList.remove('is-visible');
    }, AUTO_HIDE_DELAY);
  }

  function clear() {
    if (bodyEl) bodyEl.innerHTML = '';
  }

  const info    = (m) => log(m, 'info');
  const success = (m) => log(m, 'success');
  const warn    = (m) => log(m, 'warn');
  const error   = (m) => log(m, 'error');
  const request = (m) => log(m, 'request');
  const stream  = (m) => log(m, 'stream');
  const meta    = (m) => log(m, 'meta');

  function toggleCollapse() { /* no-op */ }

  return {
    log, info, success, warn, error, request, stream, meta,
    show, hide, clear, scheduleAutoHide, toggleCollapse
  };
})();