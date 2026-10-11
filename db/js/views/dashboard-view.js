/**
 * نمای داشبورد
 * صفحه اصلی با آمار، اطلاعات و عملیات سریع
 */
class DashboardView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.charts = new Map();
    this.listeners = new Map();
    this.refreshInterval = null;
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-dashboard',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">🏠</span>
            <span>داشبورد</span>
          </h1>
          <p class="view-subtitle">نمای کلی پایگاه داده و عملیات سریع</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm dashboard-refresh" title="بازنشانی">
            <span class="icon">🔄</span>
            <span>بازنشانی</span>
          </button>
          <button class="btn btn-primary btn-sm dashboard-new-db">
            <span class="icon">➕</span>
            <span>پایگاه داده جدید</span>
          </button>
        </div>
      </div>

      <div class="dashboard-content">
        ${this._renderWelcomeSection()}
        ${this._renderStatsSection()}
        ${this._renderQuickActionsSection()}
        ${this._renderTablesOverviewSection()}
        ${this._renderRecentActivitySection()}
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._loadData();

    return this.element;
  }

  /**
   * بخش خوش‌آمد
   */
  _renderWelcomeSection() {
    return `
      <div class="dashboard-welcome dashboard-welcome-visible">
        <div class="dashboard-welcome-bg"></div>
        <div class="dashboard-welcome-content">
          <h2 class="dashboard-welcome-title">
            به <span class="dashboard-welcome-highlight">مدیریت پایگاه داده</span> خوش آمدید
          </h2>
          <p class="dashboard-welcome-message">
            برای شروع، یک پایگاه داده باز کنید یا یکی جدید بسازید. تمام عملیات به صورت محلی در مرورگر شما انجام می‌شود.
          </p>
          <div class="dashboard-welcome-actions">
            <button class="btn btn-primary dashboard-welcome-open">
              <span class="icon">📂</span>
              <span>باز کردن پایگاه داده</span>
            </button>
            <button class="btn btn-secondary dashboard-welcome-new">
              <span class="icon">➕</span>
              <span>ایجاد پایگاه داده جدید</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * بخش آمار
   */
  _renderStatsSection() {
    const statCards = [
      { id: 'tables', icon: '📊', label: 'جداول', color: 'primary' },
      { id: 'rows', icon: '📋', label: 'ردیف‌ها', color: 'success' },
      { id: 'size', icon: '💾', label: 'حجم', color: 'info' },
      { id: 'indexes', icon: '🔍', label: 'ایندکس‌ها', color: 'warning' },
      { id: 'views', icon: '👁️', label: 'ویوها', color: 'secondary' },
      { id: 'triggers', icon: '⚡', label: 'تریگرها', color: 'danger' }
    ];

    return `
      <div class="dashboard-section">
        <div class="dashboard-section-header">
          <h3 class="dashboard-section-title">
            <span class="icon">📈</span>
            <span>آمار کلی</span>
          </h3>
        </div>
        <div class="stats-grid">
          ${statCards.map(card => `
            <div class="stat-card stat-card-${card.color}" data-stat="${card.id}">
              <div class="stat-card-header">
                <span class="stat-card-title">${card.label}</span>
                <div class="stat-card-icon stat-card-icon-${card.color}">
                  <span>${card.icon}</span>
                </div>
              </div>
              <div class="stat-card-value">
                <span class="stat-card-value-number" data-stat-value="${card.id}">۰</span>
              </div>
              <div class="stat-card-footer">
                <span class="stat-card-change" data-stat-change="${card.id}"></span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * بخش عملیات سریع
   */
  _renderQuickActionsSection() {
    const actions = [
      { id: 'new-table', icon: '➕', label: 'جدول جدید', description: 'ایجاد جدول جدید', color: 'primary' },
      { id: 'new-query', icon: '💻', label: 'کوئری جدید', description: 'اجرای کوئری SQL', color: 'secondary' },
      { id: 'import', icon: '📥', label: 'واردات', description: 'واردات از فایل', color: 'info' },
      { id: 'export', icon: '📤', label: 'صادرات', description: 'صادرات پایگاه داده', color: 'success' },
      { id: 'backup', icon: '💾', label: 'پشتیبان‌گیری', description: 'ذخیره پشتیبان', color: 'warning' },
      { id: 'optimize', icon: '⚡', label: 'بهینه‌سازی', description: 'VACUUM و ANALYZE', color: 'danger' },
      { id: 'schema', icon: '🗂️', label: 'ساختار', description: 'مشاهده ساختار', color: 'primary' },
      { id: 'settings', icon: '⚙️', label: 'تنظیمات', description: 'تنظیمات برنامه', color: 'secondary' }
    ];

    return `
      <div class="dashboard-section">
        <div class="dashboard-section-header">
          <h3 class="dashboard-section-title">
            <span class="icon">⚡</span>
            <span>عملیات سریع</span>
          </h3>
        </div>
        <div class="quick-actions-grid">
          ${actions.map(action => `
            <button class="quick-action-card quick-action-${action.color}" data-action="${action.id}">
              <div class="quick-action-icon">${action.icon}</div>
              <div class="quick-action-content">
                <div class="quick-action-label">${action.label}</div>
                <div class="quick-action-description">${action.description}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * بخش جداول
   */
  _renderTablesOverviewSection() {
    return `
      <div class="dashboard-section dashboard-tables-section">
        <div class="dashboard-section-header">
          <h3 class="dashboard-section-title">
            <span class="icon">📋</span>
            <span>جداول</span>
          </h3>
          <button class="btn btn-sm btn-ghost dashboard-view-all-tables">
            <span>مشاهده همه</span>
            <span class="icon">←</span>
          </button>
        </div>
        <div class="dashboard-tables-list"></div>
      </div>
    `;
  }

  /**
   * بخش فعالیت‌ها
   */
  _renderRecentActivitySection() {
    return `
      <div class="dashboard-section dashboard-activity-section">
        <div class="dashboard-section-header">
          <h3 class="dashboard-section-title">
            <span class="icon">🕐</span>
            <span>فعالیت‌های اخیر</span>
          </h3>
          <button class="btn btn-sm btn-ghost dashboard-clear-activity" title="پاک کردن">
            <span class="icon">🗑️</span>
          </button>
        </div>
        <div class="dashboard-activity-list"></div>
      </div>
    `;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      refreshBtn: q('.dashboard-refresh'),
      newDbBtn: q('.dashboard-new-db'),
      welcomeOpen: q('.dashboard-welcome-open'),
      welcomeNew: q('.dashboard-welcome-new'),
      welcome: q('.dashboard-welcome'),
      tablesList: q('.dashboard-tables-list'),
      activityList: q('.dashboard-activity-list'),
      viewAllTables: q('.dashboard-view-all-tables'),
      clearActivity: q('.dashboard-clear-activity')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.refreshBtn?.addEventListener('click', () => this._loadData());
    this.elements.newDbBtn?.addEventListener('click', () => this._createNewDatabase());
    this.elements.welcomeOpen?.addEventListener('click', () => this._openDatabase());
    this.elements.welcomeNew?.addEventListener('click', () => this._createNewDatabase());
    this.elements.viewAllTables?.addEventListener('click', () => router.navigate('/tables'));
    this.elements.clearActivity?.addEventListener('click', () => this._clearActivity());

    // عملیات سریع
    this.element.querySelectorAll('.quick-action-card').forEach(card => {
      card.addEventListener('click', () => this._handleQuickAction(card.dataset.action));
    });

    // جدول‌ها با کلیک
    this.element.addEventListener('click', (e) => {
      const tableCard = e.target.closest('[data-table-name]');
      if (tableCard) {
        router.navigate(`/tables/${tableCard.dataset.tableName}`);
      }
    });

    // به‌روزرسانی خودکار
    stateManager.subscribe('database.loaded', () => this._loadData());
    stateManager.subscribe('database.tables', () => this._loadData());

    // رویدادهای پایگاه داده
    databaseService.on('queryExecuted', (data) => this._addActivity({
      type: 'query',
      icon: '💻',
      title: 'کوئری اجرا شد',
      description: data.sql.substring(0, 80),
      timestamp: Date.now()
    }));
  }

  /**
   * بارگذاری داده‌ها
   */
  async _loadData() {
    try {
      const dbLoaded = stateManager.get('database.loaded');

      if (!dbLoaded) {
        this._showWelcome();
        this._renderEmptyState();
        return;
      }

      this._hideWelcome();

      const info = databaseService.getDatabaseInfo();
      this._updateStats(info);
      this._renderTables();
      this._renderActivity();
    } catch (error) {
      console.error('خطا در بارگذاری داشبورد:', error);
    }
  }

  /**
   * نمایش خوش‌آمد
   */
  _showWelcome() {
    if (this.elements.welcome) {
      this.elements.welcome.hidden = false;
    }
  }

  /**
   * مخفی کردن خوش‌آمد
   */
  _hideWelcome() {
    if (this.elements.welcome) {
      this.elements.welcome.hidden = true;
    }
  }

  /**
   * به‌روزرسانی آمار با انیمیشن
   */
  _updateStats(info) {
    const stats = {
      tables: info.tableCount || 0,
      rows: info.totalRows || 0,
      size: info.totalSize || 0,
      indexes: info.indexCount || 0,
      views: info.viewCount || 0,
      triggers: info.triggerCount || 0
    };

    Object.entries(stats).forEach(([key, value]) => {
      const el = this.element.querySelector(`[data-stat-value="${key}"]`);
      if (!el) return;

      if (key === 'size') {
        el.textContent = NumberUtils.formatBytes(value);
      } else {
        this._animateNumber(el, 0, value, 800);
      }
    });
  }

  /**
   * انیمیشن عدد
   */
  _animateNumber(el, from, to, duration) {
    const start = performance.now();
    const diff = to - from;

    const update = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + diff * eased);

      el.textContent = StringUtils.englishToPersianDigits(NumberUtils.format(current));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }

  /**
   * رندر حالت خالی
   */
  _renderEmptyState() {
    if (this.elements.tablesList) {
      this.elements.tablesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div class="empty-state-title">پایگاه داده‌ای بارگذاری نشده است</div>
          <div class="empty-state-description">برای مشاهده جداول، ابتدا یک پایگاه داده باز کنید</div>
        </div>
      `;
    }

    if (this.elements.activityList) {
      this.elements.activityList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">فعالیتی ثبت نشده</div>
        </div>
      `;
    }
  }

  /**
   * رندر جداول
   */
  _renderTables() {
    if (!this.elements.tablesList) return;

    const tables = stateManager.get('database.tables') || [];

    if (tables.length === 0) {
      this.elements.tablesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">جدولی وجود ندارد</div>
          <div class="empty-state-description">برای شروع یک جدول جدید بسازید</div>
          <button class="btn btn-primary dashboard-empty-create-table">
            <span class="icon">➕</span>
            <span>ایجاد جدول</span>
          </button>
        </div>
      `;

      this.elements.tablesList.querySelector('.dashboard-empty-create-table')?.addEventListener('click', () => {
        this._handleQuickAction('new-table');
      });

      return;
    }

    const displayTables = tables.slice(0, 6);

    this.elements.tablesList.innerHTML = displayTables.map(table => {
      const rowCount = databaseService.getTableRowCount(table.name);

      return `
        <div class="dashboard-table-card" data-table-name="${StringUtils.escapeHtml(table.name)}">
          <div class="dashboard-table-card-icon">
            ${table.type === 'view' ? '👁️' : '📋'}
          </div>
          <div class="dashboard-table-card-content">
            <div class="dashboard-table-card-name">${StringUtils.escapeHtml(table.name)}</div>
            <div class="dashboard-table-card-meta">
              <span>${StringUtils.englishToPersianDigits(rowCount)} ردیف</span>
              <span>${table.type === 'view' ? 'ویو' : 'جدول'}</span>
            </div>
          </div>
          <div class="dashboard-table-card-arrow">←</div>
        </div>
      `;
    }).join('');

    if (tables.length > 6) {
      this.elements.tablesList.insertAdjacentHTML('beforeend', `
        <div class="dashboard-table-more">
          و ${StringUtils.englishToPersianDigits(tables.length - 6)} جدول دیگر...
        </div>
      `);
    }
  }

  /**
   * رندر فعالیت‌ها
   */
  _renderActivity() {
    if (!this.elements.activityList) return;

    const activities = storageService.get('dashboard_activity', []) || [];

    if (activities.length === 0) {
      this.elements.activityList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">فعالیتی ثبت نشده</div>
        </div>
      `;
      return;
    }

    this.elements.activityList.innerHTML = activities.slice(0, 8).map(activity => `
      <div class="dashboard-activity-item">
        <div class="dashboard-activity-icon">${activity.icon || '📝'}</div>
        <div class="dashboard-activity-content">
          <div class="dashboard-activity-title">${StringUtils.escapeHtml(activity.title || '')}</div>
          ${activity.description ? `
            <div class="dashboard-activity-description">${StringUtils.escapeHtml(StringUtils.truncate(activity.description, 60))}</div>
          ` : ''}
        </div>
        <div class="dashboard-activity-time">${DateUtils.formatRelative(activity.timestamp)}</div>
      </div>
    `).join('');
  }

  /**
   * افزودن فعالیت
   */
  _addActivity(activity) {
    const activities = storageService.get('dashboard_activity', []) || [];
    activities.unshift(activity);
    storageService.set('dashboard_activity', activities.slice(0, 30));
    this._renderActivity();
  }

  /**
   * پاک کردن فعالیت‌ها
   */
  async _clearActivity() {
    const confirmed = await modalService.confirm('تمام فعالیت‌های اخیر پاک شوند؟', {
      title: 'پاک کردن فعالیت‌ها'
    });

    if (confirmed) {
      storageService.set('dashboard_activity', []);
      this._renderActivity();
      notificationService.success('فعالیت‌ها پاک شدند');
    }
  }

  /**
   * هندلر عملیات سریع
   */
  async _handleQuickAction(action) {
    switch (action) {
      case 'new-table':
        this._createNewTable();
        break;
      case 'new-query':
        router.navigate('/query');
        break;
      case 'import':
        router.navigate('/import');
        break;
      case 'export':
        router.navigate('/export');
        break;
      case 'backup':
        this._backup();
        break;
      case 'optimize':
        this._optimize();
        break;
      case 'schema':
        router.navigate('/schema');
        break;
      case 'settings':
        router.navigate('/settings');
        break;
    }
  }

  /**
   * ایجاد پایگاه داده جدید
   */
  async _createNewDatabase() {
    const confirmed = await modalService.confirm(
      'آیا می‌خواهید یک پایگاه داده جدید ایجاد کنید؟ تغییرات ذخیره نشده از بین خواهند رفت.',
      { title: 'پایگاه داده جدید', danger: true }
    );

    if (!confirmed) return;

    try {
      await databaseService.createDatabase();

      stateManager.set('database.loaded', true);
      stateManager.set('database.name', 'database.db');
      stateManager.set('database.size', 0);

      this._addActivity({
        type: 'database',
        icon: '🗄️',
        title: 'پایگاه داده جدید ایجاد شد',
        timestamp: Date.now()
      });

      notificationService.success('پایگاه داده جدید ایجاد شد');
      this._loadData();
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * باز کردن پایگاه داده
   */
  async _openDatabase() {
    try {
      const file = await FileUtils.openDialog({
        accept: AppConfig.database.supportedExtensions.join(',')
      });

      if (!file) return;

      const data = await FileUtils.readUint8Array(file);
      await databaseService.loadDatabase(data, file.name);

      stateManager.set('database.loaded', true);
      stateManager.set('database.name', file.name);
      stateManager.set('database.size', file.size);

      storageService.set('lastDatabase', {
        name: file.name,
        size: file.size,
        timestamp: Date.now()
      });

      this._addActivity({
        type: 'database',
        icon: '📂',
        title: `پایگاه داده بارگذاری شد: ${file.name}`,
        timestamp: Date.now()
      });

      notificationService.success(`"${file.name}" بارگذاری شد`);
      loadTablesList();
      this._loadData();
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * ایجاد جدول جدید
   */
  async _createNewTable() {
    const designer = new TableDesigner();
    const content = designer.render();

    modalService.open(content, {
      title: 'ایجاد جدول جدید',
      size: 'lg',
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="create">ایجاد جدول</button>
      `,
      onOpen: (modal, ctx) => {
        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
          modalService.close(ctx.id);
        });

        modal.querySelector('[data-action="create"]')?.addEventListener('click', () => {
          try {
            const sql = designer.createTable();
            notificationService.success('جدول ایجاد شد');

            this._addActivity({
              type: 'table',
              icon: '➕',
              title: 'جدول جدید ایجاد شد',
              description: sql.substring(0, 100),
              timestamp: Date.now()
            });

            loadTablesList();
            this._loadData();
            modalService.close(ctx.id);
          } catch (error) {
            notificationService.error(`خطا: ${error.message}`);
          }
        });
      }
    });
  }

  /**
   * پشتیبان‌گیری
   */
  async _backup() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    try {
      const data = databaseService.exportDatabase();
      const name = stateManager.get('database.name') || 'database';
      const timestamp = DateUtils.formatPersian(new Date(), 'YYYY-MM-DD_HH-mm');
      const filename = `${FileUtils.getBaseName(name)}_backup_${timestamp}.db`;

      FileUtils.downloadUint8Array(data, filename, 'application/x-sqlite3');

      this._addActivity({
        type: 'backup',
        icon: '💾',
        title: 'پشتیبان‌گیری انجام شد',
        description: filename,
        timestamp: Date.now()
      });

      notificationService.success('پشتیبان ایجاد شد');
    } catch (error) {
      notificationService.error(`خطا: ${error.message}`);
    }
  }

  /**
   * بهینه‌سازی
   */
  async _optimize() {
    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    const confirmed = await modalService.confirm(
      'بهینه‌سازی شامل VACUUM و ANALYZE است و ممکن است زمان‌بر باشد. ادامه؟',
      { title: 'بهینه‌سازی' }
    );

    if (!confirmed) return;

    const progress = notificationService.progress('در حال بهینه‌سازی...', { duration: 0 });

    try {
      progress.update(20, 'اجرای VACUUM...');
      databaseService.vacuum();

      progress.update(60, 'اجرای ANALYZE...');
      databaseService.analyze();

      progress.update(90, 'اجرای REINDEX...');
      databaseService.reindex();

      progress.complete('بهینه‌سازی کامل شد');

      this._addActivity({
        type: 'optimize',
        icon: '⚡',
        title: 'بهینه‌سازی انجام شد',
        timestamp: Date.now()
      });
    } catch (error) {
      progress.dismiss();
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
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.DashboardView = DashboardView;