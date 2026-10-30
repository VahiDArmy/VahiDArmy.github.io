/* =========================================================
   رندر کارت‌ها و UI
   ========================================================= */
window.Render = (function () {
  const { $, $$, escapeHtml, ratingStars, categoryEmoji, formatDate } = Utils;

  function renderCards(list) {
    const grid = $('#cards-grid');
    const empty = $('#empty-state');
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    grid.innerHTML = list.map(t => cardHtml(t)).join('');
    // Bind clicks
    grid.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        openDetail(id);
      });
    });
  }

  function cardHtml(t) {
    const cat = CONFIG.CATEGORIES[t.category] || {};
    const stars = ratingStars(t.rating);
    const fav = t.favorite ? '❤️' : '';
    return `
      <article class="card" data-id="${t.id}" data-category="${t.category}">
        <div class="card-top">
          <span class="card-cat" style="color:${cat.color || '#aaa'}">${cat.emoji || '🎬'} ${escapeHtml(cat.label || t.category)}</span>
          <span class="card-fav">${fav}</span>
        </div>
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        ${t.original_title ? `<div class="card-orig">${escapeHtml(t.original_title)}</div>` : ''}
        <div class="card-meta">
          <span>${t.year || '—'}</span>
          <span>${t.type || ''}</span>
          <span class="card-rating">${stars}</span>
        </div>
        ${t.genre ? `<div class="card-genre">${escapeHtml(t.genre)}</div>` : ''}
      </article>
    `;
  }

  async function openDetail(id) {
    Utils.showLoader(true);
    try {
      const t = await DB.getTitle(id);
      if (!t) {
        Utils.toast('عنوان پیدا نشد', 'error');
        return;
      }
      const body = $('#modal-body');
      const overlay = $('#modal-overlay');
      if (!body || !overlay) return;

      const cat = CONFIG.CATEGORIES[t.category] || {};
      body.innerHTML = `
        <div class="detail-header">
          <h2>${escapeHtml(t.title)}</h2>
          ${t.original_title ? `<p class="orig">${escapeHtml(t.original_title)}</p>` : ''}
          <div class="detail-badges">
            <span class="badge" style="background:${cat.color || '#555'}">${cat.emoji} ${escapeHtml(cat.label || '')}</span>
            <span class="badge">${ratingStars(t.rating)} ${t.rating || 0}</span>
            ${t.favorite ? '<span class="badge">❤️ علاقه‌مندی</span>' : ''}
            <span class="badge">${t.type || ''}</span>
            ${t.year ? `<span class="badge">${t.year}</span>` : ''}
          </div>
        </div>
        <div class="detail-body">
          ${t.genre ? `<p><strong>ژانر:</strong> ${escapeHtml(t.genre)}</p>` : ''}
          ${t.notes ? `<div class="notes"><strong>یادداشت:</strong><br>${escapeHtml(t.notes).replace(/\n/g, '<br>')}</div>` : ''}
          ${t.summary ? `<div class="summary"><strong>خلاصه:</strong><br>${escapeHtml(t.summary).replace(/\n/g, '<br>')}</div>` : ''}
          ${t.story_analysis ? `<div class="analysis"><strong>تحلیل داستانی:</strong><pre>${escapeHtml(t.story_analysis)}</pre></div>` : ''}
          <p class="meta-date">اضافه شده: ${formatDate(t.created_at)}</p>
        </div>
        <div class="detail-actions">
          <button class="btn-primary" id="btn-edit-detail">ویرایش</button>
          <button class="btn-secondary" id="btn-ai-detail">تحلیل AI</button>
          <button class="btn-danger" id="btn-delete-detail">حذف</button>
        </div>
      `;

      overlay.hidden = false;
      document.body.classList.add('modal-open');

      $('#btn-edit-detail')?.addEventListener('click', () => {
        closeModal();
        openEdit(t);
      });
      $('#btn-delete-detail')?.addEventListener('click', async () => {
        if (!confirm('آیا مطمئن هستید؟')) return;
        Utils.showLoader(true);
        try {
          await DB.deleteTitle(id);
          Utils.toast('حذف شد', 'success');
          closeModal();
          await State.loadTitles();
        } catch (e) {
          Utils.toast(e.message, 'error');
        } finally {
          Utils.showLoader(false);
        }
      });
      $('#btn-ai-detail')?.addEventListener('click', () => {
        Utils.toast('قابلیت AI در حال اتصال به edge function...', 'info');
        // TODO: call AI
      });
    } catch (e) {
      Utils.toast(e.message, 'error');
    } finally {
      Utils.showLoader(false);
    }
  }

  function closeModal() {
    const overlay = $('#modal-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function openEdit(t) {
    State.set({ view: 'add', editingId: t.id });
    switchView('add');
    $('#form-title').textContent = 'ویرایش عنوان';
    $('#edit-id').value = t.id;
    $('#f-title').value = t.title || '';
    $('#f-original').value = t.original_title || '';
    $('#f-category').value = t.category || 'love';
    $('#f-type').value = t.type || 'series';
    $('#f-year').value = t.year || '';
    $('#f-rating').value = t.rating || 0;
    $('#f-genre').value = t.genre || '';
    $('#f-notes').value = t.notes || '';
    $('#f-favorite').checked = !!t.favorite;
  }

  function openAdd() {
    State.set({ view: 'add', editingId: null });
    switchView('add');
    $('#form-title').textContent = 'افزودن عنوان جدید';
    $('#title-form').reset();
    $('#edit-id').value = '';
  }

  function switchView(name) {
    $$('.view-section').forEach(s => s.classList.remove('active'));
    const el = $('#view-' + name);
    if (el) el.classList.add('active');

    $$('.side-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === name || (name === 'grid' && b.dataset.filter === State.get().categoryFilter));
    });

    State.set({ view: name });
  }

  function updateHeaderStats(titles) {
    const total = titles.length;
    const rated = titles.filter(t => t.rating > 0);
    const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : '—';
    const totEl = $('#hd-total');
    const avgEl = $('#hd-avg');
    if (totEl) totEl.textContent = total;
    if (avgEl) avgEl.textContent = avg;
  }

  function renderStats(titles) {
    const container = $('#stats-container');
    if (!container) return;

    const byCat = { love: 0, good: 0, hate: 0 };
    let totalRating = 0, ratedCount = 0, favCount = 0;
    titles.forEach(t => {
      if (byCat[t.category] !== undefined) byCat[t.category]++;
      if (t.rating > 0) { totalRating += t.rating; ratedCount++; }
      if (t.favorite) favCount++;
    });

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${titles.length}</div>
          <div class="stat-label">کل عناوین</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${ratedCount ? (totalRating / ratedCount).toFixed(2) : '—'}</div>
          <div class="stat-label">میانگین امتیاز</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${favCount}</div>
          <div class="stat-label">علاقه‌مندی‌ها</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${byCat.love}</div>
          <div class="stat-label">❤️ عاشقشم</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${byCat.good}</div>
          <div class="stat-label">👍 خوبه</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${byCat.hate}</div>
          <div class="stat-label">👎 متنفرم</div>
        </div>
      </div>
    `;
  }

  return {
    renderCards,
    openDetail,
    closeModal,
    openEdit,
    openAdd,
    switchView,
    updateHeaderStats,
    renderStats
  };
})();
