/**
 * کامپوننت طراحی جدول
 * ساخت جدول به صورت گرافیکی
 */
class TableDesigner {
  constructor(options = {}) {
    this.options = {
      tableName: '',
      columns: [],
      primaryKey: [],
      foreignKeys: [],
      ...options
    };

    this.element = null;
    this.elements = {};
    this.listeners = new Map();
    this.columns = this.options.columns.length > 0
      ? [...this.options.columns]
      : [this._emptyColumn()];
    this.foreignKeys = [...this.options.foreignKeys];
  }

  /**
   * ستون خالی
   */
  _emptyColumn() {
    return {
      id: StringUtils.randomId(),
      name: '',
      type: 'TEXT',
      notNull: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      defaultValue: '',
      check: '',
      collate: ''
    };
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'table-designer-component'
    });

    this.element.innerHTML = `
      <div class="table-designer-header">
        <div class="form-group">
          <label>نام جدول</label>
          <input
            type="text"
            class="form-control table-designer-name"
            value="${StringUtils.escapeHtml(this.options.tableName)}"
            placeholder="نام جدول..."
          />
        </div>
      </div>

      <div class="table-designer-columns">
        <div class="table-designer-columns-header">
          <h4>ستون‌ها</h4>
          <button class="btn btn-sm btn-primary table-designer-add-column">
            <span class="icon">+</span>
            <span>افزودن ستون</span>
          </button>
        </div>
        <div class="table-designer-columns-list"></div>
      </div>

      <div class="table-designer-fk">
        <div class="table-designer-fk-header">
          <h4>کلیدهای خارجی</h4>
          <button class="btn btn-sm btn-secondary table-designer-add-fk">
            <span class="icon">+</span>
            <span>افزودن کلید خارجی</span>
          </button>
        </div>
        <div class="table-designer-fk-list"></div>
      </div>

      <div class="table-designer-preview">
        <div class="table-designer-preview-header">
          <h4>پیش‌نمایش SQL</h4>
          <button class="btn btn-sm btn-ghost table-designer-copy-sql" title="کپی">
            <span class="icon">📋</span>
          </button>
        </div>
        <pre class="table-designer-sql-preview"></pre>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderColumns();
    this._renderForeignKeys();
    this._updatePreview();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      nameInput: q('.table-designer-name'),
      addColumnBtn: q('.table-designer-add-column'),
      columnsList: q('.table-designer-columns-list'),
      addFkBtn: q('.table-designer-add-fk'),
      fkList: q('.table-designer-fk-list'),
      sqlPreview: q('.table-designer-sql-preview'),
      copySqlBtn: q('.table-designer-copy-sql')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.nameInput?.addEventListener('input', () => this._updatePreview());

    this.elements.addColumnBtn?.addEventListener('click', () => {
      this.columns.push(this._emptyColumn());
      this._renderColumns();
      this._updatePreview();
    });

    this.elements.addFkBtn?.addEventListener('click', () => {
      this.foreignKeys.push({
        id: StringUtils.randomId(),
        column: '',
        refTable: '',
        refColumn: 'id',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION'
      });
      this._renderForeignKeys();
      this._updatePreview();
    });

    this.elements.copySqlBtn?.addEventListener('click', async () => {
      const ok = await DomUtils.copyToClipboard(this._generateSQL());
      if (ok) notificationService.success('SQL کپی شد');
    });
  }

  /**
   * رندر ستون‌ها
   */
  _renderColumns() {
    if (!this.elements.columnsList) return;

    this.elements.columnsList.innerHTML = this.columns.map((col, index) => `
      <div class="table-designer-column" data-column-id="${col.id}">
        <div class="table-designer-column-drag">⋮⋮</div>

        <div class="table-designer-column-fields">
          <div class="form-group">
            <label>نام</label>
            <input
              type="text"
              class="form-control column-name"
              value="${StringUtils.escapeHtml(col.name)}"
              placeholder="نام ستون"
            />
          </div>

          <div class="form-group">
            <label>نوع</label>
            <select class="form-control column-type">
              <option value="INTEGER" ${col.type === 'INTEGER' ? 'selected' : ''}>INTEGER</option>
              <option value="TEXT" ${col.type === 'TEXT' ? 'selected' : ''}>TEXT</option>
              <option value="REAL" ${col.type === 'REAL' ? 'selected' : ''}>REAL</option>
              <option value="BLOB" ${col.type === 'BLOB' ? 'selected' : ''}>BLOB</option>
              <option value="NUMERIC" ${col.type === 'NUMERIC' ? 'selected' : ''}>NUMERIC</option>
              <option value="BOOLEAN" ${col.type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN</option>
              <option value="DATE" ${col.type === 'DATE' ? 'selected' : ''}>DATE</option>
              <option value="DATETIME" ${col.type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
              <option value="VARCHAR(255)" ${col.type === 'VARCHAR(255)' ? 'selected' : ''}>VARCHAR(255)</option>
            </select>
          </div>

          <div class="form-group">
            <label>مقدار پیش‌فرض</label>
            <input
              type="text"
              class="form-control column-default"
              value="${StringUtils.escapeHtml(col.defaultValue || '')}"
              placeholder="اختیاری"
            />
          </div>
        </div>

        <div class="table-designer-column-options">
          <label class="checkbox">
            <input type="checkbox" class="column-pk" ${col.primaryKey ? 'checked' : ''} />
            <span>کلید اصلی</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" class="column-auto" ${col.autoIncrement ? 'checked' : ''} />
            <span>خودافزا</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" class="column-notnull" ${col.notNull ? 'checked' : ''} />
            <span>الزامی</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" class="column-unique" ${col.unique ? 'checked' : ''} />
            <span>یکتا</span>
          </label>
        </div>

        <button class="table-designer-column-remove" title="حذف">
          <span class="icon">🗑️</span>
        </button>
      </div>
    `).join('');

    this._bindColumnEvents();
  }

  /**
   * رویدادهای ستون
   */
  _bindColumnEvents() {
    this.elements.columnsList.querySelectorAll('.table-designer-column').forEach(el => {
      const colId = el.dataset.columnId;
      const column = this.columns.find(c => c.id === colId);
      if (!column) return;

      el.querySelector('.column-name')?.addEventListener('input', (e) => {
        column.name = e.target.value;
        this._updatePreview();
      });

      el.querySelector('.column-type')?.addEventListener('change', (e) => {
        column.type = e.target.value;
        this._updatePreview();
      });

      el.querySelector('.column-default')?.addEventListener('input', (e) => {
        column.defaultValue = e.target.value;
        this._updatePreview();
      });

      el.querySelector('.column-pk')?.addEventListener('change', (e) => {
        column.primaryKey = e.target.checked;
        this._updatePreview();
      });

      el.querySelector('.column-auto')?.addEventListener('change', (e) => {
        column.autoIncrement = e.target.checked;
        this._updatePreview();
      });

      el.querySelector('.column-notnull')?.addEventListener('change', (e) => {
        column.notNull = e.target.checked;
        this._updatePreview();
      });

      el.querySelector('.column-unique')?.addEventListener('change', (e) => {
        column.unique = e.target.checked;
        this._updatePreview();
      });

      el.querySelector('.table-designer-column-remove')?.addEventListener('click', () => {
        if (this.columns.length === 1) {
          notificationService.warning('حداقل یک ستون لازم است');
          return;
        }

        const index = this.columns.findIndex(c => c.id === colId);
        if (index >= 0) {
          this.columns.splice(index, 1);
          this._renderColumns();
          this._updatePreview();
        }
      });
    });
  }

  /**
   * رندر کلیدهای خارجی
   */
  _renderForeignKeys() {
    if (!this.elements.fkList) return;

    if (this.foreignKeys.length === 0) {
      this.elements.fkList.innerHTML = '<div class="empty-message">کلید خارجی تعریف نشده است</div>';
      return;
    }

    this.elements.fkList.innerHTML = this.foreignKeys.map((fk, index) => `
      <div class="table-designer-fk" data-fk-id="${fk.id}">
        <select class="form-control fk-column">
          <option value="">-- ستون --</option>
          ${this.columns.filter(c => c.name).map(c => `
            <option value="${StringUtils.escapeHtml(c.name)}" ${fk.column === c.name ? 'selected' : ''}>
              ${StringUtils.escapeHtml(c.name)}
            </option>
          `).join('')}
        </select>

        <span class="fk-arrow">→</span>

        <select class="form-control fk-ref-table">
          <option value="">-- جدول مرجع --</option>
          ${this._getAvailableTables().map(t => `
            <option value="${StringUtils.escapeHtml(t)}" ${fk.refTable === t ? 'selected' : ''}>
              ${StringUtils.escapeHtml(t)}
            </option>
          `).join('')}
        </select>

        <select class="form-control fk-ref-column">
          <option value="">-- ستون مرجع --</option>
          ${fk.refTable ? this._getTableColumns(fk.refTable).map(c => `
            <option value="${StringUtils.escapeHtml(c)}" ${fk.refColumn === c ? 'selected' : ''}>
              ${StringUtils.escapeHtml(c)}
            </option>
          `).join('') : ''}
        </select>

        <button class="table-designer-fk-remove" title="حذف">
          <span class="icon">🗑️</span>
        </button>
      </div>
    `).join('');

    this._bindFkEvents();
  }

  /**
   * رویدادهای کلید خارجی
   */
  _bindFkEvents() {
    this.elements.fkList.querySelectorAll('.table-designer-fk').forEach(el => {
      const fkId = el.dataset.fkId;
      const fk = this.foreignKeys.find(f => f.id === fkId);
      if (!fk) return;

      el.querySelector('.fk-column')?.addEventListener('change', (e) => {
        fk.column = e.target.value;
        this._updatePreview();
      });

      el.querySelector('.fk-ref-table')?.addEventListener('change', (e) => {
        fk.refTable = e.target.value;
        this._renderForeignKeys();
        this._updatePreview();
      });

      el.querySelector('.fk-ref-column')?.addEventListener('change', (e) => {
        fk.refColumn = e.target.value;
        this._updatePreview();
      });

      el.querySelector('.table-designer-fk-remove')?.addEventListener('click', () => {
        const index = this.foreignKeys.findIndex(f => f.id === fkId);
        if (index >= 0) {
          this.foreignKeys.splice(index, 1);
          this._renderForeignKeys();
          this._updatePreview();
        }
      });
    });
  }

  /**
   * دریافت جداول موجود
   */
  _getAvailableTables() {
    return (stateManager.get('database.tables') || []).map(t => t.name);
  }

  /**
   * دریافت ستون‌های جدول
   */
  _getTableColumns(tableName) {
    const info = databaseService.getTableInfo(tableName);
    return info.map(c => c.name);
  }

  /**
   * به‌روزرسانی پیش‌نمایش
   */
  _updatePreview() {
    if (!this.elements.sqlPreview) return;
    this.elements.sqlPreview.textContent = this._generateSQL();
  }

  /**
   * تولید SQL
   */
  _generateSQL() {
    const name = this.elements.nameInput?.value || this.options.tableName || 'new_table';

    if (!ValidationUtils.tableName(name)) {
      return `-- نام جدول نامعتبر است`;
    }

    const validColumns = this.columns.filter(c => c.name && ValidationUtils.sqlIdentifier(c.name));
    if (validColumns.length === 0) {
      return `-- حداقل یک ستون معتبر لازم است`;
    }

    const defs = validColumns.map(col => {
      let def = `  "${col.name}" ${col.type}`;

      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.defaultValue) {
        def += ` DEFAULT ${this._formatDefault(col.defaultValue, col.type)}`;
      }
      if (col.check) def += ` CHECK (${col.check})`;

      return def;
    });

    // کلیدهای خارجی
    this.foreignKeys.forEach(fk => {
      if (fk.column && fk.refTable && fk.refColumn) {
        let fkDef = `  FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}")`;
        if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
          fkDef += ` ON DELETE ${fk.onDelete}`;
        }
        if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
          fkDef += ` ON UPDATE ${fk.onUpdate}`;
        }
        defs.push(fkDef);
      }
    });

    return `CREATE TABLE "${name}" (\n${defs.join(',\n')}\n);`;
  }

  /**
   * فرمت مقدار پیش‌فرض
   */
  _formatDefault(value, type) {
    if (!value) return '';

    const upperType = String(type).toUpperCase();
    if (upperType.includes('INT') || upperType.includes('REAL') || upperType.includes('NUMERIC')) {
      if (!isNaN(Number(value))) return value;
    }

    if (value === 'NULL') return 'NULL';
    if (value === 'CURRENT_TIMESTAMP' || value === 'CURRENT_DATE' || value === 'CURRENT_TIME') {
      return value;
    }

    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * ایجاد جدول
   */
  createTable() {
    const sql = this._generateSQL();

    if (sql.startsWith('--')) {
      throw new Error('تعریف جدول نامعتبر است');
    }

    const result = databaseService.executeQuery(sql);
    if (!result.success) {
      throw new Error(result.error);
    }

    return sql;
  }

  /**
   * دریافت داده‌ها
   */
  getData() {
    return {
      tableName: this.elements.nameInput?.value || '',
      columns: [...this.columns],
      foreignKeys: [...this.foreignKeys],
      sql: this._generateSQL()
    };
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

window.TableDesigner = TableDesigner;