/**
 * دیالوگ واردات
 */
class ImportDialog {
  constructor(options = {}) {
    this.options = {
      acceptedFormats: ['.db', '.sqlite', '.sqlite3', '.db3', '.sql', '.json', '.csv'],
      maxSize: 500 * 1024 * 1024,
      showPreview: true,
      ...options
    };

    this.element = null;
    this.fileUploader = null;
    this.selectedFile = null;
    this.previewData = null;
    this.listeners = new Map();
  }

  /**
   * باز کردن
   */
  async open() {
    const content = this._renderContent();

    return modalService.open(content, {
      title: 'واردات پایگاه داده',
      size: 'lg',
      closable: true,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="import" disabled>
          <span class="icon">📥</span>
          <span>واردات</span>
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
      <div class="import-dialog">
        <div class="import-dialog-upload">
          <div class="import-dialog-file-uploader"></div>
        </div>

        <div class="import-dialog-preview" hidden>
          <div class="import-dialog-preview-header">
            <h4>پیش‌نمایش فایل</h4>
            <span class="import-dialog-preview-file"></span>
          </div>
          <div class="import-dialog-preview-content"></div>
        </div>

        <div class="import-dialog-options" hidden>
          <h4>تنظیمات واردات</h4>

          <div class="form-group" data-option="tableName" hidden>
            <label>نام جدول</label>
            <input type="text" class="form-control import-opt-table-name" />
          </div>

          <div class="form-group" data-option="mode">
            <label>حالت واردات</label>
            <div class="radio-group">
              <label class="radio">
                <input type="radio" name="import-mode" value="create" checked />
                <span>ایجاد جدول جدید</span>
              </label>
              <label class="radio">
                <input type="radio" name="import-mode" value="append" />
                <span>افزودن به جدول موجود</span>
              </label>
              <label class="radio">
                <input type="radio" name="import-mode" value="replace" />
                <span>جایگزینی جدول موجود</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox">
              <input type="checkbox" class="import-opt-header" checked />
              <span>ردیف اول شامل نام ستون‌ها است</span>
            </label>
          </div>

          <div class="form-group import-opt-delimiter-group" hidden>
            <label>جداکننده</label>
            <select class="form-control import-opt-delimiter">
              <option value=",">کاما (,)</option>
              <option value=";">نقطه‌ویرگول (;)</option>
              <option value="\t">Tab</option>
              <option value="|">لوله (|)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * راه‌اندازی
   */
  _setupModal(modal, ctx) {
    this.element = modal;

    // File Uploader
    const uploaderEl = modal.querySelector('.import-dialog-file-uploader');
    this.fileUploader = new FileUploader({
      multiple: false,
      accept: this.options.acceptedFormats.join(','),
      maxSize: this.options.maxSize,
      dragAndDrop: true,
      autoUpload: false,
      onSelect: (files) => this._handleFileSelect(files[0], modal, ctx)
    });

    uploaderEl.appendChild(this.fileUploader.render());

    // فرمت
    modal.querySelectorAll('input[name="import-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        // منطق: در حالت create، نیازی به tableName نیست اما نام فایل استفاده می‌شود
      });
    });

    // ردیف اول
    modal.querySelector('.import-opt-header')?.addEventListener('change', () => {
      if (this.previewData) {
        this._renderPreview(modal);
      }
    });

    // جداکننده
    modal.querySelector('.import-opt-delimiter')?.addEventListener('change', () => {
      if (this.selectedFile) {
        this._generatePreview(this.selectedFile, modal);
      }
    });

    // دکمه‌ها
    modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      modalService.close(ctx.id);
    });

    modal.querySelector('[data-action="import"]')?.addEventListener('click', () => {
      this._performImport(modal, ctx);
    });
  }

  /**
   * انتخاب فایل
   */
  async _handleFileSelect(file, modal, ctx) {
    if (!file) return;

    this.selectedFile = file;

    const format = importService.detectFormat(file);

    // نمایش تنظیمات
    const options = modal.querySelector('.import-dialog-options');
    if (options) options.hidden = false;

    // تنظیمات مخصوص CSV
    const delimiterGroup = modal.querySelector('.import-opt-delimiter-group');
    if (delimiterGroup) {
      delimiterGroup.hidden = format !== 'csv';
    }

    // تنظیمات مخصوص JSON/CSV
    const tableNameGroup = modal.querySelector('[data-option="tableName"]');
    if (tableNameGroup) {
      tableNameGroup.hidden = !['json', 'csv'].includes(format);
      if (!tableNameGroup.hidden) {
        modal.querySelector('.import-opt-table-name').value = FileUtils.getBaseName(file.name);
      }
    }

    // پیش‌نمایش
    if (this.options.showPreview) {
      await this._generatePreview(file, modal);
    }

    // فعال کردن دکمه واردات
    const importBtn = modal.querySelector('[data-action="import"]');
    if (importBtn) importBtn.disabled = false;
  }

  /**
   * تولید پیش‌نمایش
   */
  async _generatePreview(file, modal) {
    const previewSection = modal.querySelector('.import-dialog-preview');
    const previewContent = modal.querySelector('.import-dialog-preview-content');
    const previewFile = modal.querySelector('.import-dialog-preview-file');

    if (!previewSection || !previewContent) return;

    previewSection.hidden = false;
    previewContent.innerHTML = '<div class="loading-spinner"></div>';
    if (previewFile) previewFile.textContent = file.name;

    const format = importService.detectFormat(file);

    try {
      if (format === 'sqlite') {
        previewContent.innerHTML = `
          <div class="import-preview-info">
            <div class="import-preview-info-item">
              <span class="label">نوع فایل:</span>
              <span class="value">SQLite Database</span>
            </div>
            <div class="import-preview-info-item">
              <span class="label">حجم:</span>
              <span class="value">${FileUtils.formatSize(file.size)}</span>
            </div>
            <div class="import-preview-info-item">
              <span class="label">وضعیت:</span>
              <span class="value">آماده برای واردات</span>
            </div>
          </div>
        `;
        return;
      }

      if (format === 'sql') {
        const text = await FileUtils.readText(file);
        const statements = text.split(';').filter(s => s.trim());
        const lines = text.split('\n').length;

        previewContent.innerHTML = `
          <div class="import-preview-info">
            <div class="import-preview-info-item">
              <span class="label">تعداد خطوط:</span>
              <span class="value">${StringUtils.englishToPersianDigits(lines)}</span>
            </div>
            <div class="import-preview-info-item">
              <span class="label">تعداد دستورات:</span>
              <span class="value">${StringUtils.englishToPersianDigits(statements.length)}</span>
            </div>
          </div>
          <pre class="import-preview-code">${StringUtils.escapeHtml(text.substring(0, 2000))}${text.length > 2000 ? '\n...' : ''}</pre>
        `;
        return;
      }

      if (format === 'json') {
        const data = await FileUtils.readJSON(file);
        const summary = this._summarizeJSON(data);

        previewContent.innerHTML = `
          <div class="import-preview-info">
            <div class="import-preview-info-item">
              <span class="label">نوع:</span>
              <span class="value">${summary.type}</span>
            </div>
            ${summary.tables ? `
              <div class="import-preview-info-item">
                <span class="label">تعداد جداول:</span>
                <span class="value">${StringUtils.englishToPersianDigits(summary.tables.length)}</span>
              </div>
            ` : ''}
            ${summary.rows !== undefined ? `
              <div class="import-preview-info-item">
                <span class="label">تعداد ردیف‌ها:</span>
                <span class="value">${StringUtils.englishToPersianDigits(summary.rows)}</span>
              </div>
            ` : ''}
          </div>
        `;
        return;
      }

      if (format === 'csv') {
        const preview = await importService.preview(file, 10);

        if (!preview) {
          previewContent.textContent = 'قابل پیش‌نمایش نیست';
          return;
        }

        const headers = preview.headers || [];
        const rows = preview.rows || [];

        previewContent.innerHTML = `
          <div class="import-preview-info">
            <div class="import-preview-info-item">
              <span class="label">تعداد کل ردیف:</span>
              <span class="value">${StringUtils.englishToPersianDigits(preview.totalRows)}</span>
            </div>
            <div class="import-preview-info-item">
              <span class="label">تعداد ستون‌ها:</span>
              <span class="value">${StringUtils.englishToPersianDigits(headers.length)}</span>
            </div>
          </div>
          <div class="import-preview-table-wrapper">
            <table class="import-preview-table">
              <thead>
                <tr>${headers.map(h => `<th>${StringUtils.escapeHtml(h)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map(row => `
                  <tr>${headers.map(h => `<td>${StringUtils.escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (error) {
      previewContent.innerHTML = `<div class="error">خطا در پیش‌نمایش: ${StringUtils.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * خلاصه JSON
   */
  _summarizeJSON(data) {
    if (Array.isArray(data)) {
      return { type: 'آرایه', rows: data.length };
    }

    if (data.tables) {
      return {
        type: 'ساختار جداول',
        tables: Object.keys(data.tables),
        rows: Object.values(data.tables).reduce((sum, t) => sum + (Array.isArray(t) ? t.length : (t.data?.length || 0)), 0)
      };
    }

    if (data.data) {
      return { type: 'داده', rows: Array.isArray(data.data) ? data.data.length : 1 };
    }

    return { type: 'شیء' };
  }

  /**
   * انجام واردات
   */
  async _performImport(modal, ctx) {
    if (!this.selectedFile) return;

    const importBtn = modal.querySelector('[data-action="import"]');
    const originalText = importBtn.innerHTML;

    try {
      importBtn.disabled = true;
      importBtn.innerHTML = '<div class="loading-spinner-small"></div> در حال واردات...';

      const format = importService.detectFormat(this.selectedFile);
      const tableName = modal.querySelector('.import-opt-table-name')?.value;
      const mode = modal.querySelector('input[name="import-mode"]:checked')?.value || 'create';
      const hasHeader = modal.querySelector('.import-opt-header')?.checked !== false;
      const delimiter = modal.querySelector('.import-opt-delimiter')?.value || ',';

      const options = {
        tableName,
        hasHeader,
        delimiter,
        replaceExisting: mode === 'replace'
      };

      const result = await importService.autoImport(this.selectedFile, options);

      notificationService.success('واردات با موفقیت انجام شد');

      // بازنشانی لیست جداول
      if (typeof loadTablesList === 'function') {
        loadTablesList();
      }

      modalService.close(ctx.id, { success: true, result });
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
      importBtn.disabled = false;
      importBtn.innerHTML = originalText;
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
}

window.ImportDialog = ImportDialog;