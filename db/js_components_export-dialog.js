/**
 * دیالوگ صادرات
 */
class ExportDialog {
  constructor(options = {}) {
    this.options = {
      tables: [],
      selectedTables: [],
      format: 'json',
      includeSchema: true,
      includeData: true,
      prettyPrint: true,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.listeners = new Map();
    this.previewContent = '';
  }

  /**
   * باز کردن
   */
  async open() {
    const content = this._renderContent();

    return modalService.open(content, {
      title: 'صادرات پایگاه داده',
      size: 'lg',
      closable: true,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="export">
          <span class="icon">📤</span>
          <span>صادرات</span>
        </button>
      `,
      onOpen: (modal, ctx) => {
        this._setupModal(modal, ctx);
      }
    });
  }

  /**
   * رندر محتوا
   */
  _renderContent() {
    return `
      <div class="export-dialog">
        <div class="export-dialog-tabs">
          <button class="export-dialog-tab active" data-tab="format">قالب</button>
          <button class="export-dialog-tab" data-tab="tables">جداول</button>
          <button class="export-dialog-tab" data-tab="options">تنظیمات</button>
          <button class="export-dialog-tab" data-tab="preview">پیش‌نمایش</button>
        </div>

        <div class="export-dialog-content">
          <div class="export-dialog-panel" data-panel="format">
            ${this._renderFormatPanel()}
          </div>
          <div class="export-dialog-panel" data-panel="tables" hidden>
            ${this._renderTablesPanel()}
          </div>
          <div class="export-dialog-panel" data-panel="options" hidden>
            ${this._renderOptionsPanel()}
          </div>
          <div class="export-dialog-panel" data-panel="preview" hidden>
            ${this._renderPreviewPanel()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * پنل فرمت
   */
  _renderFormatPanel() {
    const formats = AppConfig.export.formats;

    return `
      <div class="export-dialog-format-grid">
        ${formats.map(f => `
          <label class="export-format-card ${this.options.format === f.id ? 'active' : ''}">
            <input type="radio" name="export-format" value="${f.id}" ${this.options.format === f.id ? 'checked' : ''} />
            <div class="export-format-card-content">
              <div class="export-format-card-icon">${this._getFormatIcon(f.id)}</div>
              <div class="export-format-card-label">${f.label}</div>
              <div class="export-format-card-ext">${f.extension}</div>
            </div>
          </label>
        `).join('')}
      </div>
    `;
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
   * پنل جداول
   */
  _renderTablesPanel() {
    if (!this.options.tables || this.options.tables.length === 0) {
      return '<div class="empty-state"><div class="empty-state-title">جدولی موجود نیست</div></div>';
    }

    return `
      <div class="export-dialog-tables">
        <div class="export-dialog-tables-header">
          <label class="checkbox">
            <input type="checkbox" class="export-dialog-select-all" checked />
            <span>انتخاب همه (${StringUtils.englishToPersianDigits(this.options.tables.length)} جدول)</span>
          </label>
        </div>
        <div class="export-dialog-tables-list">
          ${this.options.tables.map(table => `
            <label class="export-dialog-table-item">
              <input type="checkbox" value="${table.name}" checked data-table="${table.name}" />
              <div class="export-dialog-table-info">
                <span class="export-dialog-table-name">${StringUtils.escapeHtml(table.name)}</span>
                ${table.rowCount !== undefined ? `<span class="export-dialog-table-count">${StringUtils.englishToPersianDigits(table.rowCount)} ردیف</span>` : ''}
              </div>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * پنل تنظیمات
   */
  _renderOptionsPanel() {
    return `
      <div class="export-dialog-options">
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" class="export-opt-schema" ${this.options.includeSchema ? 'checked' : ''} />
            <span>شامل ساختار (CREATE TABLE)</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" class="export-opt-data" ${this.options.includeData ? 'checked' : ''} />
            <span>شامل داده‌ها (INSERT)</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" class="export-opt-pretty" ${this.options.prettyPrint ? 'checked' : ''} />
            <span>قالب‌بندی خوانا</span>
          </label>
        </div>

        <div class="form-group">
          <label>نام فایل</label>
          <input type="text" class="form-control export-opt-filename" value="database_export" />
        </div>

        <div class="form-group">
          <label>محدودیت ردیف (اختیاری)</label>
          <input type="number" class="form-control export-opt-limit" placeholder="بدون محدودیت" min="1" />
        </div>
      </div>
    `;
  }

  /**
   * پنل پیش‌نمایش
   */
  _renderPreviewPanel() {
    return `
      <div class="export-dialog-preview">
        <div class="export-dialog-preview-header">
          <span class="export-dialog-preview-info">پیش‌نمایش:</span>
          <button class="btn btn-sm btn-ghost export-dialog-refresh-preview" title="به‌روزرسانی">
            <span class="icon">🔄</span>
          </button>
          <button class="btn btn-sm btn-ghost export-dialog-copy-preview" title="کپی">
            <span class="icon">📋</span>
          </button>
        </div>
        <pre class="export-dialog-preview-content">برای مشاهده پیش‌نمایش، دکمه به‌روزرسانی را بزنید.</pre>
      </div>
    `;
  }

  /**
   * راه‌اندازی مودال
   */
  _setupModal(modal, ctx) {
    const q = (sel) => modal.querySelector(sel);
    const qa = (sel) => Array.from(modal.querySelectorAll(sel));

    // تب‌ها
    qa('.export-dialog-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        qa('.export-dialog-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        qa('.export-dialog-panel').forEach(p => p.hidden = true);
        const panel = q(`[data-panel="${tab.dataset.tab}"]`);
        if (panel) panel.hidden = false;

        if (tab.dataset.tab === 'preview') {
          this._updatePreview(modal);
        }
      });
    });

    // فرمت
    qa('input[name="export-format"]').forEach(radio => {
      radio.addEventListener('change', () => {
        qa('.export-format-card').forEach(c => c.classList.remove('active'));
        radio.closest('.export-format-card').classList.add('active');
        this.options.format = radio.value;
      });
    });

    // انتخاب همه
    const selectAll = q('.export-dialog-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        qa('.export-dialog-table-item input[type="checkbox"]').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }

    // تنظیمات
    q('.export-opt-schema')?.addEventListener('change', (e) => {
      this.options.includeSchema = e.target.checked;
    });

    q('.export-opt-data')?.addEventListener('change', (e) => {
      this.options.includeData = e.target.checked;
    });

    q('.export-opt-pretty')?.addEventListener('change', (e) => {
      this.options.prettyPrint = e.target.checked;
    });

    // پیش‌نمایش
    q('.export-dialog-refresh-preview')?.addEventListener('click', () => {
      this._updatePreview(modal);
    });

    q('.export-dialog-copy-preview')?.addEventListener('click', async () => {
      const content = q('.export-dialog-preview-content')?.textContent;
      if (content) {
        const ok = await DomUtils.copyToClipboard(content);
        if (ok) notificationService.success('کپی شد');
      }
    });

    // دکمه‌ها
    q('[data-action="cancel"]')?.addEventListener('click', () => {
      modalService.close(ctx.id);
    });

    q('[data-action="export"]')?.addEventListener('click', () => {
      this._performExport(modal, ctx);
    });
  }

  /**
   * به‌روزرسانی پیش‌نمایش
   */
  async _updatePreview(modal) {
    const preview = modal.querySelector('.export-dialog-preview-content');
    if (!preview) return;

    preview.textContent = 'در حال بارگذاری...';

    try {
      const result = await this._generateExport(true);
      const content = typeof result.content === 'string'
        ? result.content
        : '[داده‌های باینری]';

      preview.textContent = content.substring(0, 5000) + (content.length > 5000 ? '\n\n... (بیشتر)' : '');
    } catch (error) {
      preview.textContent = `خطا: ${error.message}`;
    }
  }

  /**
   * انجام صادرات
   */
  async _performExport(modal, ctx) {
    const filename = modal.querySelector('.export-opt-filename')?.value || 'database_export';

    try {
      const result = await this._generateExport(false);

      const formatInfo = AppConfig.export.formats.find(f => f.id === this.options.format);
      const ext = formatInfo ? formatInfo.extension : '.' + this.options.format;
      const finalFilename = filename + ext;

      if (result.isBinary) {
        FileUtils.downloadUint8Array(result.content, finalFilename, result.mimeType);
      } else {
        FileUtils.downloadText(result.content, finalFilename, result.mimeType);
      }

      notificationService.success('صادرات با موفقیت انجام شد');
      modalService.close(ctx.id, { success: true, filename: finalFilename });
    } catch (error) {
      notificationService.error(`خطا در صادرات: ${error.message}`);
    }
  }

  /**
   * تولید محتوای صادرات
   */
  async _generateExport(isPreview) {
    const selectedTableNames = this.element
      ? Array.from(this.element.querySelectorAll('.export-dialog-table-item input:checked')).map(cb => cb.value)
      : this.options.selectedTables;

    const tables = {};
    const limit = this.element
      ? parseInt(this.element.querySelector('.export-opt-limit')?.value) || null
      : null;

    for (const tableName of selectedTableNames) {
      const tableData = databaseService.getTableData(tableName, {
        page: 1,
        pageSize: limit || 1000000
      });

      tables[tableName] = {
        columns: databaseService.getTableInfo(tableName),
        data: tableData.success ? tableData.data : [],
        schema: databaseService.getCreateTableSql(tableName)
      };
    }

    const exportData = { tables };

    return await exportService.export(this.options.format, exportData, {
      includeSchema: this.options.includeSchema,
      includeData: this.options.includeData,
      prettyPrint: this.options.prettyPrint
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
}

window.ExportDialog = ExportDialog;