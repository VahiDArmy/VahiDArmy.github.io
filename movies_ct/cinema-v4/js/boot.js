/* =========================================================
   Boot — بوت مشترک هر دو صفحه
   تم ← ورود (Supabase) ← ready() صفحه ← نمایش اپ
   ========================================================= */
window.Boot = (function () {
  const MIN_MS = 1000;
  const T0 = performance.now();

  /* ---------- لاگ زندهٔ صفحهٔ بارگذاری ---------- */
  function log(message, state) {
    const box = document.getElementById('boot-log');
    if (!box) return;
    box.querySelectorAll('.boot-log-line[data-state="active"]').forEach(function (l) {
      l.dataset.state = 'done';
      l.querySelector('.boot-log-mark').textContent = '✓';
    });
    const mark = { done: '✓', error: '✗', active: '▸', info: '·' }[state] || '·';
    box.appendChild(Utils.el('div', { class: 'boot-log-line', dataset: { state: state || 'info' } }, [
      Utils.el('span', { class: 'boot-log-mark' }, [mark]),
      Utils.el('span', { class: 'boot-log-text' }, [message])
    ]));
    while (box.children.length > 6) box.removeChild(box.firstChild);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- تم ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(CONFIG.STORAGE.THEME, t);
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || CONFIG.DEFAULTS.THEME; }

  /* ---------- هدر مشترک: تم، خروج ---------- */
  function bindHeader() {
    const theme = document.getElementById('btn-theme');
    if (theme) theme.addEventListener('click', function () {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Toast.info(next === 'dark' ? 'تم تاریک فعال شد' : 'تم روشن فعال شد');
    });

    const setNet = function (on) {
      const el = document.getElementById('sync-status'), lbl = document.getElementById('sync-label');
      if (el) el.dataset.state = on ? 'online' : 'offline';
      if (lbl) lbl.textContent = on ? 'آنلاین' : 'آفلاین';
    };
    setNet(navigator.onLine !== false);
    window.addEventListener('online', function () { setNet(true); Toast.success('اتصال برقرار'); });
    window.addEventListener('offline', function () { setNet(false); Toast.warning('اتصال قطع'); });

    const out = document.getElementById('btn-logout');
    if (out) {
      const u = DB.getUser();
      if (u && u.email) out.title = 'خروج — ' + u.email;
      out.addEventListener('click', function () {
        Modal.confirm({
          title: 'خروج از حساب', message: 'از حساب خارج می‌شوی؟', icon: '🚪', confirmText: 'خروج',
          onConfirm: async function () {
            try { await DB.signOut(); location.reload(); } catch (e) { Toast.error(e.message || 'خطا در خروج'); }
          }
        });
      });
    }
  }

  /* ---------- صفحهٔ ورود ---------- */
  function showAuth(bootEl) {
    const overlay = Utils.el('div', { id: 'auth-overlay', class: 'auth-overlay' });
    overlay.innerHTML =
      '<div class="auth-card">' +
      '<h2 class="auth-title">' + CONFIG.APP_NAME + '</h2>' +
      '<p class="auth-sub">ورود به آرشیو آنلاین</p>' +
      '<div class="auth-tabs"><button type="button" data-mode="login" class="is-on">ورود</button><button type="button" data-mode="signup">ثبت‌نام</button></div>' +
      '<form id="auth-form">' +
      '<input class="field-input" type="email" id="auth-email" required placeholder="ایمیل" autocomplete="username" dir="ltr" />' +
      '<input class="field-input" type="password" id="auth-pass" required minlength="6" placeholder="رمز عبور" autocomplete="current-password" dir="ltr" />' +
      '<button type="submit" class="btn btn-primary auth-submit">ورود</button>' +
      '<div id="auth-err" class="auth-err"></div>' +
      '</form></div>';
    document.body.appendChild(overlay);

    let mode = 'login';
    overlay.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        overlay.querySelectorAll('[data-mode]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        overlay.querySelector('.auth-submit').textContent = mode === 'login' ? 'ورود' : 'ثبت‌نام';
      });
    });
    overlay.querySelector('#auth-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const err = overlay.querySelector('#auth-err');
      err.textContent = '';
      const email = overlay.querySelector('#auth-email').value.trim();
      const pass = overlay.querySelector('#auth-pass').value;
      try {
        if (mode === 'login') await DB.signIn(email, pass); else await DB.signUp(email, pass);
        location.reload();
      } catch (ex) { err.textContent = ex.message || 'خطا'; }
    });
    bootEl.classList.add('is-hidden');
  }

  /* ---------- شروع ---------- */
  async function start(ready) {
    const bootEl = document.getElementById('boot-loader');
    const app = document.getElementById('app');
    try {
      applyTheme(localStorage.getItem(CONFIG.STORAGE.THEME) || CONFIG.DEFAULTS.THEME);

      log('بررسی ورود…', 'active');
      let loggedIn = false;
      try { loggedIn = await DB.init(); }
      catch (e) { console.error('[boot] DB.init', e); log('خطا در اتصال به سرور', 'error'); }

      if (!loggedIn) { log('نیاز به ورود', 'info'); showAuth(bootEl); return; }
      log('ورود موفق — دیتابیس آنلاین', 'done');

      log('آماده‌سازی صفحه…', 'active');
      bindHeader();
      await ready();
      log('همه‌چیز آماده است', 'done');

      const wait = MIN_MS - (performance.now() - T0);
      if (wait > 0) await sleep(wait);
    } catch (err) {
      console.error('[boot] fatal', err);
      log('خطا در راه‌اندازی: ' + (err.message || err), 'error');
      await sleep(1200);
    }
    bootEl.classList.add('is-hidden');
    setTimeout(function () { if (bootEl.isConnected) bootEl.remove(); }, 700);
    if (app) app.hidden = false;
  }

  return { start: start, log: log, bindHeader: bindHeader, applyTheme: applyTheme };
})();
