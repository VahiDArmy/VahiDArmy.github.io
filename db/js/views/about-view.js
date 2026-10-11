/**
 * نمای درباره
 */
class AboutView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-about',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">ℹ️</span>
            <span>درباره برنامه</span>
          </h1>
        </div>
      </div>

      <div class="about-content">
        <div class="about-hero">
          <div class="about-hero-bg"></div>
          <div class="about-hero-content">
            <div class="about-logo">🗄️</div>
            <h2 class="about-title">${AppConfig.app.name}</h2>
            <p class="about-tagline">${AppConfig.app.description}</p>
            <div class="about-version">نسخه ${AppConfig.app.version}</div>
          </div>
        </div>

        <div class="about-grid">
          <div class="about-card">
            <div class="about-card-icon">✨</div>
            <h3 class="about-card-title">امکانات</h3>
            <ul class="about-feature-list">
              <li>مدیریت کامل پایگاه داده SQLite</li>
              <li>اجرای کوئری‌های SQL با syntax highlighting</li>
              <li>صادرات به ۱۰ فرمت مختلف</li>
              <li>واردات از SQLite, SQL, JSON, CSV</li>
              <li>طراحی جدول به صورت گرافیکی</li>
              <li>مشاهده ساختار با درختوار</li>
              <li>پشتیبان‌گیری و بازیابی</li>
              <li>بهینه‌سازی و تحلیل پایگاه داده</li>
            </ul>
          </div>

          <div class="about-card">
            <div class="about-card-icon">🛡️</div>
            <h3 class="about-card-title">امنیت</h3>
            <ul class="about-feature-list">
              <li>تمام عملیات به صورت محلی انجام می‌شود</li>
              <li>هیچ داده‌ای به سرور ارسال نمی‌شود</li>
              <li>استفاده از IndexedDB برای ذخیره امن</li>
              <li>بدون نیاز به ثبت‌نام</li>
              <li>کاملاً آفلاین قابل استفاده</li>
            </ul>
          </div>

          <div class="about-card">
            <div class="about-card-icon">🌍</div>
            <h3 class="about-card-title">پشتیبانی</h3>
            <ul class="about-feature-list">
              <li>رابط کاربری کامل RTL</li>
              <li>فونت فارسی Vazirmatn</li>
              <li>تاریخ شمسی</li>
              <li>پشتیبانی از اعداد فارسی</li>
              <li>کلیدهای میانبر</li>
            </ul>
          </div>

          <div class="about-card">
            <div class="about-card-icon">⚙️</div>
            <h3 class="about-card-title">تکنولوژی‌ها</h3>
            <div class="about-tech-grid">
              <div class="about-tech-item">
                <span class="about-tech-icon">H</span>
                <span>HTML5</span>
              </div>
              <div class="about-tech-item">
                <span class="about-tech-icon">C</span>
                <span>CSS3</span>
              </div>
              <div class="about-tech-item">
                <span class="about-tech-icon">J</span>
                <span>JavaScript ES6+</span>
              </div>
              <div class="about-tech-item">
                <span class="about-tech-icon">S</span>
                <span>sql.js</span>
              </div>
              <div class="about-tech-item">
                <span class="about-tech-icon">SQL</span>
                <span>SQLite 3</span>
              </div>
              <div class="about-tech-item">
                <span class="about-tech-icon">DB</span>
                <span>IndexedDB</span>
              </div>
            </div>
          </div>
        </div>

        <div class="about-stats">
          <div class="about-stat">
            <div class="about-stat-value">${StringUtils.englishToPersianDigits(10)}</div>
            <div class="about-stat-label">فرمت صادرات</div>
          </div>
          <div class="about-stat">
            <div class="about-stat-value">${StringUtils.englishToPersianDigits(4)}</div>
            <div class="about-stat-label">فرمت واردات</div>
          </div>
          <div class="about-stat">
            <div class="about-stat-value">${StringUtils.englishToPersianDigits(18)}+</div>
            <div class="about-stat-label">کلید میانبر</div>
          </div>
          <div class="about-stat">
            <div class="about-stat-value">${StringUtils.englishToPersianDigits(100)}٪</div>
            <div class="about-stat-label">محلی و امن</div>
          </div>
        </div>

        <div class="about-actions">
          <button class="btn btn-primary about-shortcuts-btn">
            <span class="icon">⌨️</span>
            <span>کلیدهای میانبر</span>
          </button>
          <button class="btn btn-secondary about-settings-btn">
            <span class="icon">⚙️</span>
            <span>تنظیمات</span>
          </button>
          <button class="btn btn-secondary about-help-btn">
            <span class="icon">❓</span>
            <span>راهنما</span>
          </button>
        </div>

        <div class="about-footer">
          <p>© ${AppConfig.app.year} ${AppConfig.app.author} - ساخته شده با ❤️</p>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      shortcutsBtn: q('.about-shortcuts-btn'),
      settingsBtn: q('.about-settings-btn'),
      helpBtn: q('.about-help-btn')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.shortcutsBtn?.addEventListener('click', () => this._showShortcuts());
    this.elements.settingsBtn?.addEventListener('click', () => router.navigate('/settings'));
    this.elements.helpBtn?.addEventListener('click', () => this._showHelp());
  }

  /**
   * نمایش کلیدهای میانبر
   */
  _showShortcuts() {
    const shortcuts = [
      { category: 'عمومی', items: [
        { key: 'Ctrl+N', desc: 'پایگاه داده جدید' },
        { key: 'Ctrl+O', desc: 'باز کردن پایگاه داده' },
        { key: 'Ctrl+S', desc: 'ذخیره' },
        { key: 'Ctrl+E', desc: 'صادرات' },
        { key: 'Ctrl+I', desc: 'واردات' },
        { key: 'Ctrl+B', desc: 'سایدبار' },
        { key: 'Ctrl+K', desc: 'جستجوی سریع' },
        { key: 'F5', desc: 'بازنشانی' },
        { key: 'Escape', desc: 'بستن' }
      ]},
      { category: 'ویرایشگر', items: [
        { key: 'Ctrl+Enter', desc: 'اجرای کوئری' },
        { key: 'Ctrl+Shift+Enter', desc: 'اجرای انتخاب شده' },
        { key: 'Ctrl+/', desc: 'کامنت' },
        { key: 'Ctrl+Space', desc: 'پیشنهاد خودکار' },
        { key: 'Ctrl+Z', desc: 'واگرد' },
        { key: 'Ctrl+Y', desc: 'ازنو' },
        { key: 'Tab', desc: 'تورفتگی' }
      ]},
      { category: 'جدول', items: [
        { key: 'Ctrl+A', desc: 'انتخاب همه' },
        { key: 'Ctrl+C', desc: 'کپی' },
        { key: 'F2', desc: 'ویرایش سلول' },
        { key: '↑↓←→', desc: 'ناوبری' },
        { key: 'Enter', desc: 'ذخیره ویرایش' }
      ]}
    ];

    const content = `
      <div class="shortcuts-dialog">
        ${shortcuts.map(cat => `
          <div class="shortcuts-category">
            <h4>${cat.category}</h4>
            <div class="shortcuts-list">
              ${cat.items.map(item => `
                <div class="shortcut-item">
                  <kbd class="shortcut-key">${item.key}</kbd>
                  <span class="shortcut-desc">${item.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    modalService.open(content, {
      title: 'کلیدهای میانبر',
      size: 'md'
    });
  }

  /**
   * نمایش راهنما
   */
  _showHelp() {
    const content = `
      <div class="help-dialog">
        <h3>شروع کار</h3>
        <ol class="help-steps">
          <li><strong>ایجاد یا باز کردن پایگاه داده:</strong> از دکمه‌های بالای صفحه استفاده کنید</li>
          <li><strong>مشاهده جداول:</strong> به بخش "جداول" بروید</li>
          <li><strong>اجرای کوئری:</strong> به بخش "کوئری" بروید و کوئری بنویسید</li>
          <li><strong>صادرات:</strong> از بخش "صادرات" برای تبدیل فرمت استفاده کنید</li>
          <li><strong>واردات:</strong> فایل‌های SQLite, SQL, JSON, CSV را بارگذاری کنید</li>
        </ol>

        <h3>ویژگی‌های کلیدی</h3>
        <ul class="help-features">
          <li>تمام عملیات محلی در مرورگر انجام می‌شود</li>
          <li>پشتیبانی از جداول، ویوها، ایندکس‌ها و تریگرها</li>
          <li>ویرایش سلول‌ها با دابل کلیک (F2)</li>
          <li>مرتب‌سازی، فیلتر و جستجو در جداول</li>
          <li>صادرات با ۱۰ فرمت مختلف</li>
        </ul>

        <h3>راهنمای سریع</h3>
        <p>برای اجرای سریع کوئری، از <kbd>Ctrl+Enter</kbd> استفاده کنید.</p>
        <p>برای جستجوی سریع در برنامه، <kbd>Ctrl+K</kbd> را بزنید.</p>
        <p>برای مشاهده منوی زمینه، روی عناصر راست‌کلیک کنید.</p>
      </div>
    `;

    modalService.open(content, {
      title: 'راهنمای استفاده',
      size: 'lg'
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

window.AboutView = AboutView;