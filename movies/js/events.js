/* =========================================================
   رویدادها و تعاملات
   ========================================================= */
window.Events = (function () {

  function bind() {
    bindHeader();
    bindSidebar();
    bindToolbar();
    bindContent();
    bindKeyboard();
    bindNetwork();
    bindState();
  }

  /* ---------- هدر ---------- */
  function bindHeader() {
    const search = document.getElementById('global-search');
    const clear = document.getElementById('btn-search-clear');

    search?.addEventListener('input', Utils.debounce((e) => {
      State.set({ search: e.target.value });
      State.applyFilters();
      Render.renderPageTitle();
      renderList();
      clear.hidden = !e.target.value;
    }, CONFIG.DEBOUNCE.SEARCH));

    clear?.addEventListener('click', () => {
      search.value = '';
      clear.hidden = true;
      State.set({ search: '' });
      State.applyFilters();
      renderList();
      search.focus();
    });

    document.getElementById('btn-theme')?.addEventListener('click', () => {
      const next = State.get().theme === 'dark' ? 'light' : 'dark';
      State.setTheme(next);
      Toast.info(next === 'dark' ? 'تم تاریک فعال شد' : 'تم روشن فعال شد');
    });

    document.getElementById('btn-stats')?.addEventListener('click', () => {
      Stats.openDashboard();
      setTimeout(animateDashboardBars, 60);
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      try { openSettings(); }
      catch (err) {
        console.error('[settings]', err);
        Toast.error('باز کردن تنظیمات با خطا مواجه شد');
      }
    });

    document.getElementById('btn-menu-toggle')?.addEventListener('click', () => {
      const sb = document.getElementById('sidebar');
      const opening = !sb.classList.contains('is-open');
      sb.classList.toggle('is-open', opening);
      document.body.classList.toggle('sidebar-open', opening);
      toggleSidebarBackdrop(opening);
    });
  }

  function animateDashboardBars() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const bars = root.querySelectorAll('.bar-fill');
    const max = Math.max(...Array.from(root.querySelectorAll('.bar-value'))
      .map(v => parseInt(Utils.toEn(v.textContent), 10) || 0), 1);
    bars.forEach((b, i) => {
      const row = b.closest('.bar-row');
      const val = row?.querySelector('.bar-value')?.textContent || '0';
      const pct = parseInt(Utils.toEn(val), 10) || 0;
      setTimeout(() => { b.style.width = Math.min((pct / max) * 100, 100) + '%'; }, i * 40);
    });
  }

  function toggleSidebarBackdrop(show) {
    let bd = document.querySelector('.sidebar-backdrop');
    if (show && !bd) {
      bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
        toggleSidebarBackdrop(false);
      });
      const mount = document.querySelector('.app') || document.body;
      mount.appendChild(bd);
      requestAnimationFrame(() => bd.classList.add('is-open'));
    } else if (bd && !show) {
      bd.classList.remove('is-open');
      setTimeout(() => bd.remove(), 250);
    }
  }

  /* ---------- سایدبار ---------- */
  function bindSidebar() {
    document.querySelectorAll('#category-list .side-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#category-list .side-item').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        State.setCategory(btn.dataset.category);
        State.applyFilters();
        Render.renderPageTitle();
        renderList();
        if (window.innerWidth <= 900) {
          document.getElementById('sidebar')?.classList.remove('is-open');
          document.body.classList.remove('sidebar-open');
          toggleSidebarBackdrop(false);
        }
      });
    });

    document.getElementById('filter-type')?.addEventListener('change', (e) => {
      State.set({ filterType: e.target.value });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    document.getElementById('filter-sort')?.addEventListener('change', (e) => {
      State.set({ sort: e.target.value });
      State.applyFilters(); renderList();
    });
    document.getElementById('filter-favorite')?.addEventListener('change', (e) => {
      State.set({ onlyFav: e.target.checked });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    document.getElementById('filter-rated')?.addEventListener('change', (e) => {
      State.set({ onlyRated: e.target.checked });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
      Utils.download(Utils.timestampName('cinema-backup'), JSON.stringify(DB.exportJSON(), null, 2));
      Toast.success('خروجی JSON ساخته شد');
    });
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('import-file')?.click();
    });
    document.getElementById('import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        Modal.confirm({
          title: 'ورود داده',
          message: `آیا ${Utils.toFa(payload.titles?.length || 0)} عنوان اضافه شود؟`,
          confirmText: 'افزودن',
          onConfirm: () => {
            const n = DB.importJSON(payload, false);
            State.loadAll(); State.applyFilters();
            Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
            Toast.success(`${Utils.toFa(n)} عنوان اضافه شد`);
          }
        });
      } catch { Toast.error('فایل نامعتبر است'); }
      e.target.value = '';
    });

    document.getElementById('btn-pull')?.addEventListener('click', pullFromGitHub);
    document.getElementById('btn-push')?.addEventListener('click', pushToGitHub);

    document.getElementById('btn-ai-batch')?.addEventListener('click', () => AIUI.openStandardizeBatch());
    document.getElementById('btn-ai-analyze')?.addEventListener('click', () => AIUI.openAnalysis());
  }

  /* ---------- تولبار ---------- */
  function bindToolbar() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        State.setView(btn.dataset.view);
        applyViewClass();
      });
    });
    document.getElementById('btn-add')?.addEventListener('click', () => openAddEdit());
    document.getElementById('btn-empty-add')?.addEventListener('click', () => openAddEdit());
  }

  function applyViewClass() {
    const grid = document.getElementById('grid');
    grid.classList.toggle('is-list', State.get().view === 'list');
  }

  /* ---------- کارت‌ها ---------- */
  function bindContent() {
    const grid = document.getElementById('grid');
    grid?.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const id = Number(card.dataset.id);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'fav') { State.toggleFavorite(id); renderList(); Render.renderSidebarCounts(); }
      else if (act === 'edit') { openAddEdit(id); }
      else if (act === 'delete') { confirmDelete(id); }
      else if (act === 'ai') { AIUI.openAnalyzeSingle(id); }
      else { openDetail(id); }
    });
    grid?.addEventListener('keydown', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      if (e.key === 'Enter') openDetail(Number(card.dataset.id));
    });
  }

  /* ---------- کیبورد ---------- */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('global-search')?.focus(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); pushToGitHub(); return; }
      if (!inField && e.key.toLowerCase() === 'n') { e.preventDefault(); openAddEdit(); }
      if (!inField && e.key.toLowerCase() === 's' && !mod) Stats.openDashboard();
    });
  }

  function bindNetwork() {
    window.addEventListener('online', () => { updateSyncStatus('online'); Toast.success('اتصال برقرار شد'); });
    window.addEventListener('offline', () => { updateSyncStatus('offline'); Toast.warning('اتصال قطع شد'); });
  }

  function bindState() {
    State.on('title:added', () => { renderList(); Render.renderSidebarCounts(); });
    State.on('title:updated', () => { renderList(); Render.renderSidebarCounts(); });
    State.on('title:deleted', () => { renderList(); Render.renderSidebarCounts(); });
  }

  function renderList() {
    const grid = document.getElementById('grid');
    const s = State.get();
    Render.renderGrid(grid, s.filtered, s.search);
    Render.toggleEmpty(s.filtered.length === 0);
    Render.renderPageTitle();
  }

  /* ---------- افزودن/ویرایش ---------- */
  function openAddEdit(id = null) {
    const editing = id != null;
    const data = editing ? DB.getTitle(id) : {
      title: '', category: 'love', type: 'series', genre: '',
      year: null, rating: 0, favorite: false, notes: '', reason: '', watched_date: null
    };
    if (!data) { Toast.error('عنوان پیدا نشد'); return; }

    const form = buildItemForm(data);
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => Modal.close() }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'form-save' }, [editing ? 'ذخیره تغییرات' : 'افزودن'])
    ]);

    Modal.open({
      title: editing ? 'ویرایش عنوان' : 'افزودن عنوان جدید',
      icon: editing ? '✏️' : '➕',
      body: form, footer, size: 'lg'
    });

    document.getElementById('form-save').addEventListener('click', () => {
      const payload = collectForm(form, data);
      if (!payload) return;
      if (editing) { State.editTitle(id, payload); Toast.success('تغییرات ذخیره شد'); }
      else { State.addTitle(payload); Toast.success('عنوان اضافه شد'); }
      Modal.close();
    });
  }

  function buildItemForm(data) {
    const form = Utils.el('form', { class: 'form' });

    const catPicker = Utils.el('div', { class: 'cat-picker' });
    ['love', 'good', 'hate'].forEach(c => {
      const label = Utils.el('label', { class: 'cat-option', dataset: { cat: c } });
      const inp = Utils.el('input', { type: 'radio', name: 'category', value: c });
      inp.checked = data.category === c;
      label.appendChild(inp);
      label.appendChild(Utils.el('div', { class: 'cat-option-inner' }, [
        Utils.el('span', { class: 'emoji' }, [CONFIG.CATEGORIES[c].emoji]),
        Utils.el('span', { class: 'lbl' }, [CONFIG.CATEGORIES[c].label])
      ]));
      catPicker.appendChild(label);
    });
    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['دسته‌بندی ', Utils.el('span', { class: 'req' }, ['*'])]),
      catPicker
    ]));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['عنوان ', Utils.el('span', { class: 'req' }, ['*'])]),
      Utils.el('input', { class: 'field-input', type: 'text', name: 'title',
        value: data.title, placeholder: 'مثلاً Breaking Bad',
        maxlength: CONFIG.LIMITS.TITLE_MAX, required: true })
    ]));

    form.appendChild(Utils.el('div', { class: 'form-row form-row-3' }, [
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['نوع']),
        (() => {
          const s = Utils.el('select', { class: 'field-select', name: 'type' });
          Object.entries(CONFIG.TYPES).forEach(([k, v]) => {
            const o = Utils.el('option', { value: k }, [v]);
            if (data.type === k) o.selected = true;
            s.appendChild(o);
          });
          return s;
        })()
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['سال']),
        Utils.el('input', { class: 'field-input', type: 'number', name: 'year',
          value: data.year || '', placeholder: '2020', min: 1900, max: 2100 })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['ژانر']),
        Utils.el('input', { class: 'field-input', type: 'text', name: 'genre',
          value: data.genre || '', placeholder: 'درام، جنایی',
          maxlength: CONFIG.LIMITS.GENRE_MAX })
      ])
    ]));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, [
        'چرا؟ ',
        Utils.el('span', { class: 'field-hint-inline' }, ['(دلیل عاشقشم/خوب/دری‌وری بودن)'])
      ]),
      Utils.el('textarea', {
        class: 'field-textarea', name: 'reason',
        placeholder: 'مثلاً: شبکه‌ی منطقی قوی، وفاداری به قوانین، بدون سوراخ داستانی…',
        maxlength: CONFIG.LIMITS.REASON_MAX,
        style: { minHeight: '70px' }
      }, [data.reason || ''])
    ]));

    if (data.summary || data.seasons || data.country) {
      form.appendChild(Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['🪄']),
        Utils.el('div', {}, [
          'این عنوان با AI تحلیل شده. ',
          data.seasons ? `${Utils.toFa(data.seasons)} فصل` : '',
          data.episodes ? ` · ${Utils.toFa(data.episodes)} قسمت` : '',
          data.country ? ` · ${data.country}` : ''
        ].filter(Boolean))
      ]));
    }

    const ratingRow = Utils.el('div', { class: 'rating-picker' });
    const starsWrap = Utils.el('div', { class: 'rating-stars' });
    for (let i = 1; i <= 5; i++) {
      const s = Utils.el('button', { type: 'button', class: 'rating-star', dataset: { star: i } });
      s.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
      starsWrap.appendChild(s);
    }
    const ratingInput = Utils.el('input', { class: 'rating-input', type: 'number',
      name: 'rating', value: data.rating || 0, min: 0, max: 10, step: 0.5 });
    ratingRow.appendChild(starsWrap);
    ratingRow.appendChild(ratingInput);
    ratingRow.appendChild(Utils.el('span', { class: 'text-xs text-3' }, ['از ۱۰']));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['امتیاز']), ratingRow
    ]));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['یادداشت']),
      Utils.el('textarea', { class: 'field-textarea', name: 'notes',
        placeholder: 'چی دوست داشتی یا نداشتی…',
        maxlength: CONFIG.LIMITS.NOTES_MAX }, [data.notes || ''])
    ]));

    const favSwitch = Utils.el('label', { class: 'switch' });
    const favInp = Utils.el('input', { type: 'checkbox', name: 'favorite' });
    favInp.checked = !!data.favorite;
    favSwitch.appendChild(favInp);
    favSwitch.appendChild(Utils.el('span', { class: 'switch-track' }));

    form.appendChild(Utils.el('div', { class: 'switch-row' }, [
      Utils.el('div', {}, [
        Utils.el('div', { class: 'switch-label' }, ['افزودن به علاقه‌مندی‌ها ⭐']),
        Utils.el('div', { class: 'switch-desc' }, ['برای دسترسی سریع'])
      ]),
      favSwitch
    ]));

    const updateStars = (v) => {
      const n = Math.round(v / 2);
      starsWrap.querySelectorAll('.rating-star').forEach((s, i) => s.classList.toggle('on', i < n));
    };
    updateStars(Number(ratingInput.value) || 0);
    starsWrap.addEventListener('click', (e) => {
      const s = e.target.closest('.rating-star');
      if (!s) return;
      const val = Number(s.dataset.star) * 2;
      ratingInput.value = val;
      updateStars(val);
    });
    ratingInput.addEventListener('input', () => updateStars(Number(ratingInput.value) || 0));

    return form;
  }

  function collectForm(form, original = {}) {
    const data = {
      title: form.querySelector('[name="title"]').value.trim(),
      category: form.querySelector('[name="category"]:checked')?.value || 'love',
      type: form.querySelector('[name="type"]').value,
      genre: form.querySelector('[name="genre"]').value.trim(),
      year: form.querySelector('[name="year"]').value ? Number(form.querySelector('[name="year"]').value) : null,
      rating: Number(form.querySelector('[name="rating"]').value) || 0,
      favorite: form.querySelector('[name="favorite"]').checked,
      notes: form.querySelector('[name="notes"]').value.trim(),
      reason: form.querySelector('[name="reason"]').value.trim(),
      watched_date: original.watched_date || null,
      summary: original.summary || '',
      original_title: original.original_title || '',
      seasons: original.seasons ?? null,
      episodes: original.episodes ?? null,
      episodes_per_season: original.episodes_per_season ?? null,
      country: original.country || '',
      language: original.language || '',
      status: original.status || '',
      story_analysis: original.story_analysis ? JSON.stringify(original.story_analysis) : '',
      ai_standardized_at: original.ai_standardized_at || null
    };
    if (!data.title) {
      Toast.error('عنوان الزامی است');
      form.querySelector('[name="title"]').focus();
      form.classList.add('anim-shake');
      setTimeout(() => form.classList.remove('anim-shake'), 500);
      return null;
    }
    return data;
  }

  function confirmDelete(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    Modal.confirm({
      title: 'حذف عنوان',
      message: `آیا از حذف «${t.title}» مطمئنی؟`,
      confirmText: 'حذف کن', danger: true, icon: '🗑️',
      onConfirm: () => { State.removeTitle(id); Toast.success('حذف شد'); }
    });
  }

  function openDetail(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    const cat = CONFIG.CATEGORIES[t.category];

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'detail-hero', dataset: { cat: t.category } }, [
        Utils.el('h2', { class: 'detail-title' }, [t.title]),
        t.original_title && t.original_title !== t.title
          ? Utils.el('div', { class: 'text-sm text-3 mb-2' }, [t.original_title])
          : null,
        Utils.el('div', { class: 'detail-tags' }, [
          Utils.el('span', { class: 'cat-badge', dataset: { cat: t.category } }, [`${cat.emoji} ${cat.label}`]),
          Utils.el('span', { class: 'badge' }, [CONFIG.TYPES[t.type] || t.type]),
          t.year ? Utils.el('span', { class: 'badge' }, [Utils.toFa(t.year)]) : null,
          t.favorite ? Utils.el('span', { class: 'badge', style: { color: 'var(--warning)' } }, ['⭐ علاقه‌مندی']) : null,
          t.ai_standardized_at ? Utils.el('span', { class: 'badge ai-badge' }, ['🪄 AI']) : null
        ].filter(Boolean))
      ]),

      Utils.el('div', { class: 'detail-grid' }, [
        detailItem('امتیاز', t.rating ? Utils.toFa(t.rating.toFixed(1)) + ' / ۱۰' : '—'),
        detailItem('نوع', CONFIG.TYPES[t.type] || t.type),
        detailItem('سال', t.year ? Utils.toFa(t.year) : '—'),
        detailItem('ژانر', t.genre || '—'),
        t.seasons ? detailItem('فصل‌ها', Utils.toFa(t.seasons)) : null,
        t.episodes ? detailItem('قسمت‌ها', Utils.toFa(t.episodes)) : null,
        t.episodes_per_season ? detailItem('قسمت در فصل', Utils.toFa(t.episodes_per_season)) : null,
        t.country ? detailItem('کشور', t.country) : null,
        t.language ? detailItem('زبان', t.language) : null,
        t.status ? detailItem('وضعیت', t.status) : null
      ].filter(Boolean)),

      t.summary ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📖 خلاصه']),
        Utils.el('div', { class: 'detail-notes' }, [t.summary])
      ]) : null,

      (t.reason || t.story_analysis) ? (() => {
        const box = Utils.el('div', { class: 'story-analysis-box mb-3' });
        AIUI.renderStoryAnalysis(box, t.story_analysis, t.reason, t.category);
        setTimeout(() => {
          box.querySelectorAll('.score-fill').forEach(f => {
            f.style.width = (f.dataset.pct || '0') + '%';
          });
        }, 80);
        return box;
      })() : null,

      t.notes ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📝 یادداشت من']),
        Utils.el('div', { class: 'detail-notes' }, [t.notes])
      ]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'flex gap-3 w-full flex-wrap' }, [
      Utils.el('button', { class: 'btn btn-danger', onclick: () => { Modal.close(); setTimeout(() => confirmDelete(id), 150); } }, ['حذف']),
      Utils.el('button', { class: 'btn btn-soft', onclick: () => { Modal.close(); setTimeout(() => AIUI.openAnalyzeSingle(id), 150); } }, ['🔬 تحلیل AI']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { Modal.close(); setTimeout(() => openAddEdit(id), 150); } }, ['ویرایش']),
      Utils.el('button', { class: 'btn btn-primary', onclick: () => Modal.close() }, ['بستن'])
    ]);

    Modal.open({ title: 'جزئیات', icon: '🎬', size: 'xl', body, footer });
  }

  function detailItem(k, v) {
    return Utils.el('div', { class: 'detail-item' }, [
      Utils.el('div', { class: 'k' }, [k]),
      Utils.el('div', { class: 'v' }, [v])
    ]);
  }

  /* ============================================================
     انتخاب‌گر کارتی مدل — لیست استاتیک از CONFIG
     ============================================================ */
  function buildModelPicker(currentModelId, onSelect) {
    let selected = currentModelId;
    const models = AI.getModels();
    const defaultModel = (CONFIG.AI && CONFIG.AI.DEFAULT_MODEL) || '';

    const searchInput = Utils.el('input', {
      class: 'field-input model-search',
      type: 'text',
      placeholder: 'جستجو در مدل‌ها…',
      autocomplete: 'off'
    });

    const listWrap = Utils.el('div', { class: 'model-list' });
    const statsBar = Utils.el('div', { class: 'model-stats' });

    function renderList(query = '') {
      listWrap.innerHTML = '';
      const q = Utils.normalizeFa(query).toLowerCase();

      const filtered = models.filter(m => {
        if (!q) return true;
        const hay = Utils.normalizeFa(
          `${m.label} ${m.vendor} ${m.id} ${(m.tags || []).join(' ')} ${m.note || ''}`
        ).toLowerCase();
        return hay.includes(q);
      });

      if (!filtered.length) {
        listWrap.appendChild(Utils.el('div', { class: 'model-empty' }, ['مدلی با این جستجو پیدا نشد']));
        return;
      }

      filtered.forEach(m => {
        const isActive = m.id === selected;
        const isDefault = m.id === defaultModel;

        const card = Utils.el('div', {
          class: 'model-card' + (isActive ? ' is-active' : ''),
          dataset: { model: m.id },
          role: 'button',
          tabindex: '0',
          'aria-pressed': isActive ? 'true' : 'false'
        }, [
          Utils.el('div', { class: 'model-card-head' }, [
            Utils.el('div', { class: 'model-card-title' }, [
              Utils.el('span', { class: 'model-card-label' }, [m.label]),
              Utils.el('span', { class: 'model-card-vendor' }, [m.vendor])
            ]),
            Utils.el('div', { class: 'model-card-badges' }, [
              isDefault ? Utils.el('span', { class: 'model-badge model-badge-default' }, ['پیش‌فرض']) : null,
              m.recommended ? Utils.el('span', { class: 'model-badge model-badge-rec' }, ['★ پیشنهادی']) : null,
              isActive ? Utils.el('span', { class: 'model-badge model-badge-active' }, ['✓ انتخاب‌شده']) : null
            ].filter(Boolean))
          ]),

          Utils.el('div', { class: 'model-card-meta' }, [
            Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['⚙']),
              m.size
            ]),
            Utils.el('span', { class: 'model-meta-sep' }, ['·']),
            Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['📐']),
              m.context + ' ctx'
            ]),
            Utils.el('span', { class: 'model-meta-sep' }, ['·']),
            Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['⚡']),
              m.speed + ' t/s'
            ])
          ]),

          m.note ? Utils.el('div', { class: 'model-card-note' }, [m.note]) : null,

          (m.tags && m.tags.length) ? Utils.el('div', { class: 'model-card-tags' },
            m.tags.map(t => Utils.el('span', { class: 'model-tag' }, [t]))
          ) : null,

          Utils.el('div', { class: 'model-card-id' }, [m.id])
        ]);

        function select() {
          selected = m.id;
          onSelect && onSelect(m.id);
          renderList(searchInput.value);
          updateStats();
        }

        card.addEventListener('click', select);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        });

        listWrap.appendChild(card);
      });
    }

    function updateStats() {
      const total = models.length;
      const meta = models.find(m => m.id === selected);
      statsBar.innerHTML = '';
      statsBar.appendChild(Utils.el('span', { class: 'model-stats-count' }, [
        Utils.toFa(total) + ' مدل'
      ]));
      if (meta) {
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-sep' }, ['·']));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-current' }, [
          'فعال: ' + meta.label
        ]));
      }
    }

    searchInput.addEventListener('input', Utils.debounce((e) => {
      renderList(e.target.value);
    }, 120));

    renderList();
    updateStats();

    const wrap = Utils.el('div', { class: 'model-picker' }, [
      searchInput,
      statsBar,
      listWrap
    ]);

    return {
      el: wrap,
      getSelected: () => selected
    };
  }

  /* ---------- تنظیمات ---------- */
  function openSettings() {
    const s = GitHub.getSettings();
    const token = GitHub.getToken();
    const aiKey = AI.getKey();
    const currentModel = (typeof AI.getModel === 'function') ? AI.getModel() : '';
    const ghOK = !!(s.owner && s.repo && token);
    const aiOK = !!aiKey;

    function row(label, input, hint) {
      const children = [Utils.el('label', {}, [label]), input];
      if (hint) children.push(Utils.el('small', {}, [hint]));
      return Utils.el('div', { class: 'settings-row' }, children);
    }
    function input(name, value, opts = {}) {
      return Utils.el('input', {
        class: 'field-input', type: opts.type || 'text', name,
        value: value || '', placeholder: opts.placeholder || '',
        autocomplete: opts.autocomplete || 'off', spellcheck: 'false'
      });
    }

    /* ---- گیت‌هاب ---- */
    const githubSection = Utils.el('div', { class: 'settings-section' }, [
      Utils.el('div', { class: 'settings-section-head' }, [
        Utils.el('div', { class: 'settings-icon' }, ['🔗']),
        Utils.el('div', { class: 'settings-info' }, [
          Utils.el('h4', {}, ['اتصال گیت‌هاب']),
          Utils.el('p', {}, ['ذخیره‌ی دیتابیس در مخزن'])
        ]),
        Utils.el('span', { class: 'settings-status', dataset: { status: ghOK ? 'ok' : 'missing' } }, [ghOK ? 'متصل' : 'تنظیم نشده'])
      ]),
      Utils.el('div', { class: 'settings-fields' }, [
        row('نام کاربری GitHub', input('owner', s.owner, { placeholder: 'username' })),
        row('نام مخزن', input('repo', s.repo, { placeholder: 'username.github.io' })),
        row('شاخه', input('branch', s.branch, { placeholder: 'master' })),
        row('مسیر فایل دیتابیس', input('path', s.path, { placeholder: 'movies/data/cinema.sqlite' })),
        row('توکن دسترسی', input('token', token, {
          type: 'password', placeholder: 'ghp_...', autocomplete: 'new-password'
        }), 'نیاز به دسترسی repo یا contents:write دارد')
      ]),
      Utils.el('div', { class: 'settings-hint' }, [
        Utils.el('span', { class: 'hint-icon' }, ['💡']),
        Utils.el('div', {}, [
          'برای ساخت توکن: GitHub → Settings → Developer settings → Personal access tokens. ',
          Utils.el('a', { href: 'https://github.com/settings/tokens', target: '_blank', rel: 'noopener' }, ['باز کردن'])
        ])
      ])
    ]);

    /* ---- AI ---- */
    const picker = buildModelPicker(currentModel, () => {});

    const aiSection = Utils.el('div', { class: 'settings-section' }, [
      Utils.el('div', { class: 'settings-section-head' }, [
        Utils.el('div', { class: 'settings-icon' }, ['🪄']),
        Utils.el('div', { class: 'settings-info' }, [
          Utils.el('h4', {}, ['هوش مصنوعی OpenRouter']),
          Utils.el('p', {}, ['انتخاب مدل + کلید API'])
        ]),
        Utils.el('span', { class: 'settings-status', dataset: { status: aiOK ? 'ok' : 'missing' } }, [aiOK ? 'فعال' : 'تنظیم نشده'])
      ]),
      Utils.el('div', { class: 'settings-fields' }, [
        row('کلید API', input('ai_key', aiKey, {
          type: 'password', placeholder: 'sk-or-v1-...', autocomplete: 'new-password'
        }), 'همان توکن OpenRouter — مشترک بین همه‌ی مدل‌ها')
      ]),
      Utils.el('div', { class: 'settings-fieldset' }, [
        Utils.el('div', { class: 'settings-fieldset-label' }, ['مدل فعال']),
        picker.el
      ]),
      Utils.el('div', { class: 'settings-hint' }, [
        Utils.el('span', { class: 'hint-icon' }, ['✨']),
        Utils.el('div', {}, [
          'کلید رایگان از ',
          Utils.el('a', { href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener' }, ['openrouter.ai/keys']),
          ' — همه‌ی مدل‌ها با همین کلید کار می‌کنند.'
        ])
      ]),
      Utils.el('div', { class: 'settings-tests' }, [
        Utils.el('button', { class: 'settings-test-btn', id: 'btn-ai-log', type: 'button' }, ['📋 نمایش لاگ AI']),
        Utils.el('button', { class: 'settings-test-btn', id: 'btn-test-ai', type: 'button' }, ['✨ تست اتصال AI'])
      ])
    ]);

    const warnBox = Utils.el('div', { class: 'alert alert-warn' }, [
      Utils.el('span', { class: 'alert-icon' }, ['🔒']),
      Utils.el('div', {}, ['اطلاعات در localStorage مرورگر ذخیره می‌شود.'])
    ]);

    const body = Utils.el('div', { class: 'settings' }, [githubSection, aiSection, warnBox]);

    const footer = Utils.el('div', { class: 'settings-footer' }, [
      Utils.el('button', { class: 'settings-test-btn', id: 'btn-test-conn', type: 'button' }, ['🧪 تست اتصال گیت‌هاب']),
      Utils.el('div', { class: 'spacer' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => Modal.close() }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'btn-save-settings' }, ['💾 ذخیره'])
    ]);

    Modal.open({ title: 'تنظیمات', icon: '⚙️', size: 'xl', body, footer });

    function refreshStatus() {
      const ghEl = githubSection.querySelector('.settings-status');
      const ghOk = !!(body.querySelector('[name="owner"]').value.trim() &&
                     body.querySelector('[name="repo"]').value.trim() &&
                     body.querySelector('[name="token"]').value.trim());
      ghEl.dataset.status = ghOk ? 'ok' : 'missing';
      ghEl.textContent = ghOk ? 'متصل' : 'تنظیم نشده';
      const aiEl = aiSection.querySelector('.settings-status');
      const aiOk = !!body.querySelector('[name="ai_key"]').value.trim();
      aiEl.dataset.status = aiOk ? 'ok' : 'missing';
      aiEl.textContent = aiOk ? 'فعال' : 'تنظیم نشده';
    }
    body.querySelectorAll('.field-input').forEach(inp => {
      inp.addEventListener('input', refreshStatus);
    });

    /* ---- ذخیره ---- */
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const g = (n) => body.querySelector(`[name="${n}"]`).value.trim();

      GitHub.saveSettings({
        owner: g('owner'), repo: g('repo'),
        branch: g('branch') || 'master',
        path: g('path') || 'movies/data/cinema.sqlite'
      });
      GitHub.setToken(g('token'));

      AI.setKey(g('ai_key'));
      if (typeof AI.setModel === 'function') {
        AI.setModel(picker.getSelected());
      }
      const meta = (typeof AI.getModelMeta === 'function')
        ? AI.getModelMeta()
        : { label: picker.getSelected() };

      Toast.success(`تنظیمات ذخیره شد — مدل: ${meta.label}`);
      Modal.close();
      refreshSyncStatus();

      if (window.AILog && g('ai_key')) {
        try {
          AILog.show();
          AILog.success('✓ کلید AI و مدل ذخیره شد');
          AILog.meta(`مدل فعال: ${meta.label}`);
          AILog.scheduleAutoHide();
        } catch {}
      }
    });

    /* ---- تست گیت‌هاب ---- */
    document.getElementById('btn-test-conn').addEventListener('click', async (e) => {
      const btn = e.currentTarget; const old = btn.textContent;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> تست…';
      try {
        const g = (n) => body.querySelector(`[name="${n}"]`).value.trim();
        GitHub.saveSettings({
          owner: g('owner'), repo: g('repo'),
          branch: g('branch') || 'master',
          path: g('path') || 'movies/data/cinema.sqlite'
        });
        GitHub.setToken(g('token'));
        await GitHub.testConnection();
        const fi = await GitHub.getFileInfo();
        if (fi.exists) Toast.success(`اتصال موفق ✅ (${Utils.toFa(Math.round(fi.size/1024))} KB)`);
        else Toast.warning('اتصال موفق، ولی فایل دیتابیس موجود نیست.');
      } catch (err) { Toast.error(err.message || 'خطا'); }
      finally { btn.disabled = false; btn.textContent = old; }
    });

    /* ---- تست AI ---- */
    document.getElementById('btn-test-ai').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const key = body.querySelector('[name="ai_key"]').value.trim();
      const modelId = picker.getSelected();
      const meta = AI.getModels().find(m => m.id === modelId) || { label: modelId };

      AI.setKey(key);

      if (window.AILog) {
        try { AILog.show(); AILog.info('▸ شروع تست AI'); AILog.meta(`مدل: ${meta.label}`); } catch {}
      }
      if (!key) {
        if (window.AILog) { try { AILog.error('✗ کلید AI وارد نشده'); AILog.scheduleAutoHide(); } catch {} }
        Toast.warning('ابتدا کلید را وارد کنید'); return;
      }

      const old = btn.textContent;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> تست…';
      try {
        await AI.chatStream({
          model: modelId,
          messages: [
            { role: 'system', content: 'پاسخ فقط کلمه «سلام» باشد.' },
            { role: 'user', content: 'بگو سلام' }
          ],
          temperature: 0,
          onToken: () => {}
        });
        Toast.success(`اتصال به ${meta.label} موفق ✅`);
      } catch (err) { Toast.error(err.message || 'خطا'); }
      finally { btn.disabled = false; btn.textContent = old; }
    });

    document.getElementById('btn-ai-log').addEventListener('click', () => { AIUI.showLog(); });
  }

  /* ---------- سینک ---------- */
  async function pullFromGitHub() {
    if (!GitHub.isConfigured()) { Toast.warning('ابتدا توکن گیت‌هاب را تنظیم کن'); return; }
    updateSyncStatus('syncing');
    const t = Toast.loading('در حال دریافت…');
    try {
      await DB.pullFromGitHub();
      State.loadAll(); State.applyFilters();
      Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
      Toast.update(t, 'دریافت موفق ✅', 'success');
      updateSyncStatus('online');
    } catch (e) {
      Toast.update(t, e.message || 'خطا', 'error');
      updateSyncStatus('error');
    }
  }

  async function pushToGitHub() {
    if (!GitHub.isConfigured()) { Toast.warning('ابتدا توکن گیت‌هاب را تنظیم کن'); return; }
    updateSyncStatus('syncing');
    const t = Toast.loading('در حال ارسال…');
    try {
      await DB.pushToGitHub();
      Toast.update(t, 'ارسال موفق ✅', 'success');
      updateSyncStatus('online');
    } catch (e) {
      Toast.update(t, e.message || 'خطا', 'error');
      updateSyncStatus('error');
    }
  }

  function updateSyncStatus(state) {
    const el = document.getElementById('sync-status');
    const lbl = document.getElementById('sync-label');
    if (!el || !lbl) return;
    el.dataset.state = state;
    const labels = { idle: 'آفلاین', syncing: 'در حال سینک', online: 'متصل', error: 'خطا', offline: 'آفلاین' };
    lbl.textContent = labels[state] || state;
  }

  function refreshSyncStatus() {
    if (GitHub.isConfigured()) updateSyncStatus('online');
    else updateSyncStatus('idle');
  }

  return {
    bind, renderList, openAddEdit, confirmDelete, openDetail, openSettings,
    updateSyncStatus, refreshSyncStatus, pullFromGitHub, pushToGitHub
  };
})();