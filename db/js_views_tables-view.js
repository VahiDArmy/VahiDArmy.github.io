/**
 * نمای جداول
 * لیست و مدیریت جداول
 */
class TablesView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.tables = [];
    this.filteredTables = [];
    this.selectedTables = new Set();
    this.viewMode = 'grid';
    this.searchTerm = '';
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-tables',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">📊</span>
            <span>جداول</span>
          </h1>
          <p class="view-subtitle">مدیریت جداول و ویوهای پایگاه داده</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm tables-refresh" title="بازنشانی">
            <span class="icon">🔄</span>
          </button>
          <button class="btn btn-primary btn-sm tables-new-table">
            <span class="icon">➕</span>
            <span>جدول جدید</span>
          </button>
        </div>
      </div>

      <div class="tables-toolbar">
        <div class="tables-toolbar-left">
          <div class="tables-search">
            <span class="tables-search-icon">🔍</span>
            <input
              type="search"
              class="tables-search-input"
              placeholder="جستجو در جداول..."
              aria-label="جستجو"
            />
          </div>

          <div class="tables-filter-group">
            <button class="tables-filter-btn active" data-filter="all">همه</button>
            <button class="tables-filter-btn" data-filter="table">جداول</button>
            <button class="tables-filter-btn" data-filter="view">ویوها</button>
          </div>
        </div>

        <div class="tables-toolbar-right">
          <div class="tables-view-toggle">
            <button class="tables-view-btn active" data-view="grid" title="نمایش شبکه‌ای">
              <span class="icon">⊞</span>
            </button>
            <button class="tables-view-btn" data-view="list" title="نمایش لیست">
              <span class="icon">☰</span>
            </button>
          </div>
        </div>
      </div>

      <div class="tables-content">
        <div class="tables-list" data-view="grid"></div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._loadTables();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      refreshBtn: q('.tables-refresh'),
      newTableBtn: q('.tables-new-table'),
      searchInput: q('.tables-search-input'),
      filterBtns: q('.tables-filter-group'),
      viewBtns: q('.tables-view-toggle'),
      list: q('.tables-list')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.refreshBtn?.addEventListener('click', () => this._loadTables());

    this.elements.newTableBtn?.addEventListener('click', () => this._createTable());

    // جستجو
    const debouncedSearch = debounce((value) => {
      this.searchTerm = value.toLowerCase();
      this._filterTables();
    }, 200);

    this.elements.searchInput?.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });

    // فیلترها
    this.elements.filterBtns?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;

      this.elements.filterBtns.querySelectorAll('.tables-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      this._filterTables(btn.dataset.filter);
    });

    // حالت نمایش
    this.elements.viewBtns?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;

      this.elements.viewBtns.querySelectorAll('.tables-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      this.viewMode = btn.dataset.view;
      this._updateViewMode();
    });

    // کلیک روی جدول
    this.elements.list?.addEventListener('click', (e) => {
      const tableCard = e.target.closest('[data-table-name]');
      if (!tableCard) return;

      const tableName = tableCard.dataset.tableName;
      router.navigate(`/tables/${tableName}`);
    });

    // راست‌کلیک
    this.elements.list?.addEventListener('contextmenu', (e) => {
      const tableCard = e.target.closest('[data-table-name]');
      if (!tableCard) return;

      e.preventDefault();
      this._showContextMenu(e.clientX, e.clientY, tableCard.dataset.tableName);
    });
  }

  /**
   * بارگذاری جداول
   */
  _loadTables() {
    this.tables = stateManager.get('database.tables') || [];
    this._filterTables();
  }

  /**
   * فیلتر جداول
   */
  _filterTables(type = null) {
    const activeFilter = type || this.element.querySelector('.tables-filter-btn.active')?.dataset.filter || 'all';

    this.filteredTables = this.tables.filter(table => {
      if (activeFilter !== 'all' && table.type !== activeFilter) return false;
      if (this.searchTerm && !table.name.toLowerCase().includes(this.searchTerm)) return false;
      return true;
    });

    this._renderTables();
  }

  /**
   * رندر جداول
   */
  _renderTables() {
    if (!this.elements.list) return;

    this.elements.list.setAttribute('data-view', this.viewMode);

    if (this.filteredTables.length === 0) {
      this.elements.list.innerHTML = this._renderEmpty();
      return;
    }

    this.elements.list.innerHTML = this.filteredTables.map(table =>
      this.viewMode === 'grid' ? this._renderGridCard(table) : this._renderListCard(table)
    ).join('');
  }

  /**
   * رندر کارت شبکه‌ای
   */
  _renderGridCard(table) {
    const rowCount = databaseService.getTableRowCount(table.name);
    const info = databaseService.getTableInfo(table.name);
    const colCount = info.length;

    return `
      <div class="tables-grid-card" data-table-name="${StringUtils.escapeHtml(table.name)}">
        <div class="tables-grid-card-header">
          <div class="tables-grid-card-icon">
            ${table.type === 'view' ? '👁️' : '📋'}
          </div>
          <div class="tables-grid-card-title" title="${StringUtils.escapeHtml(table.name)}">
            ${StringUtils.escapeHtml(table.name)}
          </div>
          <button class="tables-grid-card-menu" title="عملیات">⋮</button>
        </div>
        <div class="tables-grid-card-stats">
          <div class="tables-grid-card-stat">
            <span class="tables-grid-card-stat-value">${StringUtils.englishToPersianDigits(rowCount)}</span>
            <span class="tables-grid-card-stat-label">ردیف</span>
          </div>
          <div class="tables-grid-card-stat">
            <span class="tables-grid-card-stat-value">${StringUtils.englishToPersianDigits(colCount)}</span>
            <span class="tables-grid-card-stat-label">ستون</span>
          </div>
        </div>
        <div class="tables-grid-card-footer">
          <span class="tables-grid-card-type">${table.type === 'view' ? 'ویو' : 'جدول'}</span>
        </div>
      </div>
    `;
  }

  /**
   * رندر کارت لیستی
   */
  _renderListCard(table) {
    const rowCount = databaseService.getTableRowCount(table.name);
    const info = databaseService.getTableInfo(table.name);
    const colCount = info.length;

    return `
      <div class="tables-list-card" data-table-name="${StringUtils.escapeHtml(table.name)}">
        <div class="tables-list-card-icon">
          ${table.type === 'view' ? '👁️' : '📋'}
        </div>
        <div class="tables-list-card-content">
          <div class="tables-list-card-name">${StringUtils.escapeHtml(table.name)}</div>
          <div class="tables-list-card-meta">
            <span>${StringUtils.englishToPersianDigits(rowCount)} ردیف</span>
            <span>${StringUtils.englishToPersianDigits(colCount)} ستون</span>
          </div>
        </div>
        <div class="tables-list-card-type">${table.type === 'view' ? 'ویو' : 'جدول'}</div>
        <button class="tables-list-card-menu" title="عملیات">⋮</button>
      </div>
    `;
  }

  /**
   * حالت خالی
   */
  _renderEmpty() {
    if (this.tables.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">جدولی وجود ندارد</div>
          <div class="empty-state-description">برای شروع یک جدول جدید بسازید</div>
          <button class="btn btn-primary tables-empty-new">
            <span class="icon">➕</span>
            <span>ایجاد جدول</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">نتیجه‌ای یافت نشد</div>
        <div class="empty-state-description">عبارت جستجو را تغییر دهید</div>
      </div>
    `;
  }

  /**
   * تغییر حالت نمایش
   */
  _updateViewMode() {
    if (this.elements.list) {
      this.elements.list.setAttribute('data-view', this.viewMode);
    }
    this._renderTables();
  }

  /**
   * منوی زمینه
   */
  _showContextMenu(x, y, tableName) {
    const table = this.tables.find(t => t.name === tableName);
    if (!table) return;

    const items = [
      {
        label: 'مشاهده داده‌ها',
        icon: '👁️',
        onClick: () => router.navigate(`/tables/${tableName}`)
      },
      {
        label: 'مشاهده ساختار',
        icon: '📐',
        onClick: () => this._showSchema(tableName)
      },
      'separator',
      {
        label: 'صادرات',
        icon: '📤',
        submenu: [
          { label: 'JSON', onClick: () => this._exportTable(tableName, 'json') },
          { label: 'CSV', onClick: () => this._exportTable(tableName, 'csv') },
          { label: 'SQL', onClick: () => this._exportTable(tableName, 'sql') },
          { label: 'Excel', onClick: () => this._exportTable(tableName, 'excel') }
        ]
      },
      {
        label: 'تولید کوئری',
        icon: '💻',
        submenu: [
          { label: 'SELECT', onClick: () => this._generateQuery(tableName, 'select') },
          { label: 'INSERT', onClick: () => this._generateQuery(tableName, 'insert') },
          { label: 'UPDATE', onClick: () => this._generateQuery(tableName, 'update') },
          { label: 'DELETE', onClick: () => this._generateQuery(tableName, 'delete') }
        ]
      },
      'separator',
      {
        label: 'تغییر نام',
        icon: '✏️',
        onClick: () => this._renameTable(tableName)
      },
      {
        label: 'کپی',
        icon: '📋',
        onClick: () => this._duplicateTable(tableName)
      },
      'separator',
      {
        label: 'خالی کردن',
        icon: '🗑️',
        danger: true,
        onClick: () => this._truncateTable(tableName)
      },
      {
        label: 'حذف',
        icon: '❌',
        danger: true,
        onClick: () => this._dropTable(tableName)
      }
    ];

    contextMenu.show(x, y, items);
  }

  /**
   * نمایش ساختار
   */
  _showSchema(tableName) {
    const info = databaseService.getTableInfo(tableName);
    const sql = databaseService.getCreateTableSql(tableName);

    const content = `
      <div class="table-schema-view">
        <h4>ستون‌ها</h4>
        <table class="table-schema-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>نوع</th>
              <th>کلید اصلی</th>
              <th>الزامی</th>
              <th>پیش‌فرض</th>
            </tr>
          </thead>
          <tbody>
            ${info.map(col => `
              <tr>
                <td>${StringUtils.escapeHtml(col.name)}</td>
                <td>${StringUtils.escapeHtml(col.type)}</td>
                <td>${col.primaryKey ? '✓' : ''}</td>
                <td>${col.notNull ? '✓' : ''}</td>
                <td>${StringUtils.escapeHtml(String(col.defaultValue ?? ''))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${sql ? `
          <h4>SQL ایجاد</h4>
          <pre class="table-schema-sql">${StringUtils.escapeHtml(sql)}</pre>
        ` : ''}
      </div>
    `;

    modalService.open(content, {
      title: `ساختار: ${tableName}`,
      size: 'lg'
    });
  }

  /**
   * صادرات جدول
   */
  async _exportTable(tableName, format) {
    try {
      const data = databaseService.getTableData(tableName, { page: 1, pageSize: 1000000 });
      const info = databaseService.getTableInfo(tableName);

      const exportData = {
        tables: {
          [tableName]: {
            columns: info,
            data: data.success ? data.data : [],
            schema: databaseService.getCreateTableSql(tableName)
          }
        }
      };

      const result = await exportService.export(format, exportData);

      if (result.isBinary) {
        FileUtils.downloadUint8Array(result.content, `${tableName}${result.extension}`, result.mimeType);
      } else {
        FileUtils.downloadText(result.content, `${tableName}${result.extension}`, result.mimeType);
      }

      notificationService.success(`صادرات "${tableName}" انجام شد`);
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * تولید کوئری
   */
  _generateQuery(tableName, type) {
    const info = databaseService.getTableInfo(tableName);
    const cols = info.map(c => c.name);
    const pk = info.find(c => c.primaryKey);

    let sql = '';

    switch (type) {
      case 'select':
        sql = `SELECT * FROM "${tableName}" LIMIT 100;`;
        break;
      case 'insert':
        sql = `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')})\nVALUES (${cols.map(() => '?').join(', ')});`;
        break;
      case 'update':
        sql = `UPDATE "${tableName}"\nSET ${cols.slice(1).map(c => `"${c}" = ?`).join(', ')}\nWHERE "${pk?.name || 'id'}" = ?;`;
        break;
      case 'delete':
        sql = `DELETE FROM "${tableName}" WHERE "${pk?.name || 'id'}" = ?;`;
        break;
    }

    stateManager.set('query.sql', sql);
    router.navigate('/query');
    notificationService.info('کوئری تولید شد');
  }

  /**
   * تغییر نام جدول
   */
  async _renameTable(oldName) {
    const newName = await modalService.prompt(`نام جدید برای "${oldName}":`, {
      title: 'تغییر نام جدول',
      defaultValue: oldName,
      validate: (v) => ValidationUtils.tableName(v)
    });

    if (!newName || newName === oldName) return;

    try {
      const result = databaseService.renameTable(oldName, newName);
      if (result.success) {
        notificationService.success('جدول تغییر نام یافت');
        loadTablesList();
        this._loadTables();
      } else {
        notificationService.error(`خطا: ${result.error}`);
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * کپی جدول
   */
  async _duplicateTable(tableName) {
    const newName = await modalService.prompt(`نام جدول جدید (کپی از "${tableName}"):`, {
      title: 'کپی جدول',
      defaultValue: `${tableName}_copy`
    });

    if (!newName) return;

    try {
      databaseService.executeQuery(`CREATE TABLE "${newName}" AS SELECT * FROM "${tableName}"`);
      notificationService.success('جدول کپی شد');
      loadTablesList();
      this._loadTables();
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * خالی کردن جدول
   */
  async _truncateTable(tableName) {
    const confirmed = await modalService.confirm(
      `تمام داده‌های جدول "${tableName}" حذف خواهند شد. ادامه؟`,
      { title: 'خالی کردن جدول', danger: true }
    );

    if (!confirmed) return;

    try {
      databaseService.executeQuery(`DELETE FROM "${tableName}"`);
      notificationService.success('جدول خالی شد');
      this._loadTables();
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * حذف جدول
   */
  async _dropTable(tableName) {
    const confirmed = await modalService.confirm(
      `آیا از حذف جدول "${tableName}" مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
      { title: 'حذف جدول', danger: true }
    );

    if (!confirmed) return;

    try {
      const result = databaseService.dropTable(tableName);
      if (result.success) {
        notificationService.success('جدول حذف شد');
        loadTablesList();
        this._loadTables();
      } else {
        notificationService.error(`خطا: ${result.error}`);
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * ایجاد جدول جدید
   */
  _createTable() {
    const designer = new TableDesigner();
    const content = designer.render();

    modalService.open(content, {
      title: 'ایجاد جدول جدید',
      size: 'lg',
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="create">ایجاد</button>
      `,
      onOpen: (modal, ctx) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          modalService.close(ctx.id);
        });

        modal.querySelector('[data-action="create"]')?.addEventListener('click', () => {
          try {
            designer.createTable();
            notificationService.success('جدول ایجاد شد');
            loadTablesList();
            this._loadTables();
            modalService.close(ctx.id);
          } catch (error) {
            notificationService.error(`خطا: ${error.message}`);
          }
        });
      }
    });
  }

  /**
   * ثبت شنونده
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  /**
   * انتشار رویداد
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`خطا در شنونده "${event}":`, error);
        }
      });
    }
  }

  /**
   * نابودی
   */
  destroy() {
    this.listeners.clear();
    this.element?.remove();
  }
}

window.TablesView = TablesView;