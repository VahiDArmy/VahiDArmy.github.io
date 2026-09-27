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

    document.getElementById('btn-settings')?.addEventListener('click', openSettings);

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

  /* ---------- بک‌دراپ سایدبار ----------
     ✅ FIX: بک‌دراپ داخل .app قرار می‌گیرد نه body.
     دلیل: .app دارای z-index:1 و Stacking Context مستقل است،
     پس هر المان خارج از آن همیشه بالاتر رندر می‌شود و سایدبار را می‌پوشاند. */
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

    /* ---- AI ---- */
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
      else if (act === 'ai') { AIUI.openStandardizeSingle(id); }
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

  /* ---------- شبکه ---------- */
  function bindNetwork() {
    window.addEventListener('online', () => { updateSyncStatus('online'); Toast.success('اتصال برقرار شد'); });
    window.addEventListener('offline', () => { updateSyncStatus('offline'); Toast.warning('اتصال قطع شد'); });
  }

  /* ---------- تغییرات state ---------- */
  function bindState() {
    State.on('title:added', () => { renderList(); Render.renderSidebarCounts(); });
    State.on('title:updated', () => { renderList(); Render.renderSidebarCounts(); });
    State.on('title:deleted', () => { renderList(); Render.renderSidebarCounts(); });
  }

  /* ---------- رندر لیست ---------- */
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
      year: null, rating: 0, favorite: false, notes: '', watched_date: null
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

    if (data.summary || data.seasons || data.country) {
      form.appendChild(Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['🪄']),
        Utils.el('div', {}, [
          'این عنوان با AI استانداردسازی شده. ',
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
      watched_date: original.watched_date || null,
      summary: original.summary || '',
      original_title: original.original_title || '',
      seasons: original.seasons ?? null,
      episodes: original.episodes ?? null,
      episodes_per_season: original.episodes_per_season ?? null,
      country: original.country || '',
      language: original.language || '',
      status: original.status || '',
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

  /* ---------- حذف ---------- */
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

  /* ---------- جزئیات ---------- */
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
        t.status ? detailItem('وضعیت', t.status) : null,
        detailItem('افزوده‌شده', Utils.toJalali(t.created_at)),
        detailItem('آخرین ویرایش', Utils.relativeTime(t.updated_at))
      ].filter(Boolean)),

      t.summary ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📖 خلاصه']),
        Utils.el('div', { class: 'detail-notes' }, [t.summary])
      ]) : null,

      t.notes ? Utils.el('div', { class: 'mb-3' }, [
        Utils.el('h4', { class: 'mb-2' }, ['📝 یادداشت من']),
        Utils.el('div', { class: 'detail-notes' }, [t.notes])
      ]) : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'flex gap-3 w-full flex-wrap' }, [
      Utils.el('button', { class: 'btn btn-danger', onclick: () => { Modal.close(); setTimeout(() => confirmDelete(id), 150); } }, ['حذف']),
      Utils.el('button', { class: 'btn btn-soft', onclick: () => { Modal.close(); setTimeout(() => AIUI.openStandardizeSingle(id), 150); } }, ['🪄 AI']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { Modal.close(); setTimeout(() => openAddEdit(id), 150); } }, ['ویرایش']),
      Utils.el('button', { class: 'btn btn-primary', onclick: () => Modal.close() }, ['بستن'])
    ]);

    Modal.open({ title: 'جزئیات', icon: '🎬', size: 'lg', body, footer });
  }

  function detailItem(k, v) {
    return Utils.el('div', { class: 'detail-item' }, [
      Utils.el('div', { class: 'k' }, [k]),
      Utils.el('div', { class: 'v' }, [v])
    ]);
  }

  /* ---------- تنظیمات ---------- */
  function openSettings() {
    const s = GitHub.getSettings();
    const token = GitHub.getToken();
    const aiKey = AI.getKey();

    const body = Utils.el('div', { class: 'form' }, [
      Utils.el('h4', { class: 'mb-2' }, ['🔗 گیت‌هاب']),

      Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['ℹ️']),
        Utils.el('div', {}, ['دیتابیس در مخزن گیت‌هاب ذخیره می‌شود. بدون توکن، فقط حالت محلی فعال است.'])
      ]),

      Utils.el('div', { class: 'form-row' }, [
        field('نام کاربری GitHub', Utils.el('input', {
          class: 'field-input', type: 'text', name: 'owner',
          value: s.owner, placeholder: 'username'
        })),
        field('نام مخزن', Utils.el('input', {
          class: 'field-input', type: 'text', name: 'repo',
          value: s.repo, placeholder: 'username.github.io'
        }))
      ]),

      Utils.el('div', { class: 'form-row' }, [
        field('شاخه', Utils.el('input', {
          class: 'field-input', type: 'text', name: 'branch',
          value: s.branch, placeholder: 'master'
        })),
        field('مسیر فایل دیتابیس', Utils.el('input', {
          class: 'field-input', type: 'text', name: 'path',
          value: s.path, placeholder: 'movies/data/cinema.sqlite'
        }))
      ]),

      field('توکن دسترسی (Personal Access Token)', Utils.el('input', {
        class: 'field-input', type: 'password', name: 'token',
        value: token, placeholder: 'ghp_... یا github_pat_...',
        autocomplete: 'new-password'
      }), 'نیاز به دسترسی repo/contents دارد.'),

      Utils.el('div', { class: 'divider' }),

      Utils.el('h4', { class: 'mb-2' }, ['🪄 هوش مصنوعی (OpenRouter)']),

      Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['✨']),
        Utils.el('div', {}, [
          'برای استانداردسازی عنوان‌ها و تحلیل سلیقه. ',
          Utils.el('a', { class: 'link', href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener' }, ['دریافت کلید از OpenRouter'])
        ])
      ]),

      field('کلید OpenRouter', Utils.el('input', {
        class: 'field-input', type: 'password', name: 'ai_key',
        value: aiKey, placeholder: 'sk-or-v1-...',
        autocomplete: 'new-password'
      }), `مدل پیش‌فرض: ${CONFIG.AI.MODEL}`),

      Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⚠️']),
        Utils.el('div', {}, ['اطلاعات در localStorage مرورگر ذخیره می‌شود.'])
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full' }, [
      Utils.el('button', { class: 'btn btn-ghost', id: 'btn-test-conn' }, ['🧪 تست اتصال']),
      Utils.el('button', { class: 'btn btn-ghost', id: 'btn-test-ai' }, ['✨ تست AI']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => Modal.close() }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'btn-save-settings' }, ['ذخیره'])
    ]);

    Modal.open({ title: 'تنظیمات', icon: '⚙️', size: 'lg', body, footer });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const g = (n) => body.querySelector(`[name="${n}"]`).value.trim();
      GitHub.saveSettings({
        owner: g('owner'), repo: g('repo'),
        branch: g('branch') || 'master',
        path: g('path') || 'movies/data/cinema.sqlite'
      });
      GitHub.setToken(g('token'));
      AI.setKey(g('ai_key'));
      Toast.success('تنظیمات ذخیره شد');
      Modal.close();
      refreshSyncStatus();
    });

    document.getElementById('btn-test-conn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> تست…';
      try {
        const g = (n) => body.querySelector(`[name="${n}"]`).value.trim();
        GitHub.saveSettings({ owner: g('owner'), repo: g('repo'), branch: g('branch'), path: g('path') });
        GitHub.setToken(g('token'));
        await GitHub.testConnection();
        const fi = await GitHub.getFileInfo();
        if (fi.exists) Toast.success(`اتصال GitHub موفق ✅ (${Utils.toFa(Math.round(fi.size/1024))} KB)`);
        else Toast.warning('اتصال GitHub موفق، ولی فایل دیتابیس موجود نیست.');
      } catch (err) { Toast.error(err.message || 'خطا'); }
      finally { btn.disabled = false; btn.textContent = old; }
    });

    document.getElementById('btn-test-ai').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> تست AI…';
      try {
        const key = body.querySelector('[name="ai_key"]').value.trim();
        AI.setKey(key);
        await AI.chatStream({
          messages: [
            { role: 'system', content: 'پاسخ فقط کلمه «سلام» باشد.' },
            { role: 'user', content: 'بگو سلام' }
          ],
          temperature: 0,
          onToken: () => {}
        });
        Toast.success('اتصال به OpenRouter موفق ✅');
      } catch (err) {
        Toast.error(err.message || 'خطا در اتصال AI');
      } finally { btn.disabled = false; btn.textContent = old; }
    });
  }

  function field(label, input, hint) {
    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, [label]),
      input,
      hint ? Utils.el('div', { class: 'field-hint' }, [hint]) : null
    ].filter(Boolean));
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