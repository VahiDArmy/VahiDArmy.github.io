/**
 * دیالوگ صادرات پیشرفته
 * تمام گزینه‌ها با UI کامل و پیش‌نمایش زنده
 */
class AdvancedExportDialog {
  constructor(options = {}) {
    this.options = {
      preselectedTables: [],
      preselectedTable: null,
      ...options
    };

    this.state = {
      tables: [],
      selectedTables: new Set(),
      outputMode: 'per-group',
      groupBy: [],
      mergeRules: [],
      filenameTemplate: '{_index}',
      format: 'json',
      prettyPrint: true,
      packAsZip: true,
      zipName: ''
    };

    this.element = null;
    this.elements = {};
    this.listeners = new Map();
    this.previewData = null;

    this._refreshPreviewDebounced = debounce(() => this._refreshPreview(), 400);
  }

  /**
   * باز کردن دیالوگ
   */
  async open() {
    this.state.tables = stateManager.get('database.tables') || [];

    if (this.options.preselectedTable) {
      this.state.selectedTables.add(this.options.preselectedTable);
    } else if (this.options.preselectedTables && this.options.preselectedTables.length > 0) {
      this.options.preselectedTables.forEach(t => this.state.selectedTables.add(t));
    } else if (this.state.tables.length > 0) {
      this.state.selectedTables.add(this.state.tables[0].name);
    }

    // بسته‌بندی ZIP به صورت پیش‌فرض اگر JSZip موجود است
    this.state.packAsZip = typeof JSZip !== 'undefined';

    const content = this._renderContent();

    return modalService.open(content, {
      title: 'صادرات پیشرفته',
      size: 'xl',
      footer: `
        <button class="btn btn-secondary" data-action="cancel">انصراف</button>
        <button class="btn btn-primary" data-action="export">
          <span class="icon">📤</span>
          <span>صادرات</span>
        </button>
      `,
      onOpen: (wrapper, modal) => {
        this.element = wrapper;
        this._cacheElements(wrapper);
        this._bindEvents(wrapper, modal);
        this._renderSelectedTables();
        this._renderOutputMode();
        this._renderGroupBy();
        this._renderMergeRules();
        this._renderFormats();
        this._syncZipUI();
        this._refreshPreview();
      }
    });
  }

  /**
   * رندر محتوای دیالوگ
   */
  _renderContent() {
    return `
      <div class="advanced-export">

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۱. انتخاب جداول</h4>
            <div class="advanced-export-section-actions">
              <button type="button" class="btn btn-xs btn-ghost" data-role="select-all-tables">انتخاب همه</button>
              <button type="button" class="btn btn-xs btn-ghost" data-role="deselect-all-tables">لغو انتخاب</button>
            </div>
          </div>
          <div class="advanced-export-tables" data-role="tables-list"></div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۲. حالت خروجی</h4>
          </div>
          <div class="advanced-export-mode">
            <label class="advanced-export-mode-item">
              <input type="radio" name="adv-output-mode" value="single" />
              <div class="advanced-export-mode-content">
                <strong>تک فایل</strong>
                <small>تمام ردیف‌ها در یک فایل</small>
              </div>
            </label>
            <label class="advanced-export-mode-item">
              <input type="radio" name="adv-output-mode" value="per-group" />
              <div class="advanced-export-mode-content">
                <strong>چند فایل</strong>
                <small>هر گروه یک فایل جداگانه</small>
              </div>
            </label>
          </div>
        </div>

        <div class="advanced-export-section" data-role="group-by-section">
          <div class="advanced-export-section-header">
            <h4>۳. گروه‌بندی</h4>
            <small class="advanced-export-hint">
              ردیف‌هایی که در ستون‌های انتخابی مقدار یکسان دارند، یک گروه را تشکیل می‌دهند
            </small>
          </div>
          <div class="advanced-export-columns" data-role="group-by-columns"></div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۴. ادغام ستون‌ها <span class="advanced-export-optional">(اختیاری)</span></h4>
            <button type="button" class="btn btn-xs btn-secondary" data-role="add-merge-rule">
              <span class="icon">+</span>
              <span>افزودن قانون</span>
            </button>
          </div>
          <div class="advanced-export-merge-rules" data-role="merge-rules"></div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۵. قالب نام فایل</h4>
          </div>
          <div class="form-group">
            <input
              type="text"
              class="form-control"
              data-role="filename-template"
              value="${StringUtils.escapeHtml(this.state.filenameTemplate)}"
              placeholder="مثال: {_index} یا {نام‌ستون}_{_index}"
              dir="ltr"
            />
            <small class="form-helper">
              با <code dir="ltr">{نام‌ستون}</code> مقدار آن ستون از گروه درج می‌شود.
              با <code dir="ltr">{_index}</code> شماره گروه درج می‌شود.
            </small>
          </div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۶. فرمت فایل‌ها</h4>
          </div>
          <div class="advanced-export-formats" data-role="formats"></div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۷. بسته‌بندی</h4>
          </div>
          <label class="checkbox">
            <input type="checkbox" data-role="pack-as-zip" />
            <span>بسته‌بندی در فایل ZIP (توصیه می‌شود برای چند فایل)</span>
          </label>
          <div class="form-group" data-role="zip-name-group" style="margin-top: 12px;">
            <label>نام فایل ZIP (اختیاری)</label>
            <input
              type="text"
              class="form-control"
              data-role="zip-name"
              placeholder="خالی = تولید خودکار"
              dir="ltr"
            />
          </div>
        </div>

        <div class="advanced-export-section">
          <div class="advanced-export-section-header">
            <h4>۸. پیش‌نمایش</h4>
            <button type="button" class="btn btn-xs btn-ghost" data-role="refresh-preview">
              <span class="icon">🔄</span>
              <span>به‌روزرسانی</span>
            </button>
          </div>
          <div class="advanced-export-preview" data-role="preview">
            <div class="advanced-export-preview-empty">در حال بارگذاری...</div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements(wrapper) {
    const q = (sel) => wrapper.querySelector(sel);

    this.elements = {
      tablesList: q('[data-role="tables-list"]'),
      selectAllTables: q('[data-role="select-all-tables"]'),
      deselectAllTables: q('[data-role="deselect-all-tables"]'),
      outputModeRadios: wrapper.querySelectorAll('input[name="adv-output-mode"]'),
      groupBySection: q('[data-role="group-by-section"]'),
      groupByColumns: q('[data-role="group-by-columns"]'),
      addMergeRuleBtn: q('[data-role="add-merge-rule"]'),
      mergeRules: q('[data-role="merge-rules"]'),
      filenameTemplate: q('[data-role="filename-template"]'),
      formats: q('[data-role="formats"]'),
      packAsZip: q('[data-role="pack-as-zip"]'),
      zipNameGroup: q('[data-role="zip-name-group"]'),
      zipName: q('[data-role="zip-name"]'),
      preview: q('[data-role="preview"]'),
      refreshPreview: q('[data-role="refresh-preview"]')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents(wrapper, modal) {
    // جداول: انتخاب همه / لغو همه
    this.elements.selectAllTables?.addEventListener('click', () => {
      this.state.selectedTables.clear();
      this.state.tables.forEach(t => this.state.selectedTables.add(t.name));
      this._renderSelectedTables();
      this._renderGroupBy();
      this._refreshPreview();
    });

    this.elements.deselectAllTables?.addEventListener('click', () => {
      this.state.selectedTables.clear();
      this._renderSelectedTables();
      this._renderGroupBy();
      this._refreshPreview();
    });

    // حالت خروجی
    this.elements.outputModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.state.outputMode = e.target.value;
        this._updateGroupByVisibility();
        this._refreshPreview();
      });
    });

    // افزودن قانون ادغام
    this.elements.addMergeRuleBtn?.addEventListener('click', () => {
      this._addMergeRule();
    });

    // قالب نام فایل
    this.elements.filenameTemplate?.addEventListener('input', (e) => {
      this.state.filenameTemplate = e.target.value;
      this._refreshPreviewDebounced();
    });

    // بسته‌بندی ZIP
    this.elements.packAsZip?.addEventListener('change', (e) => {
      this.state.packAsZip = e.target.checked;
      this._syncZipUI();
    });

    // نام ZIP
    this.elements.zipName?.addEventListener('input', (e) => {
      this.state.zipName = e.target.value;
    });

    // به‌روزرسانی دستی پیش‌نمایش
    this.elements.refreshPreview?.addEventListener('click', () => {
      this._refreshPreview();
    });

    // دکمه‌های فوتر
    wrapper.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      modalService.close(modal.id);
    });

    wrapper.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      this._performExport(modal);
    });
  }

  /**
   * همگام‌سازی UI مربوط به ZIP
   */
  _syncZipUI() {
    if (this.elements.packAsZip) {
      this.elements.packAsZip.checked = this.state.packAsZip;
      this.elements.packAsZip.disabled = !advancedExportService.isZipAvailable();
    }

    if (this.elements.zipNameGroup) {
      this.elements.zipNameGroup.style.display =
        (this.state.packAsZip && advancedExportService.isZipAvailable()) ? '' : 'none';
    }

    // اگر JSZip نیست، پیام دهیم
    if (!advancedExportService.isZipAvailable()) {
      const warning = this.element.querySelector('.advanced-export-zip-warning');
      if (!warning) {
        const parent = this.elements.zipNameGroup?.parentElement;
        if (parent) {
          const div = document.createElement('div');
          div.className = 'advanced-export-zip-warning';
          div.textContent = '⚠️ کتابخانه JSZip بارگذاری نشده — فایل‌ها به صورت جداگانه دانلود می‌شوند';
          parent.insertBefore(div, parent.firstChild);
        }
      }
    }
  }

  /**
   * رندر لیست جداول
   */
  _renderSelectedTables() {
    if (!this.elements.tablesList) return;

    if (this.state.tables.length === 0) {
      this.elements.tablesList.innerHTML = `<div class="advanced-export-empty">جدولی موجود نیست</div>`;
      return;
    }

    this.elements.tablesList.innerHTML = this.state.tables.map(t => `
      <label class="advanced-export-table-item ${this.state.selectedTables.has(t.name) ? 'selected' : ''}">
        <input
          type="checkbox"
          value="${StringUtils.escapeHtml(t.name)}"
          ${this.state.selectedTables.has(t.name) ? 'checked' : ''}
        />
        <span class="advanced-export-table-icon">${t.type === 'view' ? '👁️' : '📋'}</span>
        <span class="advanced-export-table-name">${StringUtils.escapeHtml(t.name)}</span>
      </label>
    `).join('');

    this.elements.tablesList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const name = e.target.value;
        if (e.target.checked) {
          this.state.selectedTables.add(name);
        } else {
          this.state.selectedTables.delete(name);
        }
        e.target.closest('.advanced-export-table-item')?.classList.toggle('selected', e.target.checked);
        this._renderGroupBy();
        this._refreshPreview();
      });
    });
  }

  /**
   * رندر حالت خروجی
   */
  _renderOutputMode() {
    this.elements.outputModeRadios.forEach(radio => {
      radio.checked = radio.value === this.state.outputMode;
    });
    this._updateGroupByVisibility();
  }

  /**
   * مخفی/نمایش گروه‌بندی بر اساس حالت
   */
  _updateGroupByVisibility() {
    if (!this.elements.groupBySection) return;
    this.elements.groupBySection.style.display =
      this.state.outputMode === 'per-group' ? '' : 'none';
  }

  /**
   * جدول اول انتخاب‌شده
   */
  _getFirstSelectedTable() {
    return Array.from(this.state.selectedTables)[0] || null;
  }

  /**
   * رندر ستون‌های گروه‌بندی
   */
  _renderGroupBy() {
    if (!this.elements.groupByColumns) return;

    const tableName = this._getFirstSelectedTable();

    if (!tableName) {
      this.elements.groupByColumns.innerHTML = `<div class="advanced-export-empty">جدولی انتخاب نشده است</div>`;
      return;
    }

    const info = databaseService.getTableInfo(tableName);

    this.elements.groupByColumns.innerHTML = info.map(col => `
      <label class="advanced-export-column-item ${this.state.groupBy.includes(col.name) ? 'selected' : ''}">
        <input
          type="checkbox"
          value="${StringUtils.escapeHtml(col.name)}"
          ${this.state.groupBy.includes(col.name) ? 'checked' : ''}
        />
        <span class="advanced-export-column-name">${StringUtils.escapeHtml(col.name)}</span>
        <span class="advanced-export-column-type">${StringUtils.escapeHtml(col.type)}</span>
      </label>
    `).join('');

    this.elements.groupByColumns.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const name = e.target.value;
        if (e.target.checked) {
          if (!this.state.groupBy.includes(name)) this.state.groupBy.push(name);
        } else {
          this.state.groupBy = this.state.groupBy.filter(c => c !== name);
        }
        e.target.closest('.advanced-export-column-item')?.classList.toggle('selected', e.target.checked);
        this._refreshPreview();
      });
    });
  }

  /**
   * افزودن قانون ادغام
   */
  _addMergeRule() {
    this.state.mergeRules.push({
      target: '',
      sources: [],
      mode: 'concat',
      separator: ' ',
      template: '',
      removeSources: true
    });
    this._renderMergeRules();
  }

  /**
   * حذف قانون ادغام
   */
  _removeMergeRule(index) {
    this.state.mergeRules.splice(index, 1);
    this._renderMergeRules();
    this._refreshPreview();
  }

  /**
   * رندر قوانین ادغام
   */
  _renderMergeRules() {
    if (!this.elements.mergeRules) return;

    if (this.state.mergeRules.length === 0) {
      this.elements.mergeRules.innerHTML = `<div class="advanced-export-empty">قانونی تعریف نشده است</div>`;
      return;
    }

    const tableName = this._getFirstSelectedTable();
    const columns = tableName ? databaseService.getTableInfo(tableName) : [];

    this.elements.mergeRules.innerHTML = this.state.mergeRules.map((rule, i) => `
      <div class="advanced-export-merge-rule" data-rule-index="${i}">
        <div class="advanced-export-merge-header">
          <span class="advanced-export-merge-num">قانون ${StringUtils.englishToPersianDigits(i + 1)}</span>
          <button
            type="button"
            class="btn btn-xs btn-ghost advanced-export-merge-remove"
            data-role="remove-rule"
            data-rule-index="${i}"
            title="حذف قانون"
          >✕</button>
        </div>

        <div class="advanced-export-merge-body">
          <div class="form-group">
            <label>ستون‌های منبع (چندتایی)</label>
            <div class="advanced-export-sources">
              ${columns.map(col => `
                <label class="checkbox">
                  <input
                    type="checkbox"
                    data-role="source"
                    data-rule-index="${i}"
                    value="${StringUtils.escapeHtml(col.name)}"
                    ${rule.sources.includes(col.name) ? 'checked' : ''}
                  />
                  <span>${StringUtils.escapeHtml(col.name)}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="advanced-export-merge-row">
            <div class="form-group">
              <label>نام ستون مقصد</label>
              <input
                type="text"
                class="form-control"
                data-role="target"
                data-rule-index="${i}"
                value="${StringUtils.escapeHtml(rule.target)}"
                placeholder="مثال: full_name"
                dir="ltr"
              />
            </div>

            <div class="form-group">
              <label>حالت ادغام</label>
              <select class="form-control" data-role="mode" data-rule-index="${i}">
                <option value="concat" ${rule.mode === 'concat' ? 'selected' : ''}>الحاق (رشته)</option>
                <option value="array" ${rule.mode === 'array' ? 'selected' : ''}>آرایه</option>
                <option value="object" ${rule.mode === 'object' ? 'selected' : ''}>شیء (کلید: مقدار)</option>
                <option value="template" ${rule.mode === 'template' ? 'selected' : ''}>قالب</option>
              </select>
            </div>
          </div>

          <div class="form-group" data-role="sep-row" style="${rule.mode === 'concat' ? '' : 'display:none'}">
            <label>جداکننده</label>
            <input
              type="text"
              class="form-control"
              data-role="separator"
              data-rule-index="${i}"
              value="${StringUtils.escapeHtml(rule.separator)}"
              placeholder="فاصله"
              dir="ltr"
            />
          </div>

          <div class="form-group" data-role="tpl-row" style="${rule.mode === 'template' ? '' : 'display:none'}">
            <label>قالب</label>
            <input
              type="text"
              class="form-control"
              data-role="template"
              data-rule-index="${i}"
              value="${StringUtils.escapeHtml(rule.template)}"
              placeholder="{first} {last}"
              dir="ltr"
            />
          </div>

          <div class="form-group">
            <label class="checkbox">
              <input
                type="checkbox"
                data-role="remove-sources"
                data-rule-index="${i}"
                ${rule.removeSources ? 'checked' : ''}
              />
              <span>حذف ستون‌های منبع از خروجی</span>
            </label>
          </div>
        </div>
      </div>
    `).join('');

    this._bindMergeRuleEvents();
  }

  /**
   * رویدادهای قوانین ادغام
   */
  _bindMergeRuleEvents() {
    const root = this.elements.mergeRules;

    root.querySelectorAll('[data-role="remove-rule"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._removeMergeRule(parseInt(btn.dataset.ruleIndex));
      });
    });

    root.querySelectorAll('[data-role="source"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        const val = e.target.value;

        if (e.target.checked) {
          if (!this.state.mergeRules[i].sources.includes(val)) {
            this.state.mergeRules[i].sources.push(val);
          }
        } else {
          this.state.mergeRules[i].sources =
            this.state.mergeRules[i].sources.filter(s => s !== val);
        }
        this._refreshPreviewDebounced();
      });
    });

    root.querySelectorAll('[data-role="target"]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        this.state.mergeRules[i].target = e.target.value;
        this._refreshPreviewDebounced();
      });
    });

    root.querySelectorAll('[data-role="mode"]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        this.state.mergeRules[i].mode = e.target.value;

        const ruleEl = e.target.closest('.advanced-export-merge-rule');
        if (ruleEl) {
          const sepRow = ruleEl.querySelector('[data-role="sep-row"]');
          const tplRow = ruleEl.querySelector('[data-role="tpl-row"]');
          if (sepRow) sepRow.style.display = e.target.value === 'concat' ? '' : 'none';
          if (tplRow) tplRow.style.display = e.target.value === 'template' ? '' : 'none';
        }
        this._refreshPreviewDebounced();
      });
    });

    root.querySelectorAll('[data-role="separator"]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        this.state.mergeRules[i].separator = e.target.value;
        this._refreshPreviewDebounced();
      });
    });

    root.querySelectorAll('[data-role="template"]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        this.state.mergeRules[i].template = e.target.value;
        this._refreshPreviewDebounced();
      });
    });

    root.querySelectorAll('[data-role="remove-sources"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.ruleIndex);
        this.state.mergeRules[i].removeSources = e.target.checked;
        this._refreshPreviewDebounced();
      });
    });
  }

  /**
   * رندر فرمت‌ها
   */
  _renderFormats() {
    if (!this.elements.formats) return;

    const formats = (AppConfig.export.formats || []).filter(f => f.id !== 'sqlite');

    this.elements.formats.innerHTML = formats.map(f => `
      <label class="advanced-export-format ${this.state.format === f.id ? 'active' : ''}">
        <input
          type="radio"
          name="adv-format"
          value="${f.id}"
          ${this.state.format === f.id ? 'checked' : ''}
        />
        <span class="advanced-export-format-label">${f.label}</span>
        <span class="advanced-export-format-ext" dir="ltr">${f.extension}</span>
      </label>
    `).join('');

    this.elements.formats.querySelectorAll('input[name="adv-format"]').forEach(r => {
      r.addEventListener('change', (e) => {
        this.state.format = e.target.value;
        this.elements.formats.querySelectorAll('.advanced-export-format').forEach(el => {
          el.classList.toggle('active', el.querySelector('input').checked);
        });
        this._refreshPreviewDebounced();
      });
    });
  }

  /**
   * به‌روزرسانی پیش‌نمایش
   */
  async _refreshPreview() {
    if (!this.elements.preview) return;

    if (this.state.selectedTables.size === 0) {
      this.elements.preview.innerHTML =
        `<div class="advanced-export-preview-empty">جدولی انتخاب نشده است</div>`;
      return;
    }

    if (this.state.outputMode === 'per-group' && this.state.groupBy.length === 0) {
      this.elements.preview.innerHTML =
        `<div class="advanced-export-preview-empty">لطفاً حداقل یک ستون برای گروه‌بندی انتخاب کنید</div>`;
      return;
    }

    this.elements.preview.innerHTML =
      `<div class="advanced-export-preview-loading"><div class="loading-spinner"></div></div>`;

    try {
      const preview = await advancedExportService.preview(
        Array.from(this.state.selectedTables),
        {
          groupBy: this.state.groupBy,
          mergeRules: this.state.mergeRules,
          filenameTemplate: this.state.filenameTemplate,
          format: this.state.format,
          outputMode: this.state.outputMode
        }
      );

      this.previewData = preview;
      this._renderPreview(preview);
    } catch (error) {
      this.elements.preview.innerHTML =
        `<div class="advanced-export-preview-error">خطا: ${StringUtils.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * رندر پیش‌نمایش
   */
  _renderPreview(preview) {
    const totalFiles = preview.reduce((sum, p) => sum + (p.files?.length || 0), 0);
    const totalRows = preview.reduce((sum, p) => sum + (p.totalRows || 0), 0);

    let html = `
      <div class="advanced-export-preview-summary">
        <div class="advanced-export-stat">
          <span class="advanced-export-stat-value">${StringUtils.englishToPersianDigits(totalFiles)}</span>
          <span class="advanced-export-stat-label">فایل</span>
        </div>
        <div class="advanced-export-stat">
          <span class="advanced-export-stat-value">${StringUtils.englishToPersianDigits(totalRows)}</span>
          <span class="advanced-export-stat-label">ردیف</span>
        </div>
        <div class="advanced-export-stat">
          <span class="advanced-export-stat-value">${StringUtils.englishToPersianDigits(preview.length)}</span>
          <span class="advanced-export-stat-label">جدول</span>
        </div>
      </div>
    `;

    preview.forEach(p => {
      html += `
        <div class="advanced-export-preview-table">
          <div class="advanced-export-preview-table-header">
            <span class="advanced-export-preview-table-name">${StringUtils.escapeHtml(p.tableName)}</span>
            <span class="advanced-export-preview-table-meta">
              ${StringUtils.englishToPersianDigits((p.files || []).length)} فایل
            </span>
          </div>
          <div class="advanced-export-preview-files">
      `;

      const files = p.files || [];

      files.slice(0, 30).forEach(f => {
        html += `
          <div class="advanced-export-preview-file">
            <span class="advanced-export-preview-file-icon">📄</span>
            <span class="advanced-export-preview-file-name" dir="ltr">${StringUtils.escapeHtml(f.name)}</span>
            <span class="advanced-export-preview-file-rows">
              ${StringUtils.englishToPersianDigits(f.rowCount || 0)} ردیف
            </span>
          </div>
        `;
      });

      if (files.length > 30) {
        html += `
          <div class="advanced-export-preview-more">
            و ${StringUtils.englishToPersianDigits(files.length - 30)} فایل دیگر...
          </div>
        `;
      }

      if (p.error) {
        html += `<div class="advanced-export-preview-error">خطا: ${StringUtils.escapeHtml(p.error)}</div>`;
      }

      html += `</div></div>`;
    });

    this.elements.preview.innerHTML = html;
  }

  /**
   * انجام صادرات
   */
  async _performExport(modal) {
    if (this.state.selectedTables.size === 0) {
      notificationService.warning('حداقل یک جدول انتخاب کنید');
      return;
    }

    if (this.state.outputMode === 'per-group' && this.state.groupBy.length === 0) {
      notificationService.warning('حداقل یک ستون برای گروه‌بندی انتخاب کنید');
      return;
    }

    const exportBtn = this.element.querySelector('[data-action="export"]');
    const originalHtml = exportBtn ? exportBtn.innerHTML : null;

    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<div class="loading-spinner-small"></div> در حال صادرات...';
    }

    const progress = notificationService.progress('در حال تولید فایل‌ها...', { duration: 0 });

    try {
      progress.update(30, 'در حال پردازش ردیف‌ها...');

      const files = await advancedExportService.generateFiles(
        Array.from(this.state.selectedTables),
        {
          groupBy: this.state.groupBy,
          mergeRules: this.state.mergeRules,
          filenameTemplate: this.state.filenameTemplate,
          format: this.state.format,
          outputMode: this.state.outputMode,
          prettyPrint: this.state.prettyPrint
        }
      );

      if (files.length === 0) {
        throw new Error('هیچ فایلی تولید نشد');
      }

      progress.update(80, 'در حال آماده‌سازی دانلود...');

      const result = await advancedExportService.download(files, {
        packAsZip: this.state.packAsZip,
        zipName: this.state.zipName || undefined
      });

      progress.complete(
        result.packed
          ? `${StringUtils.englishToPersianDigits(files.length)} فایل در ZIP ذخیره شد`
          : `${StringUtils.englishToPersianDigits(files.length)} فایل دانلود شد`
      );

      modalService.close(modal.id, {
        success: true,
        files: files.length,
        packed: result.packed,
        zipName: result.zipName
      });
    } catch (error) {
      progress.dismiss();
      console.error('خطا در صادرات پیشرفته:', error);
      notificationService.error(`خطا: ${error.message}`);

      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHtml;
      }
    }
  }
}

window.AdvancedExportDialog = AdvancedExportDialog;