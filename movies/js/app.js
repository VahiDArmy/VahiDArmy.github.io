/* =========================================================
   بوت‌استرپ نهایی برنامه
   ========================================================= */
(function bootstrap() {

  const BOOT_START = performance.now();
  const MIN_BOOT_MS = 1200; /* حداقل زمان نمایش صفحه‌ی بارگذاری */

  const boot = document.getElementById('boot-loader');
  const app = document.getElementById('app');

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function bootMsg(msg) {
    const el = document.getElementById('boot-message');
    if (el) el.textContent = msg;
  }

  async function start() {
    try {
      /* ---- تم و نمایش اولیه ---- */
      bootMsg('در حال آماده‌سازی…');
      const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME) || CONFIG.DEFAULTS.THEME;
      document.documentElement.setAttribute('data-theme', savedTheme);

      const savedView = localStorage.getItem(CONFIG.STORAGE.VIEW) || CONFIG.DEFAULTS.VIEW;
      const savedCat = localStorage.getItem(CONFIG.STORAGE.LAST_CATEGORY) || CONFIG.DEFAULTS.CATEGORY;

      State.set({ theme: savedTheme, view: savedView, category: savedCat });

      /* ---- راه‌اندازی دیتابیس ---- */
      try {
        await DB.init();
      } catch (dbErr) {
        console.error('[bootstrap] DB init error:', dbErr);
        Toast.error('راه‌اندازی دیتابیس با خطا مواجه شد — حالت آفلاین فعال است');
      }

      /* ---- بارگذاری داده ---- */
      bootMsg('در حال بارگذاری داده…');
      try {
        State.loadAll();
        State.applyFilters();
      } catch (e) {
        console.error('[bootstrap] load data error:', e);
      }

      /* ---- رندر اولیه ---- */
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

      /* ---- اتصال رویدادها ---- */
      bootMsg('در حال آماده‌سازی رابط…');
      Events.bind();
      Events.renderList();
      Events.refreshSyncStatus();

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

      /* ---- حداقل زمان نمایش صفحه‌ی بارگذاری ---- */
      const elapsed = performance.now() - BOOT_START;
      if (elapsed < MIN_BOOT_MS) {
        bootMsg('آماده!');
        await sleep(MIN_BOOT_MS - elapsed);
      }

      /* ---- نمایش اپ ---- */
      boot.classList.add('is-hidden');
      setTimeout(function () {
        try { boot.remove(); } catch (e) {}
      }, 500);
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
      const msg = document.getElementById('boot-message');
      if (msg) {
        msg.textContent = 'خطا در راه‌اندازی: ' + (err.message || err);
        msg.style.color = 'var(--danger)';
      }
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
      }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();