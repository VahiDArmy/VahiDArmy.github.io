/* =========================================================
   داشبورد آماری — بر اساس ستاره
   ========================================================= */
window.Stats = (function () {

  function build() {
    const titles = DB.getAllTitles();
    const total = titles.length;
    const byStars = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
    titles.forEach(function (t) {
      const s = Math.floor(Number(t.rating) || 0);
      if (byStars[s]) byStars[s].push(t);
    });
    const rated = titles.filter(function (t) { return t.rating > 0; });
    const avgAll = rated.length ? rated.reduce(function (a, b) { return a + (b.rating || 0); }, 0) / rated.length : 0;
    const favs = titles.filter(function (t) { return t.favorite; }).length;
    const types = {};
    titles.forEach(function (t) { types[t.type] = (types[t.type] || 0) + 1; });
    return { titles: titles, total: total, byStars: byStars, rated: rated, avgAll: avgAll, favs: favs, types: types };
  }

  function openDashboard() {
    const s = build();

    const statBoxes = [
      statBox('کل عنوان‌ها', Utils.toFa(s.total), 'در آرشیو'),
      statBox('میانگین ستاره', s.avgAll ? Utils.toFa(s.avgAll.toFixed(1)) + ' / ۵' : '—', Utils.toFa(s.rated.length) + ' عنوان امتیازدار'),
      statBox('علاقه‌مندی‌ها', Utils.toFa(s.favs), Utils.toFa(Math.round(s.favs / Math.max(s.total, 1) * 100)) + '٪ از کل'),
      statBox('انواع', String(Object.keys(s.types).length), 'نوع محتوا')
    ];

    const distBars = [];
    const maxCount = Math.max.apply(null, [1].concat(Object.keys(s.byStars).map(function (k) { return s.byStars[k].length; })));

    [5, 4, 3, 2, 1].forEach(function (n) {
      const meta = CONFIG.STARS[n];
      const count = s.byStars[n].length;
      const pct = (count / maxCount) * 100;
      distBars.push(Utils.el('div', { class: 'bar-row' }, [
        Utils.el('span', { class: 'bar-label', style: { color: meta.color } }, [
          meta.emoji + ' ' + meta.label
        ]),
        Utils.el('div', { class: 'bar-track' }, [
          Utils.el('div', {
            class: 'bar-fill',
            style: { width: '0%', background: meta.color, boxShadow: '0 0 12px ' + (meta.glow || 'transparent') },
            'data-pct': pct
          })
        ]),
        Utils.el('span', { class: 'bar-value' }, [Utils.toFa(count)])
      ]));
    });
    /* بدون امتیاز */
    const unrated = s.byStars[0].length;
    if (unrated > 0) {
      distBars.push(Utils.el('div', { class: 'bar-row' }, [
        Utils.el('span', { class: 'bar-label' }, ['○ بدون امتیاز']),
        Utils.el('div', { class: 'bar-track' }, [
          Utils.el('div', {
            class: 'bar-fill',
            style: { width: '0%', background: '#5a5a72' },
            'data-pct': (unrated / maxCount) * 100
          })
        ]),
        Utils.el('span', { class: 'bar-value' }, [Utils.toFa(unrated)])
      ]));
    }

    const typesBars = Object.keys(s.types).map(function (k) {
      const count = s.types[k];
      const pct = (count / Math.max(s.total, 1)) * 100;
      return Utils.el('div', { class: 'bar-row' }, [
        Utils.el('span', { class: 'bar-label' }, [CONFIG.TYPES[k] || k]),
        Utils.el('div', { class: 'bar-track' }, [
          Utils.el('div', { class: 'bar-fill', style: { width: '0%' }, 'data-pct': pct })
        ]),
        Utils.el('span', { class: 'bar-value' }, [Utils.toFa(count)])
      ]);
    });

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'stats-grid' }, statBoxes),
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['توزیع ستاره‌ها']),
      Utils.el('div', { class: 'bar-list' }, distBars),
      typesBars.length ? Utils.el('h4', { class: 'mb-3 mt-4' }, ['انواع محتوا']) : null,
      typesBars.length ? Utils.el('div', { class: 'bar-list' }, typesBars) : null,
      Utils.el('h4', { class: 'mb-3 mt-4' }, ['فعالیت اخیر']),
      Utils.el('div', { class: 'bar-list' }, DB.getActivity(10).map(function (a) {
        return Utils.el('div', {
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
        ]);
      }))
    ].filter(Boolean));

    Modal.open({
      title: 'داشبورد آماری',
      icon: '📊',
      size: 'lg',
      body: body,
      footer: Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['بستن'])
    });

    /* انیمیشن نوارها */
    setTimeout(function () {
      const root = document.getElementById('modal-root');
      if (!root) return;
      root.querySelectorAll('.bar-fill').forEach(function (f) {
        f.style.width = (f.dataset.pct || 0) + '%';
      });
    }, 80);
  }

  function statBox(label, value, sub) {
    return Utils.el('div', { class: 'stat-box' }, [
      Utils.el('div', { class: 'stat-label' }, [label]),
      Utils.el('div', { class: 'stat-value' }, [value]),
      Utils.el('div', { class: 'stat-sub' }, [sub])
    ]);
  }

  function activityIcon(a) {
    return { create: '➕', update: '✏️', delete: '🗑️', restore: '↩️', seed: '🌱', import: '📥', sync: '🔄', migrate: '🔀' }[a] || '•';
  }
  function activityLabel(a) {
    return { create: 'افزودن', update: 'ویرایش', delete: 'حذف', restore: 'بازگردانی', seed: 'راه‌اندازی', import: 'ورود داده', sync: 'همگام‌سازی', migrate: 'مهاجرت' }[a] || a;
  }

  return { openDashboard: openDashboard, build: build };
})();