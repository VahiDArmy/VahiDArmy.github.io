/* =========================================================
   بوت‌استرپ نهایی برنامه
   ========================================================= */
(function bootstrap() {

  const BOOT_START = performance.now();
  const MIN_BOOT_MS = 1400;

  const boot = document.getElementById('boot-loader');
  const app = document.getElementById('app');

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* =========================================================
     سیستم لاگ زنده‌ی صفحه‌ی بارگذاری
     ========================================================= */
  const BootLog = (function () {
    let logEl = null;
    let activeLine = null;

    function ensure() {
      if (!logEl) logEl = document.getElementById('boot-log');
      return logEl;
    }

    function markPreviousAsDone() {
      const log = ensure();
      if (!log) return;
      const actives = log.querySelectorAll('.boot-log-line[data-state="active"]');
      actives.forEach(function (line) {
        line.dataset.state = 'done';
        const mark = line.querySelector('.boot-log-mark');
        if (mark) mark.textContent = '✓';
      });
    }

    function push(message, state) {
      state = state || 'info';
      const log = ensure();
      if (!log) return null;

      if (state === 'active') markPreviousAsDone();

      const line = document.createElement('div');
      line.className = 'boot-log-line';
      line.dataset.state = state;

      const mark = document.createElement('span');
      mark.className = 'boot-log-mark';
      mark.textContent = state === 'done' ? '✓'
        : state === 'error' ? '✗'
        : state === 'active' ? '▸'
        : '·';

      const text = document.createElement('span');
      text.className = 'boot-log-text';
      text.textContent = message;

      line.appendChild(mark);
      line.appendChild(text);
      log.appendChild(line);

      /* فقط آخرین ۸ خط نگه داشته شود */
      while (log.children.length > 8) {
        log.removeChild(log.firstChild);
      }

      log.scrollTop = log.scrollHeight;
      return line;
    }

    function active(message) {
      return push(message, 'active');
    }

    function done(message) {
      markPreviousAsDone();
      return push(message, 'done');
    }

    function error(message) {
      markPreviousAsDone();
      return push(message, 'error');
    }

    function info(message) {
      return push(message, 'info');
    }

    return {
      push: push,
      active: active,
      done: done,
      error: error,
      info: info
    };
  })();

  /* اکسپوز برای استفاده در db.js */
  window.BootLog = BootLog;

  /* =========================================================
     شروع
     ========================================================= */
  async function start() {
    try {
      /* ---- مرحله ۱: تم ---- */
      BootLog.active('آماده‌سازی محیط…');
      const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME) || CONFIG.DEFAULTS.THEME;
      document.documentElement.setAttribute('data-theme', savedTheme);

      const savedView = localStorage.getItem(CONFIG.STORAGE.VIEW) || CONFIG.DEFAULTS.VIEW;
      const savedCat = localStorage.getItem(CONFIG.STORAGE.LAST_CATEGORY) || CONFIG.DEFAULTS.CATEGORY;

      State.set({ theme: savedTheme, view: savedView, category: savedCat });
      BootLog.done('محیط آماده شد');

      /* ---- مرحله ۲: احراز هویت + دیتابیس ---- */
      BootLog.active('بررسی ورود…');
      let loggedIn = false;
      try {
        loggedIn = await DB.init();
      } catch (dbErr) {
        console.error('[bootstrap] DB init error:', dbErr);
        BootLog.error('خطا در اتصال به سرور');
      }

      if (!loggedIn) {
        BootLog.info('نیاز به ورود');
        // show simple auth overlay (same visual language)
        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a0a0c;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
        overlay.innerHTML = `
          <div style="background:#12121a;border:1px solid #2a2a3a;border-radius:16px;padding:2rem;max-width:380px;width:100%;font-family:inherit;color:#eee;">
            <h2 style="margin:0 0 0.5rem;text-align:center;background:linear-gradient(135deg,#ff4d6d,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">سینما من</h2>
            <p style="text-align:center;color:#9a9ab0;font-size:0.9rem;margin-bottom:1.25rem;">ورود به آرشیو آنلاین</p>
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
              <button type="button" data-mode="login" style="flex:1;padding:0.55rem;border-radius:8px;border:1px solid #ff4d6d;background:#ff4d6d;color:#fff;cursor:pointer;">ورود</button>
              <button type="button" data-mode="signup" style="flex:1;padding:0.55rem;border-radius:8px;border:1px solid #2a2a3a;background:transparent;color:#9a9ab0;cursor:pointer;">ثبت‌نام</button>
            </div>
            <form id="auth-form-inline">
              <input type="email" id="auth-email-inline" required placeholder="ایمیل" style="width:100%;padding:0.7rem;margin-bottom:0.6rem;background:#1a1a24;border:1px solid #2a2a3a;border-radius:8px;color:#eee;font-family:inherit;box-sizing:border-box;" />
              <input type="password" id="auth-pass-inline" required minlength="6" placeholder="رمز عبور" style="width:100%;padding:0.7rem;margin-bottom:0.6rem;background:#1a1a24;border:1px solid #2a2a3a;border-radius:8px;color:#eee;font-family:inherit;box-sizing:border-box;" />
              <button type="submit" style="width:100%;padding:0.8rem;background:linear-gradient(135deg,#ff4d6d,#c73e54);border:none;border-radius:8px;color:#fff;font-weight:600;cursor:pointer;">ورود</button>
              <div id="auth-err-inline" style="color:#ff4d5e;font-size:0.85rem;text-align:center;min-height:1.2em;margin-top:0.5rem;"></div>
            </form>
          </div>`;
        document.body.appendChild(overlay);
        let mode = 'login';
        overlay.querySelectorAll('[data-mode]').forEach(function(btn){
          btn.addEventListener('click', function(){
            mode = btn.dataset.mode;
            overlay.querySelectorAll('[data-mode]').forEach(function(b){
              b.style.background = b.dataset.mode === mode ? '#ff4d6d' : 'transparent';
              b.style.color = b.dataset.mode === mode ? '#fff' : '#9a9ab0';
              b.style.borderColor = b.dataset.mode === mode ? '#ff4d6d' : '#2a2a3a';
            });
            overlay.querySelector('button[type=submit]').textContent = mode === 'login' ? 'ورود' : 'ثبت‌نام';
          });
        });
        overlay.querySelector('#auth-form-inline').addEventListener('submit', async function(e){
          e.preventDefault();
          const errEl = document.getElementById('auth-err-inline');
          errEl.textContent = '';
          try {
            if (mode === 'login') await DB.signIn(document.getElementById('auth-email-inline').value.trim(), document.getElementById('auth-pass-inline').value);
            else await DB.signUp(document.getElementById('auth-email-inline').value.trim(), document.getElementById('auth-pass-inline').value);
            location.reload();
          } catch (err) {
            errEl.textContent = err.message || 'خطا';
          }
        });
        // stop boot here
        boot.classList.add('is-hidden');
        return;
      }
      BootLog.done('ورود موفق — دیتابیس آنلاین');

      /* ---- مرحله ۳: بارگذاری داده ---- */
      BootLog.active('بارگذاری داده‌ها…');
      try {
        State.loadAll();
        State.applyFilters();
        const count = State.get().titles.length;
        BootLog.done('بارگذاری شد — ' + Utils.toFa(count) + ' عنوان');
      } catch (e) {
        console.error('[bootstrap] load data error:', e);
        BootLog.error('بارگذاری داده‌ها ناموفق بود');
      }

      /* ---- مرحله ۴: رندر اولیه ---- */
      BootLog.active('رندر رابط کاربری…');
      Render.renderSidebarCounts();
      Render.renderPageTitle();

      document.querySelectorAll('.view-btn').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.view === savedView);
      });
      const gridEl = document.getElementById('grid');
      if (gridEl) gridEl.classList.toggle('is-list', savedView === 'list');

      document.querySelectorAll('#category-list .side-item').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.category === savedCat);
      });

      const s = State.get();
      const typeSel = document.getElementById('filter-type');
      const sortSel = document.getElementById('filter-sort');
      if (typeSel) typeSel.value = s.filterType;
      if (sortSel) sortSel.value = s.sort;
      BootLog.done('رابط آماده شد');

      /* ---- مرحله ۵: رویدادها ---- */
      BootLog.active('اتصال رویدادها…');
      Events.bind();
      Events.renderList();
      Events.refreshSyncStatus();
      BootLog.done('رویدادها فعال شدند');

      /* ---- نسخه ---- */
      const verEl = document.getElementById('app-version');
      if (verEl) verEl.textContent = Utils.toFa(CONFIG.APP_VERSION);

      /* offline persistence removed — Supabase handles storage */

      /* ---- اتمام ---- */
      BootLog.done('همه‌چیز آماده است ✓');

      const elapsed = performance.now() - BOOT_START;
      if (elapsed < MIN_BOOT_MS) {
        await sleep(MIN_BOOT_MS - elapsed);
      }

      boot.classList.add('is-hidden');
      setTimeout(function () {
        try { boot.remove(); } catch (e) {}
      }, 700);
      app.hidden = false;

      /* ---- پیام خوش‌آمد ---- */
      setTimeout(function () {
        try {
          const stat = DB.getStats();
          Toast.info('آرشیو آنلاین آماده است — ' + Utils.toFa(stat.total || 0) + ' عنوان.', {
            title: 'خوش آمدی! 👋',
            duration: 4500
          });
        } catch (e) {}
      }, 700);

      console.log('%c🎬 Cinema App v' + CONFIG.APP_VERSION + ' ready',
        'color:#7c5cff;font-weight:bold;font-size:14px');

    } catch (err) {
      console.error('[bootstrap] fatal error:', err);
      BootLog.error('خطا در راه‌اندازی: ' + (err.message || err));

      setTimeout(function () {
        try {
          boot.classList.add('is-hidden');
          setTimeout(function () {
            try { boot.remove(); } catch (e) {}
          }, 400);
        } catch (e) {}
        app.hidden = false;
        try { Events.bind(); Events.refreshSyncStatus(); } catch (e) {}
        try { Events.openSettings(); } catch (e) {}
      }, 1400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();