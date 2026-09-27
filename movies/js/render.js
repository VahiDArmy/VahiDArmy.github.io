/* =========================================================
   رندر کارت‌ها و اجزای رابط
   ========================================================= */
window.Render = (function () {

  const CAT_LABEL = { love: '❤️ عاشقانه', good: '👍 خوب', hate: '👎 نفرت‌انگیز' };
  const TYPE_LABEL = CONFIG.TYPES;

  /* ---- ستاره‌ها ---- */
  function starsHTML(rating) {
    const full = Math.floor(rating / 2);
    const half = (rating / 2) - full >= 0.5;
    let html = '';
    for (let i = 0; i < 5; i++) {
      if (i < full) html += starSvg(true);
      else if (i === full && half) html += starSvg('half');
      else html += starSvg(false);
    }
    return `<span class="stars">${html}</span>`;
  }
  function starSvg(mode) {
    const cls = mode === true ? 'star filled' : mode === 'half' ? 'star half' : 'star';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
  }

  /* ---- کارت ---- */
  function cardHTML(t, query = '') {
    const cat = t.category;
    const favCls = t.favorite ? 'is-fav' : '';
    const titleHtml = Utils.highlight(t.title, query);
    const genreParts = [];
    if (t.year) genreParts.push(`<span>${Utils.toFa(t.year)}</span>`);
    if (t.type) genreParts.push(`<span>${TYPE_LABEL[t.type] || t.type}</span>`);
    if (t.genre) genreParts.push(`<span>${Utils.esc(t.genre)}</span>`);

    return `
    <article class="card ${favCls}" data-id="${t.id}" data-category="${cat}" tabindex="0">
      <header class="card-head">
        <div class="card-title-wrap">
          <h3 class="card-title">${titleHtml}</h3>
          <div class="card-meta">
            <span class="cat-badge" data-cat="${cat}">${CAT_LABEL[cat] || cat}</span>
            ${genreParts.length ? genreParts.join('<span class="dot"></span>') : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="card-act ${t.favorite ? 'is-fav' : ''}" data-act="fav" title="علاقه‌مندی" aria-label="علاقه‌مندی">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="${t.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
          </button>
          <button class="card-act" data-act="edit" title="ویرایش" aria-label="ویرایش">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="card-act danger" data-act="delete" title="حذف" aria-label="حذف">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </button>
        </div>
      </header>
      <div class="card-body">
        ${t.notes ? `<p class="card-notes">${Utils.esc(t.notes)}</p>` : ''}
      </div>
      <footer class="card-foot">
        <div class="flex items-center gap-2">
          ${starsHTML(t.rating)}
          ${t.rating > 0 ? `<span class="rating-num">${Utils.toFa(t.rating.toFixed(1))}</span>` : '<span class="text-4 text-xs">امتیاز ندارد</span>'}
        </div>
        <span class="text-4 text-xs">${Utils.relativeTime(t.created_at)}</span>
      </footer>
    </article>`;
  }

  /* ---- رندر گرید ---- */
  function renderGrid(container, items, query = '') {
    if (!items.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = items.map(t => cardHTML(t, query)).join('');
    // استاگر انیمیشن
    Utils.stagger(Array.from(container.children), 22, 260);
    // ردیابی موس روی کارت‌ها
    container.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---- رندر آمار سایدبار ---- */
  function renderSidebarCounts() {
    const counts = DB.getCounts();
    document.querySelectorAll('[data-count]').forEach(el => {
      const k = el.dataset.count;
      el.textContent = Utils.toFa(counts[k] || 0);
    });
    const stat = DB.getStats();
    const totalEl = document.getElementById('mini-total');
    const avgEl = document.getElementById('mini-avg');
    const favEl = document.getElementById('mini-fav');
    if (totalEl) totalEl.textContent = Utils.toFa(stat.totals.count);
    if (avgEl) avgEl.textContent = stat.totals.avgRating ? Utils.toFa(stat.totals.avgRating.toFixed(1)) : '—';
    if (favEl) favEl.textContent = Utils.toFa(stat.totals.favorites || 0);
  }

  /* ---- صفحه عنوان ---- */
  function renderPageTitle() {
    const s = State.get();
    const cat = CONFIG.CATEGORIES[s.category] || CONFIG.CATEGORIES.all;
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.textContent = `${cat.emoji} ${cat.label}`;
    if (subEl) subEl.textContent = `${Utils.toFa(s.filtered.length)} مورد`;
  }

  /* ---- حالت خالی ---- */
  function toggleEmpty(show) {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty-state');
    if (!grid || !empty) return;
    if (show) {
      grid.hidden = true;
      empty.hidden = false;
    } else {
      grid.hidden = false;
      empty.hidden = true;
    }
  }

  return {
    cardHTML, starsHTML, renderGrid,
    renderSidebarCounts, renderPageTitle, toggleEmpty
  };
})();