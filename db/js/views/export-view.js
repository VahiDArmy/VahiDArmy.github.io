/**
 * نمای صادرات
 */
class ExportView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.selectedTables = new Set();
    this.selectedFormat = 'json';
    this.options = {
      includeSchema: true,
      includeData: true,
      prettyPrint: true,
      includeDrop: false,
      transaction: true,
      batchSize: 1000,
      filename: 'database_export'
    };
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-export',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">📤</span>
            <span>صادرات پایگاه داده</span>
          </h1>
          <p class="view-subtitle">تبدیل پایگاه داده به فرمت‌های مختلف</p>
        </div>
      </div>

      <div class="export-layout">
        <div class="export-main">
          <div class="export-section">
            <div class="export-section-header">
              <h3><span class="icon">📁</span> انتخاب جداول</h3>
              <div class="export-section-actions">
                <button class="btn btn-xs btn-ghost export-select-all">انتخاب همه</button>
                <button class="btn btn-xs btn-ghost export-deselect-all">لغو انتخاب</button>
              </div>
            </div>
            <div class="export-tables"></div>
          </div>

          <div class="export-section">
            <div class="export-section-header">
              <h3><span class="icon">📄</span> فرمت صادرات</h3>
            </div>
            <div class="export-formats"></div>
          </div>

          <div class="export-section">
            <div class="export-section-header">
              <h3><span class="icon">⚙️</span> تنظیمات</h3>
            </div>
            <div class="export-options"></div>
          </div>
        </div>

        <div class="export-sidebar">
          <div class="export-summary">
            <h3>خلاصه</h3>
            <div class="export-summary-item">
              <span class="export-summary-label">جداول انتخاب شده:</span>
              <span class="export-summary-value export-summary-tables">۰</span>
            </div>
            <div class="export-summary-item">
              <span class="export-summary-label">ردیف‌های کل:</span>
              <span class="export-summary-value export-summary-rows">۰</span>
            </div>
            <div class="export-summary-item">
              <span class="export-summary-label">فرمت:</span>
              <span class="export-summary-value export-summary-format">JSON</span>
            </div>
            <div class="export-summary-item">
              <span class="export-summary-label">حجم تقریبی:</span>
              <span class="export-summary-value export-summary-size">-</span>
            </div>
          </div>

          <div class="export-actions">
            <button class="btn btn-primary btn-lg export-preview-btn">
              <span class="icon">👁️</span>
              <span>پیش‌نمایش</span>
            </button>
            <button class="btn btn-success btn-lg export-download-btn">
              <span class="icon">📥</span>
              <span>دانلود</span>
            </button>
            <button class="btn btn-secondary export-copy-btn">
              <span class="icon">📋</span>
              <span>کپی به کلیپ‌بورد</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderTables();
    this._renderFormats();
    this._renderOptions();
    this._updateSummary();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      tables: q('.export-tables'),
      formats: q('.export-formats'),
      options: q('.export-options'),
      selectAll: q('.export-select-all'),
      deselectAll: q('.export-deselect-all'),
      previewBtn: q('.export-preview-btn'),
      downloadBtn: q('.export-download-btn'),
      copyBtn: q('.export-copy-btn'),
      summaryTables: q('.export-summary-tables'),
      summaryRows: q('.export-summary-rows'),
      summaryFormat: q('.export-summary-format'),
      summarySize: q('.export-summary-size')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.selectAll?.addEventListener('click', () => {
      const tables = stateManager.get('database.tables') || [];
      tables.forEach(t => this.selectedTables.add(t.name));
      this._updateTablesUI();
      this._updateSummary();
    });

    this.elements.deselectAll?.addEventListener('click', () => {
      this.selectedTables.clear();
      this._updateTablesUI();
      this._updateSummary();
    });

    this.elements.previewBtn?.addEventListener('click', () => this._preview());
    this.elements.downloadBtn?.addEventListener('click', () => this._download());
    this.elements.copyBtn?.addEventListener('click', () => this._copy());
  }

  /**
   * رندر جداول
   */
  _renderTables() {
    if (!this.elements.tables) return;

    const tables = stateManager.get('database.tables') || [];

    if (tables.length === 0) {
      this.elements.tables.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">جدولی موجود نیست</div>
        </div>
      `;
      return;
    }

    this.elements.tables.innerHTML = tables.map(table => {
      const rowCount = databaseService.getTableRowCount(table.name);
      const isSelected = this.selectedTables.has(table.name);

      return `
        <label class="export-table-item ${isSelected ? 'selected' : ''}">
          <input type="checkbox" class="export-table-checkbox" value="${StringUtils.escapeHtml(table.name)}" ${isSelected ? 'checked' : ''} />
          <div class="export-table-icon">${table.type === 'view' ? '👁️' : '📋'}</div>
          <div class="export-table-content">
            <div class="export-table-name">${StringUtils.escapeHtml(table.name)}</div>
            <div class="export-table-meta">
              <span>${StringUtils.englishToPersianDigits(rowCount)} ردیف</span>
              <span>${table.type === 'view' ? 'ویو' : 'جدول'}</span>
            </div>
          </div>
        </label>
      `;
    }).join('');

    this.elements.tables.querySelectorAll('.export-table-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const tableName = e.target.value;
        if (e.target.checked) {
          this.selectedTables.add(tableName);
        } else {
          this.selectedTables.delete(tableName);
        }
        e.target.closest('.export-table-item').classList.toggle('selected', e.target.checked);
        this._updateSummary();
      });
    });
  }

  /**
   * به‌روزرسانی UI جداول
   */
  _updateTablesUI() {
    this.elements.tables?.querySelectorAll('.export-table-item').forEach(item => {
      const cb = item.querySelector('.export-table-checkbox');
      if (cb) {
        cb.checked = this.selectedTables.has(cb.value);
        item.classList.toggle('selected', cb.checked);
      }
    });
  }

  /**
   * رندر فرمت‌ها
   */
  _renderFormats() {
    if (!this.elements.formats) return;

    const formats = AppConfig.export.formats;

    this.elements.formats.innerHTML = formats.map(f => `
      <label class="export-format-item ${this.selectedFormat === f.id ? 'active' : ''}">
        <input type="radio" name="export-format" value="${f.id}" ${this.selectedFormat === f.id ? 'checked' : ''} />
        <div class="export-format-icon">${this._getFormatIcon(f.id)}</div>
        <div class="export-format-content">
          <div class="export-format-label">${f.label}</div>
          <div class="export-format-ext">${f.extension}</div>
        </div>
      </label>
    `).join('');

    this.elements.formats.querySelectorAll('input[name="export-format"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedFormat = e.target.value;
        this.elements.formats.querySelectorAll('.export-format-item').forEach(item => {
          item.classList.toggle('active', item.querySelector('input').value === this.selectedFormat);
        });
        this._updateSummary();
        this._renderOptions();
      });
    });
  }

  /**
   * آیکون فرمت
   */
  _getFormatIcon(format) {
    const icons = {
      json: '{ }',
      csv: '📊',
      sql: '💾',
      xml: '📋',
      excel: '📗',
      html: '🌐',
      markdown: '📝',
      yaml: '📄',
      tsv: '📈',
      sqlite: '🗄️'
    };
    return icons[format] || '📄';
  }

  /**
   * رندر تنظیمات
   */
  _renderOptions() {
    if (!this.elements.options) return;

    const format = this.selectedFormat;

    let specificOptions = '';

    if (['sql'].includes(format)) {
      specificOptions = `
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" data-opt="includeDrop" ${this.options.includeDrop ? 'checked' : ''} />
            <span>شامل DROP TABLE</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" data-opt="transaction" ${this.options.transaction ? 'checked' : ''} />
            <span>استفاده از TRANSACTION</span>
          </label>
        </div>
      `;
    }

    this.elements.options.innerHTML = `
      <div class="form-group">
        <label>نام فایل</label>
        <input type="text" class="form-control export-opt-filename" value="${this.options.filename}" />
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" data-opt="includeSchema" ${this.options.includeSchema ? 'checked' : ''} />
          <span>شامل ساختار (CREATE TABLE)</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" data-opt="includeData" ${this.options.includeData ? 'checked' : ''} />
          <span>شامل داده‌ها</span>
        </label>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" data-opt="prettyPrint" ${this.options.prettyPrint ? 'checked' : ''} />
          <span>قالب‌بندی خوانا</span>
        </label>
      </div>

      ${specificOptions}
    `;

    // رویدادها
    this.elements.options.querySelectorAll('[data-opt]').forEach(input => {
      input.addEventListener('change', (e) => {
        this.options[e.target.dataset.opt] = e.target.checked;
      });
    });

    this.elements.options.querySelector('.export-opt-filename')?.addEventListener('input', (e) => {
      this.options.filename = e.target.value;
    });
  }

  /**
   * به‌روزرسانی خلاصه
   */
  _updateSummary() {
    if (this.elements.summaryTables) {
      this.elements.summaryTables.textContent = StringUtils.englishToPersianDigits(this.selectedTables.size);
    }

    let totalRows = 0;
    this.selectedTables.forEach(name => {
      totalRows += databaseService.getTableRowCount(name);
    });

    if (this.elements.summaryRows) {
      this.elements.summaryRows.textContent = StringUtils.englishToPersianDigits(totalRows);
    }

    const formatInfo = AppConfig.export.formats.find(f => f.id === this.selectedFormat);
    if (this.elements.summaryFormat) {
      this.elements.summaryFormat.textContent = formatInfo ? formatInfo.label : this.selectedFormat.toUpperCase();
    }

    // حجم تقریبی (تقریبی)
    const estimatedSize = totalRows * 100; // تخمین 100 بایت به ازای ردیف
    if (this.elements.summarySize) {
      this.elements.summarySize.textContent = NumberUtils.formatBytes(estimatedSize);
    }
  }

  /**
   * تولید محتوای صادرات
   */
  async _generateExport() {
    if (this.selectedTables.size === 0) {
      throw new Error('حداقل یک جدول انتخاب کنید');
    }

    const tables = {};

    for (const tableName of this.selectedTables) {
      const info = databaseService.getTableInfo(tableName);
      const data = databaseService.getTableData(tableName, { page: 1, pageSize: 10000000 });

      tables[tableName] = {
        columns: info,
        data: data.success ? data.data : [],
        schema: this.options.includeSchema ? databaseService.getCreateTableSql(tableName) : null
      };
    }

    return await exportService.export(this.selectedFormat, { tables }, {
      includeSchema: this.options.includeSchema,
      includeData: this.options.includeData,
      prettyPrint: this.options.prettyPrint,
      includeDrop: this.options.includeDrop,
      transaction: this.options.transaction
    });
  }

  /**
   * پیش‌نمایش
   */
  async _preview() {
    if (this.selectedTables.size === 0) {
      notificationService.warning('حداقل یک جدول انتخاب کنید');
      return;
    }

    const modalId = 'export-preview-modal';

    const content = `
      <div class="export-preview">
        <div class="export-preview-loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">در حال تولید پیش‌نمایش...</div>
        </div>
        <pre class="export-preview-content" hidden></pre>
      </div>
    `;

    modalService.open(content, {
      id: modalId,
      title: 'پیش‌نمایش صادرات',
      size: 'xl',
      onOpen: async (modal) => {
        try {
          const result = await this._generateExport();
          const content = typeof result.content === 'string' ? result.content : '[داده‌های باینری]';

          const loading = modal.querySelector('.export-preview-loading');
          const pre = modal.querySelector('.export-preview-content');

          if (loading) loading.hidden = true;
          if (pre) {
            pre.hidden = false;
            pre.textContent = content.substring(0, 50000) + (content.length > 50000 ? '\n\n... (بیشتر)' : '');
          }
        } catch (error) {
          const loading = modal.querySelector('.export-preview-loading');
          if (loading) {
            loading.innerHTML = `<div class="error">خطا: ${StringUtils.escapeHtml(error.message)}</div>`;
          }
        }
      }
    });
  }

  /**
   * دانلود
   */
  async _download() {
    if (this.selectedTables.size === 0) {
      notificationService.warning('حداقل یک جدول انتخاب کنید');
      return;
    }

    const progress = notificationService.progress('در حال صادرات...', { duration: 0 });

    try {
      progress.update(50, 'تولید فایل...');
      const result = await this._generateExport();

      const formatInfo = AppConfig.export.formats.find(f => f.id === this.selectedFormat);
      const ext = formatInfo ? formatInfo.extension : '.' + this.selectedFormat;
      const filename = (this.options.filename || 'export') + ext;

      progress.update(90, 'آماده‌سازی دانلود...');

      if (result.isBinary) {
        FileUtils.downloadUint8Array(result.content, filename, result.mimeType);
      } else {
        FileUtils.downloadText(result.content, filename, result.mimeType);
      }

      progress.complete('صادرات انجام شد');
    } catch (error) {
      progress.dismiss();
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * کپی
   */
  async _copy() {
    if (this.selectedTables.size === 0) {
      notificationService.warning('حداقل یک جدول انتخاب کنید');
      return;
    }

    try {
      const result = await this._generateExport();

      if (result.isBinary) {
        notificationService.warning('این فرمت قابل کپی نیست');
        return;
      }

      const ok = await DomUtils.copyToClipboard(result.content);
      if (ok) notificationService.success('کپی شد');
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
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
    this.listeners.clear();
    this.element?.remove();
  }
}

window.ExportView = ExportView;