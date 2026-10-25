/* ==========================================================================
   Page — Data Input
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const DOM = App.DOM;
  const State = App.State;
  const Events = App.Events;
  const Format = App.Format;

  let wrapperEl = null;
  let statsEl = null;
  let statsTab = 'overview'; // 'overview' | 'columns'
  let selectionBarEl = null;
  let mounted = false;

  /* ---------- Mount ---------- */

  function mount() {
    if (mounted) return;
    mounted = true;

    wrapperEl = document.getElementById('data-table-wrapper');
    statsEl = document.getElementById('statistics-panel');

    // Wire toolbar
    document.querySelectorAll('#data-toolbar [data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleToolbarAction(btn.dataset.action));
    });

    // Search
    const searchInput = document.getElementById('data-search');
    if (searchInput) {
      const onSearch = App.Utils.debounce((v) => {
        State.setSearchQuery(v);
      }, C.DEFAULTS.SEARCH_DEBOUNCE_MS);
      searchInput.addEventListener('input', (e) => onSearch(e.target.value));
    }

    // Page header buttons (import/export)
    document.querySelectorAll('[data-action="import-excel"]').forEach((b) =>
      b.addEventListener('click', () => openFilePicker())
    );
    document.querySelectorAll('[data-action="export-excel"]').forEach((b) =>
      b.addEventListener('click', handleExportExcel)
    );

    // Hidden file input
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleImport(f);
        fileInput.value = '';
      });
    }

    // Mount data table
    if (wrapperEl) {
      App.DataTable.mount(wrapperEl);
      App.DataTable.installKeyboard();
    }

    // Attach selection bar container
    selectionBarEl = document.createElement('div');

    // Initial render
    renderAll();

    // React to data changes
    Events.on(C.EVENTS.DATA_CHANGED, renderAll);
    Events.on(C.EVENTS.DATA_SELECTION_CHANGED, renderSelectionBar);
    Events.on(C.EVENTS.DATA_LOADED, () => {
      App.Toast.success('داده بارگذاری شد', '');
    });

    // Enable drop on page
    enableFileDrop();
  }

  /* ---------- Toolbar actions ---------- */

  async function handleToolbarAction(action) {
    switch (action) {
      case 'add-row':
        State.addRow();
        break;
      case 'add-column':
        State.addColumn();
        break;
      case 'clear-all':
        await confirmAndClearAll();
        break;
    }
  }

  async function confirmAndClearAll() {
    const ok = await App.Modal.confirm({
      title: 'پاک‌سازی جدول',
      message: 'تمام مقادیر موجود پاک می‌شوند. آیا مطمئن هستید؟',
      danger: true,
      confirmLabel: 'پاک کن'
    });
    if (ok) {
      State.clearAll();
      App.Toast.success('پاک شد', 'تمام مقادیر حذف شدند.');
    }
  }

  /* ---------- Render ---------- */

  function renderAll() {
    renderSelectionBar();
    renderStatistics();
  }

  function renderSelectionBar() {
    if (!wrapperEl) return;
    const existing = document.querySelector('.selection-bar');
    if (existing) existing.remove();

    const sel = State.getData().rowSelection;
    if (!sel || sel.size === 0) return;

    const bar = DOM.el('div', { class: 'selection-bar' });
    bar.appendChild(
      DOM.el('span', {
        class: 'selection-bar__count',
        text: Format.toPersian(String(sel.size))
      })
    );
    bar.appendChild(DOM.el('span', { text: ' سطر انتخاب شده' }));

    const spacer = DOM.el('span', { class: 'spacer' });
    bar.appendChild(spacer);

    const deleteBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--danger btn--sm',
      text: 'حذف'
    });
    deleteBtn.addEventListener('click', async () => {
      const ok = await App.Modal.confirm({
        title: 'حذف سطرها',
        message: `${sel.size} سطر حذف خواهند شد.`,
        danger: true,
        confirmLabel: 'حذف'
      });
      if (ok) {
        State.deleteRows(Array.from(sel));
        App.Toast.success('حذف شد', '');
      }
    });

    const copyBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm',
      text: 'کپی'
    });
    copyBtn.addEventListener('click', () => {
      const data = State.getData();
      const cols = data.columns;
      const selRows = data.rows.filter((r) => sel.has(r.id));
      const header = cols.map((c) => c.name).join('\t');
      const lines = selRows.map((r) => r.cells.join('\t'));
      const text = [header, ...lines].join('\n');
      copyToClipboard(text);
      App.Toast.success('کپی شد', `${selRows.length} سطر`);
    });

    const clearBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm',
      text: 'لغو انتخاب'
    });
    clearBtn.addEventListener('click', () => State.clearSelection());

    bar.appendChild(deleteBtn);
    bar.appendChild(copyBtn);
    bar.appendChild(clearBtn);

    // Insert before statistics
    if (statsEl && statsEl.parentNode) {
      statsEl.parentNode.insertBefore(bar, statsEl);
    }
  }

  /* ---------- Statistics ---------- */

  function renderStatistics() {
    if (!statsEl) return;
    DOM.empty(statsEl);

    const header = DOM.el('div', { class: 'statistics-panel__header' });

    const title = DOM.el('div', { class: 'statistics-panel__title' });
    title.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
    title.appendChild(document.createTextNode(' آمار و خلاصه'));
    header.appendChild(title);

    const tabs = DOM.el('div', { class: 'statistics-panel__tabs' });
    ['overview', 'columns'].forEach((key) => {
      const btn = DOM.el('button', {
        type: 'button',
        class: 'stats-tab' + (statsTab === key ? ' is-active' : ''),
        text: key === 'overview' ? 'نمای کلی' : 'به تفکیک ستون'
      });
      btn.addEventListener('click', () => {
        statsTab = key;
        renderStatistics();
      });
      tabs.appendChild(btn);
    });
    header.appendChild(tabs);
    statsEl.appendChild(header);

    if (statsTab === 'overview') {
      statsEl.appendChild(renderOverview());
    } else {
      statsEl.appendChild(renderColumnStats());
    }
  }

  function renderOverview() {
    const stats = App.DataService.getTableStats();
    const grid = DOM.el('div', { class: 'statistics-grid' });

    grid.appendChild(statCard('تعداد سطرها', Format.toPersian(String(stats.rowCount))));
    grid.appendChild(statCard('تعداد ستون‌ها', Format.toPersian(String(stats.colCount))));
    grid.appendChild(statCard('سلول‌های پر', Format.toPersian(String(stats.nonEmpty))));
    grid.appendChild(statCard('مقادیر عددی', Format.toPersian(String(stats.numeric))));

    return grid;
  }

  function renderColumnStats() {
    const cols = State.getColumns();
    if (cols.length === 0) {
      return DOM.el('div', {
        class: 'empty-state empty-state--compact',
        html: '<div class="empty-state__title">ستونی وجود ندارد</div>'
      });
    }
    const summaries = App.DataService.summarizeAllColumns();
    const grid = DOM.el('div', { class: 'statistics-grid' });

    summaries.forEach((s) => {
      const card = DOM.el('div', { class: 'stat-card' });
      const label = DOM.el('div', { class: 'stat-card__label' });
      label.appendChild(DOM.el('span', {
        class: 'col-type-badge col-type-badge--' + (s.type || 'empty'),
        text: typeSymbol(s.type)
      }));
      label.appendChild(document.createTextNode(s.columnName));
      card.appendChild(label);

      if (s.numericStats && s.numericStats.count > 0) {
        const st = s.numericStats;
        const valueEl = DOM.el('div', {
          class: 'stat-card__value',
          text: Format.formatNumber(st.mean, { decimals: 3 })
        });
        card.appendChild(valueEl);
        card.appendChild(
          DOM.el('div', {
            class: 'stat-card__hint',
            text: `میانگین • ${Format.toPersian(String(st.count))} عدد • محدوده ${Format.formatNumber(st.min, { decimals: 2 })} تا ${Format.formatNumber(st.max, { decimals: 2 })}`
          })
        );
      } else {
        card.appendChild(
          DOM.el('div', {
            class: 'stat-card__value',
            style: { fontSize: 'var(--fs-lg)' },
            text: s.total > 0 ? `${Format.toPersian(String(s.distinct))} مقدار یکتا` : 'خالی'
          })
        );
        card.appendChild(
          DOM.el('div', {
            class: 'stat-card__hint',
            text: s.topValue
              ? `پرتکرارترین: «${truncate(s.topValue, 18)}» (${Format.toPersian(String(s.topCount))} بار)`
              : 'داده‌ای ندارد'
          })
        );
      }
      grid.appendChild(card);
    });

    return grid;
  }

  function statCard(label, value) {
    const card = DOM.el('div', { class: 'stat-card stat-card--accent' });
    card.appendChild(DOM.el('div', { class: 'stat-card__label', text: label }));
    card.appendChild(DOM.el('div', { class: 'stat-card__value', text: value }));
    return card;
  }

  function typeSymbol(t) {
    switch (t) {
      case 'number': return '۱';
      case 'text': return 'A';
      case 'mixed': return '!';
      default: return '·';
    }
  }

  function truncate(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------- Import ---------- */

  function openFilePicker() {
    const input = document.getElementById('excel-file-input');
    if (input) input.click();
  }

  function enableFileDrop() {
    const mainEl = document.getElementById('app-main');
    if (!mainEl) return;
    let dragDepth = 0;

    mainEl.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer || !hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth++;
      mainEl.style.outline = '2px dashed var(--accent)';
      mainEl.style.outlineOffset = '-8px';
    });
    mainEl.addEventListener('dragover', (e) => {
      if (!e.dataTransfer || !hasFiles(e.dataTransfer)) return;
      e.preventDefault();
    });
    mainEl.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        mainEl.style.outline = '';
        mainEl.style.outlineOffset = '';
      }
    });
    mainEl.addEventListener('drop', (e) => {
      dragDepth = 0;
      mainEl.style.outline = '';
      mainEl.style.outlineOffset = '';
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files || []);
      const excel = files.find((f) =>
        /\.(xlsx?|csv)$/i.test(f.name)
      );
      if (excel) {
        e.preventDefault();
        handleImport(excel);
      }
    });
  }

  function hasFiles(dt) {
    if (!dt.types) return false;
    return Array.from(dt.types).indexOf('Files') !== -1;
  }

  function readFileToWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(new Uint8Array(e.target.result), {
            type: 'array',
            cellDates: false
          });
          resolve(wb);
        } catch (err) {
          reject(new Error('فایل اکسل نامعتبر است.'));
        }
      };
      reader.onerror = () => reject(new Error('خطا در خواندن فایل.'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleImport(file) {
    if (!window.XLSX) {
      App.Toast.error('خطا', 'کتابخانهٔ Excel بارگذاری نشده است.');
      return;
    }
    if (file.size > C.LIMITS.MAX_FILE_SIZE_BYTES) {
      App.Toast.error(
        'فایل بسیار بزرگ',
        `حداکثر حجم مجاز ${Format.formatFileSize(C.LIMITS.MAX_FILE_SIZE_BYTES)} است.`
      );
      return;
    }

    try {
      const wb = await readFileToWorkbook(file);
      const sheets = wb.SheetNames || [];
      if (!sheets.length) throw new Error('فایل هیچ شیتی ندارد.');

      let chosen = sheets[0];
      if (sheets.length > 1) {
        const picked = await promptSheetSelection(sheets);
        if (!picked) return;
        chosen = picked;
      }

      const table = App.ExcelService.fromWorkbook(wb, chosen);
      const hasData = State.getRows().some((r) =>
        r.cells.some((c) => c !== '' && c !== null && c !== undefined)
      );
      if (hasData) {
        const ok = await App.Modal.confirm({
          title: 'جایگزینی داده‌ها',
          message: 'داده‌های فعلی با محتوای فایل جایگزین می‌شوند. ادامه می‌دهید؟',
          confirmLabel: 'جایگزین کن'
        });
        if (!ok) return;
      }

      State.replaceData(table.rows, table.columns);
      App.Toast.success(
        'بارگذاری موفق',
        `${Format.toPersian(String(table.rows.length))} سطر × ${Format.toPersian(String(table.columns.length))} ستون`
      );
    } catch (err) {
      App.Toast.error('خطا در بارگذاری', err.message || 'خواندن فایل ممکن نشد.');
    }
  }

  function promptSheetSelection(sheets) {
    return new Promise((resolve) => {
      const container = DOM.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
      let resolved = false;
      let ctrl = null;
      sheets.forEach((name) => {
        const btn = DOM.el('button', {
          type: 'button',
          class: 'btn btn--secondary btn--block',
          text: name
        });
        btn.addEventListener('click', () => {
          resolved = true;
          resolve(name);
          if (ctrl) ctrl.close();
        });
        container.appendChild(btn);
      });

      ctrl = App.Modal.custom({
        title: 'انتخاب شیت',
        subtitle: 'این فایل چند شیت دارد. یکی را انتخاب کنید.',
        icon: 'question',
        body: container,
        footer: [
          {
            label: 'انصراف',
            variant: 'ghost',
            onClick: () => {
              resolved = true;
              resolve(null);
            }
          }
        ],
        onClose: () => {
          if (!resolved) resolve(null);
        }
      });
    });
  }

  /* ---------- Export ---------- */

  function handleExportExcel() {
    if (State.getColumns().length === 0) {
      App.Toast.warning('جدول خالی است', '');
      return;
    }
    const res = App.ExportService.exportData();
    if (res.ok) {
      App.Toast.success('خروجی گرفته شد', res.filename);
    } else {
      App.Toast.error('خطا در خروجی', res.error || '');
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }

  App.PageDataInput = { mount };
})(window);