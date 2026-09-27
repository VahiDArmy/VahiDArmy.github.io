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

      /* ---- راه‌اندازی دیتابیس (خطا اینجا نباید کل اپ را بترکونه) ---- */
      try {
        await DB.init();
      } catch (dbErr) {
        console.error('[bootstrap] DB init error:', dbErr);
        Toast.error('راه‌اندازی دیتابیس با خطا مواجه شد — حالت آفلاین فعال است');
      }

      /* ---- بارگذاری داده ---- */
      try {
        State.loadAll();
        State.applyFilters();
      } catch (e) {
        console.error('[bootstrap] load data error:', e);
      }

      /* ---- رندر اولیه ---- */
      Render.renderSidebarCounts();
      Render.renderPageTitle();

      // سوییچ نمای ذخیره‌شده
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.view === savedView);
      });
      const gridEl = document.getElementById('grid');
      if (gridEl) gridEl.classList.toggle('is-list', savedView === 'list');

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
        try { DB.persistLocal(); } catch {}
      }, 10000);

      // ذخیره در هنگام بستن
      window.addEventListener('beforeunload', () => {
        try { DB.persistLocal(); } catch {}
      });

      /* ---- نمایش اپ ---- */
      boot.classList.add('is-hidden');
      setTimeout(() => boot.remove(), 500);
      app.hidden = false;

      /* ---- پیام خوش‌آمد + باز کردن خودکار تنظیمات ----
         اگر GitHub تنظیم نشده باشد، مستقیم مودال تنظیمات را باز می‌کنیم
         تا کاربر جای وارد کردن توکن را ببیند. */
      setTimeout(() => {
        let configured = false;
        try { configured = GitHub.isConfigured(); } catch (e) { configured = false; }

        if (!configured) {
          Toast.info('برای ذخیره‌سازی روی گیت‌هاب، اطلاعات مخزن و توکن را وارد کن.', {
            title: '👋 خوش آمدی',
            duration: 6000
          });
          // کمی تاخیر تا کاربر پیام را ببیند
          setTimeout(() => {
            try { Events.openSettings(); } catch (e) { console.error(e); }
          }, 900);
        } else {
          const stat = DB.getStats();
          Toast.info(`آرشیو شما آماده است — ${Utils.toFa(stat.totals.count)} عنوان در دسته‌بندی‌ها.`, {
            title: 'خوش آمدی! 👋',
            duration: 4500
          });
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
      // حتی در صورت خطای فاجعه‌بار، اپ را نشان بده تا کاربر بتواند تنظیمات را باز کند
      setTimeout(() => {
        try {
          boot.classList.add('is-hidden');
          setTimeout(() => boot.remove(), 400);
        } catch {}
        app.hidden = false;
        try { Events.bind(); Events.refreshSyncStatus(); } catch {}
        try { Events.openSettings(); } catch {}
      }, 1200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();