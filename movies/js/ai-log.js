/* =========================================================
   لاگ مینیمال AI — فقط ۲ خط آخر پایین صفحه
   ========================================================= */
window.AILog = (function () {
  const MAX_LINES = 2;
  const AUTO_HIDE_DELAY = 6000; // ۶ ثانیه بعد از آخرین پیام محو می‌شود

  let root = null;
  let bodyEl = null;
  let autohideTimer = null;

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

    // فقط آخرین N خط نگه داشته شود
    while (bodyEl.children.length > MAX_LINES) {
      bodyEl.removeChild(bodyEl.firstChild);
    }

    root.classList.add('is-visible');

    // زمان‌بندی محو خودکار
    autohideTimer = setTimeout(() => {
      if (root) root.classList.remove('is-visible');
    }, AUTO_HIDE_DELAY);
  }

  function show() {
    ensureUI();
    root.classList.add('is-visible');
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

  /* ---- میان‌برها ---- */
  const info    = (m) => log(m, 'info');
  const success = (m) => log(m, 'success');
  const warn    = (m) => log(m, 'warn');
  const error   = (m) => log(m, 'error');
  const request = (m) => log(m, 'request');
  const stream  = (m) => log(m, 'stream');
  const meta    = (m) => log(m, 'meta');

  /* ---- سازگاری با API قبلی ---- */
  function toggleCollapse() { /* no-op */ }

  return {
    log, info, success, warn, error, request, stream, meta,
    show, hide, clear, scheduleAutoHide, toggleCollapse
  };
})();