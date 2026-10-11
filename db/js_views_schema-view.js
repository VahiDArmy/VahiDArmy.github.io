/**
 * نمای ساختار پایگاه داده
 */
class SchemaView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.tree = null;
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-schema',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">🗂️</span>
            <span>ساختار پایگاه داده</span>
          </h1>
          <p class="view-subtitle">درختوار جداول، ایندکس‌ها، تریگرها و ویوها</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm schema-refresh" title="بازنشانی">
            <span class="icon">🔄</span>
            <span>بازنشانی</span>
          </button>
          <button class="btn btn-ghost btn-sm schema-export" title="صادرات">
            <span class="icon">📤</span>
            <span>صادرات</span>
          </button>
        </div>
      </div>

      <div class="schema-layout">
        <div class="schema-sidebar">
          <div class="schema-tree-container"></div>
        </div>

        <div class="schema-content">
          <div class="schema-detail">
            <div class="empty-state schema-empty">
              <div class="empty-state-icon">🗂️</div>
              <div class="empty-state-title">یک مورد را انتخاب کنید</div>
              <div class="empty-state-description">برای مشاهده جزئیات، از درخت سمت راست یک جدول، ویو یا ایندکس انتخاب کنید</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._initTree();
    this._loadSchema();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      refreshBtn: q('.schema-refresh'),
      exportBtn: q('.schema-export'),
      treeContainer: q('.schema-tree-container'),
      detail: q('.schema-detail'),
      empty: q('.schema-empty')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.refreshBtn?.addEventListener('click', () => this._loadSchema());
    this.elements.exportBtn?.addEventListener('click', () => this._exportSchema());

    stateManager.subscribe('database.tables', () => this._loadSchema());
  }

  /**
   * راه‌اندازی درخت
   */
  _initTree() {
    this.tree = new SchemaTree({
      searchable: true,
      expandable: true,
      selectable: true,
      showIcons: true,
      showCounts: true,
      contextMenu: true,
      onSelect: (items, item) => this._handleSelect(item),
      onRefresh: () => this._loadSchema()
    });

    this.elements.treeContainer.appendChild(this.tree.render());

    this.tree.on('viewData', (item) => {
      if (item.type === 'table' || item.type === 'view') {
        router.navigate(`/tables/${item.name}`);
      }
    });

    this.tree.on('viewSchema', (item) => {
      this._handleSelect(item);
    });

    this.tree.on('drop', (item) => this._dropObject(item));
    this.tree.on('dropIndex', (item) => this._dropObject(item));
    this.tree.on('dropTrigger', (item) => this._dropObject(item));
  }

  /**
   * بارگذاری ساختار
   */
  _loadSchema() {
    if (!stateManager.get('database.loaded')) {
      this.tree.setTree([]);
      return;
    }

    try {
      const objects = databaseService.getAllObjects();
      const treeData = [];

      // جداول
      if (objects.tables.length > 0) {
        treeData.push({
          id: 'folder-tables',
          label: 'جداول',
          icon: '📁',
          type: 'folder',
          count: objects.tables.length,
          children: objects.tables.map(t => this._buildTableNode(t))
        });
      }

      // ویوها
      if (objects.views.length > 0) {
        treeData.push({
          id: 'folder-views',
          label: 'ویوها',
          icon: '📁',
          type: 'folder',
          count: objects.views.length,
          children: objects.views.map(v => ({
            id: `view-${v.name}`,
            label: v.name,
            icon: '👁️',
            type: 'view',
            name: v.name
          }))
        });
      }

      // ایندکس‌ها
      if (objects.indexes.length > 0) {
        treeData.push({
          id: 'folder-indexes',
          label: 'ایندکس‌ها',
          icon: '📁',
          type: 'folder',
          count: objects.indexes.length,
          children: objects.indexes.map(idx => ({
            id: `index-${idx.name}`,
            label: idx.name,
            icon: '🔍',
            type: 'index',
            name: idx.name,
            tableName: idx.tbl_name
          }))
        });
      }

      // تریگرها
      if (objects.triggers.length > 0) {
        treeData.push({
          id: 'folder-triggers',
          label: 'تریگرها',
          icon: '📁',
          type: 'folder',
          count: objects.triggers.length,
          children: objects.triggers.map(t => ({
            id: `trigger-${t.name}`,
            label: t.name,
            icon: '⚡',
            type: 'trigger',
            name: t.name,
            tableName: t.tbl_name
          }))
        });
      }

      this.tree.setTree(treeData);
    } catch (error) {
      console.error('خطا در بارگذاری ساختار:', error);
      notificationService.error('خطا در بارگذاری ساختار');
    }
  }

  /**
   * ساخت گره جدول
   */
  _buildTableNode(table) {
    const info = databaseService.getTableInfo(table.name);
    const rowCount = databaseService.getTableRowCount(table.name);

    const columnNodes = info.map(col => ({
      id: `col-${table.name}-${col.name}`,
      label: col.name,
      icon: col.primaryKey ? '🔑' : '📊',
      type: 'column',
      badge: col.type,
      name: col.name,
      tableName: table.name,
      columnInfo: col
    }));

    return {
      id: `table-${table.name}`,
      label: table.name,
      icon: '📋',
      type: 'table',
      count: rowCount,
      name: table.name,
      children: columnNodes
    };
  }

  /**
   * هندلر انتخاب
   */
  _handleSelect(item) {
    if (!item) return;

    if (this.elements.empty) this.elements.empty.hidden = true;

    switch (item.type) {
      case 'table':
      case 'view':
        this._renderTableDetail(item);
        break;
      case 'column':
        this._renderColumnDetail(item);
        break;
      case 'index':
        this._renderIndexDetail(item);
        break;
      case 'trigger':
        this._renderTriggerDetail(item);
        break;
      default:
        this._renderGenericDetail(item);
    }
  }

  /**
   * رندر جزئیات جدول
   */
  _renderTableDetail(item) {
    const info = databaseService.getTableInfo(item.name);
    const rowCount = databaseService.getTableRowCount(item.name);
    const sql = databaseService.getCreateTableSql(item.name);
    const indexes = databaseService.getIndexes(item.name);
    const fks = databaseService.getForeignKeys(item.name);

    this.elements.detail.innerHTML = `
      <div class="schema-detail-header">
        <h2 class="schema-detail-title">
          <span class="icon">📋</span>
          <span>${StringUtils.escapeHtml(item.name)}</span>
        </h2>
        <div class="schema-detail-actions">
          <button class="btn btn-sm btn-primary schema-detail-view-data">
            <span class="icon">👁️</span>
            <span>مشاهده داده‌ها</span>
          </button>
        </div>
      </div>

      <div class="schema-detail-stats">
        <div class="schema-stat-item">
          <div class="schema-stat-value">${StringUtils.englishToPersianDigits(rowCount)}</div>
          <div class="schema-stat-label">ردیف</div>
        </div>
        <div class="schema-stat-item">
          <div class="schema-stat-value">${StringUtils.englishToPersianDigits(info.length)}</div>
          <div class="schema-stat-label">ستون</div>
        </div>
        <div class="schema-stat-item">
          <div class="schema-stat-value">${StringUtils.englishToPersianDigits(indexes.length)}</div>
          <div class="schema-stat-label">ایندکس</div>
        </div>
        <div class="schema-stat-item">
          <div class="schema-stat-value">${StringUtils.englishToPersianDigits(fks.length)}</div>
          <div class="schema-stat-label">کلید خارجی</div>
        </div>
      </div>

      <div class="schema-detail-section">
        <h3>ستون‌ها</h3>
        <table class="schema-detail-table">
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
                <td>${col.primaryKey ? '🔑 ' : ''}${StringUtils.escapeHtml(col.name)}</td>
                <td><code>${StringUtils.escapeHtml(col.type)}</code></td>
                <td>${col.primaryKey ? '✓' : ''}</td>
                <td>${col.notNull ? '✓' : ''}</td>
                <td>${col.defaultValue !== null && col.defaultValue !== undefined ? StringUtils.escapeHtml(String(col.defaultValue)) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${sql ? `
        <div class="schema-detail-section">
          <h3>SQL ایجاد</h3>
          <pre class="schema-detail-code">${StringUtils.escapeHtml(sql)}</pre>
        </div>
      ` : ''}
    `;

    this.elements.detail.querySelector('.schema-detail-view-data')?.addEventListener('click', () => {
      router.navigate(`/tables/${item.name}`);
    });
  }

  /**
   * رندر جزئیات ستون
   */
  _renderColumnDetail(item) {
    const col = item.columnInfo;

    this.elements.detail.innerHTML = `
      <div class="schema-detail-header">
        <h2 class="schema-detail-title">
          <span class="icon">📊</span>
          <span>ستون: ${StringUtils.escapeHtml(col.name)}</span>
        </h2>
      </div>

      <div class="schema-detail-info">
        <div class="schema-info-row">
          <span class="schema-info-label">جدول:</span>
          <span class="schema-info-value">${StringUtils.escapeHtml(item.tableName)}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">نام:</span>
          <span class="schema-info-value">${StringUtils.escapeHtml(col.name)}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">نوع:</span>
          <span class="schema-info-value"><code>${StringUtils.escapeHtml(col.type)}</code></span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">کلید اصلی:</span>
          <span class="schema-info-value">${col.primaryKey ? '✓ بله' : '✕ خیر'}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">الزامی:</span>
          <span class="schema-info-value">${col.notNull ? '✓ بله' : '✕ خیر'}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">پیش‌فرض:</span>
          <span class="schema-info-value">${col.defaultValue !== null && col.defaultValue !== undefined ? StringUtils.escapeHtml(String(col.defaultValue)) : '-'}</span>
        </div>
      </div>
    `;
  }

  /**
   * رندر جزئیات ایندکس
   */
  _renderIndexDetail(item) {
    const indexes = databaseService.getIndexes(item.tableName);
    const idx = indexes.find(i => i.name === item.name);
    const sql = databaseService.getCreateIndexSql(item.name);

    this.elements.detail.innerHTML = `
      <div class="schema-detail-header">
        <h2 class="schema-detail-title">
          <span class="icon">🔍</span>
          <span>ایندکس: ${StringUtils.escapeHtml(item.name)}</span>
        </h2>
      </div>

      <div class="schema-detail-info">
        <div class="schema-info-row">
          <span class="schema-info-label">جدول:</span>
          <span class="schema-info-value">${StringUtils.escapeHtml(item.tableName)}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">یکتا:</span>
          <span class="schema-info-value">${idx?.unique ? '✓ بله' : '✕ خیر'}</span>
        </div>
        <div class="schema-info-row">
          <span class="schema-info-label">ستون‌ها:</span>
          <span class="schema-info-value">${idx?.columns.map(c => StringUtils.escapeHtml(c)).join(', ') || '-'}</span>
        </div>
      </div>

      ${sql ? `
        <div class="schema-detail-section">
          <h3>SQL ایجاد</h3>
          <pre class="schema-detail-code">${StringUtils.escapeHtml(sql)}</pre>
        </div>
      ` : ''}
    `;
  }

  /**
   * رندر جزئیات تریگر
   */
  _renderTriggerDetail(item) {
    const sql = databaseService.getCreateTriggerSql(item.name);

    this.elements.detail.innerHTML = `
      <div class="schema-detail-header">
        <h2 class="schema-detail-title">
          <span class="icon">⚡</span>
          <span>تریگر: ${StringUtils.escapeHtml(item.name)}</span>
        </h2>
      </div>

      <div class="schema-detail-info">
        <div class="schema-info-row">
          <span class="schema-info-label">جدول:</span>
          <span class="schema-info-value">${StringUtils.escapeHtml(item.tableName)}</span>
        </div>
      </div>

      ${sql ? `
        <div class="schema-detail-section">
          <h3>SQL ایجاد</h3>
          <pre class="schema-detail-code">${StringUtils.escapeHtml(sql)}</pre>
        </div>
      ` : ''}
    `;
  }

  /**
   * رندر جزئیات عمومی
   */
  _renderGenericDetail(item) {
    this.elements.detail.innerHTML = `
      <div class="schema-detail-header">
        <h2 class="schema-detail-title">${StringUtils.escapeHtml(item.label || '')}</h2>
      </div>
      <pre class="schema-detail-code">${StringUtils.escapeHtml(JSON.stringify(item, null, 2))}</pre>
    `;
  }

  /**
   * حذف شیء
   */
  async _dropObject(item) {
    const type = item.type;
    const typeLabels = { table: 'جدول', view: 'ویو', index: 'ایندکس', trigger: 'تریگر' };
    const label = typeLabels[type] || 'شیء';

    const confirmed = await modalService.confirm(
      `آیا از حذف ${label} "${item.name}" مطمئن هستید؟`,
      { title: `حذف ${label}`, danger: true }
    );

    if (!confirmed) return;

    try {
      let result;

      switch (type) {
        case 'table':
          result = databaseService.dropTable(item.name);
          break;
        case 'view':
          result = databaseService.dropView(item.name);
          break;
        case 'index':
          result = databaseService.dropIndex(item.name);
          break;
        case 'trigger':
          result = databaseService.dropTrigger(item.name);
          break;
      }

      if (result && result.success) {
        notificationService.success(`${label} حذف شد`);
        loadTablesList();
        this._loadSchema();
      } else {
        notificationService.error(result?.error || 'خطا در حذف');
      }
    } catch (error) {
      notificationService.error(error.message);
    }
  }

  /**
   * صادرات ساختار
   */
  async _exportSchema() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    const items = [
      { label: 'SQL Schema', onClick: () => this._exportAs('sql') },
      { label: 'JSON Schema', onClick: () => this._exportAs('json') },
      { label: 'Markdown', onClick: () => this._exportAs('markdown') },
      { label: 'HTML', onClick: () => this._exportAs('html') }
    ];

    const rect = this.elements.exportBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * صادرات با فرمت
   */
  async _exportAs(format) {
    try {
      const objects = databaseService.getAllObjects();

      let content;
      let filename;
      let mimeType;

      switch (format) {
        case 'sql': {
          const parts = [];
          objects.tables.forEach(t => {
            if (t.sql) parts.push(t.sql + ';');
          });
          objects.views.forEach(v => {
            if (v.sql) parts.push(v.sql + ';');
          });
          objects.indexes.forEach(i => {
            if (i.sql) parts.push(i.sql + ';');
          });
          objects.triggers.forEach(tr => {
            if (tr.sql) parts.push(tr.sql + ';');
          });

          content = parts.join('\n\n');
          filename = 'schema.sql';
          mimeType = 'text/plain';
          break;
        }
        case 'json': {
          const schema = {
            tables: objects.tables.map(t => ({
              name: t.name,
              columns: databaseService.getTableInfo(t.name),
              indexes: databaseService.getIndexes(t.name),
              foreignKeys: databaseService.getForeignKeys(t.name),
              sql: t.sql
            })),
            views: objects.views.map(v => ({ name: v.name, sql: v.sql })),
            indexes: objects.indexes.map(i => ({ name: i.name, sql: i.sql })),
            triggers: objects.triggers.map(t => ({ name: t.name, sql: t.sql }))
          };

          content = JSON.stringify(schema, null, 2);
          filename = 'schema.json';
          mimeType = 'application/json';
          break;
        }
        case 'markdown': {
          let md = '# ساختار پایگاه داده\n\n';
          md += `> تاریخ: ${DateUtils.formatPersian(new Date(), 'YYYY/MM/DD HH:mm')}\n\n`;

          objects.tables.forEach(t => {
            md += `## ${t.name}\n\n`;
            const cols = databaseService.getTableInfo(t.name);
            md += '| ستون | نوع | کلید اصلی |\n';
            md += '|------|-----|----------|\n';
            cols.forEach(c => {
              md += `| ${c.name} | ${c.type} | ${c.primaryKey ? '✓' : ''} |\n`;
            });
            md += '\n';
          });

          content = md;
          filename = 'schema.md';
          mimeType = 'text/markdown';
          break;
        }
        case 'html': {
          let html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>ساختار پایگاه داده</title>`;
          html += `<style>body{font-family:Tahoma;padding:20px;direction:rtl}table{border-collapse:collapse;margin:10px 0;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f0f0f0}h1{color:#333}</style></head><body>`;
          html += `<h1>ساختار پایگاه داده</h1>`;
          html += `<p>تاریخ: ${DateUtils.formatPersian(new Date(), 'YYYY/MM/DD HH:mm')}</p>`;

          objects.tables.forEach(t => {
            html += `<h2>${StringUtils.escapeHtml(t.name)}</h2>`;
            const cols = databaseService.getTableInfo(t.name);
            html += '<table><thead><tr><th>ستون</th><th>نوع</th><th>کلید اصلی</th></tr></thead><tbody>';
            cols.forEach(c => {
              html += `<tr><td>${StringUtils.escapeHtml(c.name)}</td><td>${StringUtils.escapeHtml(c.type)}</td><td>${c.primaryKey ? '✓' : ''}</td></tr>`;
            });
            html += '</tbody></table>';
          });

          html += '</body></html>';
          content = html;
          filename = 'schema.html';
          mimeType = 'text/html';
          break;
        }
      }

      FileUtils.downloadText(content, filename, `${mimeType};charset=utf-8`);
      notificationService.success('صادرات انجام شد');
    } catch (error) {
      notificationService.error(error.message);
    }
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
    if (this.tree) this.tree.destroy();
    this.listeners.clear();
    this.element?.remove();
  }
}

window.SchemaView = SchemaView;