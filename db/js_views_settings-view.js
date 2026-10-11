/**
 * نمای تنظیمات
 */
class SettingsView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.settings = {};
    this.listeners = new Map();
    this.currentSection = 'general';
  }

  /**
   * رندر
   */
  async render() {
    this.settings = this._loadSettings();

    this.element = DomUtils.create('div', {
      className: 'view view-settings',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">⚙️</span>
            <span>تنظیمات</span>
          </h1>
          <p class="view-subtitle">تنظیمات برنامه و اولویت‌ها</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm settings-reset">
            <span class="icon">🔄</span>
            <span>بازنشانی به پیش‌فرض</span>
          </button>
          <button class="btn btn-primary btn-sm settings-save">
            <span class="icon">💾</span>
            <span>ذخیره</span>
          </button>
        </div>
      </div>

      <div class="settings-layout">
        <div class="settings-sidebar">
          <nav class="settings-nav">
            <button class="settings-nav-item active" data-section="general">
              <span class="icon">🎨</span>
              <span>عمومی</span>
            </button>
            <button class="settings-nav-item" data-section="database">
              <span class="icon">🗄️</span>
              <span>پایگاه داده</span>
            </button>
            <button class="settings-nav-item" data-section="display">
              <span class="icon">👁️</span>
              <span>نمایش</span>
            </button>
            <button class="settings-nav-item" data-section="editor">
              <span class="icon">💻</span>
              <span>ویرایشگر</span>
            </button>
            <button class="settings-nav-item" data-section="shortcuts">
              <span class="icon">⌨️</span>
              <span>کلیدهای میانبر</span>
            </button>
            <button class="settings-nav-item" data-section="storage">
              <span class="icon">💾</span>
              <span>ذخیره‌سازی</span>
            </button>
            <button class="settings-nav-item" data-section="about">
              <span class="icon">ℹ️</span>
              <span>درباره</span>
            </button>
          </nav>
        </div>

        <div class="settings-content"></div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderSection();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      nav: q('.settings-nav'),
      content: q('.settings-content'),
      saveBtn: q('.settings-save'),
      resetBtn: q('.settings-reset')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.nav?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-section]');
      if (!item) return;

      this.currentSection = item.dataset.section;
      this.elements.nav.querySelectorAll('.settings-nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.section === this.currentSection);
      });
      this._renderSection();
    });

    this.elements.saveBtn?.addEventListener('click', () => this._save());
    this.elements.resetBtn?.addEventListener('click', () => this._reset());
  }

  /**
   * بارگذاری تنظیمات
   */
  _loadSettings() {
    return storageService.get('settings', {
      theme: 'dark',
      language: 'fa',
      animations: true,
      autoSave: true,
      autoSaveInterval: 60,
      pageSize: 50,
      rowHeight: 48,
      dateFormat: 'persian',
      editorFontSize: 14,
      editorTabSize: 2,
      editorAutoComplete: true,
      editorLineNumbers: true,
      maxRecentFiles: 10,
      confirmDelete: true,
      showNotifications: true
    });
  }

  /**
   * رندر بخش
   */
  _renderSection() {
    if (!this.elements.content) return;

    switch (this.currentSection) {
      case 'general':
        this._renderGeneral();
        break;
      case 'database':
        this._renderDatabase();
        break;
      case 'display':
        this._renderDisplay();
        break;
      case 'editor':
        this._renderEditor();
        break;
      case 'shortcuts':
        this._renderShortcuts();
        break;
      case 'storage':
        this._renderStorage();
        break;
      case 'about':
        this._renderAbout();
        break;
    }
  }

  /**
   * بخش عمومی
   */
  _renderGeneral() {
    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>تنظیمات عمومی</h2>

        <div class="settings-group">
          <label class="settings-label">تم</label>
          <div class="settings-radio-group">
            ${['dark', 'light', 'high-contrast'].map(theme => `
              <label class="settings-radio ${this.settings.theme === theme ? 'active' : ''}">
                <input type="radio" name="theme" value="${theme}" ${this.settings.theme === theme ? 'checked' : ''} />
                <div class="settings-radio-icon">${theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '⚡'}</div>
                <div class="settings-radio-label">${theme === 'dark' ? 'تاریک' : theme === 'light' ? 'روشن' : 'کنتراست بالا'}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="settings-group">
          <label class="settings-label">زبان</label>
          <select class="form-control settings-select" data-setting="language">
            <option value="fa" ${this.settings.language === 'fa' ? 'selected' : ''}>فارسی</option>
            <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="animations" ${this.settings.animations ? 'checked' : ''} />
            <div>
              <span>فعال‌سازی انیمیشن‌ها</span>
              <small>انیمیشن‌های رابط کاربری</small>
            </div>
          </label>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="showNotifications" ${this.settings.showNotifications ? 'checked' : ''} />
            <div>
              <span>نمایش اعلان‌ها</span>
              <small>نمایش پیام‌های سیستمی</small>
            </div>
          </label>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="confirmDelete" ${this.settings.confirmDelete ? 'checked' : ''} />
            <div>
              <span>تأیید قبل از حذف</span>
              <small>نمایش دیالوگ تأیید برای عملیات حذف</small>
            </div>
          </label>
        </div>
      </div>
    `;

    this._bindSectionInputs();
  }

  /**
   * بخش پایگاه داده
   */
  _renderDatabase() {
    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>تنظیمات پایگاه داده</h2>

        <div class="settings-group">
          <label class="settings-label">تعداد ردیف در صفحه</label>
          <select class="form-control settings-select" data-setting="pageSize">
            ${AppConfig.database.pageSizeOptions.map(size => `
              <option value="${size}" ${this.settings.pageSize === size ? 'selected' : ''}>${StringUtils.englishToPersianDigits(size)}</option>
            `).join('')}
          </select>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="autoSave" ${this.settings.autoSave ? 'checked' : ''} />
            <div>
              <span>ذخیره خودکار</span>
              <small>ذخیره خودکار تغییرات پایگاه داده</small>
            </div>
          </label>
        </div>

        <div class="settings-group">
          <label class="settings-label">فاصله ذخیره خودکار (ثانیه)</label>
          <input type="number" class="form-control settings-input" data-setting="autoSaveInterval" value="${this.settings.autoSaveInterval}" min="10" max="600" />
        </div>

        <div class="settings-group">
          <label class="settings-label">حداکثر فایل‌های اخیر</label>
          <input type="number" class="form-control settings-input" data-setting="maxRecentFiles" value="${this.settings.maxRecentFiles}" min="1" max="50" />
        </div>
      </div>
    `;

    this._bindSectionInputs();
  }

  /**
   * بخش نمایش
   */
  _renderDisplay() {
    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>تنظیمات نمایش</h2>

        <div class="settings-group">
          <label class="settings-label">ارتفاع ردیف (پیکسل)</label>
          <input type="range" class="settings-range" data-setting="rowHeight" min="30" max="80" value="${this.settings.rowHeight}" />
          <div class="settings-range-value">${StringUtils.englishToPersianDigits(this.settings.rowHeight)} پیکسل</div>
        </div>

        <div class="settings-group">
          <label class="settings-label">قالب تاریخ</label>
          <select class="form-control settings-select" data-setting="dateFormat">
            <option value="persian" ${this.settings.dateFormat === 'persian' ? 'selected' : ''}>شمسی</option>
            <option value="gregorian" ${this.settings.dateFormat === 'gregorian' ? 'selected' : ''}>میلادی</option>
          </select>
        </div>
      </div>
    `;

    this._bindSectionInputs();
  }

  /**
   * بخش ویرایشگر
   */
  _renderEditor() {
    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>تنظیمات ویرایشگر</h2>

        <div class="settings-group">
          <label class="settings-label">اندازه فونت (پیکسل)</label>
          <input type="number" class="form-control settings-input" data-setting="editorFontSize" value="${this.settings.editorFontSize}" min="10" max="24" />
        </div>

        <div class="settings-group">
          <label class="settings-label">اندازه Tab</label>
          <select class="form-control settings-select" data-setting="editorTabSize">
            <option value="2" ${this.settings.editorTabSize === 2 ? 'selected' : ''}>2 فاصله</option>
            <option value="4" ${this.settings.editorTabSize === 4 ? 'selected' : ''}>4 فاصله</option>
          </select>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="editorAutoComplete" ${this.settings.editorAutoComplete ? 'checked' : ''} />
            <div>
              <span>پیشنهاد خودکار</span>
              <small>نمایش پیشنهادها هنگام تایپ</small>
            </div>
          </label>
        </div>

        <div class="settings-group">
          <label class="settings-checkbox">
            <input type="checkbox" data-setting="editorLineNumbers" ${this.settings.editorLineNumbers ? 'checked' : ''} />
            <div>
              <span>نمایش شماره خطوط</span>
            </div>
          </label>
        </div>
      </div>
    `;

    this._bindSectionInputs();
  }

  /**
   * بخش کلیدهای میانبر
   */
  _renderShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+N', desc: 'پایگاه داده جدید' },
      { key: 'Ctrl+O', desc: 'باز کردن پایگاه داده' },
      { key: 'Ctrl+S', desc: 'ذخیره پایگاه داده' },
      { key: 'Ctrl+E', desc: 'صادرات' },
      { key: 'Ctrl+I', desc: 'واردات' },
      { key: 'Ctrl+Enter', desc: 'اجرای کوئری' },
      { key: 'Ctrl+Shift+Enter', desc: 'اجرای انتخاب شده' },
      { key: 'Ctrl+F', desc: 'جستجو' },
      { key: 'Ctrl+K', desc: 'فوکوس روی جستجو' },
      { key: 'Ctrl+B', desc: 'تغییر وضعیت سایدبار' },
      { key: 'Ctrl+A', desc: 'انتخاب همه' },
      { key: 'Ctrl+C', desc: 'کپی' },
      { key: 'Ctrl+V', desc: 'چسباندن' },
      { key: 'Ctrl+Z', desc: 'واگرد' },
      { key: 'Ctrl+Y', desc: 'ازنو' },
      { key: 'F2', desc: 'ویرایش سلول' },
      { key: 'F5', desc: 'بازنشانی' },
      { key: 'Escape', desc: 'بستن' }
    ];

    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>کلیدهای میانبر</h2>
        <p class="settings-description">لیست کلیدهای میانبر موجود در برنامه</p>

        <table class="settings-shortcuts-table">
          <thead>
            <tr>
              <th>کلید</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            ${shortcuts.map(s => `
              <tr>
                <td><kbd class="settings-kbd">${s.key}</kbd></td>
                <td>${s.desc}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * بخش ذخیره‌سازی
   */
  async _renderStorage() {
    const usage = await storageService.getStorageUsage();

    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>ذخیره‌سازی</h2>

        <div class="settings-group">
          <label class="settings-label">فضای استفاده شده</label>
          <div class="settings-storage-bar">
            <div class="settings-storage-fill" style="width: ${Math.min(100, usage.percentage)}%"></div>
          </div>
          <div class="settings-storage-info">
            ${NumberUtils.formatBytes(usage.usage)} از ${NumberUtils.formatBytes(usage.quota)} استفاده شده
            (${StringUtils.englishToPersianDigits(usage.percentage.toFixed(1))}٪)
          </div>
        </div>

        <div class="settings-group">
          <h3>مدیریت داده‌ها</h3>
          <div class="settings-danger-actions">
            <button class="btn btn-warning settings-clear-cache">
              <span class="icon">🗑️</span>
              <span>پاک کردن کش برنامه</span>
            </button>
            <button class="btn btn-danger settings-clear-all">
              <span class="icon">⚠️</span>
              <span>پاک کردن همه داده‌ها</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.elements.content.querySelector('.settings-clear-cache')?.addEventListener('click', () => {
      this._clearCache();
    });

    this.elements.content.querySelector('.settings-clear-all')?.addEventListener('click', () => {
      this._clearAll();
    });
  }

  /**
   * بخش درباره
   */
  _renderAbout() {
    this.elements.content.innerHTML = `
      <div class="settings-section">
        <h2>درباره برنامه</h2>

        <div class="settings-about-header">
          <div class="settings-about-logo">🗄️</div>
          <div class="settings-about-info">
            <h3>${AppConfig.app.name}</h3>
            <p class="settings-about-version">نسخه ${AppConfig.app.version}</p>
          </div>
        </div>

        <p class="settings-about-description">
          ${AppConfig.app.description}
        </p>

        <div class="settings-about-features">
          <h4>امکانات:</h4>
          <ul>
            <li>✅ مدیریت کامل پایگاه داده SQLite</li>
            <li>✅ صادرات به ۱۰ فرمت مختلف</li>
            <li>✅ واردات از فایل‌های SQLite, SQL, JSON, CSV</li>
            <li>✅ ویرایشگر SQL با syntax highlighting</li>
            <li>✅ طراحی جدول به صورت گرافیکی</li>
            <li>✅ اجرای عملیات محلی در مرورگر</li>
            <li>✅ پشتیبانی کامل از زبان فارسی و RTL</li>
            <li>✅ رابط کاربری حرفه‌ای</li>
          </ul>
        </div>

        <div class="settings-about-tech">
          <h4>تکنولوژی‌ها:</h4>
          <div class="settings-tech-badges">
            <span class="tech-badge">HTML5</span>
            <span class="tech-badge">CSS3</span>
            <span class="tech-badge">JavaScript</span>
            <span class="tech-badge">SQLite</span>
            <span class="tech-badge">sql.js</span>
          </div>
        </div>

        <div class="settings-about-footer">
          <p>© ${AppConfig.app.year} ${AppConfig.app.author}</p>
        </div>
      </div>
    `;
  }

  /**
   * ثبت ورودی‌های بخش
   */
  _bindSectionInputs() {
    // Selects و Inputs با data-setting
    this.elements.content.querySelectorAll('[data-setting]').forEach(input => {
      const key = input.dataset.setting;

      if (input.type === 'checkbox') {
        input.addEventListener('change', (e) => {
          this.settings[key] = e.target.checked;
        });
      } else if (input.type === 'radio') {
        input.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.settings[key] = e.target.value;
            input.closest('.settings-radio-group')?.querySelectorAll('.settings-radio').forEach(r => {
              r.classList.toggle('active', r.querySelector('input').checked);
            });
          }
        });
      } else if (input.type === 'range') {
        const valueEl = input.nextElementSibling;

        input.addEventListener('input', (e) => {
          this.settings[key] = parseInt(e.target.value);
          if (valueEl && valueEl.classList.contains('settings-range-value')) {
            valueEl.textContent = `${StringUtils.englishToPersianDigits(e.target.value)} پیکسل`;
          }
        });
      } else {
        input.addEventListener('input', (e) => {
          const value = e.target.value;
          if (input.type === 'number') {
            this.settings[key] = parseInt(value) || 0;
          } else {
            this.settings[key] = value;
          }
        });
      }
    });
  }

  /**
   * ذخیره تنظیمات
   */
  _save() {
    storageService.set('settings', this.settings);
    notificationService.success('تنظیمات ذخیره شد');
    this.emit('saved', this.settings);

    // اعمال تغییرات
    if (this.settings.theme) {
      applyTheme(this.settings.theme);
    }
  }

  /**
   * بازنشانی
   */
  async _reset() {
    const confirmed = await modalService.confirm(
      'آیا می‌خواهید همه تنظیمات را به حالت پیش‌فرض بازنشانی کنید؟',
      { title: 'بازنشانی تنظیمات', danger: true }
    );

    if (!confirmed) return;

    storageService.remove('settings');
    this.settings = this._loadSettings();
    this._renderSection();
    notificationService.success('تنظیمات بازنشانی شد');
  }

  /**
   * پاک کردن کش
   */
  async _clearCache() {
    const confirmed = await modalService.confirm(
      'کش برنامه (تاریخچه کوئری، فایل‌های اخیر) پاک شود؟',
      { title: 'پاک کردن کش' }
    );

    if (!confirmed) return;

    storageService.remove('query_history');
    storageService.remove('recent_files');
    storageService.remove('dashboard_activity');
    notificationService.success('کش پاک شد');
  }

  /**
   * پاک کردن همه
   */
  async _clearAll() {
    const confirmed = await modalService.confirm(
      '⚠️ هشدار: تمام داده‌های ذخیره شده در مرورگر پاک خواهند شد! این شامل تنظیمات، تاریخچه، فایل‌های اخیر و... می‌شود. ادامه؟',
      { title: 'پاک کردن همه', danger: true }
    );

    if (!confirmed) return;

    const reconfirm = await modalService.prompt('برای تأیید، عبارت "تأیید" را بنویسید:', {
      title: 'تأیید نهایی',
      validate: (v) => v === 'تأیید'
    });

    if (reconfirm !== 'تأیید') return;

    storageService.clear();

    try {
      indexedDB.deleteDatabase('DatabaseManager');
    } catch (e) {
      // ignore
    }

    notificationService.success('همه داده‌ها پاک شدند');
    setTimeout(() => location.reload(), 1500);
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

window.SettingsView = SettingsView;