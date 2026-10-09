/* =========================================================
   مدیریت دیتابیس — مرور، ویرایش، ساختار، SQL
   ========================================================= */
window.DBAdmin = (function () {

  console.log('[db-admin] module loaded');

  const PAGE_SIZE = 40;

  const TABLE_META = {
    titles:        { icon: '🎬', label: 'عنوان‌ها' },
    conversations: { icon: '💬', label: 'پرامپت‌ها' },
    activity:      { icon: '📋', label: 'فعالیت' },
    meta:          { icon: '⚙️', label: 'فراداده' }
  };

  /* روابط منطقی — در اسکیما به‌صورت FOREIGN KEY تعریف نشده‌اند */
  const RELATIONS = {
    conversations: [
      { column: 'title_id', refTable: 'titles', refColumn: 'id', onDelete: 'SET NULL' }
    ]
  };

  const SQL_READ   = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i;
  const SQL_WRITE  = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
  const SQL_SCHEMA = /^\s*(CREATE|ALTER|DROP|VACUUM|REINDEX|ATTACH|DETACH|ANALYZE)\b/i;

  let S = null;
  let escBound = false;

  /* =========================================================
     Entry — صفحه‌ی مستقل (نه مودال)
     ========================================================= */
  function open() {
    console.log('[db-admin] open() called');
    if (document.body.classList.contains('db-mode')) {
      console.log('[db-admin] already in db-mode, ignoring');
      return;
    }
    ensureCss();
    ensurePage();
    document.body.classList.add('db-mode');
    bindEsc();
    initState();
    render();
    console.log('[db-admin] rendered');
  }

  function close() {
    try { Modal.closeAll(); } catch (e) {}
    document.body.classList.remove('db-mode');
    S = null;
  }

  function toggle() {
    if (document.body.classList.contains('db-mode')) close();
    else open();
  }

  function bindEsc() {
    if (escBound) return;
    escBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!document.body.classList.contains('db-mode')) return;
      const root = document.getElementById('modal-root');
      if (root && root.classList.contains('is-open')) return;
      close();
    });
  }

  /* ---- ایجاد #db-page در صورت نبود ---- */
  function ensurePage() {
    let page = document.getElementById('db-page');
    if (page) return page;
    const app = document.getElementById('app');
    if (!app) {
      console.error('[db-admin] no #app element found — cannot mount db page');
      return null;
    }
    page = document.createElement('div');
    page.className = 'db-page';
    page.id = 'db-page';
    const footer = app.querySelector('.app-footer');
    if (footer) app.insertBefore(page, footer);
    else app.appendChild(page);
    console.log('[db-admin] created #db-page on the fly');
    return page;
  }

  /* ---- تزریق CSS حداقلی اگر لینک خارجی نبود ---- */
  function ensureCss() {
    if (document.getElementById('db-admin-css-inline')) return;
    if (document.querySelector('link[href*="db-admin.css"]')) return;
    console.warn('[db-admin] css/db-admin.css not linked — injecting fallback styles');
    const style = document.createElement('style');
    style.id = 'db-admin-css-inline';
    style.textContent = [
      'body.db-mode{overflow:hidden}',
      'body.db-mode .app{grid-template-rows:1fr var(--footer-h)}',
      'body.db-mode .app-header,body.db-mode .ticker,body.db-mode .app-body{display:none}',
      'body.db-mode .db-page{display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--bg-1)}',
      '.db-page-head{display:flex;align-items:center;gap:14px;padding:0 18px;height:var(--header-h);background:var(--bg-0);border-bottom:1px solid var(--border-2);flex-shrink:0}',
      '.db-page-back{padding:6px 12px;font:inherit;font-size:11.5px;font-weight:700;color:var(--text-2);background:var(--bg-2);border:1px solid var(--border-2);cursor:pointer}',
      '.db-page-back:hover{color:var(--accent);border-color:var(--accent)}',
      '.db-page-title{font-size:var(--fs-md);font-weight:700;color:var(--accent);margin:0;flex:1}',
      '.db-page-hint{font-size:10.5px;color:var(--text-4);flex-shrink:0}',
      '.dba{flex:1;min-height:0;display:grid;grid-template-columns:272px minmax(0,1fr);overflow:hidden;font-family:var(--font-mono);font-size:11.5px;color:var(--text-2)}',
      '.dba-side{padding:12px;overflow-y:auto;background:var(--bg-0);border-inline-end:1px solid var(--border-2);min-height:0;display:flex;flex-direction:column;gap:14px}',
      '.dba-main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--bg-1)}',
      '.dba-tabs{display:flex;background:var(--bg-0);border-bottom:1px solid var(--border-2);flex-shrink:0}',
      '.dba-tab{padding:10px 16px;font:inherit;font-size:11px;font-weight:700;color:var(--text-3);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer}',
      '.dba-tab.is-active{color:var(--accent);border-bottom-color:var(--accent);background:var(--bg-1)}',
      '.dba-content{flex:1;min-height:0;overflow:auto;padding:14px 18px 24px}',
      '.dba-foot{display:flex;justify-content:space-between;gap:12px;padding:8px 18px;background:var(--bg-0);border-top:1px solid var(--border-2);flex-shrink:0;flex-wrap:wrap}',
      '.dba-btn{padding:6px 12px;font:inherit;font-size:11px;font-weight:600;color:var(--text-2);background:var(--bg-2);border:1px solid var(--border-2);cursor:pointer}',
      '.dba-btn:hover{background:var(--bg-3);color:var(--text-1)}',
      '.dba-table-wrap{overflow:auto;border:1px solid var(--border-1);background:var(--bg-0);max-height:calc(100vh - 260px)}',
      '.dba-grid{border-collapse:separate;border-spacing:0;width:100%;font-size:11px;font-family:var(--font-mono)}',
      '.dba-grid thead th{position:sticky;top:0;padding:8px 10px;background:var(--bg-2);color:var(--text-3);font-size:10px;text-align:right;border-bottom:1px solid var(--border-2);border-inline-end:1px solid var(--border-1)}',
      '.dba-grid tbody td{padding:6px 10px;color:var(--text-2);border-bottom:1px solid var(--border-1);border-inline-end:1px solid var(--border-1);direction:ltr;text-align:left;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dba-grid tbody tr:hover{background:var(--bg-2)}'
    ].join('');
    document.head.appendChild(style);
  }

  function initState() {
    S = {
      table: null,
      tab: 'data',
      page: 1,
      sort: { column: null, dir: 'asc' },
      filter: { column: '__all__', value: '' },
      tables: [],
      columns: [],
      pkColumns: [],
      indices: [],
      fks: [],
      declaredRels: [],
      rowCount: 0,
      filteredCount: 0,
      rows: [],
      rawSql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;\n",
      rawResult: null,
      rawError: null,
      rawHistory: [],
      status: 'آماده',
      sideEl: null, mainEl: null, contentEl: null, footEl: null
    };
  }

  function render() {
    const page = ensurePage();
    if (!page) {
      document.body.classList.remove('db-mode');
      return;
    }
    page.innerHTML = '';

    /* ---- نوار بالا ---- */
    page.appendChild(Utils.el('div', { class: 'db-page-head' }, [
      Utils.el('button', {
        class: 'db-page-back',
        type: 'button',
        onclick: close
      }, ['← بازگشت به کتابخانه']),
      Utils.el('h2', { class: 'db-page-title' }, ['🗄️ مدیریت دیتابیس']),
      Utils.el('span', { class: 'db-page-hint' }, ['Esc = خروج'])
    ]));

    /* ---- چیدمان ---- */
    const root = Utils.el('div', { class: 'dba' });
    S.sideEl = Utils.el('aside', { class: 'dba-side' });
    S.mainEl = Utils.el('main', { class: 'dba-main' });
    root.appendChild(S.sideEl);
    root.appendChild(S.mainEl);
    page.appendChild(root);

    /* ---- فوتر ---- */
    S.footEl = Utils.el('div', { class: 'dba-foot' });
    page.appendChild(S.footEl);

    loadTables();
    renderSide();
    renderFooter();

    if (S.tables.length) selectTable(S.tables[0].name);
    else renderMain();
  }

  /* =========================================================
     Load
     ========================================================= */
  function loadTables() {
    try { S.tables = DB.listTables(); }
    catch (e) { S.tables = []; Toast.error('خواندن جدول‌ها ناموفق: ' + e.message); }
  }

  function selectTable(name) {
    S.table = name;
    S.page = 1;
    S.sort = { column: null, dir: 'asc' };
    S.filter = { column: '__all__', value: '' };
    if (S.tab === 'sql') S.tab = 'data';
    refreshTable();
    renderSide();
  }

  function refreshTable() {
    if (!S.table) return;
    try {
      S.columns = DB.getTableColumns(S.table);
      S.pkColumns = S.columns.filter(function (c) { return c.pk > 0; })
        .sort(function (a, b) { return a.pk - b.pk; });
      S.indices = DB.getTableIndices(S.table);
      S.fks = DB.getForeignKeys(S.table);
      S.declaredRels = RELATIONS[S.table] || [];
      S.rowCount = DB.getTableRowCount(S.table);
      loadRows();
    } catch (e) {
      Toast.error('خواندن اطلاعات جدول: ' + e.message);
      S.columns = []; S.pkColumns = []; S.indices = []; S.fks = [];
      S.rows = []; S.rowCount = 0; S.filteredCount = 0;
    }
    renderMain();
  }

  function loadRows() {
    const offset = (S.page - 1) * PAGE_SIZE;
    try {
      S.rows = DB.getTableRows(S.table, {
        limit: PAGE_SIZE, offset: offset,
        orderBy: S.sort.column, orderDir: S.sort.dir,
        filterColumn: S.filter.column, filterValue: S.filter.value
      });
      S.filteredCount = DB.getTableRowCountFiltered(S.table, S.filter.column, S.filter.value);
    } catch (e) {
      S.rows = []; S.filteredCount = 0;
      Toast.error('خواندن ردیف‌ها: ' + e.message);
    }
  }

  function afterWrite(table) {
    if (table === 'titles') {
      try {
        State.loadAll();
        State.applyFilters();
        Events.renderList();
        Render.renderSidebarCounts();
      } catch (e) {}
    }
    loadTables();
    refreshTable();
    renderSide();
  }

  /* =========================================================
     Sidebar
     ========================================================= */
  function renderSide() {
    if (!S || !S.sideEl) return;
    const side = S.sideEl;
    side.innerHTML = '';

    side.appendChild(Utils.el('div', { class: 'dba-side-head' }, [
      Utils.el('span', { class: 'dba-side-title' }, ['TABLES']),
      Utils.el('span', { class: 'dba-side-count' }, [Utils.toFa(S.tables.length)])
    ]));

    const list = Utils.el('ul', { class: 'dba-tables' });
    S.tables.forEach(function (t) {
      const meta = TABLE_META[t.name] || { icon: '📦', label: t.name };
      let count = 0;
      try { count = DB.getTableRowCount(t.name); } catch (e) {}
      list.appendChild(Utils.el('li', {}, [
        Utils.el('button', {
          class: 'dba-table-btn' + (t.name === S.table ? ' is-active' : ''),
          type: 'button',
          onclick: function () { selectTable(t.name); }
        }, [
          Utils.el('span', { class: 'dba-table-icon' }, [meta.icon]),
          Utils.el('span', { class: 'dba-table-info' }, [
            Utils.el('span', { class: 'dba-table-name' }, [meta.label]),
            Utils.el('span', { class: 'dba-table-sub' }, [t.name])
          ]),
          Utils.el('span', { class: 'dba-table-count' }, [Utils.toFa(count)])
        ])
      ]));
    });
    side.appendChild(list);

    let info = null;
    try { info = DB.getDbInfo(); } catch (e) {}
    if (info) {
      side.appendChild(Utils.el('div', { class: 'dba-dbinfo' }, [
        Utils.el('div', { class: 'dba-dbinfo-title' }, ['DATABASE']),
        infoRow('حجم', formatBytes(info.sizeBytes)),
        infoRow('صفحه', Utils.toFa(info.pageCount) + ' × ' + Utils.toFa(info.pageSize) + 'B'),
        infoRow('رمزگذاری', info.encoding || '—'),
        infoRow('اسکیما', info.schemaVersion != null ? Utils.toFa(info.schemaVersion) : '—'),
        infoRow('FK', info.foreignKeysOn ? 'فعال' : 'غیرفعال'),
        infoRow('ژورنال', info.journalMode || '—')
      ]));
    }
  }

  function infoRow(k, v) {
    return Utils.el('div', { class: 'dba-dbinfo-row' }, [
      Utils.el('span', { class: 'dba-dbinfo-k' }, [k]),
      Utils.el('span', { class: 'dba-dbinfo-v' }, [v])
    ]);
  }

  function formatBytes(n) {
    if (!n) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return Utils.toFa(n.toFixed(n < 10 && i > 0 ? 1 : 0)) + ' ' + units[i];
  }

  /* =========================================================
     Footer
     ========================================================= */
  function renderFooter() {
    if (!S || !S.footEl) return;
    const f = S.footEl;
    f.innerHTML = '';

    f.appendChild(Utils.el('div', { class: 'dba-foot-status' }, [
      Utils.el('span', { class: 'dba-status-dot' }),
      Utils.el('span', {}, [S.status || 'آماده'])
    ]));

    f.appendChild(Utils.el('div', { class: 'dba-foot-actions' }, [
      Utils.el('button', { class: 'dba-btn', type: 'button', onclick: runIntegrity }, ['🧪 بررسی سلامت']),
      Utils.el('button', { class: 'dba-btn', type: 'button', onclick: runVacuum }, ['🧹 فشرده‌سازی']),
      Utils.el('button', { class: 'dba-btn', type: 'button', onclick: exportSqlite }, ['⬇ فایل SQLite']),
      Utils.el('button', { class: 'dba-btn dba-btn-primary', type: 'button', onclick: close }, ['بازگشت'])
    ]));
  }

  function setStatus(msg) {
    if (!S) return;
    S.status = msg;
    if (!S.footEl) return;
    const el = S.footEl.querySelector('.dba-foot-status span:last-child');
    if (el) el.textContent = msg;
  }

  function runIntegrity() {
    try {
      const out = DB.integrityCheck();
      const ok = out.length === 1 && /^ok$/i.test(out[0]);
      setStatus(ok ? 'سلامت: ok ✓' : 'سلامت: ' + out.join(' | '));
      if (ok) Toast.success('دیتابیس سالم است');
      else Toast.warning('مشکل یافت شد — جزئیات در نوار پایین');
    } catch (e) { Toast.error('بررسی سلامت: ' + e.message); }
  }

  function runVacuum() {
    Modal.confirm({
      title: 'فشرده‌سازی دیتابیس',
      message: 'VACUUM جدول‌ها را بازنویسی می‌کند و حجم فایل را کم می‌کند. ادامه؟',
      icon: '🧹',
      confirmText: 'اجرا کن',
      onConfirm: function () {
        try {
          DB.vacuum();
          setStatus('فشرده‌سازی انجام شد');
          loadTables(); refreshTable(); renderSide();
          Toast.success('فشرده‌سازی انجام شد');
        } catch (e) { Toast.error('VACUUM: ' + e.message); }
      }
    });
  }

  function exportSqlite() {
    try {
      const bytes = DB.exportBinary();
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      Utils.download(Utils.timestampName('cinema-db', 'sqlite'), blob, 'application/x-sqlite3');
      setStatus('فایل SQLite ساخته شد');
    } catch (e) { Toast.error('خروجی: ' + e.message); }
  }

  /* =========================================================
     Main — تب‌ها
     ========================================================= */
  function renderMain() {
    if (!S || !S.mainEl) return;
    S.mainEl.innerHTML = '';

    if (!S.table) {
      S.mainEl.appendChild(Utils.el('div', { class: 'dba-empty' }, ['جدولی برای نمایش وجود ندارد']));
      return;
    }

    const TABS = [
      ['data',      'داده‌ها'],
      ['structure', 'ساختار'],
      ['indices',   'ایندکس‌ها'],
      ['keys',      'کلیدها'],
      ['sql',       'SQL']
    ];

    const tabs = Utils.el('div', { class: 'dba-tabs' });
    TABS.forEach(function (t) {
      tabs.appendChild(Utils.el('button', {
        class: 'dba-tab' + (S.tab === t[0] ? ' is-active' : ''),
        type: 'button',
        onclick: function () { S.tab = t[0]; renderMain(); }
      }, [t[1]]));
    });
    S.mainEl.appendChild(tabs);

    const content = Utils.el('div', { class: 'dba-content' });
    S.mainEl.appendChild(content);
    S.contentEl = content;

    if (S.tab === 'data') renderDataTab(content);
    else if (S.tab === 'structure') renderStructureTab(content);
    else if (S.tab === 'indices') renderIndicesTab(content);
    else if (S.tab === 'keys') renderKeysTab(content);
    else if (S.tab === 'sql') renderSqlTab(content);
  }

  /* =========================================================
     تب داده‌ها
     ========================================================= */
  function renderDataTab(host) {
    const tb = Utils.el('div', { class: 'dba-toolbar' });

    const filterInput = Utils.el('input', {
      class: 'dba-input', type: 'search',
      placeholder: 'جستجو…',
      value: S.filter.value,
      autocomplete: 'off'
    });
    filterInput.addEventListener('input', Utils.debounce(function (e) {
      S.filter.value = e.target.value;
      S.page = 1;
      loadRows();
      rebuildTable();
      rebuildPager();
    }, 220));
    tb.appendChild(filterInput);

    const colSel = Utils.el('select', { class: 'dba-select' });
    colSel.appendChild(Utils.el('option', { value: '__all__' }, ['همه ستون‌ها']));
    S.columns.forEach(function (c) {
      const o = Utils.el('option', { value: c.name }, [c.name]);
      if (S.filter.column === c.name) o.selected = true;
      colSel.appendChild(o);
    });
    colSel.addEventListener('change', function (e) {
      S.filter.column = e.target.value;
      S.page = 1;
      loadRows();
      rebuildTable();
      rebuildPager();
    });
    tb.appendChild(colSel);

    tb.appendChild(Utils.el('button', {
      class: 'dba-btn', type: 'button', title: 'پاک کردن فیلتر',
      onclick: function () {
        S.filter = { column: '__all__', value: '' };
        S.page = 1;
        loadRows();
        renderDataTab(host);
      }
    }, ['✕']));

    tb.appendChild(Utils.el('button', {
      class: 'dba-btn', type: 'button',
      onclick: function () { loadRows(); rebuildTable(); rebuildPager(); }
    }, ['🔄 بازخوانی']));

    tb.appendChild(Utils.el('div', { class: 'dba-toolbar-spacer' }));

    tb.appendChild(Utils.el('div', { class: 'dba-meta' }, [
      Utils.el('span', {}, ['ردیف: ', Utils.el('b', {}, [Utils.toFa(S.rowCount)])]),
      S.filter.value ? Utils.el('span', {}, ['فیلتر: ', Utils.el('b', {}, [Utils.toFa(S.filteredCount)])]) : null
    ].filter(Boolean)));

    tb.appendChild(Utils.el('button', {
      class: 'dba-btn dba-btn-primary', type: 'button',
      onclick: function () { openRowEditor('insert', null); }
    }, ['+ افزودن ردیف']));

    host.appendChild(tb);

    const wrap = Utils.el('div', { class: 'dba-table-wrap' });
    const pager = Utils.el('div', { class: 'dba-pager' });
    host.appendChild(wrap);
    host.appendChild(pager);

    rebuildTable();
    rebuildPager();

    function rebuildTable() {
      wrap.innerHTML = '';
      if (!S.columns.length) {
        wrap.appendChild(Utils.el('div', { class: 'dba-empty' }, ['جدول ستونی ندارد']));
        return;
      }

      const tbl = Utils.el('table', { class: 'dba-grid' });
      const thead = Utils.el('thead');
      const htr = Utils.el('tr');

      S.columns.forEach(function (c) {
        const isPk = c.pk > 0;
        const isSorted = S.sort.column === c.name;
        const th = Utils.el('th', {
          class: (isPk ? 'is-pk ' : '') + (isSorted ? 'is-sorted' : ''),
          title: (c.type || '') + (isPk ? ' · PRIMARY KEY' : '') + (c.notnull ? ' · NOT NULL' : ''),
          onclick: function () {
            if (S.sort.column === c.name) {
              S.sort.dir = S.sort.dir === 'asc' ? 'desc' : 'asc';
            } else {
              S.sort.column = c.name;
              S.sort.dir = 'asc';
            }
            loadRows();
            rebuildTable();
          }
        }, [
          Utils.el('span', {}, [c.name]),
          isSorted ? Utils.el('span', { class: 'dba-sort-ind' }, [S.sort.dir === 'asc' ? '▲' : '▼']) : null
        ].filter(Boolean));
        htr.appendChild(th);
      });

      htr.appendChild(Utils.el('th', { class: 'dba-actions-col' }, ['']));
      thead.appendChild(htr);
      tbl.appendChild(thead);

      const tbody = Utils.el('tbody');
      if (!S.rows.length) {
        const tr = Utils.el('tr');
        const td = Utils.el('td', { colspan: String(S.columns.length + 1) });
        td.appendChild(Utils.el('div', { class: 'dba-empty' }, ['ردیفی نیست']));
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        S.rows.forEach(function (row) {
          const tr = Utils.el('tr', {
            onclick: function (e) {
              if (e.target.closest('.dba-actions-col')) return;
              openRowEditor('edit', row);
            }
          });
          S.columns.forEach(function (c) {
            tr.appendChild(renderCell(row[c.name], c));
          });
          tr.appendChild(renderActions(row));
          tbody.appendChild(tr);
        });
      }
      tbl.appendChild(tbody);
      wrap.appendChild(tbl);
    }

    function rebuildPager() {
      pager.innerHTML = '';
      const total = S.filteredCount;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (pages <= 1) {
        if (total) pager.appendChild(Utils.el('div', { class: 'dba-page-info' }, [Utils.toFa(total) + ' ردیف']));
        return;
      }
      const btn = function (label, target, disabled, active) {
        return Utils.el('button', {
          class: 'dba-page-btn' + (active ? ' is-active' : ''),
          type: 'button',
          disabled: !!disabled,
          onclick: function () {
            S.page = target;
            loadRows();
            rebuildTable();
            rebuildPager();
          }
        }, [label]);
      };

      pager.appendChild(btn('‹', Math.max(1, S.page - 1), S.page <= 1));

      const set = new Set([1, pages, S.page, S.page - 1, S.page + 1, S.page - 2, S.page + 2]);
      const list = Array.from(set).filter(function (n) { return n >= 1 && n <= pages; }).sort(function (a, b) { return a - b; });
      let prev = 0;
      list.forEach(function (n) {
        if (prev && n - prev > 1) pager.appendChild(Utils.el('span', { class: 'dba-page-info' }, ['…']));
        pager.appendChild(btn(Utils.toFa(n), n, false, n === S.page));
        prev = n;
      });

      pager.appendChild(btn('›', Math.min(pages, S.page + 1), S.page >= pages));
      pager.appendChild(Utils.el('div', { class: 'dba-page-info' }, [
        Utils.toFa(S.page) + ' / ' + Utils.toFa(pages) + ' — ' + Utils.toFa(total)
      ]));
    }
  }

  function renderCell(value, col) {
    const isNum = /INT|REAL|NUM|DEC|FLOA|DOUB/i.test(col.type || '') ||
      (value != null && typeof value === 'number');

    if (value == null) {
      return Utils.el('td', { class: 'dba-cell-null' }, ['NULL']);
    }
    if (value instanceof Uint8Array || (value && value.buffer instanceof ArrayBuffer && typeof value !== 'string')) {
      const len = value.length != null ? value.length : (value.byteLength || 0);
      return Utils.el('td', { class: 'dba-cell-blob' }, ['BLOB(' + Utils.toFa(len) + 'B)']);
    }
    const s = String(value);
    const td = Utils.el('td', { class: isNum ? 'dba-cell-num' : '', title: s });
    td.textContent = s.length > 240 ? s.slice(0, 240) + '…' : s;
    return td;
  }

  function renderActions(row) {
    const cell = Utils.el('td', { class: 'dba-actions-col' });
    const box = Utils.el('div', { class: 'dba-row-actions' });
    box.appendChild(Utils.el('button', {
      class: 'dba-row-act', type: 'button', title: 'ویرایش',
      onclick: function (e) { e.stopPropagation(); openRowEditor('edit', row); }
    }, ['✏️']));
    box.appendChild(Utils.el('button', {
      class: 'dba-row-act dba-del', type: 'button', title: 'حذف',
      onclick: function (e) { e.stopPropagation(); confirmDelete(row); }
    }, ['🗑️']));
    cell.appendChild(box);
    return cell;
  }

  /* =========================================================
     ویرایش ردیف
     ========================================================= */
  function pkMapOf(row) {
    const map = {};
    S.pkColumns.forEach(function (c) { map[c.name] = row ? row[c.name] : null; });
    return map;
  }

  function confirmDelete(row) {
    const pk = pkMapOf(row);
    const desc = Object.keys(pk).map(function (k) { return k + '=' + pk[k]; }).join(', ') || '(بدون PK)';
    Modal.confirm({
      title: 'حذف ردیف',
      message: 'ردیف با ' + desc + ' از جدول ' + S.table + ' حذف شود؟',
      icon: '🗑️',
      danger: true,
      confirmText: 'حذف کن',
      onConfirm: function () {
        try {
          if (!S.pkColumns.length) { Toast.error('جدول کلید اصلی ندارد'); return; }
          const changes = DB.deleteRow(S.table, pk);
          setStatus(changes + ' ردیف حذف شد');
          Toast.success('حذف شد');
          afterWrite(S.table);
        } catch (e) { Toast.error('حذف: ' + e.message); }
      }
    });
  }

  function openRowEditor(mode, rowData) {
    const isEdit = mode === 'edit';
    const tableRow = S.tables.filter(function (t) { return t.name === S.table; })[0];
    const tableSql = (tableRow && tableRow.sql) || '';
    const autoInc = /AUTOINCREMENT/i.test(tableSql);
    const pkNames = S.pkColumns.map(function (c) { return c.name; });

    const fields = [];

    const form = Utils.el('div', { class: 'dba-form' });

    S.columns.forEach(function (col) {
      const isPk = col.pk > 0;
      const isSingleAutoInc = isPk && autoInc && pkNames.length === 1;
      const disabled = isEdit && (isPk || isSingleAutoInc);
      const original = isEdit && rowData ? rowData[col.name] : null;
      const isNull = isEdit ? original == null : false;

      const input = makeInputFor(col, original, disabled);
      const nullCheck = Utils.el('input', { type: 'checkbox' });
      nullCheck.checked = isNull;
      if (disabled || col.notnull) nullCheck.disabled = true;
      if (nullCheck.checked) input.disabled = true;

      nullCheck.addEventListener('change', function () {
        input.disabled = nullCheck.checked || disabled;
      });

      fields.push({ col: col, input: input, nullCheck: nullCheck, disabled: disabled });

      const tags = [];
      if (isPk) tags.push(Utils.el('span', { class: 'dba-tag dba-tag-pk' }, ['PK']));
      if (isPk && isSingleAutoInc) tags.push(Utils.el('span', { class: 'dba-tag' }, ['AUTOINC']));
      if (col.notnull) tags.push(Utils.el('span', { class: 'dba-tag dba-tag-notnull' }, ['NOT NULL']));
      const fk = S.fks.filter(function (f) { return f.from === col.name; })[0];
      const rel = S.declaredRels.filter(function (r) { return r.column === col.name; })[0];
      if (fk) tags.push(Utils.el('span', { class: 'dba-tag dba-tag-fk' }, ['FK → ' + fk.table + '.' + fk.to]));
      else if (rel) tags.push(Utils.el('span', { class: 'dba-tag dba-tag-fk' }, ['FK → ' + rel.refTable + '.' + rel.refColumn]));

      form.appendChild(Utils.el('div', { class: 'dba-form-row' }, [
        Utils.el('div', { class: 'dba-form-head' }, [
          Utils.el('span', { class: 'dba-form-name' }, [col.name]),
          Utils.el('span', { class: 'dba-form-type' }, [col.type || 'ANY']),
          tags.length ? Utils.el('div', { class: 'dba-form-tags' }, tags) : null
        ].filter(Boolean)),
        Utils.el('div', { class: 'dba-form-body' }, [
          input,
          Utils.el('label', { class: 'dba-form-null' }, [
            nullCheck,
            Utils.el('span', {}, ['NULL'])
          ])
        ])
      ]));
    });

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'dba-meta', style: { marginBottom: '10px' } }, [
        Utils.el('span', {}, ['جدول: ', Utils.el('b', {}, [S.table])]),
        Utils.el('span', {}, [isEdit ? 'حالت: ویرایش' : 'حالت: افزودن'])
      ]),
      form
    ]);

    const footer = Utils.el('div', { class: 'flex gap-3 w-full justify-end' }, [
      Utils.el('button', { class: 'btn btn-ghost', onclick: function () { Modal.close(); } }, ['انصراف']),
      Utils.el('button', { class: 'btn btn-primary', id: 'dba-row-save' }, [isEdit ? 'ذخیره تغییرات' : 'افزودن'])
    ]);

    Modal.open({
      title: isEdit ? 'ویرایش ردیف' : 'افزودن ردیف',
      icon: isEdit ? '✏️' : '➕',
      size: 'lg',
      body: body,
      footer: footer
    });

    document.getElementById('dba-row-save').addEventListener('click', function () {
      const data = {};
      const pkMap = {};

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.nullCheck.checked) {
          data[f.col.name] = null;
        } else {
          data[f.col.name] = coerceValue(f.input.value, f.col);
        }
        if (isEdit && f.col.pk > 0) pkMap[f.col.name] = rowData[f.col.name];
      }

      if (isEdit && !S.pkColumns.length) {
        Toast.error('جدول کلید اصلی ندارد — ویرایش ممکن نیست');
        return;
      }

      try {
        if (isEdit) {
          const changes = DB.updateRow(S.table, pkMap, data);
          setStatus(changes + ' ردیف ویرایش شد');
          Toast.success('ذخیره شد');
        } else {
          if (autoInc && pkNames.length === 1 && pkNames[0] in data && (data[pkNames[0]] == null || data[pkNames[0]] === '')) {
            delete data[pkNames[0]];
          }
          const id = DB.insertRow(S.table, data);
          setStatus('ردیف جدید — id=' + id);
          Toast.success('ردیف اضافه شد');
        }
        Modal.close();
        setTimeout(function () { afterWrite(S.table); }, 120);
      } catch (e) {
        Toast.error('ذخیره: ' + e.message);
      }
    });
  }

  function makeInputFor(col, value, disabled) {
    const t = String(col.type || '').toUpperCase();
    const v = value == null ? '' : String(value);

    if (/INT|REAL|NUM|DEC|FLOA|DOUB/.test(t)) {
      return Utils.el('input', {
        class: 'field-input', type: 'number',
        value: v, disabled: disabled,
        step: /REAL|FLOA|DOUB|DEC/.test(t) ? 'any' : '1',
        dataset: { col: col.name }
      });
    }
    if (v.length > 80 || /TEXT/.test(t) && v.length > 60) {
      return Utils.el('textarea', {
        class: 'field-textarea',
        disabled: disabled,
        dataset: { col: col.name }
      }, [v]);
    }
    return Utils.el('input', {
      class: 'field-input', type: 'text',
      value: v, disabled: disabled,
      dataset: { col: col.name }
    });
  }

  function coerceValue(raw, col) {
    const t = String(col.type || '').toUpperCase();
    const s = String(raw == null ? '' : raw);
    if (/INT/.test(t)) {
      if (s === '') return null;
      const n = Number(s);
      return isNaN(n) ? s : Math.trunc(n);
    }
    if (/REAL|FLOA|DOUB|NUM|DEC/.test(t)) {
      if (s === '') return null;
      const n = Number(s);
      return isNaN(n) ? s : n;
    }
    return s;
  }

  /* =========================================================
     تب ساختار
     ========================================================= */
  function renderStructureTab(host) {
    const tableRow = S.tables.filter(function (t) { return t.name === S.table; })[0];

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [
        Utils.el('span', {}, ['CREATE STATEMENT']),
        Utils.el('em', {}, [S.table])
      ]),
      Utils.el('div', { class: 'dba-block-body' }, [
        Utils.el('div', {
          class: 'dba-sql-editor',
          style: { minHeight: 'auto', maxHeight: 'none', whiteSpace: 'pre', cursor: 'text', overflowX: 'auto' }
        }, [(tableRow && tableRow.sql) || '—'])
      ])
    ]));

    const rows = S.columns.map(function (c) {
      const isPk = c.pk > 0;
      const fk = S.fks.filter(function (f) { return f.from === c.name; })[0];
      const rel = S.declaredRels.filter(function (r) { return r.column === c.name; })[0];

      let refCell = '—';
      if (fk) {
        refCell = Utils.el('span', {
          class: 'dba-ref',
          onclick: function () { if (fk.table) selectTable(fk.table); }
        }, [fk.table + '.' + fk.to]);
      } else if (rel) {
        refCell = Utils.el('span', {
          class: 'dba-ref',
          onclick: function () { selectTable(rel.refTable); }
        }, [rel.refTable + '.' + rel.refColumn]);
      }

      return Utils.el('tr', {}, [
        Utils.el('td', { class: 'num' }, [Utils.toFa(c.cid)]),
        Utils.el('td', { class: 'ltr' }, [c.name]),
        Utils.el('td', { class: 'ltr' }, [c.type || 'ANY']),
        Utils.el('td', {}, [
          c.notnull ? Utils.el('span', { class: 'dba-tag dba-tag-notnull' }, ['NOT NULL']) : Utils.el('span', { class: 'dba-tag' }, ['NULL ok'])
        ]),
        Utils.el('td', { class: 'ltr' }, [c.dflt_value == null ? '—' : String(c.dflt_value)]),
        Utils.el('td', {}, [
          isPk ? Utils.el('span', { class: 'dba-tag dba-tag-pk' }, ['PK #' + c.pk]) : Utils.el('span', {}, ['—'])
        ]),
        Utils.el('td', {}, [refCell])
      ]);
    });

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [
        Utils.el('span', {}, ['COLUMNS']),
        Utils.el('em', {}, [Utils.toFa(S.columns.length) + ' ستون'])
      ]),
      Utils.el('div', { class: 'dba-block-body', style: { padding: '0' } }, [
        Utils.el('table', { class: 'dba-kv-table' }, [
          Utils.el('thead', {}, [Utils.el('tr', {}, [
            Utils.el('th', {}, ['CID']),
            Utils.el('th', {}, ['NAME']),
            Utils.el('th', {}, ['TYPE']),
            Utils.el('th', {}, ['NULLABLE']),
            Utils.el('th', {}, ['DEFAULT']),
            Utils.el('th', {}, ['KEY']),
            Utils.el('th', {}, ['REFERENCES'])
          ])]),
          Utils.el('tbody', {}, rows)
        ])
      ])
    ]));
  }

  /* =========================================================
     تب ایندکس‌ها
     ========================================================= */
  function renderIndicesTab(host) {
    if (!S.indices.length) {
      host.appendChild(Utils.el('div', { class: 'dba-empty' }, ['این جدول ایندکسی ندارد']));
      return;
    }

    const originLabel = { c: 'ساخته‌شده با CREATE INDEX', u: 'قید UNIQUE', pk: 'کلید اصلی' };

    const rows = S.indices.map(function (ix) {
      return Utils.el('tr', {}, [
        Utils.el('td', { class: 'ltr' }, [ix.name]),
        Utils.el('td', {}, [
          ix.unique ? Utils.el('span', { class: 'dba-tag dba-tag-unique' }, ['UNIQUE']) : Utils.el('span', { class: 'dba-tag' }, ['INDEX'])
        ]),
        Utils.el('td', { class: 'ltr' }, [ix.columns.join(', ') || '—']),
        Utils.el('td', {}, [originLabel[ix.origin] || ix.origin || '—']),
        Utils.el('td', {}, [ix.partial ? 'بله' : '—'])
      ]);
    });

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [
        Utils.el('span', {}, ['INDICES']),
        Utils.el('em', {}, [Utils.toFa(S.indices.length) + ' ایندکس'])
      ]),
      Utils.el('div', { class: 'dba-block-body', style: { padding: '0' } }, [
        Utils.el('table', { class: 'dba-kv-table' }, [
          Utils.el('thead', {}, [Utils.el('tr', {}, [
            Utils.el('th', {}, ['NAME']),
            Utils.el('th', {}, ['TYPE']),
            Utils.el('th', {}, ['COLUMNS']),
            Utils.el('th', {}, ['ORIGIN']),
            Utils.el('th', {}, ['PARTIAL'])
          ])]),
          Utils.el('tbody', {}, rows)
        ])
      ])
    ]));
  }

  /* =========================================================
     تب کلیدها
     ========================================================= */
  function renderKeysTab(host) {
    const pkBody = S.pkColumns.length
      ? S.pkColumns.map(function (c, i) {
          return Utils.el('div', { class: 'dba-kv-table' }, [
            Utils.el('div', { style: { padding: '6px 0' } }, [
              Utils.el('span', { class: 'dba-tag dba-tag-pk' }, ['PK #' + (i + 1)]),
              Utils.el('span', { class: 'ltr', style: { marginInlineStart: '8px', fontFamily: 'var(--font-mono)' } }, [c.name]),
              Utils.el('span', { class: 'dba-tag', style: { marginInlineStart: '8px' } }, [c.type || 'ANY']),
              c.notnull ? Utils.el('span', { class: 'dba-tag dba-tag-notnull', style: { marginInlineStart: '4px' } }, ['NOT NULL']) : null
            ].filter(Boolean))
          ]);
        })
      : [Utils.el('div', { class: 'dba-sql-msg' }, ['این جدول کلید اصلی ندارد.'])];

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [Utils.el('span', {}, ['PRIMARY KEY'])]),
      Utils.el('div', { class: 'dba-block-body' }, pkBody)
    ]));

    const fkReal = S.fks.map(function (fk) {
      return Utils.el('tr', {}, [
        Utils.el('td', { class: 'ltr' }, [fk.from]),
        Utils.el('td', {}, [
          Utils.el('span', { class: 'dba-ref', onclick: function () { selectTable(fk.table); } }, [fk.table + '.' + fk.to])
        ]),
        Utils.el('td', {}, [fk.on_update || '—']),
        Utils.el('td', {}, [fk.on_delete || '—'])
      ]);
    });

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [
        Utils.el('span', {}, ['FOREIGN KEYS — تعریف‌شده در اسکیما']),
        Utils.el('em', {}, [Utils.toFa(fkReal.length) + ' مورد'])
      ]),
      Utils.el('div', { class: 'dba-block-body', style: { padding: '0' } },
        fkReal.length
          ? [Utils.el('table', { class: 'dba-kv-table' }, [
              Utils.el('thead', {}, [Utils.el('tr', {}, [
                Utils.el('th', {}, ['FROM']),
                Utils.el('th', {}, ['REFERENCES']),
                Utils.el('th', {}, ['ON UPDATE']),
                Utils.el('th', {}, ['ON DELETE'])
              ])]),
              Utils.el('tbody', {}, fkReal)
            ])]
          : [Utils.el('div', { class: 'dba-sql-msg' }, ['در اسکیما FK تعریف نشده است.'])]
      )
    ]));

    const rel = S.declaredRels.map(function (r) {
      return Utils.el('tr', {}, [
        Utils.el('td', { class: 'ltr' }, [S.table + '.' + r.column]),
        Utils.el('td', {}, [
          Utils.el('span', { class: 'dba-ref', onclick: function () { selectTable(r.refTable); } }, [r.refTable + '.' + r.refColumn])
        ]),
        Utils.el('td', {}, [r.onDelete || '—'])
      ]);
    });

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [
        Utils.el('span', {}, ['RELATIONS — روابط منطقی برنامه']),
        Utils.el('em', {}, [Utils.toFa(rel.length) + ' مورد'])
      ]),
      Utils.el('div', { class: 'dba-block-body', style: { padding: '0' } },
        rel.length
          ? [Utils.el('table', { class: 'dba-kv-table' }, [
              Utils.el('thead', {}, [Utils.el('tr', {}, [
                Utils.el('th', {}, ['FROM']),
                Utils.el('th', {}, ['TO']),
                Utils.el('th', {}, ['ON DELETE'])
              ])]),
              Utils.el('tbody', {}, rel)
            ])]
          : [Utils.el('div', { class: 'dba-sql-msg' }, ['رابطه‌ای برای این جدول ثبت نشده.'])]
      )
    ]));

    const arrows = [];
    S.tables.forEach(function (t) {
      const rels = RELATIONS[t.name] || [];
      rels.forEach(function (r) {
        arrows.push(
          '<div><b>' + escapeHtml(t.name) + '</b>.<i>' + escapeHtml(r.column) + '</i>' +
          '  <s>──▶</s>  <b>' + escapeHtml(r.refTable) + '</b>.<i>' + escapeHtml(r.refColumn) + '</i>' +
          '  <s>[' + escapeHtml(r.onDelete || 'NO ACTION') + ']</s></div>'
        );
      });
    });

    host.appendChild(Utils.el('div', { class: 'dba-block' }, [
      Utils.el('div', { class: 'dba-block-title' }, [Utils.el('span', {}, ['RELATION MAP'])]),
      Utils.el('div', { class: 'dba-block-body' }, [
        Utils.el('div', { class: 'dba-rel-map', html: arrows.length ? arrows.join('') : '<s>هیچ رابطه‌ای ثبت نشده</s>' })
      ])
    ]));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* =========================================================
     تب SQL
     ========================================================= */
  function renderSqlTab(host) {
    const wrap = Utils.el('div', { class: 'dba-sql' });

    const editor = Utils.el('textarea', {
      class: 'dba-sql-editor',
      spellcheck: 'false',
      placeholder: "SELECT * FROM titles LIMIT 10;"
    });
    editor.value = S.rawSql || '';
    editor.addEventListener('input', function () {
      S.rawSql = editor.value;
      updateKindBadge();
    });

    const kindBadge = Utils.el('span', { class: 'dba-sql-kind', dataset: { kind: 'read' } }, ['READ']);

    function updateKindBadge() {
      const s = (S.rawSql || '').trim();
      let kind = '—';
      if (SQL_READ.test(s)) kind = 'read';
      else if (SQL_WRITE.test(s)) kind = 'write';
      else if (SQL_SCHEMA.test(s)) kind = 'schema';
      kindBadge.dataset.kind = kind;
      kindBadge.textContent = kind === '—' ? '—' : kind.toUpperCase();
    }
    updateKindBadge();

    const bar = Utils.el('div', { class: 'dba-sql-bar' }, [
      kindBadge,
      Utils.el('button', {
        class: 'dba-btn dba-btn-primary', type: 'button',
        onclick: runSql
      }, ['▶ اجرا']),
      Utils.el('button', {
        class: 'dba-btn', type: 'button',
        onclick: function () {
          editor.value = "SELECT name, type FROM sqlite_master WHERE type IN ('table','index','view') ORDER BY type, name;";
          S.rawSql = editor.value;
          updateKindBadge();
        }
      }, ['نمونه']),
      Utils.el('button', {
        class: 'dba-btn', type: 'button',
        onclick: function () { editor.value = ''; S.rawSql = ''; updateKindBadge(); }
      }, ['پاک کردن']),
      Utils.el('div', { class: 'dba-toolbar-spacer' }),
      Utils.el('span', { class: 'dba-meta' }, ['Ctrl+Enter = اجرا'])
    ]);

    const result = Utils.el('div', { class: 'dba-sql-result', hidden: true });

    wrap.appendChild(editor);
    wrap.appendChild(bar);
    wrap.appendChild(result);

    if (S.rawHistory.length) {
      const hist = Utils.el('div', { class: 'dba-sql-history' });
      S.rawHistory.slice(0, 12).forEach(function (h) {
        hist.appendChild(Utils.el('button', {
          class: 'dba-sql-history-item', type: 'button', title: h,
          onclick: function () { editor.value = h; S.rawSql = h; updateKindBadge(); editor.focus(); }
        }, [h.length > 120 ? h.slice(0, 120) + '…' : h]));
      });
      wrap.appendChild(hist);
    }

    host.appendChild(wrap);

    editor.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runSql();
      }
    });

    if (S.rawResult || S.rawError) renderResult();
    setTimeout(function () { editor.focus(); }, 60);

    function runSql() {
      const sql = editor.value.trim();
      if (!sql) { Toast.warning('خالی است'); return; }

      const kind = SQL_READ.test(sql) ? 'read'
        : SQL_WRITE.test(sql) ? 'write'
        : SQL_SCHEMA.test(sql) ? 'schema' : 'other';

      if (kind === 'read' || kind === 'other') {
        doRun(sql);
        return;
      }

      Modal.confirm({
        title: kind === 'schema' ? 'اجرای دستور ساختاری' : 'اجرای دستور نوشتن',
        message: sql.length > 220 ? sql.slice(0, 220) + '…' : sql,
        icon: kind === 'schema' ? '⚠️' : '✏️',
        danger: kind === 'schema',
        confirmText: 'اجرا کن',
        onConfirm: function () { doRun(sql); }
      });
    }

    function doRun(sql) {
      try {
        const res = DB.runRaw(sql);
        S.rawResult = res;
        S.rawError = null;
        S.rawHistory.unshift(sql);
        if (S.rawHistory.length > 30) S.rawHistory.length = 30;
        renderResult();
        setStatus('SQL: ' + (res.kind === 'read' ? Utils.toFa(res.rows.length) + ' ردیف' : Utils.toFa(res.changes) + ' تغییر'));
        if (res.kind === 'write') { loadTables(); refreshTable(); renderSide(); }
      } catch (e) {
        S.rawResult = null;
        S.rawError = e.message || String(e);
        renderResult();
        setStatus('SQL خطا');
      }
    }

    function renderResult() {
      result.hidden = false;
      result.innerHTML = '';

      if (S.rawError) {
        result.appendChild(Utils.el('div', { class: 'dba-sql-result-head' }, [
          Utils.el('span', {}, ['ERROR'])
        ]));
        result.appendChild(Utils.el('div', { class: 'dba-sql-msg is-error' }, [S.rawError]));
        return;
      }

      const r = S.rawResult;
      if (!r) return;

      if (r.kind === 'read') {
        result.appendChild(Utils.el('div', { class: 'dba-sql-result-head' }, [
          Utils.el('span', {}, ['RESULT']),
          Utils.el('span', {}, ['ردیف‌ها: ', Utils.el('b', {}, [Utils.toFa(r.rows.length)])])
        ]));

        if (!r.rows.length) {
          result.appendChild(Utils.el('div', { class: 'dba-sql-msg' }, ['نتیجه‌ای برنگشت.']));
          return;
        }

        const wrapT = Utils.el('div', { class: 'dba-table-wrap', style: { maxHeight: '360px' } });
        const tbl = Utils.el('table', { class: 'dba-grid' });
        const thead = Utils.el('thead');
        const htr = Utils.el('tr');
        r.columns.forEach(function (c) { htr.appendChild(Utils.el('th', {}, [c])); });
        thead.appendChild(htr);
        tbl.appendChild(thead);

        const tbody = Utils.el('tbody');
        r.rows.slice(0, 500).forEach(function (row) {
          const tr = Utils.el('tr');
          r.columns.forEach(function (c) {
            tr.appendChild(renderCell(row[c], { type: '' }));
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        wrapT.appendChild(tbl);
        result.appendChild(wrapT);

        if (r.rows.length > 500) {
          result.appendChild(Utils.el('div', { class: 'dba-sql-msg' }, ['نمایش ۵۰۰ ردیف اول از ' + Utils.toFa(r.rows.length) + ' ردیف.']));
        }
      } else if (r.kind === 'write') {
        result.appendChild(Utils.el('div', { class: 'dba-sql-result-head' }, [Utils.el('span', {}, ['OK'])]));
        result.appendChild(Utils.el('div', { class: 'dba-sql-msg is-ok' }, [
          'تغییرات: ' + Utils.toFa(r.changes) +
          (r.lastInsertRowid ? ' · آخرین id: ' + Utils.toFa(r.lastInsertRowid) : '')
        ]));
      } else {
        result.appendChild(Utils.el('div', { class: 'dba-sql-result-head' }, [Utils.el('span', {}, ['OK'])]));
        result.appendChild(Utils.el('div', { class: 'dba-sql-msg is-ok' }, ['دستور اجرا شد.']));
      }
    }
  }

  return { open: open, close: close, toggle: toggle };
})();