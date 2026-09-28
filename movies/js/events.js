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

    if (search) {
      search.addEventListener('input', Utils.debounce(function (e) {
        State.set({ search: e.target.value });
        State.applyFilters();
        Render.renderPageTitle();
        renderList();
        clear.hidden = !e.target.value;
      }, CONFIG.DEBOUNCE.SEARCH));
    }

    if (clear) {
      clear.addEventListener('click', function () {
        search.value = '';
        clear.hidden = true;
        State.set({ search: '' });
        State.applyFilters();
        renderList();
        search.focus();
      });
    }

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', function () {
        const next = State.get().theme === 'dark' ? 'light' : 'dark';
        State.setTheme(next);
        Toast.info(next === 'dark' ? 'تم تاریک فعال شد' : 'تم روشن فعال شد');
      });
    }

    const btnStats = document.getElementById('btn-stats');
    if (btnStats) {
      btnStats.addEventListener('click', function () {
        Stats.openDashboard();
        setTimeout(animateDashboardBars, 60);
      });
    }

    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', function () {
        try { openSettings(); }
        catch (err) {
          console.error('[settings]', err);
          Toast.error('باز کردن تنظیمات با خطا مواجه شد — کنسول را چک کن');
        }
      });
    }

    const btnMenu = document.getElementById('btn-menu-toggle');
    if (btnMenu) {
      btnMenu.addEventListener('click', function () {
        const sb = document.getElementById('sidebar');
        const opening = !sb.classList.contains('is-open');
        sb.classList.toggle('is-open', opening);
        document.body.classList.toggle('sidebar-open', opening);
        toggleSidebarBackdrop(opening);
      });
    }

    /* ---- کلیک روی وضعیت گیت‌هاب = ارسال ---- */
    const syncEl = document.getElementById('sync-status');
    if (syncEl) {
      const trigger = function () {
        const cur = syncEl.dataset.state;
        if (cur === 'syncing') {
          Toast.info('در حال ارسال است — کمی صبر کن');
          return;
        }
        pushToGitHub();
      };

      syncEl.addEventListener('click', trigger);
      syncEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger();
        }
      });
    }
  }

  function animateDashboardBars() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const bars = root.querySelectorAll('.bar-fill');
    const vals = Array.from(root.querySelectorAll('.bar-value')).map(function (v) {
      return parseInt(Utils.toEn(v.textContent), 10) || 0;
    });
    const max = Math.max.apply(null, vals.concat([1]));
    bars.forEach(function (b, i) {
      const row = b.closest('.bar-row');
      const val = row && row.querySelector('.bar-value') ? row.querySelector('.bar-value').textContent : '0';
      const pct = parseInt(Utils.toEn(val), 10) || 0;
      setTimeout(function () {
        b.style.width = Math.min((pct / max) * 100, 100) + '%';
      }, i * 40);
    });
  }

  function toggleSidebarBackdrop(show) {
    let bd = document.querySelector('.sidebar-backdrop');
    if (show && !bd) {
      bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', function () {
        const sb = document.getElementById('sidebar');
        if (sb) sb.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
        toggleSidebarBackdrop(false);
      });
      const mount = document.querySelector('.app') || document.body;
      mount.appendChild(bd);
      requestAnimationFrame(function () { bd.classList.add('is-open'); });
    } else if (bd && !show) {
      bd.classList.remove('is-open');
      setTimeout(function () { bd.remove(); }, 250);
    }
  }

  /* ---------- سایدبار ---------- */
  function bindSidebar() {
    document.querySelectorAll('#category-list .side-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#category-list .side-item').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        State.setCategory(btn.dataset.category);
        State.applyFilters();
        Render.renderPageTitle();
        renderList();
        if (window.innerWidth <= 900) {
          const sb = document.getElementById('sidebar');
          if (sb) sb.classList.remove('is-open');
          document.body.classList.remove('sidebar-open');
          toggleSidebarBackdrop(false);
        }
      });
    });

    const ft = document.getElementById('filter-type');
    if (ft) ft.addEventListener('change', function (e) {
      State.set({ filterType: e.target.value });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    const fs = document.getElementById('filter-sort');
    if (fs) fs.addEventListener('change', function (e) {
      State.set({ sort: e.target.value });
      State.applyFilters(); renderList();
    });
    const ff = document.getElementById('filter-favorite');
    if (ff) ff.addEventListener('change', function (e) {
      State.set({ onlyFav: e.target.checked });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });
    const fr = document.getElementById('filter-rated');
    if (fr) fr.addEventListener('change', function (e) {
      State.set({ onlyRated: e.target.checked });
      State.applyFilters(); Render.renderPageTitle(); renderList();
    });

    const btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', function () {
      Utils.download(Utils.timestampName('cinema-backup'), JSON.stringify(DB.exportJSON(), null, 2));
      Toast.success('خروجی JSON ساخته شد');
    });

    const btnImport = document.getElementById('btn-import');
    if (btnImport) btnImport.addEventListener('click', function () {
      document.getElementById('import-file').click();
    });

    const impFile = document.getElementById('import-file');
    if (impFile) impFile.addEventListener('change', async function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        Modal.confirm({
          title: 'ورود داده',
          message: 'آیا ' + Utils.toFa(payload.titles ? payload.titles.length : 0) + ' عنوان اضافه شود؟',
          confirmText: 'افزودن',
          onConfirm: function () {
            const n = DB.importJSON(payload, false);
            State.loadAll(); State.applyFilters();
            Render.renderSidebarCounts(); Render.renderPageTitle(); renderList();
            Toast.success(Utils.toFa(n) + ' عنوان اضافه شد');
          }
        });
      } catch (err) { Toast.error('فایل نامعتبر است'); }
      e.target.value = '';
    });

    const btnPull = document.getElementById('btn-pull');
    if (btnPull) btnPull.addEventListener('click', pullFromGitHub);
    const btnPush = document.getElementById('btn-push');
    if (btnPush) btnPush.addEventListener('click', pushToGitHub);

    const btnBatch = document.getElementById('btn-ai-batch');
    if (btnBatch) btnBatch.addEventListener('click', function () { AIUI.openStandardizeBatch(); });
    const btnAnalyze = document.getElementById('btn-ai-analyze');
    if (btnAnalyze) btnAnalyze.addEventListener('click', function () { AIUI.openAnalysis(); });
  }

  /* ---------- تولبار ---------- */
  function bindToolbar() {
    document.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        State.setView(btn.dataset.view);
        applyViewClass();
      });
    });
    const bAdd = document.getElementById('btn-add');
    if (bAdd) bAdd.addEventListener('click', function () { openAddEdit(); });
    const bEmpty = document.getElementById('btn-empty-add');
    if (bEmpty) bEmpty.addEventListener('click', function () { openAddEdit(); });
  }

  function applyViewClass() {
    const grid = document.getElementById('grid');
    grid.classList.toggle('is-list', State.get().view === 'list');
  }

  /* ---------- کارت‌ها ---------- */
  function bindContent() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    grid.addEventListener('click', function (e) {
      const card = e.target.closest('.card');
      if (!card) return;
      const id = Number(card.dataset.id);
      const actEl = e.target.closest('[data-act]');
      const act = actEl ? actEl.dataset.act : null;

      if (act === 'fav') {
        State.toggleFavorite(id);
        renderList();
        Render.renderSidebarCounts();
      } else if (act === 'edit') {
        openAddEdit(id);
      } else if (act === 'delete') {
        confirmDelete(id);
      } else if (act === 'ai') {
        AIUI.openAnalyzeSingle(id);
      } else {
        openDetail(id);
      }
    });

    grid.addEventListener('keydown', function (e) {
      const card = e.target.closest('.card');
      if (!card) return;
      if (e.key === 'Enter') openDetail(Number(card.dataset.id));
    });
  }

  /* ---------- کیبورد ---------- */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      const inField = active && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(active.tagName) > -1;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const s = document.getElementById('global-search');
        if (s) s.focus();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        pushToGitHub();
        return;
      }
      if (!inField && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openAddEdit();
      }
      if (!inField && e.key.toLowerCase() === 's' && !mod) Stats.openDashboard();
    });
  }

  function bindNetwork() {
    window.addEventListener('online', function () {
      updateSyncStatus('online');
      Toast.success('اتصال برقرار شد');
    });
    window.addEventListener('offline', function () {
      updateSyncStatus('offline');
      Toast.warning('اتصال قطع شد');
    });
  }

  function bindState() {
    State.on('title:added', function () { renderList(); Render.renderSidebarCounts(); });
    State.on('title:updated', function () { renderList(); Render.renderSidebarCounts(); });
    State.on('title:deleted', function () { renderList(); Render.renderSidebarCounts(); });
  }

  function renderList() {
    const grid = document.getElementById('grid');
    const s = State.get();
    Render.renderGrid(grid, s.filtered, s.search);
    Render.toggleEmpty(s.filtered.length === 0);
    Render.renderPageTitle();
  }

  /* =========================================================
     افزودن/ویرایش — با تشخیص تکراری
     ========================================================= */
  function openAddEdit(id) {
    const editing = id != null;
    const data = editing ? DB.getTitle(id) : {
      title: '', category: 'love', type: 'series', genre: '',
      year: null, rating: 0, favorite: false, notes: '', reason: '', watched_date: null
    };
    if (!data) { Toast.error('عنوان پیدا نشد'); return; }

    const form = buildItemForm(data);
    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'form-save' }, [editing ? 'ذخیره تغییرات' : 'افزودن'])
    ]);

    Modal.open({
      title: editing ? 'ویرایش عنوان' : 'افزودن عنوان جدید',
      icon: editing ? '✏️' : '➕',
      body: form, footer: footer, size: 'lg'
    });

    document.getElementById('form-save').addEventListener('click', function () {
      const payload = collectForm(form, data);
      if (!payload) return;

      if (!editing) {
        const similar = DB.findSimilar(payload.title);
        if (similar.length > 0) {
          showDuplicateWarning(similar, payload.title, function () {
            State.addTitle(payload);
            Toast.success('عنوان اضافه شد');
            Modal.close();
          });
          return;
        }
      }

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

  /* =========================================================
     هشدار عنوان مشابه
     ========================================================= */
  function showDuplicateWarning(similar, newTitle, onConfirm) {
    const root = document.getElementById('modal-root');
    const wrappers = root ? Array.from(root.querySelectorAll('.modal-wrapper')) : [];
    const previousWrapper = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;

    if (previousWrapper) {
      previousWrapper.classList.add('is-suspended');
    }

    function restorePrevious() {
      if (!previousWrapper || !document.body.contains(previousWrapper)) return;
      const m = previousWrapper.querySelector('.modal');
      if (m && m.classList.contains('is-closing')) return;
      previousWrapper.classList.remove('is-suspended');
    }

    const matchLabels = {
      exact: 'دقیقاً یکسان',
      contains: 'شامل می‌شود',
      similar: 'شبیه'
    };
    const matchIcons = {
      exact: '⚠️',
      contains: '🔶',
      similar: '🔸'
    };

    const list = similar.map(function (s) {
      const meta = [];
      if (s.year) meta.push(Utils.toFa(s.year));
      const typeLabel = CONFIG.TYPES[s.type] || s.type;
      if (typeLabel) meta.push(typeLabel);

      return Utils.el('div', {
        class: 'dup-item',
        dataset: { match: s._matchType }
      }, [
        Utils.el('span', { class: 'dup-icon' }, [matchIcons[s._matchType] || '🔸']),
        Utils.el('div', { class: 'dup-info' }, [
          Utils.el('div', { class: 'dup-title' }, [s.title]),
          meta.length ? Utils.el('div', { class: 'dup-meta' }, [meta.join(' · ')]) : null
        ].filter(Boolean)),
        Utils.el('span', { class: 'dup-tag' }, [matchLabels[s._matchType] || 'شبیه'])
      ]);
    });

    const body = Utils.el('div', { class: 'dup-warning' }, [
      Utils.el('p', { class: 'dup-intro' }, [
        'عنوانی که می‌خواهی اضافه کنی — ',
        Utils.el('strong', {}, ['«' + newTitle + '»']),
        ' — شبیه این عنوان‌های موجود در آرشیو است:'
      ]),
      Utils.el('div', { class: 'dup-list' }, list),
      Utils.el('p', { class: 'dup-question' }, [
        'اگر یکی از این‌ها همان است که می‌خواستی، انصراف بزن و به‌جایش آن کارت را ویرایش کن. ',
        'در غیر این صورت می‌توانی اضافه کنی.'
      ])
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', {
        class: 'btn btn-ghost',
        onclick: function () { Modal.close(); }
      }, ['انصراف']),
      Utils.el('button', {
        class: 'btn btn-danger',
        onclick: function () {
          Modal.close();
          onConfirm();
        }
      }, ['بله، اضافه کن'])
    ]);

    Modal.open({
      title: 'عنوان مشابه پیدا شد',
      icon: '⚠️',
      size: 'sm',
      body: body,
      footer: footer,
      onClose: restorePrevious
    });
  }

  function buildItemForm(data) {
    const form = Utils.el('form', { class: 'form' });

    const catPicker = Utils.el('div', { class: 'cat-picker' });
    ['love', 'good', 'hate'].forEach(function (c) {
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
      Utils.el('input', {
        class: 'field-input', type: 'text', name: 'title',
        value: data.title, placeholder: 'مثلاً Breaking Bad',
        maxlength: CONFIG.LIMITS.TITLE_MAX, required: true
      })
    ]));

    form.appendChild(Utils.el('div', { class: 'form-row form-row-3' }, [
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['نوع']),
        (function () {
          const s = Utils.el('select', { class: 'field-select', name: 'type' });
          Object.keys(CONFIG.TYPES).forEach(function (k) {
            const o = Utils.el('option', { value: k }, [CONFIG.TYPES[k]]);
            if (data.type === k) o.selected = true;
            s.appendChild(o);
          });
          return s;
        })()
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['سال']),
        Utils.el('input', {
          class: 'field-input', type: 'number', name: 'year',
          value: data.year || '', placeholder: '2020', min: 1900, max: 2100
        })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', { class: 'field-label' }, ['ژانر']),
        Utils.el('input', {
          class: 'field-input', type: 'text', name: 'genre',
          value: data.genre || '', placeholder: 'درام، جنایی',
          maxlength: CONFIG.LIMITS.GENRE_MAX
        })
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
          data.seasons ? Utils.toFa(data.seasons) + ' فصل' : '',
          data.episodes ? ' · ' + Utils.toFa(data.episodes) + ' قسمت' : '',
          data.country ? ' · ' + data.country : ''
        ].filter(Boolean))
      ]));
    }

    const ratingRow = Utils.el('div', { class: 'rating-picker' });
    const starsWrap = Utils.el('div', { class: 'rating-stars' });
    for (let i = 1; i <= 5; i++) {
      const s = Utils.el('button', { type: 'button', class: 'rating-star', dataset: { star: i } });
      s.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
      starsWrap.appendChild(s);
    }
    const ratingInput = Utils.el('input', {
      class: 'rating-input', type: 'number',
      name: 'rating', value: data.rating || 0, min: 0, max: 10, step: 0.5
    });
    ratingRow.appendChild(starsWrap);
    ratingRow.appendChild(ratingInput);
    ratingRow.appendChild(Utils.el('span', { class: 'text-xs text-3' }, ['از ۱۰']));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['امتیاز']), ratingRow
    ]));

    form.appendChild(Utils.el('div', { class: 'field' }, [
      Utils.el('label', { class: 'field-label' }, ['یادداشت']),
      Utils.el('textarea', {
        class: 'field-textarea', name: 'notes',
        placeholder: 'چی دوست داشتی یا نداشتی…',
        maxlength: CONFIG.LIMITS.NOTES_MAX
      }, [data.notes || ''])
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

    const updateStars = function (v) {
      const n = Math.round(v / 2);
      starsWrap.querySelectorAll('.rating-star').forEach(function (s, i) {
        s.classList.toggle('on', i < n);
      });
    };
    updateStars(Number(ratingInput.value) || 0);
    starsWrap.addEventListener('click', function (e) {
      const s = e.target.closest('.rating-star');
      if (!s) return;
      const val = Number(s.dataset.star) * 2;
      ratingInput.value = val;
      updateStars(val);
    });
    ratingInput.addEventListener('input', function () {
      updateStars(Number(ratingInput.value) || 0);
    });

    return form;
  }

  function collectForm(form, original) {
    original = original || {};
    const data = {
      title: form.querySelector('[name="title"]').value.trim(),
      category: (form.querySelector('[name="category"]:checked') || {}).value || 'love',
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
      seasons: original.seasons != null ? original.seasons : null,
      episodes: original.episodes != null ? original.episodes : null,
      episodes_per_season: original.episodes_per_season != null ? original.episodes_per_season : null,
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
      setTimeout(function () { form.classList.remove('anim-shake'); }, 500);
      return null;
    }
    return data;
  }

  function confirmDelete(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    Modal.confirm({
      title: 'حذف عنوان',
      message: 'آیا از حذف «' + t.title + '» مطمئنی؟',
      confirmText: 'حذف کن', danger: true, icon: '🗑️',
      onConfirm: function () { State.removeTitle(id); Toast.success('حذف شد'); }
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
          Utils.el('span', { class: 'cat-badge', dataset: { cat: t.category } }, [cat.emoji + ' ' + cat.label]),
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

      (t.reason || t.story_analysis) ? (function () {
        const box = Utils.el('div', { class: 'story-analysis-box mb-3' });
        AIUI.renderStoryAnalysis(box, t.story_analysis, t.reason, t.category);
        setTimeout(function () {
          box.querySelectorAll('.score-fill').forEach(function (f) {
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
      Utils.el('button', { class: 'btn btn-danger', onclick: function () { Modal.close(); setTimeout(function () { confirmDelete(id); }, 150); } }, ['حذف']),
      Utils.el('button', { class: 'btn btn-soft', onclick: function () { Modal.close(); setTimeout(function () { AIUI.openAnalyzeSingle(id); }, 150); } }, ['🔬 تحلیل AI']),
      Utils.el('div', { class: 'flex-1' }),
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); setTimeout(function () { openAddEdit(id); }, 150); } }, ['ویرایش']),
      Utils.el('button', { class: 'btn btn-primary', onclick: function () { Modal.close(); } }, ['بستن'])
    ]);

    Modal.open({ title: 'جزئیات', icon: '🎬', size: 'xl', body: body, footer: footer });
  }

  function detailItem(k, v) {
    return Utils.el('div', { class: 'detail-item' }, [
      Utils.el('div', { class: 'k' }, [k]),
      Utils.el('div', { class: 'v' }, [v])
    ]);
  }

  /* =========================================================
     انتخاب‌گر کارتی مدل
     ========================================================= */
  function buildModelPicker(currentModelId, onSelect) {
    let selected = currentModelId;
    const models = (CONFIG.AI && CONFIG.AI.MODELS) || [];
    const defaultModel = (CONFIG.AI && CONFIG.AI.DEFAULT_MODEL) || '';

    const searchInput = Utils.el('input', {
      class: 'field-input model-search',
      type: 'text',
      placeholder: 'جستجو در مدل‌ها…',
      autocomplete: 'off'
    });

    const listWrap = Utils.el('div', { class: 'model-list' });
    const statsBar = Utils.el('div', { class: 'model-stats' });

    function renderList(query) {
      listWrap.innerHTML = '';
      const q = Utils.normalizeFa(query || '').toLowerCase();

      const filtered = models.filter(function (m) {
        if (!q) return true;
        const hay = Utils.normalizeFa(
          m.label + ' ' + m.vendor + ' ' + m.id + ' ' + (m.tags || []).join(' ') + ' ' + (m.note || '')
        ).toLowerCase();
        return hay.indexOf(q) > -1;
      });

      if (!filtered.length) {
        listWrap.appendChild(Utils.el('div', { class: 'model-empty' }, [
          models.length ? 'مدلی با این جستجو پیدا نشد' : 'لیست مدل‌ها خالی است'
        ]));
        return;
      }

      filtered.forEach(function (m) {
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
            m.size && m.size !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['⚙']),
              m.size
            ]) : null,
            m.size && m.size !== '—' ? Utils.el('span', { class: 'model-meta-sep' }, ['·']) : null,
            Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['📐']),
              m.context + ' ctx'
            ]),
            m.speed && m.speed !== '—' ? Utils.el('span', { class: 'model-meta-sep' }, ['·']) : null,
            m.speed && m.speed !== '—' ? Utils.el('span', { class: 'model-meta-item' }, [
              Utils.el('span', { class: 'model-meta-icon' }, ['⚡']),
              m.speed + ' t/s'
            ]) : null
          ].filter(Boolean)),

          m.note ? Utils.el('div', { class: 'model-card-note' }, [m.note]) : null,

          (m.tags && m.tags.length) ? Utils.el('div', { class: 'model-card-tags' },
            m.tags.map(function (t) { return Utils.el('span', { class: 'model-tag' }, [t]); })
          ) : null,

          Utils.el('div', { class: 'model-card-id' }, [m.id])
        ]);

        function select() {
          selected = m.id;
          if (onSelect) onSelect(m.id);
          renderList(searchInput.value);
          updateStats();
        }

        card.addEventListener('click', select);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        });

        listWrap.appendChild(card);
      });
    }

    function updateStats() {
      const meta = models.filter(function (m) { return m.id === selected; })[0];
      statsBar.innerHTML = '';
      statsBar.appendChild(Utils.el('span', { class: 'model-stats-count' }, [
        Utils.toFa(models.length) + ' مدل'
      ]));
      if (meta) {
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-sep' }, ['·']));
        statsBar.appendChild(Utils.el('span', { class: 'model-stats-current' }, [
          'فعال: ' + meta.label
        ]));
      }
    }

    searchInput.addEventListener('input', Utils.debounce(function (e) {
      renderList(e.target.value);
    }, 120));

    renderList('');
    updateStats();

    const wrap = Utils.el('div', { class: 'model-picker' }, [
      searchInput,
      statsBar,
      listWrap
    ]);

    return {
      el: wrap,
      getSelected: function () { return selected; }
    };
  }

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
    function input(name, value, opts) {
      opts = opts || {};
      return Utils.el('input', {
        class: 'field-input', type: opts.type || 'text', name: name,
        value: value || '', placeholder: opts.placeholder || '',
        autocomplete: opts.autocomplete || 'off', spellcheck: 'false'
      });
    }

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

    const picker = buildModelPicker(currentModel, function () {});

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
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'btn-save-settings' }, ['💾 ذخیره'])
    ]);

    Modal.open({ title: 'تنظیمات', icon: '⚙️', size: 'xl', body: body, footer: footer });

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
    body.querySelectorAll('.field-input').forEach(function (inp) {
      inp.addEventListener('input', refreshStatus);
    });

    document.getElementById('btn-save-settings').addEventListener('click', function () {
      const g = function (n) { return body.querySelector('[name="' + n + '"]').value.trim(); };

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

      Toast.success('تنظیمات ذخیره شد — مدل: ' + meta.label);
      Modal.close();
      refreshSyncStatus();

      if (window.AILog && g('ai_key')) {
        try {
          AILog.show();
          AILog.success('✓ کلید AI و مدل ذخیره شد');
          AILog.meta('مدل فعال: ' + meta.label);
          AILog.scheduleAutoHide();
        } catch (e) {}
      }
    });

    document.getElementById('btn-test-conn').addEventListener('click', async function (e) {
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> تست…';
      try {
        const g = function (n) { return body.querySelector('[name="' + n + '"]').value.trim(); };
        GitHub.saveSettings({
          owner: g('owner'), repo: g('repo'),
          branch: g('branch') || 'master',
          path: g('path') || 'movies/data/cinema.sqlite'
        });
        GitHub.setToken(g('token'));
        await GitHub.testConnection();
        const fi = await GitHub.getFileInfo();
        if (fi.exists) Toast.success('اتصال موفق ✅ (' + Utils.toFa(Math.round(fi.size / 1024)) + ' KB)');
        else Toast.warning('اتصال موفق، ولی فایل دیتابیس موجود نیست.');
      } catch (err) {
        Toast.error(err.message || 'خطا');
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    document.getElementById('btn-test-ai').addEventListener('click', async function (e) {
      const btn = e.currentTarget;
      const key = body.querySelector('[name="ai_key"]').value.trim();
      const modelId = picker.getSelected();
      const models = (CONFIG.AI && CONFIG.AI.MODELS) || [];
      const meta = models.filter(function (m) { return m.id === modelId; })[0] || { label: modelId };

      AI.setKey(key);

      if (window.AILog) {
        try {
          AILog.show();
          AILog.info('▸ شروع تست AI');
          AILog.meta('مدل: ' + meta.label);
        } catch (err) {}
      }
      if (!key) {
        if (window.AILog) {
          try { AILog.error('✗ کلید AI وارد نشده'); AILog.scheduleAutoHide(); } catch (err) {}
        }
        Toast.warning('ابتدا کلید را وارد کنید');
        return;
      }

      const old = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> تست…';
      try {
        await AI.chatStream({
          model: modelId,
          messages: [
            { role: 'system', content: 'پاسخ فقط کلمه «سلام» باشد.' },
            { role: 'user', content: 'بگو سلام' }
          ],
          temperature: 0,
          onToken: function () {}
        });
        Toast.success('اتصال به ' + meta.label + ' موفق ✅');
      } catch (err) {
        Toast.error(err.message || 'خطا');
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    document.getElementById('btn-ai-log').addEventListener('click', function () {
      AIUI.showLog();
    });
  }

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
    const labels = {
      idle: 'آفلاین',
      syncing: 'در حال سینک',
      online: 'متصل — برای ارسال بزن',
      error: 'خطا — برای تلاش دوباره بزن',
      offline: 'آفلاین'
    };
    lbl.textContent = labels[state] || state;
  }

  function refreshSyncStatus() {
    if (GitHub.isConfigured()) updateSyncStatus('online');
    else updateSyncStatus('idle');
  }

  return {
    bind: bind,
    renderList: renderList,
    openAddEdit: openAddEdit,
    confirmDelete: confirmDelete,
    openDetail: openDetail,
    openSettings: openSettings,
    updateSyncStatus: updateSyncStatus,
    refreshSyncStatus: refreshSyncStatus,
    pullFromGitHub: pullFromGitHub,
    pushToGitHub: pushToGitHub
  };
})();