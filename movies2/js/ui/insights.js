/* =========================================================
   Insights — the archive at a glance
   ========================================================= */
(function (UI) {
  'use strict';

  function tally(list, keyFn) {
    return list.reduce(function (acc, item) {
      var k = keyFn(item);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  function kpi(label, value, note) {
    return '<div class="kpi">' +
      '<span class="kpi__label">' + UI.esc(label) + '</span>' +
      '<strong class="kpi__value">' + UI.esc(value) + '</strong>' +
      (note ? '<span class="kpi__note">' + UI.esc(note) + '</span>' : '') +
      '</div>';
  }

  function bars(rows, max) {
    return '<div class="dist">' + rows.map(function (row) {
      var pct = max ? Math.round((row.value / max) * 100) : 0;
      return '<div class="dist__row">' +
        '<span class="dist__label">' + row.label + '</span>' +
        '<span class="dist__track"><span class="dist__fill" style="width:' + pct + '%;' + (row.style || '') + '"></span></span>' +
        '<span class="dist__value">' + UI.fa(row.value) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function weeks(titles) {
    var now = new Date();
    var buckets = [];
    for (var i = 11; i >= 0; i--) {
      var end = new Date(now.getTime() - i * 7 * 86400000);
      var start = new Date(end.getTime() - 7 * 86400000);
      buckets.push({ start: start, end: end, count: 0 });
    }
    titles.forEach(function (t) {
      var d = new Date(t.created_at || t.updated_at || 0);
      if (isNaN(d)) return;
      for (var i = 0; i < buckets.length; i++) {
        if (d > buckets[i].start && d <= buckets[i].end) { buckets[i].count++; break; }
      }
    });
    return buckets;
  }

  function render(root) {
    var titles = State.get().titles || [];
    var rated = titles.filter(function (t) { return Number(t.rating) > 0; });
    var favorites = titles.filter(function (t) { return t.favorite; });
    var willWatch = titles.filter(function (t) { return t.status === 'will_watch'; });
    var avg = rated.length ? rated.reduce(function (a, t) { return a + Number(t.rating); }, 0) / rated.length : 0;

    var starCounts = tally(titles, function (t) { return Math.floor(Number(t.rating) || 0); });
    var starRows = [5, 4, 3, 2, 1, 0].map(function (n) {
      var meta = UI.starMeta(n);
      return {
        label: n === 0 ? 'بدون امتیاز' : UI.fa(n) + ' ستاره',
        value: starCounts[n] || 0,
        style: 'background:' + meta.color
      };
    });
    var starMax = Math.max.apply(null, starRows.map(function (r) { return r.value; }).concat([1]));

    var typeCounts = tally(titles, function (t) { return t.type || 'series'; });
    var typeRows = Object.keys(CONFIG.TYPES).map(function (key) {
      return { label: CONFIG.TYPES[key], value: typeCounts[key] || 0 };
    });
    var typeMax = Math.max.apply(null, typeRows.map(function (r) { return r.value; }).concat([1]));

    var genreCounts = tally(titles.filter(function (t) { return t.genre; }), function (t) { return t.genre; });
    var genreRows = Object.keys(genreCounts)
      .map(function (k) { return { label: k, value: genreCounts[k] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 6);
    var genreMax = Math.max.apply(null, genreRows.map(function (r) { return r.value; }).concat([1]));

    var spark = weeks(titles);
    var sparkMax = Math.max.apply(null, spark.map(function (b) { return b.count; }).concat([1]));

    var top = titles.slice()
      .filter(function (t) { return Number(t.rating) >= 4; })
      .sort(function (a, b) { return (Number(b.rating) - Number(a.rating)) || (new Date(b.created_at) - new Date(a.created_at)); })
      .slice(0, 6);

    var profile = CONFIG.TASTE_PROFILE || {};

    root.innerHTML = [
      '<header class="viewhead">',
      '  <div class="viewhead__titles">',
      '    <h1 class="viewtitle">تحلیل و آمار</h1>',
      '    <p class="viewsub">تصویری از ' + UI.fa(titles.length) + ' عنوان ثبت‌شده در آرشیو</p>',
      '  </div>',
      '</header>',

      '<div class="kpis">',
      kpi('کل عنوان‌ها', UI.fa(titles.length), UI.fa(rated.length) + ' امتیازداده‌شده'),
      kpi('میانگین امتیاز', avg ? UI.fa(avg.toFixed(1)) : '—', 'از ۵'),
      kpi('علاقه‌مندی‌ها', UI.fa(favorites.length), UI.fa(titles.length ? Math.round(favorites.length / titles.length * 100) : 0) + '٪ آرشیو'),
      kpi('در انتظار تماشا', UI.fa(willWatch.length), 'فهرست «خواهم دید»'),
      '</div>',

      '<div class="panels panels--2">',
      '  <section class="panel"><h2 class="panel__title">پراکندگی امتیاز</h2>' + bars(starRows, starMax) + '</section>',
      '  <section class="panel"><h2 class="panel__title">ترکیب انواع</h2>' + bars(typeRows, typeMax) + '</section>',
      '</div>',

      '<div class="panels panels--2">',
      '  <section class="panel"><h2 class="panel__title">فعالیت ۱۲ هفتهٔ اخیر</h2>',
      '    <div class="spark">' + spark.map(function (b) {
        var h = Math.round((b.count / sparkMax) * 100);
        return '<span class="spark__bar" style="height:' + Math.max(h, 3) + '%" title="' + UI.esc(Utils.toJalali(b.end)) + ' — ' + UI.fa(b.count) + ' عنوان"></span>';
      }).join('') + '</div>',
      '    <p class="muted">جمع این دوره: ' + UI.fa(spark.reduce(function (a, b) { return a + b.count; }, 0)) + ' عنوان</p>',
      '  </section>',
      '  <section class="panel"><h2 class="panel__title">بهترین‌ها</h2>',
      top.length ? '    <ol class="toplist">' + top.map(function (t, i) {
        return '<li class="toplist__item" data-id="' + UI.esc(t.id) + '">' +
          '<span class="toplist__rank">' + UI.fa(i + 1) + '</span>' +
          '<span class="toplist__main"><strong>' + UI.esc(t.title) + '</strong>' +
          '<span class="muted">' + [t.year ? UI.fa(t.year) : '', UI.typeLabel(t.type)].filter(Boolean).join(' · ') + '</span></span>' +
          '<span class="toplist__rate" style="--star:' + UI.starMeta(t.rating).color + '">' + UI.fa(Math.floor(Number(t.rating) || 0)) + '</span>' +
          '</li>';
      }).join('') + '</ol>' : '    <p class="muted">هنوز عنوانی با امتیاز ۴ یا ۵ نداری.</p>',
      '  </section>',
      '</div>',

      '<div class="panels panels--2">',
      '  <section class="panel"><h2 class="panel__title">ژانرهای پرتکرار</h2>',
      genreRows.length ? bars(genreRows, genreMax) : '<p class="muted">ژانری ثبت نشده.</p>',
      '  </section>',
      '  <section class="panel"><h2 class="panel__title">معیار سلیقه</h2>',
      '    <p class="lead">' + UI.esc(profile.manifesto || '') + '</p>',
      '    <div class="tastecols">',
      '      <div><h3 class="tastecols__title is-good">می‌پسندم</h3><ul class="tightlist">' +
        (profile.loves || []).slice(0, 5).map(function (x) { return '<li>' + UI.esc(x) + '</li>'; }).join('') + '</ul></div>',
      '      <div><h3 class="tastecols__title is-bad">می‌راندم</h3><ul class="tightlist">' +
        (profile.hates || []).slice(0, 5).map(function (x) { return '<li>' + UI.esc(x) + '</li>'; }).join('') + '</ul></div>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('');

    if (root.dataset.bound !== '1') {
      root.dataset.bound = '1';
      UI.on(root, 'click', '.toplist__item', function (ev, target) {
        UI.Item.openDetail(target.dataset.id);
      });
    }
  }

  UI.Insights = { render: render };
})(window.UI);
