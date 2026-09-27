/* =========================================================
   داشبورد آماری
   ========================================================= */
window.Stats = (function () {

  function build() {
    const titles = DB.getAllTitles();
    const total = titles.length;
    const byCat = { love: [], good: [], hate: [] };
    titles.forEach(t => byCat[t.category]?.push(t));

    const rated = titles.filter(t => t.rating > 0);
    const avgAll = rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length) : 0;

    const favs = titles.filter(t => t.favorite).length;
    const types = {};
    titles.forEach(t => { types[t.type] = (types[t.type] || 0) + 1; });

    const genres = {};
    titles.forEach(t => {
      (t.genre || '').split(/[,،]/).map(g => g.trim()).filter(Boolean).forEach(g => {
        genres[g] = (genres[g] || 0) + 1;
      });
    });

    return { titles, total, byCat, rated, avgAll, favs, types, genres };
  }

  function openDashboard() {
    const s = build();

    const body = Utils.el('div', {}, [
      // ردیف اول آمار
      Utils.el('div', { class: 'stats-grid' }, [
        statBox('کل عنوان‌ها', Utils.toFa(s.total), 'در ۳ دسته'),
        statBox('میانگین امتیاز', s.avgAll ? Utils.toFa(s.avgAll.toFixed(1)) : '—', `${Utils.toFa(s.rated.length)} عنوان امتیازدار`),
        statBox('علاقه‌مندی‌ها', Utils.toFa(s.favs), `${Utils.toFa(Math.round(s.favs / Math.max(s.total, 1) * 100))}٪ از کل`),
        statBox('انواع', `${Object.keys(s.types).length}`, 'نوع محتوا'),
      ]),

      // توزیع دسته‌ها
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['توزیع در دسته‌ها']),
      Utils.el('div', { class: 'bar-list' }, [
        barRow('عاشقانه', s.byCat.love.length, s.total, 'love'),
        barRow('خوب', s.byCat.good.length, s.total, 'good'),
        barRow('نفرت‌انگیز', s.byCat.hate.length, s.total, 'hate')
      ]),

      // میانگین امتیاز هر دسته
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['میانگین امتیاز به تفکیک دسته']),
      Utils.el('div', { class: 'bar-list' }, [
        barRowRating('عاشقانه', avg(s.byCat.love), 'love'),
        barRowRating('خوب', avg(s.byCat.good), 'good'),
        barRowRating('نفرت‌انگیز', avg(s.byCat.hate), 'hate')
      ]),

      // نوع
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['انواع محتوا']),
      Utils.el('div', { class: 'bar-list' },
        Object.entries(s.types).map(([k, v]) =>
          barRow(CONFIG.TYPES[k] || k, v, s.total)
        )
      ),

      // ژانرهای برتر
      s.genres && Object.keys(s.genres).length
        ? Utils.el('div', {}, [
            Utils.el('h4', { class: 'mb-3 mt-4' }, ['ژانرهای برتر']),
            Utils.el('div', { class: 'bar-list' },
              Object.entries(s.genres)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([g, c]) => barRow(g, c, Math.max(...Object.values(s.genres))))
            )
          ])
        : null,

      // فعالیت اخیر
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['فعالیت اخیر']),
      Utils.el('div', { class: 'bar-list' }, DB.getActivity(10).map(a =>
        Utils.el('div', {
          class: 'flex justify-between items-center p-3 rounded',
          style: { background: 'var(--bg-2)', border: '1px solid var(--border-1)' }
        }, [
          Utils.el('div', { class: 'flex items-center gap-3' }, [
            Utils.el('span', { class: 'text-lg' }, [activityIcon(a.action)]),
            Utils.el('div', {}, [
              Utils.el('div', { class: 'text-sm text-1 font-bold' }, [activityLabel(a.action)]),
              a.detail ? Utils.el('div', { class: 'text-xs text-3' }, [Utils.esc(a.detail)]) : null
            ].filter(Boolean))
          ]),
          Utils.el('span', { class: 'text-xs text-4' }, [Utils.relativeTime(a.created_at)])
        ])
      ))
    ]);

    Modal.open({
      title: 'داشبورد آماری',
      icon: '📊',
      size: 'lg',
      body,
      footer: Utils.el('button', { class: 'btn btn-ghost', onclick: () => Modal.close() }, ['بستن'])
    });
  }

  function statBox(label, value, sub, cat) {
    return Utils.el('div', {
      class: 'stat-box',
      dataset: cat ? { cat } : {}
    }, [
      Utils.el('div', { class: 'stat-label' }, [label]),
      Utils.el('div', { class: 'stat-value' }, [value]),
      Utils.el('div', { class: 'stat-sub' }, [sub])
    ]);
  }

  function barRow(label, value, total, cat) {
    const pct = total ? Math.round(value / total * 100) : 0;
    return Utils.el('div', { class: 'bar-row' }, [
      Utils.el('span', { class: 'bar-label' }, [label]),
      Utils.el('div', { class: 'bar-track' }, [
        Utils.el('div', {
          class: 'bar-fill',
          dataset: cat ? { cat } : {},
          style: { width: '0%' }
        })
      ]),
      Utils.el('span', { class: 'bar-value' }, [Utils.toFa(value)])
    ]);
  }

  function barRowRating(label, value, cat) {
    const pct = Math.round(value / 10 * 100);
    return Utils.el('div', { class: 'bar-row' }, [
      Utils.el('span', { class: 'bar-label' }, [label]),
      Utils.el('div', { class: 'bar-track' }, [
        Utils.el('div', {
          class: 'bar-fill',
          dataset: { cat },
          style: { width: '0%' }
        })
      ]),
      Utils.el('span', { class: 'bar-value' }, [value ? Utils.toFa(value.toFixed(1)) : '—'])
    ]);
  }

  function avg(arr) {
    const rated = arr.filter(t => t.rating > 0);
    return rated.length ? rated.reduce((a, b) => a + b.rating, 0) / rated.length : 0;
  }

  function activityIcon(a) {
    return { create: '➕', update: '✏️', delete: '🗑️', seed: '🌱', import: '📥', sync: '🔄' }[a] || '•';
  }
  function activityLabel(a) {
    return { create: 'افزودن', update: 'ویرایش', delete: 'حذف', seed: 'راه‌اندازی', import: 'ورود داده', sync: 'همگام‌سازی' }[a] || a;
  }

  /* ---- انیمیشن بارها بعد از نمایش ---- */
  function animateBars(container) {
    container.querySelectorAll('.bar-fill').forEach(f => {
      const pct = f.parentElement.dataset.pct || null;
    });
  }

  return { openDashboard, build };
})();