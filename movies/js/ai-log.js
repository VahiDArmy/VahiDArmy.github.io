/* =========================================================
   لاگ زنده‌ی AI — پنل شیشه‌ای
   ========================================================= */
window.AILog = (function () {
  const MAX_LINES = 200;
  const AUTO_HIDE_DELAY = 10000; // 10s بعد از پایان، بسته می‌شود

  let panel = null;
  let bodyEl = null;
  let autohideTimer = null;
  let userScrolledUp = false;

  function nowTime() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function ensureUI() {
    if (panel && document.body.contains(panel)) return;

    panel = Utils.el('div', { class: 'ai-log', id: 'ai-log', dataset: { active: 'false' } });

    const pulse = Utils.el('span', { class: 'ai-log-pulse' });

    const header = Utils.el('div', { class: 'ai-log-header' }, [
      Utils.el('div', { class: 'ai-log-title' }, [
        pulse,
        Utils.el('span', {}, ['AI · LIVE LOG'])
      ]),
      Utils.el('div', { class: 'ai-log-controls' }, [
        Utils.el('button', {
          class: 'ai-log-btn',
          title: 'پاک کردن',
          onclick: (e) => { e.stopPropagation(); clear(); }
        }, ['🗑']),
        Utils.el('button', {
          class: 'ai-log-btn ai-log-toggle',
          title: 'باز/جمع',
          onclick: (e) => { e.stopPropagation(); toggleCollapse(); }
        }, ['▾'])
      ])
    ]);

    bodyEl = Utils.el('div', { class: 'ai-log-body' });

    // ردیابی اسکرول کاربر
    bodyEl.addEventListener('scroll', () => {
      const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 20;
      userScrolledUp = !atBottom;
    });

    header.addEventListener('click', (e) => {
      // فقط اگر روی دکمه‌ها نبود
      if (!e.target.closest('.ai-log-btn')) toggleCollapse();
    });

    panel.appendChild(header);
    panel.appendChild(bodyEl);
    document.body.appendChild(panel);
  }

  function toggleCollapse() {
    if (!panel) return;
    const collapsed = panel.classList.toggle('is-collapsed');
    const btn = panel.querySelector('.ai-log-toggle');
    if (btn) btn.textContent = collapsed ? '▸' : '▾';
  }

  function log(message, level = 'info') {
    ensureUI();
    show();

    const line = Utils.el('div', {
      class: 'ai-log-line',
      dataset: { level }
    }, [
      Utils.el('span', { class: 'ai-log-time' }, [nowTime()]),
      Utils.el('span', { class: 'ai-log-msg' }, [String(message)])
    ]);

    bodyEl.appendChild(line);

    while (bodyEl.children.length > MAX_LINES) {
      bodyEl.removeChild(bodyEl.firstChild);
    }

    if (!userScrolledUp) {
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    panel.dataset.active = 'true';
    panel.classList.remove('is-collapsed');
    const btn = panel.querySelector('.ai-log-toggle');
    if (btn) btn.textContent = '▾';
  }

  function show() {
    ensureUI();
    panel.classList.add('is-visible');
    clearTimeout(autohideTimer);
  }

  function hide() {
    if (!panel) return;
    panel.classList.remove('is-visible');
  }

  function scheduleAutoHide() {
    clearTimeout(autohideTimer);
    if (panel) panel.dataset.active = 'false';
    autohideTimer = setTimeout(() => {
      if (!panel) return;
      panel.classList.add('is-collapsed');
      const btn = panel.querySelector('.ai-log-toggle');
      if (btn) btn.textContent = '▸';
      setTimeout(() => {
        if (panel && panel.dataset.active === 'false') {
          panel.classList.remove('is-visible');
        }
      }, 5000);
    }, AUTO_HIDE_DELAY);
  }

  function clear() {
    if (bodyEl) bodyEl.innerHTML = '';
    userScrolledUp = false;
  }

  /* ---- میان‌برها ---- */
  const info    = (m) => log(m, 'info');
  const success = (m) => log(m, 'success');
  const warn    = (m) => log(m, 'warn');
  const error   = (m) => log(m, 'error');
  const request = (m) => log(m, 'request');
  const stream  = (m) => log(m, 'stream');
  const meta    = (m) => log(m, 'meta');

  return {
    log, info, success, warn, error, request, stream, meta,
    show, hide, clear, scheduleAutoHide, toggleCollapse
  };
})();