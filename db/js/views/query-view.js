/**
 * نمای کوئری
 * اجرای کوئری‌های SQL
 */
class QueryView {
  constructor() {
    this.element = null;
    this.elements = {};
    this.editor = null;
    this.resultsTable = null;
    this.currentResult = null;
    this.splitRatio = 0.5;
    this.listeners = new Map();
    this._boundKeydown = this._handleKeydown.bind(this);
  }

  /**
   * رندر
   */
  async render() {
    this.element = DomUtils.create('div', {
      className: 'view view-query',
      attrs: { role: 'main' }
    });

    this.element.innerHTML = `
      <div class="view-header">
        <div class="view-header-content">
          <h1 class="view-title">
            <span class="view-title-icon">💻</span>
            <span>ویرایشگر کوئری</span>
          </h1>
          <p class="view-subtitle">اجرای کوئری SQL و مشاهده نتایج</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-ghost btn-sm query-save" title="ذخیره کوئری">
            <span class="icon">💾</span>
            <span>ذخیره</span>
          </button>
          <button class="btn btn-ghost btn-sm query-templates" title="قالب‌ها">
            <span class="icon">📝</span>
            <span>قالب‌ها</span>
          </button>
          <button class="btn btn-ghost btn-sm query-history" title="تاریخچه">
            <span class="icon">🕐</span>
            <span>تاریخچه</span>
          </button>
        </div>
      </div>

      <div class="query-layout">
        <div class="query-editor-panel">
          <div class="query-editor-container"></div>
        </div>

        <div class="query-resizer" data-resizer="query">
          <div class="query-resizer-handle"></div>
        </div>

        <div class="query-results-panel">
          <div class="query-results-header">
            <div class="query-results-tabs">
              <button class="query-results-tab active" data-tab="results">
                <span class="icon">📊</span>
                <span>نتایج</span>
                <span class="query-results-tab-badge" hidden>0</span>
              </button>
              <button class="query-results-tab" data-tab="messages">
                <span class="icon">💬</span>
                <span>پیام‌ها</span>
              </button>
              <button class="query-results-tab" data-tab="plan">
                <span class="icon">📈</span>
                <span>نقشه اجرا</span>
              </button>
            </div>
            <div class="query-results-actions">
              <button class="btn btn-xs btn-ghost query-results-copy" title="کپی">
                <span class="icon">📋</span>
              </button>
              <button class="btn btn-xs btn-ghost query-results-export" title="صادرات">
                <span class="icon">📤</span>
              </button>
              <button class="btn btn-xs btn-ghost query-results-clear" title="پاک کردن">
                <span class="icon">🗑️</span>
              </button>
            </div>
          </div>

          <div class="query-results-content">
            <div class="query-results-panel-content" data-panel="results">
              <div class="query-results-table-container"></div>
            </div>
            <div class="query-results-panel-content" data-panel="messages" hidden>
              <div class="query-messages"></div>
            </div>
            <div class="query-results-panel-content" data-panel="plan" hidden>
              <div class="query-plan"></div>
            </div>
          </div>

          <div class="query-results-status">
            <div class="query-results-status-left">
              <span class="query-status-info query-status-rows">۰ ردیف</span>
              <span class="query-status-info query-status-time">۰ms</span>
            </div>
            <div class="query-results-status-right">
              <span class="query-status-message"></span>
            </div>
          </div>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._initEditor();
    this._initResultsTable();
    this._loadSavedState();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      saveBtn: q('.query-save'),
      templatesBtn: q('.query-templates'),
      historyBtn: q('.query-history'),
      editorContainer: q('.query-editor-container'),
      resizer: q('.query-resizer'),
      resultsTabs: q('.query-results-tabs'),
      resultsCopy: q('.query-results-copy'),
      resultsExport: q('.query-results-export'),
      resultsClear: q('.query-results-clear'),
      resultsTableContainer: q('.query-results-table-container'),
      messages: q('.query-messages'),
      plan: q('.query-plan'),
      tabBadge: q('.query-results-tab-badge'),
      statusRows: q('.query-status-rows'),
      statusTime: q('.query-status-time'),
      statusMessage: q('.query-status-message')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.saveBtn?.addEventListener('click', () => this._saveQuery());
    this.elements.templatesBtn?.addEventListener('click', () => this._showTemplates());
    this.elements.historyBtn?.addEventListener('click', () => this._showHistory());

    this.elements.resultsTabs?.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;

      this.elements.resultsTabs.querySelectorAll('.query-results-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      this.element.querySelectorAll('.query-results-panel-content').forEach(p => {
        p.hidden = p.dataset.panel !== tabName;
      });
    });

    this.elements.resultsCopy?.addEventListener('click', () => this._copyResults());
    this.elements.resultsExport?.addEventListener('click', () => this._exportResults());
    this.elements.resultsClear?.addEventListener('click', () => this._clearResults());

    // Resizer
    this._initResizer();

    // کلیدهای میانبر
    document.addEventListener('keydown', this._boundKeydown);

    // بارگذاری SQL از state
    stateManager.subscribe('query.sql', (sql) => {
      if (sql !== undefined && this.editor && this.editor.getValue() !== sql) {
        this.editor.setValue(sql);
      }
    });
  }

  /**
   * راه‌اندازی resizer
   */
  _initResizer() {
    const resizer = this.elements.resizer;
    const editorPanel = this.element.querySelector('.query-editor-panel');
    const resultsPanel = this.element.querySelector('.query-results-panel');

    if (!resizer) return;

    let startY = 0;
    let startEditorHeight = 0;
    let startResultsHeight = 0;

    const onMouseMove = (e) => {
      const diff = e.clientY - startY;
      const newEditorHeight = Math.max(100, startEditorHeight + diff);
      const newResultsHeight = Math.max(100, startResultsHeight - diff);

      editorPanel.style.flex = `0 0 ${newEditorHeight}px`;
      resultsPanel.style.flex = `1 1 auto`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startY = e.clientY;
      startEditorHeight = editorPanel.offsetHeight;
      startResultsHeight = resultsPanel.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * راه‌اندازی ویرایشگر
   */
  _initEditor() {
    this.editor = new SqlEditor({
      value: stateManager.get('query.sql') || '-- کوئری خود را اینجا بنویسید\nSELECT * FROM sqlite_master WHERE type = \'table\' LIMIT 10;',
      lineNumbers: true,
      autoComplete: true,
      highlightActiveLine: true,
      onExecute: (sql) => this._execute(sql),
      onChange: (sql) => stateManager.set('query.sql', sql)
    });

    // تنظیم جداول برای autocomplete
    const tables = stateManager.get('database.tables') || [];
    const columns = {};
    tables.forEach(t => {
      columns[t.name] = databaseService.getTableInfo(t.name).map(c => c.name);
    });
    this.editor.setSchema(tables, columns);

    this.elements.editorContainer.appendChild(this.editor.render());
  }

  /**
   * راه‌اندازی جدول نتایج
   */
  _initResultsTable() {
    this.resultsTable = new DataTable({
      columns: [],
      data: [],
      pageSize: 100,
      sortable: true,
      filterable: true,
      selectable: true,
      multiSelect: true,
      virtualScroll: true,
      contextMenu: true,
      onExport: (info) => this._exportData(info.data)
    });

    this.elements.resultsTableContainer.appendChild(this.resultsTable.render());
  }

  /**
   * بارگذاری state
   */
  _loadSavedState() {
    // اجرای خودکار اگر از قبل نتیجه‌ای وجود دارد
  }

  /**
   * هندلر کیبورد
   */
  _handleKeydown(e) {
    // Ctrl+Enter - اجرا (اگر در ویرایشگر نیست)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (!this.editor?.elements?.textarea?.contains(document.activeElement)) {
        e.preventDefault();
        this._execute(this.editor.getValue());
      }
    }

    // Ctrl+S - ذخیره
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this._saveQuery();
    }
  }

  /**
   * اجرا
   */
  async _execute(sql) {
    if (!sql || !sql.trim()) {
      notificationService.warning('کوئری خالی است');
      return;
    }

    if (!stateManager.get('database.loaded')) {
      notificationService.warning('پایگاه داده‌ای بارگذاری نشده است');
      return;
    }

    this._setStatusMessage('در حال اجرا...', 'info');

    const startTime = performance.now();

    try {
      const result = await queryService.execute(sql);
      const elapsed = performance.now() - startTime;

      if (result.success) {
        this._handleSuccess(result, elapsed);
      } else {
        this._handleError(result, elapsed);
      }
    } catch (error) {
      this._handleError({ error: error.message }, performance.now() - startTime);
    }
  }

  /**
   * هندلر موفقیت
   */
  _handleSuccess(result, elapsed) {
    this.currentResult = result;

    const rowCount = result.data ? result.data.length : 0;

    // به‌روزرسانی جدول نتایج
    if (result.columns && result.columns.length > 0) {
      const columns = result.columns.map(col => ({
        name: col,
        title: col,
        type: this._detectColumnType(result.data, col),
        editable: false
      }));

      this.resultsTable.setColumns(columns);
      this.resultsTable.setData(result.data, { total: rowCount, page: 1 });
    } else {
      this.resultsTable.setColumns([]);
      this.resultsTable.setData([], { total: 0 });
    }

    // به‌روزرسانی بج
    if (this.elements.tabBadge) {
      this.elements.tabBadge.textContent = StringUtils.englishToPersianDigits(rowCount);
      this.elements.tabBadge.hidden = rowCount === 0;
    }

    // به‌روزرسانی وضعیت
    if (this.elements.statusRows) {
      this.elements.statusRows.textContent = `${StringUtils.englishToPersianDigits(rowCount)} ردیف`;
    }
    if (this.elements.statusTime) {
      this.elements.statusTime.textContent = DateUtils.formatExecutionTime(elapsed);
    }

    this._setStatusMessage('کوئری با موفقیت اجرا شد', 'success');

    // اطلاعات ویرایشگر
    if (this.editor) {
      this.editor.setResultInfo({
        executionTime: elapsed,
        rowCount
      });
    }

    // پیام‌ها
    this._addMessage({
      type: 'success',
      text: `کوئری با موفقیت اجرا شد. ${StringUtils.englishToPersianDigits(rowCount)} ردیف برگردانده شد.`,
      time: elapsed
    });

    // فعالیت
    const activities = storageService.get('dashboard_activity', []) || [];
    activities.unshift({
      type: 'query',
      icon: '💻',
      title: 'کوئری اجرا شد',
      description: StringUtils.truncate(result.sql || '', 80),
      timestamp: Date.now()
    });
    storageService.set('dashboard_activity', activities.slice(0, 30));
  }

  /**
   * تشخیص نوع ستون
   */
  _detectColumnType(data, colName) {
    if (!data || data.length === 0) return 'TEXT';

    const samples = data.slice(0, 20).map(r => r[colName]).filter(v => v !== null && v !== undefined);
    if (samples.length === 0) return 'TEXT';

    const allNumbers = samples.every(v => typeof v === 'number' || !isNaN(Number(v)));
    if (allNumbers) return 'INTEGER';

    return 'TEXT';
  }

  /**
   * هندلر خطا
   */
  _handleError(result, elapsed) {
    if (this.elements.statusTime) {
      this.elements.statusTime.textContent = DateUtils.formatExecutionTime(elapsed);
    }

    this._setStatusMessage(`خطا: ${result.error}`, 'error');

    if (this.elements.messages) {
      this.elements.messages.innerHTML = `
        <div class="query-message query-message-error">
          <div class="query-message-icon">✕</div>
          <div class="query-message-content">
            <div class="query-message-title">خطا در اجرای کوئری</div>
            <div class="query-message-text">${StringUtils.escapeHtml(result.error)}</div>
          </div>
        </div>
      `;
    }

    // نمایش تب پیام‌ها
    this.element.querySelector('[data-tab="messages"]')?.click();
  }

  /**
   * تنظیم پیام وضعیت
   */
  _setStatusMessage(text, type = 'info') {
    if (!this.elements.statusMessage) return;
    this.elements.statusMessage.textContent = text;
    this.elements.statusMessage.className = `query-status-message query-status-message-${type}`;
  }

  /**
   * افزودن پیام
   */
  _addMessage(message) {
    if (!this.elements.messages) return;

    const html = `
      <div class="query-message query-message-${message.type}">
        <div class="query-message-icon">${message.type === 'success' ? '✓' : 'ℹ'}</div>
        <div class="query-message-content">
          <div class="query-message-text">${StringUtils.escapeHtml(message.text)}</div>
          ${message.time !== undefined ? `<div class="query-message-time">${DateUtils.formatExecutionTime(message.time)}</div>` : ''}
        </div>
      </div>
    `;

    this.elements.messages.insertAdjacentHTML('afterbegin', html);
  }

  /**
   * پاک کردن نتایج
   */
  _clearResults() {
    this.resultsTable.setColumns([]);
    this.resultsTable.setData([], { total: 0 });
    this.currentResult = null;

    if (this.elements.tabBadge) this.elements.tabBadge.hidden = true;
    if (this.elements.statusRows) this.elements.statusRows.textContent = '۰ ردیف';
    if (this.elements.statusTime) this.elements.statusTime.textContent = '۰ms';
    if (this.elements.messages) this.elements.messages.innerHTML = '';

    this._setStatusMessage('نتایج پاک شد', 'info');
  }

  /**
   * کپی نتایج
   */
  async _copyResults() {
    if (!this.currentResult || !this.currentResult.data) {
      notificationService.warning('نتیجه‌ای برای کپی وجود ندارد');
      return;
    }

    const text = JSON.stringify(this.currentResult.data, null, 2);
    const ok = await DomUtils.copyToClipboard(text);
    if (ok) notificationService.success('کپی شد');
  }

  /**
   * صادرات نتایج
   */
  async _exportResults() {
    if (!this.currentResult || !this.currentResult.data) {
      notificationService.warning('نتیجه‌ای برای صادرات وجود ندارد');
      return;
    }

    const items = [
      { label: 'JSON', onClick: () => this._exportData(this.currentResult.data, 'json') },
      { label: 'CSV', onClick: () => this._exportData(this.currentResult.data, 'csv') },
      { label: 'SQL', onClick: () => this._exportData(this.currentResult.data, 'sql') },
      { label: 'XML', onClick: () => this._exportData(this.currentResult.data, 'xml') },
      { label: 'Excel', onClick: () => this._exportData(this.currentResult.data, 'excel') }
    ];

    const rect = this.elements.resultsExport.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * صادرات داده
   */
  async _exportData(data, format = 'json') {
    const exportData = {
      tables: {
        query_result: {
          columns: this.currentResult?.columns?.map(c => ({ name: c, type: 'TEXT' })) || [],
          data
        }
      }
    };

    try {
      const result = await exportService.export(format, exportData);

      if (result.isBinary) {
        FileUtils.downloadUint8Array(result.content, `query_result${result.extension}`, result.mimeType);
      } else {
        FileUtils.downloadText(result.content, `query_result${result.extension}`, result.mimeType);
      }

      notificationService.success('صادرات انجام شد');
    } catch (error) {
      notificationService.error(error.message);
    }
  }

  /**
   * ذخیره کوئری
   */
  async _saveQuery() {
    const sql = this.editor.getValue();
    if (!sql.trim()) {
      notificationService.warning('کوئری خالی است');
      return;
    }

    const name = await modalService.prompt('نام کوئری:', {
      title: 'ذخیره کوئری',
      placeholder: 'نام کوئری'
    });

    if (!name) return;

    queryService.saveQuery(name, sql);
    notificationService.success(`کوئری "${name}" ذخیره شد`);
  }

  /**
   * نمایش قالب‌ها
   */
  _showTemplates() {
    const templates = queryService.getTemplates();

    const items = templates.map(t => ({
      label: t.name,
      icon: '📝',
      onClick: () => {
        this.editor.setValue(t.sql);
        this.editor.focus();
      }
    }));

    const rect = this.elements.templatesBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * نمایش تاریخچه
   */
  _showHistory() {
    const history = queryService.getHistory(50);

    if (history.length === 0) {
      notificationService.info('تاریخچه‌ای وجود ندارد');
      return;
    }

    const items = history.map(h => ({
      label: StringUtils.truncate(h.sql.replace(/\s+/g, ' '), 70),
      icon: h.success ? '✓' : '✕',
      onClick: () => {
        this.editor.setValue(h.sql);
        this.editor.focus();
      }
    }));

    items.push('separator');
    items.push({
      label: 'پاک کردن تاریخچه',
      icon: '🗑️',
      danger: true,
      onClick: () => {
        queryService.clearHistory();
        notificationService.success('تاریخچه پاک شد');
      }
    });

    const rect = this.elements.historyBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
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
    if (this.editor) this.editor.destroy();
    if (this.resultsTable) this.resultsTable.destroy();
    this.listeners.clear();
    this.element?.remove();
  }
}

window.QueryView = QueryView;