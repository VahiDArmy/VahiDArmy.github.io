/**
 * کامپوننت نوار ناوبری
 * نوار بالای برنامه با منوها، جستجو و اکشن‌ها
 */
class Navbar {
  constructor(options = {}) {
    this.options = {
      brandText: 'مدیریت پایگاه داده',
      brandIcon: '🗄️',
      showSearch: true,
      showNotifications: true,
      showUserMenu: true,
      showThemeToggle: true,
      showLanguageToggle: false,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.listeners = new Map();
    this.searchDebounced = debounce((term) => {
      this._handleSearch(term);
    }, 300);
    this._boundKeydown = this._handleKeydown.bind(this);
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('nav', {
      className: 'navbar-component',
      attrs: { role: 'navigation', 'aria-label': 'ناوبری اصلی' }
    });

    this.element.innerHTML = `
      <div class="navbar-brand-section">
        <button class="navbar-sidebar-toggle" aria-label="تغییر وضعیت سایدبار" title="تغییر وضعیت سایدبار (Ctrl+B)">
          <span class="icon-menu">☰</span>
        </button>
        <a href="#/" class="navbar-brand" aria-label="${this.options.brandText}">
          <span class="navbar-brand-icon">${this.options.brandIcon}</span>
          <span class="navbar-brand-text">${this.options.brandText}</span>
        </a>
      </div>

      ${this.options.showSearch ? this._renderSearch() : ''}

      <div class="navbar-actions-section">
        ${this._renderQuickActions()}
        ${this.options.showNotifications ? this._renderNotifications() : ''}
        ${this.options.showThemeToggle ? this._renderThemeToggle() : ''}
        ${this.options.showLanguageToggle ? this._renderLanguageToggle() : ''}
        ${this.options.showUserMenu ? this._renderUserMenu() : ''}
      </div>
    `;

    this._cacheElements();
    this._bindEvents();

    return this.element;
  }

  /**
   * بخش جستجو
   */
  _renderSearch() {
    return `
      <div class="navbar-search" role="search">
        <span class="navbar-search-icon">🔍</span>
        <input
          type="search"
          class="navbar-search-input"
          placeholder="جستجو در برنامه... (Ctrl+K)"
          aria-label="جستجو"
          autocomplete="off"
          spellcheck="false"
        />
        <kbd class="navbar-search-shortcut">Ctrl+K</kbd>
        <button class="navbar-search-clear" aria-label="پاک کردن" hidden>✕</button>
        <div class="navbar-search-results" hidden role="listbox"></div>
      </div>
    `;
  }

  /**
   * اکشن‌های سریع
   */
  _renderQuickActions() {
    return `
      <div class="navbar-quick-actions">
        <button class="navbar-action-btn" data-action="new-db" title="پایگاه داده جدید (Ctrl+N)" aria-label="پایگاه داده جدید">
          <span class="icon">➕</span>
        </button>
        <button class="navbar-action-btn" data-action="open-db" title="باز کردن (Ctrl+O)" aria-label="باز کردن">
          <span class="icon">📂</span>
        </button>
        <button class="navbar-action-btn" data-action="save-db" title="ذخیره (Ctrl+S)" aria-label="ذخیره">
          <span class="icon">💾</span>
        </button>
        <button class="navbar-action-btn" data-action="export" title="صادرات (Ctrl+E)" aria-label="صادرات">
          <span class="icon">📤</span>
        </button>
        <button class="navbar-action-btn" data-action="import" title="واردات (Ctrl+I)" aria-label="واردات">
          <span class="icon">📥</span>
        </button>
      </div>
    `;
  }

  /**
   * دکمه اعلان‌ها
   */
  _renderNotifications() {
    return `
      <button class="navbar-action-btn navbar-notifications-btn" data-action="notifications" title="اعلان‌ها" aria-label="اعلان‌ها">
        <span class="icon">🔔</span>
        <span class="navbar-notifications-badge" hidden>0</span>
      </button>
    `;
  }

  /**
   * دکمه تم
   */
  _renderThemeToggle() {
    return `
      <button class="navbar-action-btn navbar-theme-btn" data-action="theme" title="تغییر تم" aria-label="تغییر تم">
        <span class="icon icon-theme">🌙</span>
      </button>
    `;
  }

  /**
   * دکمه زبان
   */
  _renderLanguageToggle() {
    return `
      <button class="navbar-action-btn" data-action="language" title="تغییر زبان" aria-label="تغییر زبان">
        <span class="icon">🌐</span>
        <span class="navbar-lang-label">FA</span>
      </button>
    `;
  }

  /**
   * منوی کاربر
   */
  _renderUserMenu() {
    return `
      <div class="navbar-user-menu">
        <button class="navbar-user-btn" data-action="user-menu" aria-haspopup="true" aria-expanded="false">
          <span class="navbar-user-avatar">👤</span>
        </button>
        <div class="navbar-user-dropdown" hidden>
          <div class="navbar-user-info">
            <div class="navbar-user-name">کاربر مهمان</div>
            <div class="navbar-user-status">
              <span class="status-dot status-online"></span>
              آنلاین
            </div>
          </div>
          <div class="navbar-user-divider"></div>
          <button class="navbar-user-item" data-action="settings">
            <span class="icon">⚙️</span>
            <span>تنظیمات</span>
          </button>
          <button class="navbar-user-item" data-action="shortcuts">
            <span class="icon">⌨️</span>
            <span>کلیدهای میانبر</span>
          </button>
          <button class="navbar-user-item" data-action="help">
            <span class="icon">❓</span>
            <span>راهنما</span>
          </button>
          <button class="navbar-user-item" data-action="about">
            <span class="icon">ℹ️</span>
            <span>درباره</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      sidebarToggle: q('.navbar-sidebar-toggle'),
      searchInput: q('.navbar-search-input'),
      searchClear: q('.navbar-search-clear'),
      searchResults: q('.navbar-search-results'),
      quickActions: q('.navbar-quick-actions'),
      notificationsBtn: q('.navbar-notifications-btn'),
      notificationsBadge: q('.navbar-notifications-badge'),
      themeBtn: q('.navbar-theme-btn'),
      themeIcon: q('.icon-theme'),
      userMenuBtn: q('.navbar-user-btn'),
      userDropdown: q('.navbar-user-dropdown'),
      brand: q('.navbar-brand')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    // تغییر وضعیت سایدبار
    this.elements.sidebarToggle?.addEventListener('click', () => {
      this._toggleSidebar();
    });

    // جستجو
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        this.elements.searchClear.hidden = !value;
        this.searchDebounced(value);
      });

      this.elements.searchInput.addEventListener('focus', () => {
        if (this.elements.searchInput.value) {
          this._showSearchResults();
        }
      });

      this.elements.searchInput.addEventListener('keydown', (e) => {
        this._handleSearchKeydown(e);
      });
    }

    // پاک کردن جستجو
    this.elements.searchClear?.addEventListener('click', () => {
      this._clearSearch();
    });

    // کلیک خارج از نتایج
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target)) {
        this._hideSearchResults();
        this._hideUserDropdown();
      }
    });

    // اکشن‌های سریع
    this.elements.quickActions?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this._handleAction(btn.dataset.action);
      }
    });

    // اعلان‌ها
    this.elements.notificationsBtn?.addEventListener('click', () => {
      this._handleAction('notifications');
    });

    // تم
    this.elements.themeBtn?.addEventListener('click', () => {
      this._handleAction('theme');
    });

    // منوی کاربر
    this.elements.userMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleUserDropdown();
    });

    this.elements.userDropdown?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (item) {
        this._handleAction(item.dataset.action);
        this._hideUserDropdown();
      }
    });

    // کلیدهای میانبر
    document.addEventListener('keydown', this._boundKeydown);

    // به‌روزرسانی وضعیت تم
    this._updateThemeIcon();
  }

  /**
   * هندلر کیبورد
   */
  _handleKeydown(e) {
    // Ctrl+K - فوکوس روی جستجو
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.elements.searchInput?.focus();
      this.elements.searchInput?.select();
      return;
    }

    // Escape - بستن جستجو
    if (e.key === 'Escape') {
      this._hideSearchResults();
      this._hideUserDropdown();
      if (document.activeElement === this.elements.searchInput) {
        this.elements.searchInput.blur();
      }
    }
  }

  /**
   * هندلر کلید در جستجو
   */
  _handleSearchKeydown(e) {
    const results = this.elements.searchResults?.querySelectorAll('.navbar-search-result');
    if (!results || results.length === 0) return;

    const active = this.elements.searchResults.querySelector('.navbar-search-result.active');
    let currentIndex = Array.from(results).indexOf(active);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % results.length;
      this._setActiveResult(results[currentIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + results.length) % results.length;
      this._setActiveResult(results[currentIndex]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = active || results[0];
      if (target) {
        this._selectSearchResult(target);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._hideSearchResults();
      this.elements.searchInput.blur();
    }
  }

  /**
   * تنظیم نتیجه فعال
   */
  _setActiveResult(el) {
    this.elements.searchResults.querySelectorAll('.navbar-search-result').forEach(r => {
      r.classList.remove('active');
    });
    el.classList.add('active');
    el.scrollIntoView({ block: 'nearest' });
  }

  /**
   * انتخاب نتیجه
   */
  _selectSearchResult(el) {
    const path = el.dataset.path;
    if (path) {
      router.navigate(path);
      this._clearSearch();
    }
  }

  /**
   * هندلر جستجو
   */
  _handleSearch(term) {
    if (!term || term.length < 2) {
      this._hideSearchResults();
      return;
    }

    const results = this._search(term);
    this._renderSearchResults(results);
  }

  /**
   * جستجو
   */
  _search(term) {
    const results = [];
    const lower = term.toLowerCase();

    // جستجو در ناوبری
    const routes = [
      { title: 'داشبورد', path: '/dashboard', icon: '🏠', keywords: ['داشبورد', 'خانه', 'dashboard', 'home'] },
      { title: 'جداول', path: '/tables', icon: '📊', keywords: ['جداول', 'tables', 'table'] },
      { title: 'کوئری', path: '/query', icon: '💻', keywords: ['کوئری', 'query', 'sql'] },
      { title: 'ساختار', path: '/schema', icon: '🗂️', keywords: ['ساختار', 'schema'] },
      { title: 'صادرات', path: '/export', icon: '📤', keywords: ['صادرات', 'export'] },
      { title: 'واردات', path: '/import', icon: '📥', keywords: ['واردات', 'import'] },
      { title: 'تنظیمات', path: '/settings', icon: '⚙️', keywords: ['تنظیمات', 'settings'] },
      { title: 'درباره', path: '/about', icon: 'ℹ️', keywords: ['درباره', 'about'] }
    ];

    routes.forEach(route => {
      const match = route.title.toLowerCase().includes(lower) ||
                    route.keywords.some(k => k.toLowerCase().includes(lower));
      if (match) {
        results.push({ type: 'route', ...route });
      }
    });

    // جستجو در جداول
    const tables = stateManager.get('database.tables') || [];
    tables.forEach(table => {
      if (table.name.toLowerCase().includes(lower)) {
        results.push({
          type: 'table',
          title: table.name,
          path: `/tables/${table.name}`,
          icon: '📋',
          subtitle: `${table.type || 'جدول'}`
        });
      }
    });

    // جستجو در کوئری‌های ذخیره شده
    if (typeof queryService !== 'undefined') {
      const queries = queryService.searchSavedQueries(term);
      queries.slice(0, 5).forEach(q => {
        results.push({
          type: 'query',
          title: q.name,
          subtitle: q.sql.substring(0, 60),
          icon: '💾',
          action: () => {
            stateManager.set('query.sql', q.sql);
            router.navigate('/query');
          }
        });
      });
    }

    return results.slice(0, 10);
  }

  /**
   * رندر نتایج جستجو
   */
  _renderSearchResults(results) {
    if (!this.elements.searchResults) return;

    if (results.length === 0) {
      this.elements.searchResults.innerHTML = `
        <div class="navbar-search-empty">
          <span class="icon">🔍</span>
          <span>نتیجه‌ای یافت نشد</span>
        </div>
      `;
      this.elements.searchResults.hidden = false;
      return;
    }

    this.elements.searchResults.innerHTML = results.map((r, i) => `
      <div class="navbar-search-result ${i === 0 ? 'active' : ''}"
           data-index="${i}"
           data-path="${r.path || ''}"
           role="option">
        <span class="navbar-search-result-icon">${r.icon || '📄'}</span>
        <div class="navbar-search-result-content">
          <div class="navbar-search-result-title">${StringUtils.highlight(r.title, this.elements.searchInput.value, 'search-highlight')}</div>
          ${r.subtitle ? `<div class="navbar-search-result-subtitle">${StringUtils.escapeHtml(r.subtitle)}</div>` : ''}
        </div>
        <span class="navbar-search-result-type">${this._getTypeLabel(r.type)}</span>
      </div>
    `).join('');

    this.elements.searchResults.hidden = false;

    // کلیک روی نتایج
    this.elements.searchResults.querySelectorAll('.navbar-search-result').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index);
        const result = results[index];

        if (result.action) {
          result.action();
        } else if (result.path) {
          router.navigate(result.path);
        }

        this._clearSearch();
      });
    });
  }

  /**
   * برچسب نوع
   */
  _getTypeLabel(type) {
    const labels = {
      route: 'صفحه',
      table: 'جدول',
      query: 'کوئری',
      setting: 'تنظیم'
    };
    return labels[type] || '';
  }

  /**
   * نمایش نتایج
   */
  _showSearchResults() {
    if (this.elements.searchResults) {
      this.elements.searchResults.hidden = false;
    }
  }

  /**
   * مخفی کردن نتایج
   */
  _hideSearchResults() {
    if (this.elements.searchResults) {
      this.elements.searchResults.hidden = true;
    }
  }

  /**
   * پاک کردن جستجو
   */
  _clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    if (this.elements.searchClear) {
      this.elements.searchClear.hidden = true;
    }
    this._hideSearchResults();
  }

  /**
   * تغییر وضعیت سایدبار
   */
  _toggleSidebar() {
    const collapsed = !stateManager.get('app.sidebarCollapsed');
    stateManager.set('app.sidebarCollapsed', collapsed);
    this.emit('sidebarToggle', collapsed);
  }

  /**
   * تغییر وضعیت منوی کاربر
   */
  _toggleUserDropdown() {
    if (!this.elements.userDropdown) return;

    const isHidden = this.elements.userDropdown.hidden;
    this.elements.userDropdown.hidden = !isHidden;
    this.elements.userMenuBtn.setAttribute('aria-expanded', String(isHidden));
  }

  /**
   * مخفی کردن منوی کاربر
   */
  _hideUserDropdown() {
    if (this.elements.userDropdown) {
      this.elements.userDropdown.hidden = true;
      this.elements.userMenuBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * هندلر اکشن
   */
  _handleAction(action) {
    this.emit('action', action);

    switch (action) {
      case 'new-db':
        this._handleNewDatabase();
        break;
      case 'open-db':
        this._handleOpenDatabase();
        break;
      case 'save-db':
        this._handleSaveDatabase();
        break;
      case 'export':
        router.navigate('/export');
        break;
      case 'import':
        router.navigate('/import');
        break;
      case 'theme':
        this._handleThemeToggle();
        break;
      case 'notifications':
        this._handleNotificationsClick();
        break;
      case 'settings':
        router.navigate('/settings');
        break;
      case 'shortcuts':
        this._showShortcuts();
        break;
      case 'help':
        this._showHelp();
        break;
      case 'about':
        router.navigate('/about');
        break;
    }
  }

  /**
   * پایگاه داده جدید
   */
  async _handleNewDatabase() {
    const confirmed = await modalService.confirm(
      'آیا می‌خواهید یک پایگاه داده جدید ایجاد کنید؟ تغییرات ذخیره نشده از بین خواهند رفت.',
      { title: 'پایگاه داده جدید', danger: true }
    );

    if (confirmed) {
      try {
        await databaseService.createDatabase();
        stateManager.set('database.loaded', true);
        stateManager.set('database.name', 'database.db');
        notificationService.success('پایگاه داده جدید ایجاد شد');
        loadTablesList();
      } catch (error) {
        notificationService.error(`خطا: ${error.message}`);
      }
    }
  }

  /**
   * باز کردن پایگاه داده
   */
  async _handleOpenDatabase() {
    try {
      const file = await fileService.openFileDialog({
        accept: '.db,.sqlite,.sqlite3,.db3,.sql'
      });

      if (!file) return;

      const validation = fileService.validateFile(file, {
        maxSize: AppConfig.database.maxFileSize,
        accept: AppConfig.database.supportedExtensions
      });

      if (!validation.valid) {
        notificationService.error(validation.errors[0]);
        return;
      }

      const data = await fileService.readAsUint8Array(file);
      await databaseService.loadDatabase(data, file.name);

      stateManager.set('database.loaded', true);
      stateManager.set('database.name', file.name);
      stateManager.set('database.size', file.size);

      storageService.set('lastDatabase', {
        name: file.name,
        size: file.size,
        timestamp: Date.now()
      });

      notificationService.success(`پایگاه داده "${file.name}" بارگذاری شد`);
      loadTablesList();
    } catch (error) {
      notificationService.error(`خطا در بارگذاری: ${error.message}`);
    }
  }

  /**
   * ذخیره پایگاه داده
   */
  _handleSaveDatabase() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    try {
      const data = databaseService.exportDatabase();
      const filename = stateManager.get('database.name') || 'database.db';

      fileService.downloadUint8Array(data, filename, 'application/x-sqlite3');

      stateManager.set('database.dirty', false);
      stateManager.set('database.lastSaved', Date.now());

      notificationService.success('پایگاه داده ذخیره شد');
    } catch (error) {
      notificationService.error(`خطا در ذخیره: ${error.message}`);
    }
  }

  /**
   * تغییر تم
   */
  _handleThemeToggle() {
    const currentTheme = stateManager.get('app.theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    stateManager.set('app.theme', newTheme);
    applyTheme(newTheme);
    this._updateThemeIcon();

    storageService.set('theme', newTheme);
    notificationService.info(`تم به ${newTheme === 'dark' ? 'تاریک' : 'روشن'} تغییر کرد`);
  }

  /**
   * به‌روزرسانی آیکون تم
   */
  _updateThemeIcon() {
    if (!this.elements.themeIcon) return;
    const theme = stateManager.get('app.theme') || 'dark';
    this.elements.themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  /**
   * نمایش اعلان‌ها
   */
  _handleNotificationsClick() {
    const notifications = notificationService.getActive();

    if (notifications.length === 0) {
      notificationService.info('اعلان جدیدی وجود ندارد');
      return;
    }

    this.emit('notificationsClick', notifications);
  }

  /**
   * نمایش کلیدهای میانبر
   */
  _showShortcuts() {
    const shortcuts = AppConfig.keyboardShortcuts;
    const rows = Object.entries(shortcuts).map(([key, action]) => `
      <tr>
        <td><kbd>${key}</kbd></td>
        <td>${this._getActionLabel(action)}</td>
      </tr>
    `).join('');

    modalService.open(`
      <table class="shortcuts-table">
        <thead>
          <tr><th>کلید</th><th>عملیات</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `, {
      title: 'کلیدهای میانبر',
      size: 'md'
    });
  }

  /**
   * برچسب اکشن
   */
  _getActionLabel(action) {
    const labels = {
      newDatabase: 'پایگاه داده جدید',
      openDatabase: 'باز کردن پایگاه داده',
      saveDatabase: 'ذخیره پایگاه داده',
      saveAs: 'ذخیره به عنوان',
      exportDatabase: 'صادرات',
      importDatabase: 'واردات',
      executeQuery: 'اجرای کوئری',
      search: 'جستجو',
      closeModal: 'بستن مودال',
      toggleSidebar: 'تغییر وضعیت سایدبار',
      toggleFullscreen: 'تمام صفحه',
      quickCommand: 'دستور سریع',
      commandPalette: 'پالت دستورات'
    };
    return labels[action] || action;
  }

  /**
   * نمایش راهنما
   */
  _showHelp() {
    modalService.open(`
      <div class="help-content">
        <p>برای شروع، یک پایگاه داده باز کنید یا یکی جدید بسازید.</p>
        <p>از منوی سمت راست برای ناوبری بین بخش‌ها استفاده کنید.</p>
        <p>برای مشاهده کلیدهای میانبر، از منوی کاربر گزینه "کلیدهای میانبر" را انتخاب کنید.</p>
      </div>
    `, { title: 'راهنما', size: 'md' });
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
    document.removeEventListener('keydown', this._boundKeydown);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.Navbar = Navbar;