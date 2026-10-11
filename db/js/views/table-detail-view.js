/**
 * نمای جزئیات جدول
 * نمایش داده‌های یک جدول خاص با تمام قابلیت‌ها
 */
class TableDetailView {
  constructor(params = {}) {
    this.params = params;
    this.tableName = params.name;
    this.element = null;
    this.elements = {};
    this.dataTable = null;
    this.info = [];
    this.currentTab = 'data';
    this.rowsPerPage = 50;
    this.currentPage = 1;
    this.currentSort = { column: null, direction: 'asc' };
    this.currentFilters = [];
    this.searchTerm = '';
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    if (!this.tableName) {
      return this._renderNotFound();
    }

    this.info = databaseService.getTableInfo(this.tableName);

    if (!this.info || this.info.length === 0) {
      return this._renderNotFound();
    }

    this.element = DomUtils.create('div', {
      className: 'view view-table-detail',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <nav class="view-breadcrumb">
            <a href="#/tables">جداول</a>
            <span class="view-breadcrumb-separator">/</span>
            <span class="view-breadcrumb-current">${StringUtils.escapeHtml(this.tableName)}</span>
          </nav>
          <h1 class="view-title">
            <span class="view-title-icon">📋</span>
            <span>${StringUtils.escapeHtml(this.tableName)}</span>
          </h1>
          <p class="view-subtitle">
            ${StringUtils.englishToPersianDigits(this.info.length)} ستون
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm table-detail-refresh" title="بازنشانی">
            <span class="icon">🔄</span>
          </button>
          <button class="btn btn-secondary btn-sm table-detail-add-row">
            <span class="icon">➕</span>
            <span>ردیف جدید</span>
          </button>
          <button class="btn btn-ghost btn-sm table-detail-menu" title="عملیات">
            <span class="icon">⋮</span>
          </button>
        </div>
      </div>

      <div class="table-detail-tabs">
        <button class="table-detail-tab active" data-tab="data">
          <span class="icon">📊</span>
          <span>داده‌ها</span>
        </button>
        <button class="table-detail-tab" data-tab="structure">
          <span class="icon">📐</span>
          <span>ساختار</span>
        </button>
        <button class="table-detail-tab" data-tab="indexes">
          <span class="icon">🔍</span>
          <span>ایندکس‌ها</span>
        </button>
        <button class="table-detail-tab" data-tab="constraints">
          <span class="icon">🔒</span>
          <span>محدودیت‌ها</span>
        </button>
        <button class="table-detail-tab" data-tab="sql">
          <span class="icon">💾</span>
          <span>SQL</span>
        </button>
      </div>

      <div class="table-detail-content">
        <div class="table-detail-panel" data-panel="data">
          <div class="table-detail-data-container"></div>
        </div>
        <div class="table-detail-panel" data-panel="structure" hidden></div>
        <div class="table-detail-panel" data-panel="indexes" hidden></div>
        <div class="table-detail-panel" data-panel="constraints" hidden></div>
        <div class="table-detail-panel" data-panel="sql" hidden></div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderActivePanel();

    return this.element;
  }

  /**
   * حالت یافت نشد
   */
  _renderNotFound() {
    this.element = DomUtils.create('div', { className: 'view view-error' });
    this.element.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">جدول یافت نشد</div>
        <div class="empty-state-description">جدول "${StringUtils.escapeHtml(this.tableName || '')}" در پایگاه داده وجود ندارد</div>
        <a href="#/tables" class="btn btn-primary">بازگشت به لیست</a>
      </div>
    `;
    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      refreshBtn: q('.table-detail-refresh'),
      addRowBtn: q('.table-detail-add-row'),
      menuBtn: q('.table-detail-menu'),
      tabs: q('.table-detail-tabs'),
      dataContainer: q('.table-detail-data-container'),
      panels: {
        data: q('[data-panel="data"]'),
        structure: q('[data-panel="structure"]'),
        indexes: q('[data-panel="indexes"]'),
        constraints: q('[data-panel="constraints"]'),
        sql: q('[data-panel="sql"]')
      }
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.refreshBtn?.addEventListener('click', () => this._refresh());
    this.elements.addRowBtn?.addEventListener('click', () => this._addRow());
    this.elements.menuBtn?.addEventListener('click', (e) => {
      const rect = this.elements.menuBtn.getBoundingClientRect();
      this._showMainMenu(rect.right, rect.bottom + 4);
    });

    this.elements.tabs?.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;

      this.currentTab = tab.dataset.tab;
      this._renderActivePanel();
    });
  }

  /**
   * رندر پنل فعال
   */
  _renderActivePanel() {
    // به‌روزرسانی تب‌ها
    this.elements.tabs.querySelectorAll('.table-detail-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === this.currentTab);
    });

    // نمایش/مخفی پنل‌ها
    Object.entries(this.elements.panels).forEach(([key, panel]) => {
      if (panel) panel.hidden = key !== this.currentTab;
    });

    // رندر پنل
    switch (this.currentTab) {
      case 'data':
        this._renderDataPanel();
        break;
      case 'structure':
        this._renderStructurePanel();
        break;
      case 'indexes':
        this._renderIndexesPanel();
        break;
      case 'constraints':
        this._renderConstraintsPanel();
        break;
      case 'sql':
        this._renderSqlPanel();
        break;
    }
  }

  /**
   * پنل داده‌ها
   */
  _renderDataPanel() {
    if (!this.elements.dataContainer) return;

    // تخریب جدول قبلی
    if (this.dataTable) {
      this.dataTable.destroy();
    }

    const columns = this.info.map(col => ({
      name: col.name,
      title: col.name,
      type: col.type,
      primaryKey: col.primaryKey,
      notNull: col.notNull,
      editable: !col.primaryKey || col.type === 'TEXT'
    }));

    this.dataTable = new DataTable({
      columns,
      data: [],
      pageSize: this.rowsPerPage,
      page: this.currentPage,
      sortable: true,
      filterable: true,
      selectable: true,
      multiSelect: true,
      editable: true,
      resizable: true,
      stickyHeader: true,
      virtualScroll: true,
      contextMenu: true,
      onCellEdit: (rowIndex, colName, newValue, oldValue) => this._handleCellEdit(rowIndex, colName, newValue, oldValue),
      onSortChange: (sort) => this._handleSort(sort),
      onFilterChange: (filters) => this._handleFilters(filters),
      onPageChange: (info) => this._handlePageChange(info),
      onSelectionChange: (selected) => this._handleSelection(selected),
      onDeleteRow: (info) => this._handleDeleteRow(info),
      onInsertRow: (info) => this._handleInsertRow(info),
      onExport: (info) => this._handleExport(info)
    });

    this.elements.dataContainer.innerHTML = '';
    this.elements.dataContainer.appendChild(this.dataTable.render());

    this._loadTableData();
  }

  /**
   * بارگذاری داده‌ها
   */
  _loadTableData() {
    try {
      const result = databaseService.getTableData(this.tableName, {
        page: this.currentPage,
        pageSize: this.rowsPerPage,
        sortColumn: this.currentSort.column,
        sortDirection: this.currentSort.direction,
        filters: this.currentFilters
      });

      if (result.success) {
        this.dataTable.setData(result.data, {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize
        });
      } else {
        notificationService.error(`خطا در بارگذاری: ${result.error}`);
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * هندلر ویرایش سلول
   */
  _handleCellEdit(rowIndex, colName, newValue, oldValue) {
    const pk = this.info.find(c => c.primaryKey);
    if (!pk) {
      notificationService.warning('کلید اصلی برای به‌روزرسانی لازم است');
      return false;
    }

    const row = this.dataTable.options.data[rowIndex];
    const pkValue = row[pk.name];

    const where = { [pk.name]: pkValue };
    const updates = { [colName]: newValue };

    const result = databaseService.updateRow(this.tableName, updates, where);

    if (result.success) {
      notificationService.success('به‌روزرسانی شد', { duration: 1500 });
    } else {
      notificationService.error(`خطا: ${result.error}`);
      return false;
    }
  }

  /**
   * هندلر مرتب‌سازی
   */
  _handleSort(sort) {
    this.currentSort = sort;
    this._loadTableData();
  }

  /**
   * هندلر فیلترها
   */
  _handleFilters(filters) {
    this.currentFilters = filters;
    this.currentPage = 1;
    this._loadTableData();
  }

  /**
   * هندلر تغییر صفحه
   */
  _handlePageChange(info) {
    this.currentPage = info.page;
    this.rowsPerPage = info.pageSize;
    this._loadTableData();
  }

  /**
   * هندلر انتخاب
   */
  _handleSelection(selected) {
    // می‌تواند برای اکشن‌های دسته‌ای استفاده شود
  }

  /**
   * هندلر حذف ردیف
   */
  async _handleDeleteRow(info) {
    const pk = this.info.find(c => c.primaryKey);
    if (!pk) {
      notificationService.warning('کلید اصلی لازم است');
      return;
    }

    const row = this.dataTable.options.data[info.rowIndex];
    const pkValue = row[pk.name];

    const confirmed = await modalService.confirm(
      'آیا از حذف این ردیف مطمئن هستید؟',
      { title: 'حذف ردیف', danger: true }
    );

    if (!confirmed) return;

    const result = databaseService.deleteRow(this.tableName, { [pk.name]: pkValue });

    if (result.success) {
      notificationService.success('ردیف حذف شد');
      this._loadTableData();
    } else {
      notificationService.error(`خطا: ${result.error}`);
    }
  }

  /**
   * هندلر درج ردیف
   */
  _handleInsertRow(info) {
    this._showInsertRowModal(info.where === 'above' ? info.rowIndex : info.rowIndex + 1);
  }

  /**
   * هندلر صادرات
   */
  _handleExport(info) {
    const data = info.data;
    if (!data || data.length === 0) return;

    const format = 'json';
    const result = exportService.export(format, {
      tables: { [this.tableName]: { columns: this.info, data } }
    });

    Promise.resolve(result).then(r => {
      FileUtils.downloadText(r.content, `${this.tableName}${r.extension}`, r.mimeType);
      notificationService.success('صادرات انجام شد');
    });
  }

  /**
   * پنل ساختار
   */
  _renderStructurePanel() {
    const panel = this.elements.panels.structure;
    if (!panel) return;

    panel.innerHTML = `
      <div class="table-structure">
        <div class="table-structure-header">
          <h4>ستون‌ها (${StringUtils.englishToPersianDigits(this.info.length)})</h4>
        </div>
        <table class="table-structure-table">
          <thead>
            <tr>
              <th>#</th>
              <th>نام</th>
              <th>نوع</th>
              <th>کلید اصلی</th>
              <th>الزامی</th>
              <th>یکتا</th>
              <th>پیش‌فرض</th>
            </tr>
          </thead>
          <tbody>
            ${this.info.map((col, i) => `
              <tr>
                <td>${StringUtils.englishToPersianDigits(i + 1)}</td>
                <td class="col-name">${StringUtils.escapeHtml(col.name)}</td>
                <td class="col-type">${StringUtils.escapeHtml(col.type)}</td>
                <td>${col.primaryKey ? '✅' : ''}</td>
                <td>${col.notNull ? '✅' : ''}</td>
                <td>${col.unique ? '✅' : ''}</td>
                <td>${col.defaultValue !== null && col.defaultValue !== undefined ? StringUtils.escapeHtml(String(col.defaultValue)) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * پنل ایندکس‌ها
   */
  _renderIndexesPanel() {
    const panel = this.elements.panels.indexes;
    if (!panel) return;

    const indexes = databaseService.getIndexes(this.tableName);

    if (indexes.length === 0) {
      panel.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">ایندکسی وجود ندارد</div>
          <div class="empty-state-description">برای این جدول ایندکسی تعریف نشده است</div>
          <button class="btn btn-primary table-index-add">
            <span class="icon">➕</span>
            <span>ایجاد ایندکس</span>
          </button>
        </div>
      `;

      panel.querySelector('.table-index-add')?.addEventListener('click', () => this._createIndex());
      return;
    }

    panel.innerHTML = `
      <div class="table-indexes">
        <div class="table-indexes-header">
          <h4>ایندکس‌ها (${StringUtils.englishToPersianDigits(indexes.length)})</h4>
          <button class="btn btn-primary btn-sm table-index-add">
            <span class="icon">➕</span>
            <span>ایندکس جدید</span>
          </button>
        </div>
        <div class="table-indexes-list">
          ${indexes.map(idx => `
            <div class="table-index-card">
              <div class="table-index-card-header">
                <span class="table-index-card-name">${StringUtils.escapeHtml(idx.name)}</span>
                ${idx.unique ? '<span class="table-index-card-badge">یکتا</span>' : ''}
              </div>
              <div class="table-index-card-columns">
                ستون‌ها: ${idx.columns.map(c => `<span class="table-index-card-col">${StringUtils.escapeHtml(c)}</span>`).join(', ')}
              </div>
              <div class="table-index-card-actions">
                <button class="btn btn-sm btn-ghost table-index-drop" data-index="${StringUtils.escapeHtml(idx.name)}">
                  <span class="icon">🗑️</span>
                  <span>حذف</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    panel.querySelector('.table-index-add')?.addEventListener('click', () => this._createIndex());
    panel.querySelectorAll('.table-index-drop').forEach(btn => {
      btn.addEventListener('click', () => this._dropIndex(btn.dataset.index));
    });
  }

  /**
   * پنل محدودیت‌ها
   */
  _renderConstraintsPanel() {
    const panel = this.elements.panels.constraints;
    if (!panel) return;

    const constraints = databaseService.getConstraints(this.tableName);
    const foreignKeys = databaseService.getForeignKeys(this.tableName);

    panel.innerHTML = `
      <div class="table-constraints">
        <h4>محدودیت‌ها</h4>
        ${constraints.length === 0 ? `
          <div class="empty-message">محدودیتی تعریف نشده است</div>
        ` : `
          <table class="table-constraints-table">
            <thead>
              <tr>
                <th>نوع</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              ${constraints.map(c => `
                <tr>
                  <td><span class="constraint-type">${c.type}</span></td>
                  <td>${this._formatConstraint(c)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}

        <h4>کلیدهای خارجی</h4>
        ${foreignKeys.length === 0 ? `
          <div class="empty-message">کلید خارجی تعریف نشده است</div>
        ` : `
          <table class="table-constraints-table">
            <thead>
              <tr>
                <th>ستون</th>
                <th>جدول مرجع</th>
                <th>ستون مرجع</th>
                <th>ON DELETE</th>
                <th>ON UPDATE</th>
              </tr>
            </thead>
            <tbody>
              ${foreignKeys.map(fk => `
                <tr>
                  <td>${StringUtils.escapeHtml(fk.from)}</td>
                  <td>${StringUtils.escapeHtml(fk.table)}</td>
                  <td>${StringUtils.escapeHtml(fk.to)}</td>
                  <td>${fk.onDelete}</td>
                  <td>${fk.onUpdate}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /**
   * فرمت محدودیت
   */
  _formatConstraint(c) {
    if (c.columns) return c.columns.map(col => StringUtils.escapeHtml(col)).join(', ');
    if (c.column) return `${StringUtils.escapeHtml(c.column)} → ${StringUtils.escapeHtml(c.refTable)}.${StringUtils.escapeHtml(c.refColumn)}`;
    if (c.expression) return `<code>${StringUtils.escapeHtml(c.expression)}</code>`;
    return '';
  }

  /**
   * پنل SQL
   */
  _renderSqlPanel() {
    const panel = this.elements.panels.sql;
    if (!panel) return;

    const createSql = databaseService.getCreateTableSql(this.tableName);

    panel.innerHTML = `
      <div class="table-sql">
        <div class="table-sql-header">
          <h4>SQL ایجاد جدول</h4>
          <button class="btn btn-sm btn-ghost table-sql-copy" title="کپی">
            <span class="icon">📋</span>
          </button>
        </div>
        <pre class="table-sql-content">${StringUtils.escapeHtml(createSql || '-- SQL موجود نیست')}</pre>
      </div>
    `;

    panel.querySelector('.table-sql-copy')?.addEventListener('click', async () => {
      const ok = await DomUtils.copyToClipboard(createSql || '');
      if (ok) notificationService.success('کپی شد', { duration: 1500 });
    });
  }

  /**
   * ایجاد ایندکس
   */
  async _createIndex() {
    const content = `
      <div class="form-group">
        <label>نام ایندکس</label>
        <input type="text" class="form-control" id="idx-name" placeholder="idx_name" />
      </div>
      <div class="form-group">
        <label>ستون‌ها</label>
        ${this.info.map(col => `
          <label class="checkbox">
            <input type="checkbox" class="idx-col" value="${StringUtils.escapeHtml(col.name)}" />
            <span>${StringUtils.escapeHtml(col.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" id="idx-unique" />
          <span>ایندکس یکتا</span>
        </label>
      </div>
    `;

    const result = await modalService.open(content, {
      title: 'ایجاد ایندکس',
      size: 'md',
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="create">ایجاد</button>
      `,
      onOpen: (modal, ctx) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modalService.close(ctx.id));
        modal.querySelector('[data-action="create"]')?.addEventListener('click', () => {
          const name = modal.querySelector('#idx-name').value.trim();
          const cols = Array.from(modal.querySelectorAll('.idx-col:checked')).map(cb => cb.value);
          const unique = modal.querySelector('#idx-unique').checked;

          if (!name || cols.length === 0) {
            notificationService.warning('نام و ستون‌ها لازم است');
            return;
          }

          try {
            const r = databaseService.createIndex(name, this.tableName, cols, { unique });
            if (r.success) {
              notificationService.success('ایندکس ایجاد شد');
              this._renderIndexesPanel();
              modalService.close(ctx.id);
            } else {
              notificationService.error(r.error);
            }
          } catch (error) {
            notificationService.error(error.message);
          }
        });
      }
    });
  }

  /**
   * حذف ایندکس
   */
  async _dropIndex(name) {
    const confirmed = await modalService.confirm(`ایندکس "${name}" حذف شود؟`, { danger: true });
    if (!confirmed) return;

    const result = databaseService.dropIndex(name);
    if (result.success) {
      notificationService.success('ایندکس حذف شد');
      this._renderIndexesPanel();
    } else {
      notificationService.error(result.error);
    }
  }

  /**
   * افزودن ردیف
   */
  _addRow() {
    this._showInsertRowModal(this.dataTable ? this.dataTable.options.data.length : 0);
  }

  /**
   * دیالوگ درج ردیف
   */
  _showInsertRowModal(position) {
    const fieldsHtml = this.info.map(col => {
      if (col.primaryKey && col.autoIncrement) {
        return `
          <div class="form-group">
            <label>${StringUtils.escapeHtml(col.name)} <small>(${col.type} - خودافزا)</small></label>
            <input type="text" class="form-control insert-field" data-col="${StringUtils.escapeHtml(col.name)}" disabled placeholder="خودکار" />
          </div>
        `;
      }

      return `
        <div class="form-group">
          <label>
            ${StringUtils.escapeHtml(col.name)}
            <small>(${col.type})</small>
            ${col.notNull ? '<span class="required">*</span>' : ''}
          </label>
          <input
            type="${this._getInputType(col.type)}"
            class="form-control insert-field"
            data-col="${StringUtils.escapeHtml(col.name)}"
            data-type="${col.type}"
            ${col.defaultValue !== null && col.defaultValue !== undefined ? `placeholder="پیش‌فرض: ${StringUtils.escapeHtml(String(col.defaultValue))}"` : ''}
          />
        </div>
      `;
    }).join('');

    const content = `<div class="insert-row-form">${fieldsHtml}</div>`;

    modalService.open(content, {
      title: 'درج ردیف جدید',
      size: 'md',
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="insert">درج</button>
      `,
      onOpen: (modal, ctx) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modalService.close(ctx.id));
        modal.querySelector('[data-action="insert"]')?.addEventListener('click', () => {
          const data = {};
          let hasError = false;

          modal.querySelectorAll('.insert-field:not([disabled])').forEach(input => {
            const col = input.dataset.col;
            const type = input.dataset.type;
            let value = input.value;

            if (value === '') {
              value = null;
            } else {
              const upper = type.toUpperCase();
              if (upper.includes('INT') || upper.includes('REAL') || upper.includes('NUMERIC')) {
                const n = Number(value);
                if (!isNaN(n)) value = n;
              }
            }

            // بررسی الزامی
            const colInfo = this.info.find(c => c.name === col);
            if (colInfo && colInfo.notNull && value === null) {
              notificationService.error(`${col} الزامی است`);
              hasError = true;
              return;
            }

            data[col] = value;
          });

          if (hasError) return;

          const result = databaseService.insertRow(this.tableName, data);
          if (result.success) {
            notificationService.success('ردیف درج شد');
            this._loadTableData();
            modalService.close(ctx.id);
          } else {
            notificationService.error(result.error);
          }
        });
      }
    });
  }

  /**
   * نوع ورودی
   */
  _getInputType(type) {
    const upper = String(type).toUpperCase();
    if (upper.includes('INT') || upper.includes('REAL') || upper.includes('NUMERIC')) return 'number';
    if (upper.includes('DATE')) return 'date';
    if (upper.includes('TIME')) return 'datetime-local';
    return 'text';
  }

  /**
   * منوی اصلی
   */
  _showMainMenu(x, y) {
    const items = [
      {
        label: 'صادرات جدول',
        icon: '📤',
        submenu: [
          { label: 'JSON', onClick: () => this._export('json') },
          { label: 'CSV', onClick: () => this._export('csv') },
          { label: 'SQL', onClick: () => this._export('sql') },
          { label: 'XML', onClick: () => this._export('xml') },
          { label: 'Excel', onClick: () => this._export('excel') }
        ]
      },
      {
        label: 'SQL',
        icon: '💾',
        onClick: () => {
          this.currentTab = 'sql';
          this._renderActivePanel();
        }
      },
      'separator',
      {
        label: 'خالی کردن جدول',
        icon: '🗑️',
        danger: true,
        onClick: () => this._truncate()
      },
      {
        label: 'حذف جدول',
        icon: '❌',
        danger: true,
        onClick: () => this._drop()
      }
    ];

    contextMenu.show(x, y, items);
  }

  /**
   * صادرات
   */
  async _export(format) {
    try {
      const data = databaseService.getTableData(this.tableName, { page: 1, pageSize: 1000000 });
      const result = await exportService.export(format, {
        tables: {
          [this.tableName]: {
            columns: this.info,
            data: data.success ? data.data : [],
            schema: databaseService.getCreateTableSql(this.tableName)
          }
        }
      });

      if (result.isBinary) {
        FileUtils.downloadUint8Array(result.content, `${this.tableName}${result.extension}`, result.mimeType);
      } else {
        FileUtils.downloadText(result.content, `${this.tableName}${result.extension}`, result.mimeType);
      }

      notificationService.success('صادرات انجام شد');
    } catch (error) {
      notificationService.error(error.message);
    }
  }

  /**
   * خالی کردن
   */
  async _truncate() {
    const confirmed = await modalService.confirm(
      `تمام داده‌های جدول "${this.tableName}" حذف خواهند شد؟`,
      { danger: true }
    );

    if (!confirmed) return;

    const result = databaseService.executeQuery(`DELETE FROM "${this.tableName}"`);
    if (result.success) {
      notificationService.success('جدول خالی شد');
      this._loadTableData();
    }
  }

  /**
   * حذف جدول
   */
  async _drop() {
    const confirmed = await modalService.confirm(
      `آیا از حذف جدول "${this.tableName}" مطمئن هستید؟`,
      { danger: true }
    );

    if (!confirmed) return;

    const result = databaseService.dropTable(this.tableName);
    if (result.success) {
      notificationService.success('جدول حذف شد');
      loadTablesList();
      router.navigate('/tables');
    }
  }

  /**
   * بازنشانی
   */
  _refresh() {
    this._renderActivePanel();
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
    if (this.dataTable) this.dataTable.destroy();
    this.listeners.clear();
    this.element?.remove();
  }
}

window.TableDetailView = TableDetailView;