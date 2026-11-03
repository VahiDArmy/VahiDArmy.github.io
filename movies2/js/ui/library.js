/* =========================================================
   Library view — browse, filter, sort, switch density
   ========================================================= */
(function (UI) {
  'use strict';

  var mounts = {};

  function s() { return State.get(); }

  function titleFor() {
    var st = s();
    if (st.starFilter !== 'all') {
      var meta = UI.starMeta(Number(st.starFilter));
      return (Number(st.starFilter) === 0 ? 'بدون امتیاز' : meta.label + ' — ' + UI.fa(st.starFilter) + ' ستاره');
    }
    if (st.onlyFav) return 'علاقه‌مندی‌ها';
    if (st.onlyRated) return 'امتیازداده‌شده‌ها';
    if (st.filterType !== 'all') return UI.typeLabel(st.filterType) + '‌ها';
    return 'همهٔ عنوان‌ها';
  }

  function averageOf(list) {
    var rated = list.filter(function (t) { return Number(t.rating) > 0; });
    if (!rated.length) return null;
    return rated.reduce(function (a, t) { return a + Number(t.rating); }, 0) / rated.length;
  }

  function badgesFor(t) {
    var out = [];
    if (t.favorite) out.push('<span class="badge badge--fav">' + UI.icon('heart') + 'علاقه‌مندی</span>');
    if (t.status === 'will_watch') out.push('<span class="badge">خواهم دید</span>');
    if (t.ai_standardized_at) out.push('<span class="badge badge--ai">' + UI.icon('wand') + 'AI</span>');
    return out.join('');
  }

  function cardHTML(t, query) {
    var rating = Math.floor(Number(t.rating) || 0);
    var meta = UI.starMeta(rating);
    var bits = [];
    if (t.year) bits.push(UI.fa(t.year));
    bits.push(UI.typeLabel(t.type));
    if (t.seasons) bits.push(UI.fa(t.seasons) + ' فصل');
    if (t.genre) bits.push(UI.esc(t.genre));

    var reason = t.reason || '';
    var notes = t.notes || '';
    var hasReason = reason.trim().length > 0;
    var hasNotes = notes.trim().length > 0;

    return [
      '<article class="tile' + (t.favorite ? ' is-fav' : '') + '" data-id="' + UI.esc(t.id) + '" ' +
        'style="--star:' + meta.color + '" tabindex="0" role="button" aria-label="' + UI.esc(t.title) + '">',
      '  <div class="tile__rate">',
      '    <b>' + (rating ? UI.fa(rating) : '—') + '</b><span>' + UI.meter(rating) + '</span>',
      '  </div>',
      '  <div class="tile__body">',
      '    <h3 class="tile__title">' + UI.highlight(t.title, query) + '</h3>',
      '    <p class="tile__meta">' + bits.join('<span class="dot"></span>') + '</p>',
      hasReason ? '    <p class="tile__reason">' + '<span class="tile__reasonlabel">چرا</span>' + UI.esc(reason) + '</p>' : '',
      (!hasReason && hasNotes) ? '    <p class="tile__notes">' + UI.esc(notes) + '</p>' : '',
      (hasReason && hasNotes) ? '    <p class="tile__notes">' + UI.esc(notes) + '</p>' : '',
      '  </div>',
      '  <div class="tile__foot">',
      '    <div class="tile__badges">' + badgesFor(t) + '</div>',
      '    <time>' + UI.esc(UI.timeAgo(t.created_at)) + '</time>',
      '  </div>',
      '  <button class="tile__fav" type="button" data-act="fav" aria-label="علاقه‌مندی" title="علاقه‌مندی">' + UI.icon('heart') + '</button>',
      '</article>'
    ].join('');
  }

  function rowHTML(t, query) {
    var rating = Math.floor(Number(t.rating) || 0);
    var meta = UI.starMeta(rating);
    var bits = [];
    if (t.year) bits.push(UI.fa(t.year));
    bits.push(UI.typeLabel(t.type));
    if (t.seasons) bits.push(UI.fa(t.seasons) + ' فصل');
    if (t.genre) bits.push(UI.esc(t.genre));

    return [
      '<article class="rowitem' + (t.favorite ? ' is-fav' : '') + '" data-id="' + UI.esc(t.id) + '" ' +
        'style="--star:' + meta.color + '" tabindex="0" role="button" aria-label="' + UI.esc(t.title) + '">',
      '  <div class="rowitem__rate"><b>' + (rating ? UI.fa(rating) : '—') + '</b>' + UI.meter(rating) + '</div>',
      '  <div class="rowitem__main">',
      '    <h3 class="rowitem__title">' + UI.highlight(t.title, query) + '</h3>',
      '    <p class="rowitem__meta">' + bits.join('<span class="dot"></span>') + '</p>',
      '  </div>',
      '  <p class="rowitem__reason">' + (t.reason ? UI.esc(t.reason) : (t.notes ? UI.esc(t.notes) : '—')) + '</p>',
      '  <div class="rowitem__foot">',
      '    <div class="tile__badges">' + badgesFor(t) + '</div>',
      '    <time>' + UI.esc(UI.timeAgo(t.created_at)) + '</time>',
      '  </div>',
      '  <button class="rowitem__fav" type="button" data-act="fav" aria-label="علاقه‌مندی" title="علاقه‌مندی">' + UI.icon('heart') + '</button>',
      '</article>'
    ].join('');
  }

  function toolbarHTML() {
    var st = s();
    var dirty = st.filterType !== 'all' || st.onlyFav || st.onlyRated || st.search || st.starFilter !== 'all' || st.sort !== 'recent';
    return [
      '<div class="toolbar">',
      '  <div class="toolbar__group">',
      '    <label class="field field--inline">',
      '      <span class="field__label">نوع</span>',
      '      <select class="select" data-filter="type">',
      '        <option value="all"' + (st.filterType === 'all' ? ' selected' : '') + '>همه</option>',
      Object.keys(CONFIG.TYPES).map(function (key) {
        return '<option value="' + key + '"' + (st.filterType === key ? ' selected' : '') + '>' + UI.esc(CONFIG.TYPES[key]) + '</option>';
      }).join(''),
      '      </select>',
      '    </label>',
      '    <label class="field field--inline">',
      '      <span class="field__label">ترتیب</span>',
      '      <select class="select" data-filter="sort">',
      '        <option value="recent"' + (st.sort === 'recent' ? ' selected' : '') + '>تازه‌ترین</option>',
      '        <option value="oldest"' + (st.sort === 'oldest' ? ' selected' : '') + '>قدیمی‌ترین</option>',
      '        <option value="rating-desc"' + (st.sort === 'rating-desc' ? ' selected' : '') + '>بیشترین ستاره</option>',
      '        <option value="rating-asc"' + (st.sort === 'rating-asc' ? ' selected' : '') + '>کمترین ستاره</option>',
      '        <option value="title-asc"' + (st.sort === 'title-asc' ? ' selected' : '') + '>نام (الف تا ی)</option>',
      '        <option value="title-desc"' + (st.sort === 'title-desc' ? ' selected' : '') + '>نام (ی تا الف)</option>',
      '        <option value="year-desc"' + (st.sort === 'year-desc' ? ' selected' : '') + '>سال ساخت</option>',
      '      </select>',
      '    </label>',
      '  </div>',
      '  <div class="toolbar__group">',
      '    <button class="chip' + (st.onlyFav ? ' is-on' : '') + '" data-filter="fav" type="button">' + UI.icon('heart') + 'علاقه‌مندی‌ها</button>',
      '    <button class="chip' + (st.onlyRated ? ' is-on' : '') + '" data-filter="rated" type="button">' + UI.icon('star') + 'امتیازداده‌شده</button>',
      dirty ? '    <button class="chip chip--clear" data-filter="reset" type="button">' + UI.icon('close') + 'پاک کردن فیلترها</button>' : '',
      '  </div>',
      '</div>'
    ].join('');
  }

  function render(root) {
    mounts.root = root;
    root.innerHTML = [
      '<header class="viewhead">',
      '  <div class="viewhead__titles">',
      '    <h1 class="viewtitle" data-lib-title>' + UI.esc(titleFor()) + '</h1>',
      '    <p class="viewsub" data-lib-sub></p>',
      '  </div>',
      '  <div class="viewhead__actions">',
      '    <div class="seg" role="group" aria-label="چیدمان">',
      '      <button class="seg__btn' + (s().view === 'grid' ? ' is-on' : '') + '" data-view="grid" type="button" title="کارتی">' + UI.icon('grid') + '</button>',
      '      <button class="seg__btn' + (s().view === 'list' ? ' is-on' : '') + '" data-view="list" type="button" title="لیستی">' + UI.icon('list') + '</button>',
      '    </div>',
      '    <button class="btn is-primary" data-act="new" type="button">' + UI.icon('plus') + 'افزودن عنوان</button>',
      '  </div>',
      '</header>',
      '<div data-lib-toolbar>' + toolbarHTML() + '</div>',
      '<div class="lib" data-lib-list></div>',
      '<div class="empty" data-lib-empty hidden>',
      '  <span class="empty__icon">' + UI.icon('film') + '</span>',
      '  <h2>اینجا خالی است</h2>',
      '  <p data-lib-empty-text>هنوز عنوانی اضافه نشده یا فیلترها چیزی باقی نگذاشته‌اند.</p>',
      '  <div class="empty__actions">',
      '    <button class="btn is-primary" data-act="new" type="button">' + UI.icon('plus') + 'افزودن عنوان</button>',
      '    <button class="btn is-quiet" data-act="reset" type="button">پاک کردن فیلترها</button>',
      '  </div>',
      '</div>'
    ].join('');

    if (root.dataset.bound !== '1') {
      root.dataset.bound = '1';
      bind(root);
    }
    UI.Library.renderList();
  }

  function bind(root) {
    UI.on(root, 'click', '[data-act="new"]', function () { UI.Item.openForm(null); });
    UI.on(root, 'click', '[data-act="reset"]', function () { resetFilters(); });
    UI.on(root, 'click', '[data-filter]', function (ev, target) {
      /* selects are handled on change — clicking one must not re-render the toolbar */
      if (target.tagName === 'SELECT') return;
      var key = target.dataset.filter;
      if (key === 'reset') return resetFilters();
      if (key === 'fav') { s().onlyFav = !s().onlyFav; }
      if (key === 'rated') { s().onlyRated = !s().onlyRated; }
      apply();
    });
    UI.on(root, 'change', 'select[data-filter]', function (ev, target) {
      if (target.dataset.filter === 'type') s().filterType = target.value;
      if (target.dataset.filter === 'sort') s().sort = target.value;
      apply();
    });
    UI.on(root, 'click', '[data-view]', function (ev, target) {
      State.setView(target.dataset.view);
      UI.qsa('.seg__btn[data-view]', root).forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.view === target.dataset.view);
      });
      UI.Library.renderList();
    });
    UI.on(root, 'click', '.tile, .rowitem', function (ev, target) {
      if (ev.target.closest('[data-act="fav"]')) return;
      UI.Item.openDetail(target.dataset.id);
    });
    UI.on(root, 'keydown', '.tile, .rowitem', function (ev, target) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); UI.Item.openDetail(target.dataset.id); }
    });
    UI.on(root, 'click', '[data-act="fav"]', function (ev, target) {
      ev.stopPropagation();
      var card = target.closest('[data-id]');
      if (!card) return;
      State.toggleFavorite(card.dataset.id);
      App.refresh();
    });
  }

  function resetFilters() {
    State.set({ filterType: 'all', onlyFav: false, onlyRated: false, starFilter: 'all', search: '', sort: 'recent' });
    State.setStarFilter('all');
    if (App.setSearch) App.setSearch('');
    State.applyFilters();
    var tb = UI.qs('[data-lib-toolbar]');
    if (tb) tb.innerHTML = toolbarHTML();
    UI.Library.renderList();
    App.refreshNav();
  }

  function apply() {
    State.applyFilters();
    var tb = UI.qs('[data-lib-toolbar]');
    if (tb) tb.innerHTML = toolbarHTML();
    UI.Library.renderList();
    App.refreshNav();
  }

  function renderList() {
    var list = UI.qs('[data-lib-list]');
    if (!list) return;
    var st = s();
    var items = st.filtered || [];
    var query = st.search || '';
    var view = st.view === 'list' ? 'list' : 'grid';

    list.className = 'lib lib--' + view;
    list.innerHTML = items.map(function (t) {
      return view === 'list' ? rowHTML(t, query) : cardHTML(t, query);
    }).join('');

    var empty = UI.qs('[data-lib-empty]');
    var hasAny = (st.titles || []).length > 0;
    if (empty) {
      empty.hidden = items.length > 0;
      var text = UI.qs('[data-lib-empty-text]');
      if (text) {
        text.textContent = hasAny
          ? 'هیچ عنوانی با این فیلترها پیدا نشد.'
          : 'هنوز عنوانی اضافه نشده. با دکمهٔ پایین شروع کن.';
      }
    }
    if (items.length) UI.qsa('.tile, .rowitem', list).forEach(function (node) {
      node.classList.add('is-in');
    });

    var titleEl = UI.qs('[data-lib-title]');
    var subEl = UI.qs('[data-lib-sub]');
    if (titleEl) titleEl.textContent = titleFor();
    if (subEl) {
      var avg = averageOf(items);
      subEl.textContent = UI.fa(items.length) + ' عنوان' +
        (avg ? ' · میانگین ' + UI.fa(avg.toFixed(1)) : '') +
        ' · ' + UI.fa((st.titles || []).filter(function (t) { return t.favorite; }).length) + ' علاقه‌مندی';
    }
  }

  UI.Library = { render: render, renderList: renderList, refresh: apply };
})(window.UI);
