/* =========================================================
   بوت‌استرپ نهایی برنامه
   ========================================================= */
(function bootstrap() {

  const boot = document.getElementById('boot-loader');
  const app = document.getElementById('app');

  async function start() {
    try {
      /* ---- تم و نمایش اولیه ---- */
      const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME) || CONFIG.DEFAULTS.THEME;
      document.documentElement.setAttribute('data-theme', savedTheme);

      const savedView = localStorage.getItem(CONFIG.STORAGE.VIEW) || CONFIG.DEFAULTS.VIEW;
      const savedCat = localStorage.getItem(CONFIG.STORAGE.LAST_CATEGORY) || CONFIG.DEFAULTS.CATEGORY;

      State.set({ theme: savedTheme, view: savedView, category: savedCat });

      /* ---- راه‌اندازی دیتابیس ---- */
      await DB.init();

      /* ---- بارگذاری داده ---- */
      State.loadAll();
      State.applyFilters();

      /* ---- رندر اولیه ---- */
      Render.renderSidebarCounts();
      Render.renderPageTitle();

      // سوییچ نمای ذخیره‌شده
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.view === savedView);
      });
      document.getElementById('grid').classList.toggle('is-list', savedView === 'list');

      // دسته‌ی ذخیره‌شده
      document.querySelectorAll('#category-list .side-item').forEach(b => {
        b.classList.toggle('is-active', b.dataset.category === savedCat);
      });

      // سوییچ فیلترها بر اساس state
      const s = State.get();
      const typeSel = document.getElementById('filter-type');
      const sortSel = document.getElementById('filter-sort');
      if (typeSel) typeSel.value = s.filterType;
      if (sortSel) sortSel.value = s.sort;

      /* ---- اتصال رویدادها ---- */
      Events.bind();
      Events.renderList();
      Events.refreshSyncStatus();

      /* ---- نسخه ---- */
      const verEl = document.getElementById('app-version');
      if (verEl) verEl.textContent = Utils.toFa(CONFIG.APP_VERSION);

      /* ---- ذخیره‌ی خودکار ---- */
      setInterval(() => {
        DB.persistLocal();
      }, 10000);

      // ذخیره در هنگام بستن
      window.addEventListener('beforeunload', () => {
        try { DB.persistLocal(); } catch {}
      });

      /* ---- پاک کردن لودر ---- */
      boot.classList.add('is-hidden');
      setTimeout(() => boot.remove(), 500);
      app.hidden = false;

      /* ---- پیام خوش‌آمد ---- */
      setTimeout(() => {
        const s = DB.getStats();
        Toast.info(`آرشیو شما آماده است — ${Utils.toFa(s.totals.count)} عنوان در دسته‌بندی‌ها.`, {
          title: 'خوش آمدی! 👋',
          duration: 4500
        });
      }, 800);

      console.log('%c🎬 Cinema App v' + CONFIG.APP_VERSION + ' ready',
        'color:#7c5cff;font-weight:bold;font-size:14px');

    } catch (err) {
      console.error('[bootstrap] fatal error:', err);
      const msg = document.getElementById('boot-message');
      if (msg) {
        msg.textContent = 'خطا در راه‌اندازی: ' + (err.message || err);
        msg.style.color = 'var(--danger)';
      }
      Toast.error('راه‌اندازی با خطا مواجه شد. کنسول را چک کن.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();