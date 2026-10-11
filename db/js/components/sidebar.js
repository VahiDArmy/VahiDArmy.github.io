/**
 * کامپوننت سایدبار
 * منوی کناری با ناوبری درختوار
 */
class Sidebar {
  constructor(options = {}) {
    this.options = {
      collapsible: true,
      showSections: ['main', 'database', 'tools', 'info'],
      ...options
    };

    this.element = null;
    this.elements = {};
    this.listeners = new Map();
    this.collapsed = false;
    this.activeRoute = '/dashboard';
    this.expandedItems = new Set(['database', 'tables']);
    this._boundResize = this._handleResize.bind(this);
  }

  /**
   * رندر
   */
  render() {
    this.collapsed = stateManager.get('app.sidebarCollapsed') || false;

    this.element = DomUtils.create('aside', {
      className: `sidebar-component ${this.collapsed ? 'collapsed' : ''}`,
      attrs: { role: 'complementary', 'aria-label': 'سایدبار' }
    });

    this.element.innerHTML = `
      <div class="sidebar-inner">
        ${this._renderMainSection()}
        ${this._renderDatabaseSection()}
        ${this._renderToolsSection()}
        ${this._renderInfoSection()}
      </div>
      <div class="sidebar-footer">
        <div class="sidebar-footer-info">
          <span class="sidebar-footer-version">نسخه ${AppConfig.app.version}</span>
        </div>
        ${this.options.collapsible ? `
          <button class="sidebar-collapse-btn" data-action="collapse" aria-label="جمع کردن">
            <span class="icon">${this.collapsed ? '◀' : '▶'}</span>
          </button>
        ` : ''}
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._updateActiveItem();

    return this.element;
  }

  /**
   * بخش اصلی
   */
  _renderMainSection() {
    return `
      <div class="sidebar-section" data-section="main">
        <div class="sidebar-section-header">
          <span class="sidebar-section-title">منو</span>
        </div>
        <nav class="sidebar-nav" role="navigation">
          ${this._renderNavItem({
            id: 'dashboard',
            icon: '🏠',
            text: 'داشبورد',
            path: '/dashboard',
            tooltip: 'داشبورد'
          })}
          ${this._renderNavItem({
            id: 'tables',
            icon: '📊',
            text: 'جداول',
            path: '/tables',
            tooltip: 'جداول',
            badge: () => {
              const count = stateManager.get('database.tables')?.length || 0;
              return count > 0 ? String(count) : null;
            }
          })}
          ${this._renderNavItem({
            id: 'query',
            icon: '💻',
            text: 'کوئری',
            path: '/query',
            tooltip: 'ویرایشگر کوئری'
          })}
          ${this._renderNavItem({
            id: 'schema',
            icon: '🗂️',
            text: 'ساختار',
            path: '/schema',
            tooltip: 'ساختار پایگاه داده'
          })}
        </nav>
      </div>
    `;
  }

  /**
   * بخش پایگاه داده
   */
  _renderDatabaseSection() {
    const dbLoaded = stateManager.get('database.loaded');
    const dbName = stateManager.get('database.name');

    return `
      <div class="sidebar-section" data-section="database">
        <div class="sidebar-section-header">
          <span class="sidebar-section-title">پایگاه داده</span>
        </div>
        <div class="sidebar-db-info">
          <div class="sidebar-db-status ${dbLoaded ? 'loaded' : 'not-loaded'}">
            <span class="sidebar-db-status-dot"></span>
            <span class="sidebar-db-status-text">${dbLoaded ? 'متصل' : 'قطع'}</span>
          </div>
          ${dbName ? `
            <div class="sidebar-db-name" title="${StringUtils.escapeHtml(dbName)}">
              ${StringUtils.truncate(dbName, 22)}
            </div>
          ` : ''}
        </div>
        <nav class="sidebar-nav">
          ${this._renderNavItem({
            id: 'export',
            icon: '📤',
            text: 'صادرات',
            path: '/export',
            tooltip: 'صادرات پایگاه داده',
            disabled: !dbLoaded
          })}
          ${this._renderNavItem({
            id: 'import',
            icon: '📥',
            text: 'واردات',
            path: '/import',
            tooltip: 'واردات پایگاه داده'
          })}
        </nav>
      </div>
    `;
  }

  /**
   * بخش ابزارها
   */
  _renderToolsSection() {
    return `
      <div class="sidebar-section" data-section="tools">
        <div class="sidebar-section-header">
          <span class="sidebar-section-title">ابزارها</span>
        </div>
        <nav class="sidebar-nav">
          <button class="sidebar-nav-item" data-action="run-vacuum" title="فشرده‌سازی">
            <span class="sidebar-nav-item-icon">🧹</span>
            <span class="sidebar-nav-item-text">فشرده‌سازی</span>
          </button>
          <button class="sidebar-nav-item" data-action="run-analyze" title="تحلیل">
            <span class="sidebar-nav-item-icon">📈</span>
            <span class="sidebar-nav-item-text">تحلیل</span>
          </button>
          <button class="sidebar-nav-item" data-action="run-integrity" title="بررسی یکپارچگی">
            <span class="sidebar-nav-item-icon">✅</span>
            <span class="sidebar-nav-item-text">بررسی یکپارچگی</span>
          </button>
          <button class="sidebar-nav-item" data-action="run-reindex" title="بازسازی ایندکس‌ها">
            <span class="sidebar-nav-item-icon">🔄</span>
            <span class="sidebar-nav-item-text">بازسازی ایندکس</span>
          </button>
        </nav>
      </div>
    `;
  }

  /**
   * بخش اطلاعات
   */
  _renderInfoSection() {
    const size = stateManager.get('database.size');
    const tables = stateManager.get('database.tables')?.length || 0;

    return `
      <div class="sidebar-section" data-section="info">
        <div class="sidebar-section-header">
          <span class="sidebar-section-title">اطلاعات</span>
        </div>
        <div class="sidebar-stats">
          <div class="sidebar-stat">
            <span class="sidebar-stat-label">جداول</span>
            <span class="sidebar-stat-value">${StringUtils.englishToPersianDigits(tables)}</span>
          </div>
          <div class="sidebar-stat">
            <span class="sidebar-stat-label">حجم</span>
            <span class="sidebar-stat-value">${size ? FileUtils.formatSize(size) : '-'}</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${this._renderNavItem({
            id: 'settings',
            icon: '⚙️',
            text: 'تنظیمات',
            path: '/settings',
            tooltip: 'تنظیمات'
          })}
          ${this._renderNavItem({
            id: 'about',
            icon: 'ℹ️',
            text: 'درباره',
            path: '/about',
            tooltip: 'درباره برنامه'
          })}
        </nav>
      </div>
    `;
  }

  /**
   * آیتم ناوبری
   */
  _renderNavItem(options) {
    const { id, icon, text, path, tooltip, badge, disabled } = options;

    let badgeHtml = '';
    if (typeof badge === 'function') {
      const b = badge();
      if (b) badgeHtml = `<span class="sidebar-nav-item-badge">${b}</span>`;
    } else if (badge) {
      badgeHtml = `<span class="sidebar-nav-item-badge">${badge}</span>`;
    }

    return `
      <a
        class="sidebar-nav-item ${disabled ? 'disabled' : ''}"
        data-nav-id="${id}"
        data-path="${path || ''}"
        ${disabled ? 'aria-disabled="true"' : ''}
        title="${tooltip || text}"
        href="${disabled ? 'javascript:void(0)' : '#' + path}"
      >
        <span class="sidebar-nav-item-icon">${icon}</span>
        <span class="sidebar-nav-item-text">${text}</span>
        ${badgeHtml}
      </a>
    `;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    this.elements = {
      inner: this.element.querySelector('.sidebar-inner'),
      collapseBtn: this.element.querySelector('.sidebar-collapse-btn')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    // ناوبری
    this.element.addEventListener('click', (e) => {
      const navItem = e.target.closest('.sidebar-nav-item[data-path]');
      if (navItem && !navItem.classList.contains('disabled')) {
        const path = navItem.dataset.path;
        if (path) {
          router.navigate(path);
        }
      }

      const actionItem = e.target.closest('.sidebar-nav-item[data-action]');
      if (actionItem) {
        this._handleAction(actionItem.dataset.action);
      }
    });

    // دکمه جمع کردن
    this.elements.collapseBtn?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // به‌روزرسانی از state
    stateManager.subscribe('app.sidebarCollapsed', (collapsed) => {
      this._applyCollapse(collapsed);
    });

    stateManager.subscribe('database.tables', () => {
      this._updateBadges();
    });

    // تغییر مسیر
    router.on('navigated', (ctx) => {
      this.activeRoute = ctx.path;
      this._updateActiveItem();
    });

    window.addEventListener('resize', this._boundResize);
  }

  /**
   * هندلر تغییر اندازه
   */
  _handleResize() {
    const width = window.innerWidth;
    if (width < 768 && !this.collapsed) {
      stateManager.set('app.sidebarCollapsed', true);
    }
  }

  /**
   * تغییر وضعیت جمع شدن
   */
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    stateManager.set('app.sidebarCollapsed', this.collapsed);
  }

  /**
   * اعمال حالت جمع‌شده
   */
  _applyCollapse(collapsed) {
    this.collapsed = collapsed;
    if (collapsed) {
      this.element.classList.add('collapsed');
    } else {
      this.element.classList.remove('collapsed');
    }

    const icon = this.elements.collapseBtn?.querySelector('.icon');
    if (icon) {
      icon.textContent = collapsed ? '◀' : '▶';
    }
  }

  /**
   * به‌روزرسانی آیتم فعال
   */
  _updateActiveItem() {
    this.element.querySelectorAll('.sidebar-nav-item').forEach(item => {
      const path = item.dataset.path;
      if (!path) return;

      if (this._isPathActive(path)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * بررسی مسیر فعال
   */
  _isPathActive(path) {
    const current = router.currentRoute || '/dashboard';
    if (path === current) return true;
    if (path === '/dashboard' && current === '/') return true;
    if (path !== '/' && current.startsWith(path + '/')) return true;
    return false;
  }

  /**
   * به‌روزرسانی نشان‌ها
   */
  _updateBadges() {
    const tablesCount = stateManager.get('database.tables')?.length || 0;
    const tablesItem = this.element.querySelector('[data-nav-id="tables"] .sidebar-nav-item-badge');

    if (tablesItem) {
      tablesItem.textContent = tablesCount > 0 ? String(tablesCount) : '';
      tablesItem.hidden = tablesCount === 0;
    }
  }

  /**
   * هندلر اکشن
   */
  async _handleAction(action) {
    this.emit('action', action);

    switch (action) {
      case 'collapse':
        this.toggleCollapse();
        break;
      case 'run-vacuum':
        await this._runVacuum();
        break;
      case 'run-analyze':
        await this._runAnalyze();
        break;
      case 'run-integrity':
        await this._runIntegrity();
        break;
      case 'run-reindex':
        await this._runReindex();
        break;
    }
  }

  /**
   * اجرای VACUUM
   */
  async _runVacuum() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    const confirmed = await modalService.confirm(
      'فشرده‌سازی پایگاه داده ممکن است زمان‌بر باشد. ادامه می‌دهید؟',
      { title: 'فشرده‌سازی' }
    );

    if (!confirmed) return;

    try {
      const result = databaseService.vacuum();
      if (result.success) {
        notificationService.success('پایگاه داده فشرده شد');
      } else {
        notificationService.error(`خطا: ${result.error}`);
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * اجرای ANALYZE
   */
  async _runAnalyze() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    try {
      const result = databaseService.analyze();
      if (result.success) {
        notificationService.success('تحلیل کامل شد');
      } else {
        notificationService.error(`خطا: ${result.error}`);
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * بررسی یکپارچگی
   */
  async _runIntegrity() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    try {
      const result = databaseService.integrityCheck();
      if (result.success && result.data.length > 0) {
        const status = result.data[0].integrity_check;
        if (status === 'ok') {
          notificationService.success('پایگاه داده سالم است');
        } else {
          notificationService.warning(`مشکل: ${status}`);
        }
      }
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * بازسازی ایندکس‌ها
   */
  async _runReindex() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    try {
      const result = databaseService.reindex();
      if (result.success) {
        notificationService.success('ایندکس‌ها بازسازی شدند');
      } else {
        notificationService.error(`خطا: ${result.error}`);
      }
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
    window.removeEventListener('resize', this._boundResize);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.Sidebar = Sidebar;