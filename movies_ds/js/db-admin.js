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
          title: (c.type || '') + (isPk ? ' · PRIMARY KEY' : '')