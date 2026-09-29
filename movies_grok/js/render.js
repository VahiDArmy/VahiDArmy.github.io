/* =========================================================
   رندر کارت‌ها و اجزای رابط
   ========================================================= */
window.Render = (function () {

  const TYPE_LABEL = CONFIG.TYPES;

  /* ---- ساخت یک ستاره SVG ---- */
  function starSvg(filled, color) {
    const cls = filled ? 'star filled' : 'star';
    const fill = filled ? color : 'currentColor';
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor" stroke-width="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  }

  /* ---- رندر ۵ ستاره بر اساس rating ---- */
  function starsHTML(rating) {
    const n = Math.floor(Number(rating) || 0);
    if (n < 1) {
      /* بدون امتیاز */
      return '<span class="stars stars-empty" title="بدون امتیاز">' +
        '<span class="stars-empty-text">بدون امتیاز</span></span>';
    }
    const meta = CONFIG.STARS[n];
    const color = meta ? meta.color : 'var(--star-3)';
    let html = '<span class="stars" data-stars="' + n + '" title="' + (meta ? meta.label : '') + '" style="--star-color: ' + color + '">';
    for (let i = 1; i <= 5; i++) {
      html += starSvg(i <= n, color);
    }
    html += '</span>';
    return html;
  }

  /* ---- کارت ---- */
  function cardHTML(t, query) {
    const favCls = t.favorite ? 'is-fav' : '';
    const titleHtml = Utils.highlight(t.title, query);
    const metaParts = [];
    if (t.year) metaParts.push('<span>' + Utils.toFa(t.year) + '</span>');
    if (t.type) metaParts.push('<span>' + (TYPE_LABEL[t.type] || t.type) + '</span>');
    if (t.seasons) metaParts.push('<span>' + Utils.toFa(t.seasons) + ' فصل</span>');
    if (t.genre) metaParts.push('<span>' + Utils.esc(t.genre) + '</span>');

    const aiBadge = t.ai_standardized_at
      ? '<span class="ai-badge" title="استانداردسازی‌شده با AI">🪄</span>'
      : '';

    const rating = Math.floor(Number(t.rating) || 0);
    const ratingCls = rating >= 1 ? 'rating-' + rating : 'rating-none';

    const reasonBlock = t.reason
      ? '<div class="card-reason" data-stars="' + rating + '">' +
          '<span class="card-reason-icon">' + reasonIcon(rating) + '</span>' +
          '<span class="card-reason-text">' + Utils.esc(t.reason) + '</span>' +
        '</div>'
      : '';

    return [
      '<article class="card ' + favCls + ' ' + ratingCls + '" data-id="' + t.id + '" data-rating="' + rating + '" tabindex="0">',
      '  <header class="card-head">',
      '    <div class="card-title-wrap">',
      '      <h3 class="card-title">' + titleHtml + aiBadge + '</h3>',
      '      <div class="card-meta">' + metaParts.join('<span class="dot"></span>') + '</div>',
      '    </div>',
      '    <div class="card-actions">',
      '      <button class="card-act" data-act="ai" title="تحلیل با AI">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
      '      </button>',
      '      <button class="card-act ' + (t.favorite ? 'is-fav' : '') + '" data-act="fav" title="علاقه‌مندی">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="' + (t.favorite ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
      '      </button>',
      '      <button class="card-act" data-act="edit" title="ویرایش">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
      '      </button>',
      '      <button class="card-act danger" data-act="delete" title="حذف">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
      '      </button>',
      '    </div>',
      '  </header>',
      '  <div class="card-body">',
      '    ' + reasonBlock,
      (t.notes ? '<p class="card-notes">' + Utils.esc(t.notes) + '</p>' : ''),
      (!t.notes && t.summary && !t.reason ? '<p class="card-notes">' + Utils.esc(t.summary) + '</p>' : ''),
      '  </div>',
      '  <footer class="card-foot">',
      '    <div class="flex items-center gap-2">' + starsHTML(t.rating) + '</div>',
      '    <span class="text-4 text-xs">' + Utils.relativeTime(t.created_at) + '</span>',
      '  </footer>',
      '</article>'
    ].join('');
  }

  function reasonIcon(rating) {
    if (rating >= 5) return '🏆';
    if (rating === 4) return '👍';
    if (rating === 3) return '😐';
    if (rating === 2) return '👎';
    if (rating === 1) return '💔';
    return '💬';
  }

  function renderGrid(container, items, query) {
    if (!items.length) { container.innerHTML = ''; return; }
    container.innerHTML = items.map(function (t) { return cardHTML(t, query); }).join('');
    Utils.stagger(Array.from(container.children), 22, 260);
    container.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
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
    const tEl = document.getElementById('mini-total');
    const aEl = document.getElementById('mini-avg');
    const fEl = document.getElementById('mini-fav');
    if (tEl) tEl.textContent = Utils.toFa(stat.totals.count);
    if (aEl) aEl.textContent = stat.totals.avgRating ? Utils.toFa(stat.totals.avgRating.toFixed(1)) : '—';
    if (fEl) fEl.textContent = Utils.toFa(stat.totals.favorites || 0);
  }

  function renderPageTitle() {
    const s = State.get();
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    let title = 'همه';
    if (s.starFilter !== 'all') {
      const n = Number(s.starFilter);
      if (n === 0) title = 'بدون امتیاز';
      else {
        const meta = CONFIG.STARS[n];
        title = (meta ? meta.emoji : '') + ' ' + (meta ? meta.label : n + ' ستاره');
      }
    } else {
      title = '📽️ همه‌ی عنوان‌ها';
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