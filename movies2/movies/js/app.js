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

      /* ---- مرحله ۲: دیتابیس ---- */
      BootLog.active('راه‌اندازی موتور دیتابیس…');
      try {
        await DB.init();
        BootLog.done('دیتابیس آماده است');
      } catch (dbErr) {
        console.error('[bootstrap] DB init error:', dbErr);
        BootLog.error('راه‌اندازی دیتابیس با خطا مواجه شد — حالت آفلاین فعال است');
        Toast.error('راه‌اندازی دیتابیس با خطا مواجه شد');
      }

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

      /* ---- ذخیره‌ی خودکار ---- */
      setInterval(function () {
        try { DB.persistLocal(); } catch (e) {}
      }, 10000);

      window.addEventListener('beforeunload', function () {
        try { DB.persistLocal(); } catch (e) {}
      });

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
        let configured = false;
        try { configured = GitHub.isConfigured(); } catch (e) { configured = false; }

        if (!configured) {
          Toast.info('برای ذخیره‌سازی روی گیت‌هاب، اطلاعات مخزن و توکن را وارد کن.', {
            title: '👋 خوش آمدی',
            duration: 6000
          });
          setTimeout(function () {
            try { Events.openSettings(); } catch (e) { console.error(e); }
          }, 900);
        } else {
          try {
            const stat = DB.getStats();
            Toast.info('آرشیو شما آماده است — ' + Utils.toFa(stat.totals.count) + ' عنوان.', {
              title: 'خوش آمدی! 👋',
              duration: 4500
            });
          } catch (e) {}
        }
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