/* =========================================================
   رندر کارت‌ها و اجزای رابط — UI v3
   Same public API as before (Render.cardHTML, starsHTML, …);
   only the markup changed. Colours come from CSS ([data-stars]),
   never from inline config values.
   ========================================================= */
window.Render = (function () {

  const TYPE_LABEL = CONFIG.TYPES;
  const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';

  const ICON = {
    tidy: '<path d="M4 7h16M4 12h10M4 17h7M15 17l2 2 4-4"/>',
    ai: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    del: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'
  };

  function icon(path, fill) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (fill || 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  /* ---- ستاره‌ها (برای ماژول‌های دیگر) ---- */
  function starsHTML(rating) {
    const n = Math.floor(Number(rating) || 0);
    if (n < 1) {
      return '<span class="stars stars-empty" title="بدون امتیاز"><span class="stars-empty-text">بدون امتیاز</span></span>';
    }
    const meta = CONFIG.STARS[n];
    let html = '<span class="stars" data-stars="' + n + '" title="' + (meta ? meta.label : '') + '">';
    for (let i = 1; i <= 5; i++) {
      html += '<svg class="star' + (i <= n ? ' filled' : '') + '" viewBox="0 0 24 24" fill="currentColor"><path d="' + STAR_PATH + '"/></svg>';
    }
    return html + '</span>';
  }

  /* ---- کارت: یک بلیت با شمارهٔ امتیاز در برگه ---- */
  function cardHTML(t, query) {
    const n = Math.floor(Number(t.rating) || 0);
    const meta = CONFIG.STARS[n];

    const bits = [];
    if (t.year) bits.push(Utils.toFa(t.year));
    if (t.type) bits.push(Utils.esc(TYPE_LABEL[t.type] || t.type));
    if (t.seasons) bits.push(Utils.toFa(t.seasons) + ' فصل');
    if (t.genre) bits.push(Utils.esc(t.genre));

    let badges = '';
    if (t.source === 'ai' || (t.notes && String(t.notes).indexOf('[AI') === 0)) {
      badges += '<span class="m-badge" title="افزوده‌شده توسط AI">AI</span>';
    }
    if (String(t.status || '') === 'will_watch') {
      badges += '<span class="m-badge" title="خواهم دید">در صف دیدن</span>';
    }
    if (t.ai_standardized_at) {
      badges += '<span class="m-badge" title="استانداردسازی‌شده با AI">استانداردشده</span>';
    }

    let pips = '';
    for (let i = 5; i >= 1; i--) pips += '<i' + (i <= n ? ' class="on"' : '') + '></i>';

    const body = (t.reason ? '<p class="m-reason">' + Utils.esc(t.reason) + '</p>' : '') +
      (t.notes ? '<p class="card-notes">' + Utils.esc(t.notes) + '</p>'
        : (t.summary && !t.reason ? '<p class="card-notes">' + Utils.esc(t.summary) + '</p>' : ''));

    return '' +
      '<article class="card r' + n + (t.favorite ? ' is-fav' : '') + '" data-id="' + t.id + '" data-rating="' + n + '" data-stars="' + n + '" tabindex="0">' +
        '<div class="m-stub" title="' + (meta ? meta.label : 'بدون امتیاز') + '">' +
          '<b>' + (n ? Utils.toFa(n) : '—') + '</b><span class="m-pips">' + pips + '</span>' +
        '</div>' +
        '<div class="m-body">' +
          '<h3 class="card-title">' + (t.favorite ? '<span class="m-fav" title="علاقه‌مندی">★</span>' : '') + Utils.highlight(t.title, query) + badges + '</h3>' +
          '<div class="m-meta">' + bits.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>' +
          body +
          '<div class="m-row">' +
            '<span class="m-time">' + Utils.relativeTime(t.created_at) + '</span>' +
            '<div class="card-actions">' +
              '<button class="card-act" data-act="standardize" title="استانداردسازی اطلاعات">' + icon(ICON.tidy) + '</button>' +
              '<button class="card-act" data-act="ai" title="تحلیل عمیق با AI">' + icon(ICON.ai) + '</button>' +
              '<button class="card-act' + (t.favorite ? ' is-fav' : '') + '" data-act="fav" title="علاقه‌مندی">' + icon('<path d="' + STAR_PATH + '"/>', t.favorite ? 'currentColor' : 'none') + '</button>' +
              '<button class="card-act" data-act="edit" title="ویرایش">' + icon(ICON.edit) + '</button>' +
              '<button class="card-act danger" data-act="delete" title="حذف">' + icon(ICON.del) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderGrid(container, items, query) {
    container.innerHTML = items.length
      ? items.map(function (t) { return cardHTML(t, query); }).join('')
      : '';
  }

  /* ---- شمارش ستاره‌ها در سایدبار ---- */
  function renderSidebarCounts() {
    const counts = DB.getStarCounts();
    document.querySelectorAll('[data-star-count]').forEach(function (el) {
      const k = el.dataset.starCount;
      const v = k === 'all' ? counts.all : counts[Number(k)] || 0;
      el.textContent = Utils.toFa(v);
    });
    const stat = DB.getStats();
    const set = function (id, v) { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('mini-total', Utils.toFa(stat.totals.count));
    set('mini-avg', stat.totals.avgRating ? Utils.toFa(stat.totals.avgRating.toFixed(1)) : '—');
    set('mini-fav', Utils.toFa(stat.totals.favorites || 0));
  }

  function renderPageTitle() {
    const s = State.get();
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    let title = 'همه‌ی عنوان‌ها';
    if (s.starFilter !== 'all') {
      const n = Number(s.starFilter);
      const meta = CONFIG.STARS[n];
      title = n === 0 ? 'بدون امتیاز' : (meta ? meta.label : n + ' ستاره');
    }
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = Utils.toFa(s.filtered.length) + ' مورد';
  }

  function toggleEmpty(show) {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty-state');
    if (!grid || !empty) return;
    grid.hidden = show;
    empty.hidden = !show;
  }

  return {
    cardHTML: cardHTML,
    starsHTML: starsHTML,
    renderGrid: renderGrid,
    renderSidebarCounts: renderSidebarCounts,
    renderPageTitle: renderPageTitle,
    toggleEmpty: toggleEmpty
  };
})();
