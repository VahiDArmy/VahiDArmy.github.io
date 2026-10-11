/**
 * نمای واردات
 */
class ImportView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.uploader = null;
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-import',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">📥</span>
            <span>واردات پایگاه داده</span>
          </h1>
          <p class="view-subtitle">بارگذاری پایگاه داده از فایل‌های مختلف</p>
        </div>
      </div>

      <div class="import-layout">
        <div class="import-main">
          <div class="import-uploader-container"></div>
        </div>

        <div class="import-sidebar">
          <div class="import-info">
            <h3>فرمت‌های پشتیبانی شده</h3>
            <div class="import-formats-list">
              <div class="import-format-info">
                <span class="import-format-icon">🗄️</span>
                <div class="import-format-details">
                  <div class="import-format-name">SQLite Database</div>
                  <div class="import-format-ext">.db, .sqlite, .sqlite3, .db3</div>
                  <div class="import-format-desc">پایگاه داده SQLite آماده</div>
                </div>
              </div>

              <div class="import-format-info">
                <span class="import-format-icon">💾</span>
                <div class="import-format-details">
                  <div class="import-format-name">SQL Script</div>
                  <div class="import-format-ext">.sql</div>
                  <div class="import-format-desc">دستورات SQL</div>
                </div>
              </div>

              <div class="import-format-info">
                <span class="import-format-icon">{ }</span>
                <div class="import-format-details">
                  <div class="import-format-name">JSON</div>
                  <div class="import-format-ext">.json</div>
                  <div class="import-format-desc">داده‌های JSON</div>
                </div>
              </div>

              <div class="import-format-info">
                <span class="import-format-icon">📊</span>
                <div class="import-format-details">
                  <div class="import-format-name">CSV</div>
                  <div class="import-format-ext">.csv, .tsv</div>
                  <div class="import-format-desc">داده‌های جدولی</div>
                </div>
              </div>
            </div>
          </div>

          <div class="import-tips">
            <h3>نکات</h3>
            <ul class="import-tips-list">
              <li>حداکثر حجم فایل ۵۰۰ مگابایت</li>
              <li>تمام عملیات به صورت محلی انجام می‌شود</li>
              <li>می‌توانید چندین فایل انتخاب کنید</li>
              <li>داده‌های موجود در صورت نیاز جایگزین می‌شوند</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._initUploader();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      uploaderContainer: q('.import-uploader-container')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    // ثبت در state
    stateManager.subscribe('database.loaded', () => {
      // می‌تواند برای راهنمایی بیشتر استفاده شود
    });
  }

  /**
   * راه‌اندازی uploader
   */
  _initUploader() {
    this.uploader = new FileUploader({
      multiple: true,
      accept: '.db,.sqlite,.sqlite3,.db3,.sql,.json,.csv,.tsv',
      maxSize: AppConfig.import.maxFileSize,
      maxFiles: 20,
      dragAndDrop: true,
      autoUpload: false,
      showPreview: true,
      onSelect: (files) => this._handleFilesSelected(files),
      onUpload: (file, onProgress) => this._handleUpload(file, onProgress)
    });

    this.elements.uploaderContainer.appendChild(this.uploader.render());
  }

  /**
   * هندلر انتخاب فایل‌ها
   */
  async _handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    // اگر فقط یک فایل است، مستقیم import
    if (files.length === 1) {
      await this._processFile(files[0]);
    } else {
      // چندین فایل، modal انتخاب
      this._processMultipleFiles(files);
    }
  }

  /**
   * پردازش یک فایل
   */
  async _processFile(file) {
    const format = importService.detectFormat(file);

    if (format === 'sqlite') {
      const confirmed = await modalService.confirm(
        `پایگاه داده فعلی با "${file.name}" جایگزین خواهد شد. ادامه؟`,
        { title: 'بارگذاری پایگاه داده', danger: true }
      );

      if (!confirmed) return;

      try {
        await importService.autoImport(file);
        notificationService.success('پایگاه داده بارگذاری شد');

        stateManager.set('database.loaded', true);
        stateManager.set('database.name', file.name);
        stateManager.set('database.size', file.size);

        loadTablesList();
        router.navigate('/dashboard');
      } catch (error) {
        notificationService.error(`خطا: ${error.message}`);
      }
    } else {
      // SQL, JSON, CSV
      this._showImportOptions(file, format);
    }
  }

  /**
   * نمایش تنظیمات واردات
   */
  _showImportOptions(file, format) {
    const dialog = new ImportDialog();
    dialog.open();
  }

  /**
   * پردازش چندین فایل
   */
  async _processMultipleFiles(files) {
    const confirmed = await modalService.confirm(
      `${StringUtils.englishToPersianDigits(files.length)} فایل برای واردات انتخاب شد. ادامه؟`,
      { title: 'واردات چندگانه' }
    );

    if (!confirmed) return;

    const progress = notificationService.progress('در حال واردات...', { duration: 0 });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = Math.round(((i) / files.length) * 100);
      progress.update(percent, `پردازش ${file.name}... (${i + 1}/${files.length})`);

      try {
        const format = importService.detectFormat(file);

        if (format === 'sqlite') {
          await importService.autoImport(file);
        } else {
          await importService.autoImport(file);
        }

        success++;
      } catch (error) {
        console.error(`خطا در ${file.name}:`, error);
        failed++;
      }
    }

    progress.complete(`کامل شد: ${StringUtils.englishToPersianDigits(success)} موفق، ${StringUtils.englishToPersianDigits(failed)} خطا`);

    if (success > 0) {
      loadTablesList();
    }
  }

  /**
   * هندلر آپلود
   */
  async _handleUpload(file, onProgress) {
    // شبیه‌سازی
    for (let i = 0; i <= 100; i += 10) {
      onProgress(i);
      await new Promise(r => setTimeout(r, 50));
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
    if (this.uploader) this.uploader.destroy();
    this.listeners.clear();
    this.element?.remove();
  }
}

window.ImportView = ImportView;