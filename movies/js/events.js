/* =========================================================
   مدیریت رویدادها
   ========================================================= */
window.Events = (function () {
  const { $, $$, debounce } = Utils;

  function bind() {
    // Sidebar navigation
    $$('.side-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        const filter = btn.dataset.filter;
        if (view === 'grid') {
          State.set({ categoryFilter: filter || 'all' });
          State.applyFilters();
          Render.switchView('grid');
        } else if (view === 'add') {
          Render.openAdd();
        } else if (view === 'stats') {
          Render.switchView('stats');
          Render.renderStats(State.get().titles);
        } else if (view === 'migrate') {
          Render.switchView('migrate');
        }
      });
    });

    // Search
    const searchInput = $('#global-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        State.set({ search: searchInput.value });
        State.applyFilters();
      }, 200));
    }
    $('#btn-search-clear')?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      State.set({ search: '' });
      State.applyFilters();
      $('#btn-search-clear').hidden = true;
    });
    searchInput?.addEventListener('input', () => {
      const clearBtn = $('#btn-search-clear');
      if (clearBtn) clearBtn.hidden = !searchInput.value;
    });

    // Star filters
    $$('#filter-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('#filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        State.set({ starFilter: chip.dataset.star });
        State.applyFilters();
      });
    });

    // Sort
    $('#sort-select')?.addEventListener('change', (e) => {
      State.set({ sort: e.target.value });
      State.applyFilters();
    });

    // Form submit
    $('#title-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#edit-id').value;
      const payload = {
        title: $('#f-title').value.trim(),
        original_title: $('#f-original').value.trim(),
        category: $('#f-category').value,
        type: $('#f-type').value,
        year: $('#f-year').value ? Number($('#f-year').value) : null,
        rating: Number($('#f-rating').value) || 0,
        genre: $('#f-genre').value.trim(),
        notes: $('#f-notes').value.trim(),
        favorite: $('#f-favorite').checked
      };
      if (!payload.title) {
        Utils.toast('عنوان الزامی است', 'error');
        return;
      }
      Utils.showLoader(true);
      try {
        if (id) {
          await DB.updateTitle(id, payload);
          Utils.toast('به‌روزرسانی شد', 'success');
        } else {
          await DB.addTitle(payload);
          Utils.toast('اضافه شد', 'success');
        }
        await State.loadTitles();
        Render.switchView('grid');
      } catch (err) {
        Utils.toast(err.message || 'خطا در ذخیره', 'error');
      } finally {
        Utils.showLoader(false);
      }
    });

    $('#btn-cancel')?.addEventListener('click', () => {
      Render.switchView('grid');
    });

    $('#btn-empty-add')?.addEventListener('click', () => Render.openAdd());

    // Modal close
    $('#modal-close')?.addEventListener('click', Render.closeModal);
    $('#modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') Render.closeModal();
    });

    // Theme
    $('#btn-theme')?.addEventListener('click', () => {
      const next = State.get().theme === 'dark' ? 'light' : 'dark';
      State.setTheme(next);
    });

    // User / logout
    $('#btn-user')?.addEventListener('click', async () => {
      if (confirm('خروج از حساب؟')) {
        await DB.signOut();
        location.reload();
      }
    });

    // Clock
    setInterval(() => {
      const el = $('#hd-clock');
      if (el) {
        const now = new Date();
        el.textContent = now.toTimeString().slice(0, 8);
      }
    }, 1000);

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        $('#global-search')?.focus();
      }
      if (e.key === 'Escape') Render.closeModal();
    });

    // Menu toggle (mobile)
    $('#btn-menu')?.addEventListener('click', () => {
      $('#sidebar')?.classList.toggle('open');
    });

    // Migrate
    const fileInput = $('#sqlite-file');
    const migrateBtn = $('#btn-migrate');
    const statusEl = $('#migrate-status');
    fileInput?.addEventListener('change', () => {
      migrateBtn.disabled = !fileInput.files?.length;
    });
    migrateBtn?.addEventListener('click', () => doMigrate(fileInput.files[0], statusEl));
  }

  async function doMigrate(file, statusEl) {
    if (!file) return;
    statusEl.innerHTML = '<p>در حال خواندن فایل...</p>';
    Utils.showLoader(true);
    try {
      const buffer = await file.arrayBuffer();
      // Load sql.js
      const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
      });
      const db = new SQL.Database(new Uint8Array(buffer));
      const res = db.exec('SELECT * FROM titles');
      if (!res.length) {
        statusEl.innerHTML = '<p class="error">جدول titles پیدا نشد</p>';
        return;
      }
      const cols = res[0].columns;
      const rows = res[0].values.map(vals => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = vals[i]);
        return obj;
      });
      statusEl.innerHTML = `<p>${rows.length} عنوان پیدا شد. در حال ارسال به سرور...</p>`;
      const count = await DB.bulkInsertTitles(rows);
      statusEl.innerHTML = `<p class="success">✅ ${count} عنوان با موفقیت منتقل شد.</p>`;
      Utils.toast('انتقال کامل شد', 'success');
      await State.loadTitles();
    } catch (e) {
      console.error(e);
      statusEl.innerHTML = `<p class="error">خطا: ${e.message}</p>`;
      Utils.toast(e.message, 'error');
    } finally {
      Utils.showLoader(false);
    }
  }

  return { bind };
})();
