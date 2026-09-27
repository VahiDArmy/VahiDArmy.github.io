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
      const cur = State.get().theme;
      const next = cur === 'dark' ? 'light' : 'dark';
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
      sb.classList.toggle('is-open');
      toggleSidebarBackdrop(sb.classList.contains('is-open'));
    });
  }

  function animateDashboardBars() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const bars = root.querySelectorAll('.bar-fill');
    bars.forEach((b, i) => {
      const row = b.closest('.bar-row');
      const val = row?.querySelector('.bar-value')?.textContent || '0';
      const pct = parseInt(Utils.toEn(val), 10) || 0;
      const max = Math.max(...Array.from(root.querySelectorAll('.bar-value')).map(v => parseInt(Utils.toEn(v.textContent), 10) || 0), 1);
      setTimeout(() => { b.style.width = Math.min((pct / max) * 100, 100) + '%'; }, i * 40);
    });
  }

  function toggleSidebarBackdrop(show) {
    let bd = document.querySelector('.sidebar-backdrop');
    if (show && !bd) {
      bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('is-open');
        toggleSidebarBackdrop(false);
      });
      document.body.appendChild(bd);
      requestAnimationFrame(() => bd.classList.add('is-open'));
    } else if (bd) {
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
        // بستن سایدبار موبایل
        if (window.innerWidth <= 900) {
          document.getElementById('sidebar')?.classList.remove('is-open');
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
      const payload = DB.exportJSON();
      Utils.download(Utils.timestampName('cinema-backup'), JSON.stringify(payload, null, 2));
      Toast.success('خروجی JSON با موفقیت ساخته شد');
    });

    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('import-file')?.click();
    });

    document.getElementById('import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        Modal.confirm({
          title: 'ورود داده',
          message: `آیا می‌خواهید ${Utils.toFa(payload.titles?.length || 0)} عنوان را به آرشیو اضافه کنید؟`,
          confirmText: 'افزودن',
          onConfirm: () => {
            const n = DB.importJSON(payload, false);
            State.loadAll(); State.applyFilters();
            Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
            Toast.success(`${Utils.toFa(n)} عنوان اضافه شد`);
          }
        });
      } catch (err) {
        Toast.error('فایل نامعتبر است');
      }
      e.target.value = '';
    });

    document.getElementById('btn-pull')?.addEventListener('click', pullFromGitHub);
    document.getElementById('btn-push')?.addEventListener('click', pushToGitHub);
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
    const v = State.get().view;
    grid.classList.toggle('is-list', v === 'list');
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

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        pushToGitHub();
        return;
      }
      if (!inField && e.key.toLowerCase() === 'n') {
        e.preventDefault(); openAddEdit();
      }
      if (!inField && e.key.toLowerCase() === 's' && !mod) {
        Stats.openDashboard();
      }
    });
  }

  /* ---------- شبکه ---------- */
  function bindNetwork() {
    window.addEventListener('online', () => {
      updateSyncStatus('online');
      Toast.success('اتصال اینترنت برقرار شد');
    });
    window.addEventListener('offline', () => {
      updateSyncStatus('offline');
      Toast.warning('اتصال اینترنت قطع شد');
    });
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
      body: form,
      footer,
      size: 'lg'
    });

    document.getElementById('form-save').addEventListener('click', () => {
      const payload = collectForm(form);
      if (!payload) return;

      if (editing) {
        State.editTitle(id, payload);
        Toast.success('تغییرات ذخیره شد');
      } else {
        State.addTitle(payload);
        Toast.success('عنوان اضافه شد');
      }
      Modal.close();
    });
  }

  function buildItemForm(data) {
    const form = Utils.el('form', { class: 'form' });

    // دسته‌بندی
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

    // عنوان
    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['عنوان ', Utils.el('span', { class: 'req' }, ['*'])]),
      Utils.el('input', {
        class: 'field-input',
        type: 'text',
        name: 'title',
        value: data.title,
        placeholder: 'مثلاً Breaking Bad',
        maxlength: CONFIG.LIMITS.TITLE_MAX,
        required: true
      })
    ]));

    // ردیف: نوع، سال، ژانر
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
        Utils.el('input', {
          class: 'field-input',
          type: 'number',
          name: 'year',
          value: data.year || '',
          placeholder: '2020',
          min: 1900, max: 2100
        })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['ژانر']),
        Utils.el('input', {
          class: 'field-input',
          type: 'text',
          name: 'genre',
          value: data.genre || '',
          placeholder: 'درام، جنایی',
          maxlength: CONFIG.LIMITS.GENRE_MAX
        })
      ])
    ]));

    // امتیاز
    const ratingRow = Utils.el('div', { class: 'rating-picker' });
    const starsWrap = Utils.el('div', { class: 'rating-stars' });
    for (let i = 1; i <= 5; i++) {
      const s = Utils.el('button', { type: 'button', class: 'rating-star', dataset: { star: i } });
      s.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
      starsWrap.appendChild(s);
    }
    const ratingInput = Utils.el('input', {
      class: 'rating-input', type: 'number', name: 'rating',
      value: data.rating || 0, min: 0, max: 10, step: 0.5
    });
    ratingRow.appendChild(starsWrap);
    ratingRow.appendChild(ratingInput);
    ratingRow.appendChild(Utils.el('span', { class: 'text-xs text-3' }, ['از ۱۰']));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['امتیاز']),
      ratingRow
    ]));

    // یادداشت
    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['یادداشت']),
      Utils.el('textarea', {
        class: 'field-textarea', name: 'notes',
        placeholder: 'چی دوست داشتی یا نداشتی…',
        maxlength: CONFIG.LIMITS.NOTES_MAX
      }, [data.notes || ''])
    ]));

    // علاقه‌مندی
    const favSwitch = Utils.el('label', { class: 'switch' });
    const favInp = Utils.el('input', { type: 'checkbox', name: 'favorite' });
    favInp.checked = !!data.favorite;
    favSwitch.appendChild(favInp);
    favSwitch.appendChild(Utils.el('span', { class: 'switch-track' }));

    form.appendChild(Utils.el('div', { class: 'switch-row' }, [
      Utils.el('div', {}, [
        Utils.el('div', { class: 'switch-label' }, ['افزودن به علاقه‌مندی‌ها ⭐']),
        Utils.el('div', { class: 'switch-desc' }, ['برای دسترسی سریع در آینده'])
      ]),
      favSwitch
    ]));

    // اتصال ستاره‌ها به input
    const updateStars = (v) => {
      const n = Math.round(v / 2);
      starsWrap.querySelectorAll('.rating-star').forEach((s, i) => {
        s.classList.toggle('on', i < n);
      });
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

  function collectForm(form) {
    const data = {
      title: form.querySelector('[name="title"]').value.trim(),
      category: form.querySelector('[name="category"]:checked')?.value || 'love',
      type: form.querySelector('[name="type"]').value,
      genre: form.querySelector('[name="genre"]').value.trim(),
      year: form.querySelector('[name="year"]').value ? Number(form.querySelector('[name="year"]').value) : null,
      rating: Number(form.querySelector('[name="rating"]').value) || 0,
      favorite: form.querySelector('[name="favorite"]').checked,
      notes: form.querySelector('[name="notes"]').value.trim(),
      watched_date: null
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
      message: `آیا از حذف «${t.title}» مطمئن هستی؟ این عمل برگشت‌پذیر نیست.`,
      confirmText: 'حذف کن',
      cancelText: 'انصراف',
      danger: true,
      icon: '🗑️',
      onConfirm: () => {
        State.removeTitle(id);
        Toast.success('عنوان حذف شد');
      }
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
        Utils.el('div', { class: 'detail-tags' }, [
          Utils.el('span', { class: 'cat-badge', dataset: { cat: t.category } }, [`${cat.emoji} ${cat.label}`]),
          Utils.el('span', { class: 'badge' }, [CONFIG.TYPES[t.type] || t.type]),
          t.year ? Utils.el('span', { class: 'badge' }, [Utils.toFa(t.year)]) : null,
          t.favorite ? Utils.el('span', { class: 'badge', style: { color: 'var(--warning)' } }, ['⭐ علاقه‌مندی']) : null
        ].filter(Boolean))
      ]),
      Utils.el('div', { class: 'detail-grid' }, [
        detailItem('امتیاز', t.rating ? Utils.toFa(t.rating.toFixed(1)) + ' / ۱۰' : '—'),
        detailItem('ژانر', t.genre || '—'),
        detailItem('نوع', CONFIG.TYPES[t.type] || t.type),
        detailItem('سال', t.year ? Utils.toFa(t.year) : '—'),
        detailItem('افزوده‌شده', Utils.toJalali(t.created_at)),
        detailItem('آخرین ویرایش', Utils.relativeTime(t.updated_at))
      ]),
      t.notes
        ? Utils.el('div', {}, [
            Utils.el('h4', { class: 'mb-2' }, ['یادداشت']),
            Utils.el('div', { class: 'detail-notes' }, [t.notes])
          ])
        : null
    ].filter(Boolean));

    const footer = Utils.el('div', { class: 'flex gap-3 w-full' }, [
      Utils.el('button', { class: 'btn btn-danger', onclick: () => { Modal.close(); setTimeout(() => confirmDelete(id), 150); } }, ['حذف']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => { Modal.close(); setTimeout(() => openAddEdit(id), 150); } }, ['ویرایش']),
      Utils.el('button', { class: 'btn btn-primary', onclick: () => Modal.close() }, ['بستن'])
    ]);

    Modal.open({
      title: 'جزئیات',
      icon: '🎬',
      size: 'lg',
      body,
      footer
    });
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

    const body = Utils.el('div', { class: 'form' }, [
      Utils.el('div', { class: 'alert alert-info' }, [
        Utils.el('span', { class: 'alert-icon' }, ['ℹ️']),
        Utils.el('div', {}, [
          'دیتابیس از طریق GitHub API در مخزن شما ذخیره می‌شود. اگر توکن را وارد نکنی، فقط حالت محلی فعال است.'
        ])
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
          value: s.path, placeholder: 'data/cinema.sqlite'
        }))
      ]),

      field('توکن دسترسی (Personal Access Token)', Utils.el('input', {
        class: 'field-input', type: 'password', name: 'token',
        value: token, placeholder: 'ghp_...'
      }), 'نیاز به دسترسی repo دارد.'),

      Utils.el('div', { class: 'alert alert-warn' }, [
        Utils.el('span', { class: 'alert-icon' }, ['⚠️']),
        Utils.el('div', {}, ['توکن در localStorage مرورگر ذخیره می‌شود. از کامپیوتر عمومی استفاده نکن.'])
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full' }, [
      Utils.el('button', { class: 'btn btn-ghost', id: 'btn-test-conn' }, ['🧪 تست اتصال']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: () => Modal.close() }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'btn-save-settings' }, ['ذخیره'])
    ]);

    Modal.open({ title: 'تنظیمات', icon: '⚙️', size: 'lg', body, footer });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const get = (n) => body.querySelector(`[name="${n}"]`).value.trim();
      GitHub.saveSettings({
        owner: get('owner'),
        repo: get('repo'),
        branch: get('branch') || 'master',
        path: get('path') || 'data/cinema.sqlite'
      });
      GitHub.setToken(get('token'));
      Toast.success('تنظیمات ذخیره شد');
      Modal.close();
      refreshSyncStatus();
    });

    document.getElementById('btn-test-conn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> در حال تست…';
      try {
        // ذخیره موقت
        const get = (n) => body.querySelector(`[name="${n}"]`).value.trim();
        GitHub.saveSettings({
          owner: get('owner'), repo: get('repo'),
          branch: get('branch') || 'master',
          path: get('path') || 'data/cinema.sqlite'
        });
        GitHub.setToken(get('token'));

        const info = await GitHub.testConnection();
        const fileInfo = await GitHub.getFileInfo();
        if (fileInfo.exists) {
          Toast.success(`اتصال موفق — فایل دیتابیس موجود است (${Utils.toFa(Math.round(fileInfo.size/1024))} KB)`);
        } else {
          Toast.warning('اتصال موفق، اما فایل دیتابیس روی مخزن پیدا نشد (اولین push ایجادش می‌کند).');
        }
      } catch (err) {
        Toast.error(err.message || 'تست اتصال ناموفق');
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
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
    if (!GitHub.isConfigured()) {
      Toast.warning('ابتدا توکن و اطلاعات مخزن را در تنظیمات وارد کن');
      return;
    }
    updateSyncStatus('syncing');
    const t = Toast.loading('در حال دریافت از گیت‌هاب…');
    try {
      const res = await DB.pullFromGitHub();
      State.loadAll(); State.applyFilters();
      Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
      Toast.update(t, 'دریافت با موفقیت انجام شد ✅', 'success');
      updateSyncStatus('online');
      State.set({ dirty: false, lastSyncAt: new Date() });
    } catch (e) {
      Toast.update(t, e.message || 'دریافت ناموفق', 'error');
      updateSyncStatus('error');
    }
  }

  async function pushToGitHub() {
    if (!GitHub.isConfigured()) {
      Toast.warning('ابتدا توکن و اطلاعات مخزن را در تنظیمات وارد کن');
      return;
    }
    updateSyncStatus('syncing');
    const t = Toast.loading('در حال ارسال به گیت‌هاب…');
    try {
      await DB.pushToGitHub();
      Toast.update(t, 'ارسال با موفقیت انجام شد ✅', 'success');
      updateSyncStatus('online');
      State.set({ dirty: false, lastSyncAt: new Date() });
    } catch (e) {
      Toast.update(t, e.message || 'ارسال ناموفق', 'error');
      updateSyncStatus('error');
    }
  }

  /* ---------- وضعیت سینک ---------- */
  function updateSyncStatus(state) {
    const el = document.getElementById('sync-status');
    const lbl = document.getElementById('sync-label');
    if (!el || !lbl) return;
    el.dataset.state = state;
    const labels = {
      idle: 'آفلاین',
      syncing: 'در حال سینک',
      online: 'متصل',
      error: 'خطا',
      offline: 'آفلاین'
    };
    lbl.textContent = labels[state] || state;
  }

  function refreshSyncStatus() {
    if (GitHub.isConfigured()) updateSyncStatus('online');
    else updateSyncStatus('idle');
  }

  return { bind, renderList, openAddEdit, confirmDelete, openDetail, openSettings, updateSyncStatus, refreshSyncStatus, pullFromGitHub, pushToGitHub };
})();