/**
 * کامپوننت جدول داده
 * جدول داده جامع با تمام قابلیت‌ها
 */
class DataTable {
  constructor(options = {}) {
    this.options = {
      columns: [],
      data: [],
      pageSize: 50,
      page: 1,
      total: 0,
      sortable: true,
      filterable: true,
      selectable: true,
      multiSelect: true,
      editable: false,
      resizable: true,
      reorderable: true,
      showRowNumbers: true,
      showColumnTypes: true,
      stickyHeader: true,
      virtualScroll: false,
      virtualBuffer: 10,
      rowHeight: 48,
      contextMenu: true,
      onRowClick: null,
      onRowDoubleClick: null,
      onCellEdit: null,
      onSelectionChange: null,
      onSortChange: null,
      onFilterChange: null,
      onPageChange: null,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.selectedRows = new Set();
    this.selectedColumns = new Set();
    this.currentSort = { column: null, direction: 'asc' };
    this.currentFilters = [];
    this.currentPage = this.options.page;
    this.currentPageSize = this.options.pageSize;
    this.visibleColumns = new Set();
    this.columnWidths = new Map();
    this.frozenColumns = new Set();
    this.editingCell = null;
    this.filterRowVisible = false;
    this.virtualScrollTop = 0;
    this.listeners = new Map();
    this._renderScheduled = false;
    this._rafId = null;

    this._initColumns();
    this._bindHandlers();
  }

  /**
   * راه‌اندازی ستون‌ها
   */
  _initColumns() {
    this.options.columns.forEach(col => {
      if (col.visible !== false) {
        this.visibleColumns.add(col.name);
      }
      if (col.width) {
        this.columnWidths.set(col.name, col.width);
      }
      if (col.frozen) {
        this.frozenColumns.add(col.name);
      }
    });
  }

  /**
   * اتصال هندلرها
   */
  _bindHandlers() {
    this._boundKeydown = this._handleKeydown.bind(this);
    this._boundDocumentClick = this._handleDocumentClick.bind(this);
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'data-table-component',
      attrs: { role: 'region', 'aria-label': 'جدول داده' }
    });

    this.element.innerHTML = `
      ${this._renderToolbar()}
      ${this._renderTableContainer()}
      ${this._renderPagination()}
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderTable();
    this._updateToolbar();

    return this.element;
  }

  /**
   * نوار ابزار
   */
  _renderToolbar() {
    return `
      <div class="data-table-toolbar">
        <div class="data-table-toolbar-left">
          <div class="data-table-search">
            <span class="data-table-search-icon">🔍</span>
            <input
              type="search"
              class="data-table-search-input"
              placeholder="جستجو در جدول..."
              aria-label="جستجو"
            />
            <button class="data-table-search-clear" hidden aria-label="پاک کردن">✕</button>
          </div>

          <button class="btn btn-sm btn-ghost data-table-filter-toggle" title="نمایش/مخفی فیلترها">
            <span class="icon">🎯</span>
            <span>فیلترها</span>
            <span class="data-table-filter-badge" hidden>0</span>
          </button>
        </div>

        <div class="data-table-toolbar-center">
          <span class="data-table-info">
            <span class="data-table-info-total">0</span> ردیف
            ${this.selectedRows.size > 0 ? `<span class="data-table-info-selected">(${StringUtils.englishToPersianDigits(this.selectedRows.size)} انتخاب شده)</span>` : ''}
          </span>
        </div>

        <div class="data-table-toolbar-right">
          ${this.selectedRows.size > 0 ? this._renderSelectionActions() : ''}

          <button class="btn btn-sm btn-ghost data-table-columns-btn" title="ستون‌ها">
            <span class="icon">📊</span>
          </button>

          <button class="btn btn-sm btn-ghost data-table-refresh-btn" title="بازنشانی (F5)">
            <span class="icon">🔄</span>
          </button>

          <button class="btn btn-sm btn-ghost data-table-export-btn" title="صادرات">
            <span class="icon">📤</span>
          </button>

          <button class="btn btn-sm btn-ghost data-table-settings-btn" title="تنظیمات">
            <span class="icon">⚙️</span>
          </button>
        </div>
      </div>

      <div class="data-table-filter-row" hidden>
        <div class="data-table-filter-row-inner"></div>
      </div>
    `;
  }

  /**
   * اکشن‌های انتخاب
   */
  _renderSelectionActions() {
    return `
      <div class="data-table-selection-actions">
        <span class="data-table-selection-count">
          ${StringUtils.englishToPersianDigits(this.selectedRows.size)} مورد
        </span>
        <button class="btn btn-sm btn-ghost" data-action="copy-selected" title="کپی">
          <span class="icon">📋</span>
        </button>
        <button class="btn btn-sm btn-ghost" data-action="export-selected" title="صادرات">
          <span class="icon">📤</span>
        </button>
        <button class="btn btn-sm btn-ghost" data-action="duplicate-selected" title="کپی ردیف‌ها">
          <span class="icon">📑</span>
        </button>
        <button class="btn btn-sm btn-ghost btn-danger" data-action="delete-selected" title="حذف">
          <span class="icon">🗑️</span>
        </button>
        <button class="btn btn-sm btn-ghost" data-action="clear-selection" title="لغو انتخاب">
          <span class="icon">✕</span>
        </button>
      </div>
    `;
  }

  /**
   * ظرف جدول
   */
  _renderTableContainer() {
    return `
      <div class="data-table-container ${this.options.virtualScroll ? 'virtual' : ''}">
        <div class="data-table-header-wrapper">
          <table class="data-table-header-table">
            <thead>
              <tr class="data-table-header-row"></tr>
            </thead>
          </table>
        </div>
        <div class="data-table-body-wrapper">
          <table class="data-table-body-table">
            <tbody class="data-table-body"></tbody>
          </table>
        </div>
        <div class="data-table-loading" hidden>
          <div class="loading-spinner"></div>
          <div class="loading-text">در حال بارگذاری...</div>
        </div>
        <div class="data-table-empty" hidden>
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-title">داده‌ای برای نمایش وجود ندارد</div>
            <div class="empty-state-description">جدول خالی است یا فیلترها نتیجه‌ای برنگردانده‌اند</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * صفحه‌بندی
   */
  _renderPagination() {
    return `
      <div class="data-table-pagination">
        <div class="data-table-pagination-left">
          <label class="data-table-page-size">
            <span>نمایش</span>
            <select class="data-table-page-size-select">
              ${AppConfig.database.pageSizeOptions.map(size =>
                `<option value="${size}" ${size === this.currentPageSize ? 'selected' : ''}>${StringUtils.englishToPersianDigits(size)}</option>`
              ).join('')}
            </select>
            <span>ردیف در صفحه</span>
          </label>
        </div>

        <div class="data-table-pagination-center">
          <button class="data-table-page-btn" data-page="first" aria-label="صفحه اول">«</button>
          <button class="data-table-page-btn" data-page="prev" aria-label="قبلی">‹</button>
          <div class="data-table-page-numbers"></div>
          <button class="data-table-page-btn" data-page="next" aria-label="بعدی">›</button>
          <button class="data-table-page-btn" data-page="last" aria-label="صفحه آخر">»</button>
        </div>

        <div class="data-table-pagination-right">
          <span class="data-table-page-info"></span>
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
      searchInput: q('.data-table-search-input'),
      searchClear: q('.data-table-search-clear'),
      filterToggle: q('.data-table-filter-toggle'),
      filterBadge: q('.data-table-filter-badge'),
      filterRow: q('.data-table-filter-row'),
      filterRowInner: q('.data-table-filter-row-inner'),
      columnsBtn: q('.data-table-columns-btn'),
      refreshBtn: q('.data-table-refresh-btn'),
      exportBtn: q('.data-table-export-btn'),
      settingsBtn: q('.data-table-settings-btn'),
      container: q('.data-table-container'),
      headerWrapper: q('.data-table-header-wrapper'),
      bodyWrapper: q('.data-table-body-wrapper'),
      headerRow: q('.data-table-header-row'),
      body: q('.data-table-body'),
      loading: q('.data-table-loading'),
      empty: q('.data-table-empty'),
      infoTotal: q('.data-table-info-total'),
      infoSelected: q('.data-table-info-selected'),
      pageSizeSelect: q('.data-table-page-size-select'),
      pageNumbers: q('.data-table-page-numbers'),
      pageInfo: q('.data-table-page-info')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    // جستجو
    if (this.elements.searchInput) {
      const debouncedSearch = debounce((value) => {
        this._handleSearch(value);
      }, 300);

      this.elements.searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        this.elements.searchClear.hidden = !value;
        debouncedSearch(value);
      });
    }

    this.elements.searchClear?.addEventListener('click', () => {
      this.elements.searchInput.value = '';
      this.elements.searchClear.hidden = true;
      this._handleSearch('');
    });

    // فیلترها
    this.elements.filterToggle?.addEventListener('click', () => {
      this._toggleFilterRow();
    });

    // اکشن‌ها
    this.element.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        this._handleAction(actionBtn.dataset.action);
      }

      const pageBtn = e.target.closest('.data-table-page-btn[data-page]');
      if (pageBtn) {
        this._handlePageNavigation(pageBtn.dataset.page);
      }

      const pageNum = e.target.closest('.data-table-page-number');
      if (pageNum) {
        this._goToPage(parseInt(pageNum.dataset.page));
      }
    });

    // تغییر اندازه صفحه
    this.elements.pageSizeSelect?.addEventListener('change', (e) => {
      this.currentPageSize = parseInt(e.target.value);
      this.currentPage = 1;
      this._emitPageChange();
    });

    // دکمه‌ها
    this.elements.refreshBtn?.addEventListener('click', () => this.refresh());
    this.elements.columnsBtn?.addEventListener('click', () => this._showColumnsMenu());
    this.elements.exportBtn?.addEventListener('click', () => this._showExportMenu());
    this.elements.settingsBtn?.addEventListener('click', () => this._showSettingsMenu());

    // دابل کلیک روی ردیف
    this.elements.body?.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.data-table-row');
      if (row && this.options.onRowDoubleClick) {
        const rowIndex = parseInt(row.dataset.rowIndex);
        this.options.onRowDoubleClick(this.options.data[rowIndex], rowIndex);
      }
    });

    // کلیک روی سلول
    this.elements.body?.addEventListener('click', (e) => {
      const row = e.target.closest('.data-table-row');
      if (!row) return;

      const rowIndex = parseInt(row.dataset.rowIndex);
      const cell = e.target.closest('.data-table-cell');

      if (this.options.onRowClick) {
        this.options.onRowClick(this.options.data[rowIndex], rowIndex, cell);
      }
    });

    // راست‌کلیک
    if (this.options.contextMenu) {
      this.elements.body?.addEventListener('contextmenu', (e) => {
        const row = e.target.closest('.data-table-row');
        const cell = e.target.closest('.data-table-cell');
        if (!row || !cell) return;

        e.preventDefault();
        const rowIndex = parseInt(row.dataset.rowIndex);
        const colName = cell.dataset.column;

        this._showContextMenu(e.clientX, e.clientY, rowIndex, colName);
      });

      this.elements.headerRow?.addEventListener('contextmenu', (e) => {
        const header = e.target.closest('.data-table-header-cell');
        if (!header) return;

        e.preventDefault();
        const colName = header.dataset.column;
        this._showHeaderContextMenu(e.clientX, e.clientY, colName);
      });
    }

    // انتخاب ردیف با کیبورد
    document.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('click', this._boundDocumentClick);

    // اسکرول مجازی
    if (this.options.virtualScroll && this.elements.bodyWrapper) {
      const throttledScroll = rafThrottle(() => {
        this.virtualScrollTop = this.elements.bodyWrapper.scrollTop;
        this._renderVirtualBody();
      });

      this.elements.bodyWrapper.addEventListener('scroll', throttledScroll);
    }
  }

  /**
   * هندلر کیبورد
   */
  _handleKeydown(e) {
    if (!this.element || !this.element.isConnected) return;
    if (!this.element.contains(document.activeElement) && !this.element.contains(e.target)) return;

    // Ctrl+A - انتخاب همه
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (document.activeElement?.classList.contains('data-table-cell')) {
        e.preventDefault();
        this.selectAll();
      }
    }

    // Escape - لغو انتخاب
    if (e.key === 'Escape') {
      if (this.selectedRows.size > 0) {
        this.clearSelection();
      }
    }

    // Ctrl+C - کپی
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const cell = document.activeElement?.closest?.('.data-table-cell');
      if (cell) {
        const value = cell.textContent;
        DomUtils.copyToClipboard(value);
        notificationService.success('کپی شد', { duration: 1500 });
      }
    }

    // F2 - ویرایش
    if (e.key === 'F2' && this.options.editable) {
      const cell = document.activeElement?.closest?.('.data-table-cell');
      if (cell) {
        e.preventDefault();
        this._startEditing(cell);
      }
    }

    // Enter - ذخیره ویرایش
    if (e.key === 'Enter' && this.editingCell) {
      e.preventDefault();
      this._commitEdit();
    }

    // Navigation با فلش‌ها
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const cell = document.activeElement?.closest?.('.data-table-cell');
      if (cell) {
        e.preventDefault();
        this._navigateCell(e.key, cell);
      }
    }
  }

  /**
   * ناوبری سلول‌ها
   */
  _navigateCell(direction, cell) {
    const row = cell.closest('.data-table-row');
    const rowIndex = parseInt(row.dataset.rowIndex);
    const colName = cell.dataset.column;

    let targetRow = rowIndex;
    let targetCol = colName;

    const visibleCols = Array.from(this.visibleColumns);
    const colIndex = visibleCols.indexOf(colName);

    switch (direction) {
      case 'ArrowUp':
        targetRow = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        targetRow = Math.min(this.options.data.length - 1, rowIndex + 1);
        break;
      case 'ArrowRight':
        targetCol = visibleCols[Math.min(visibleCols.length - 1, colIndex + 1)];
        break;
      case 'ArrowLeft':
        targetCol = visibleCols[Math.max(0, colIndex - 1)];
        break;
    }

    const targetCell = this.elements.body.querySelector(
      `[data-row-index="${targetRow}"] [data-column="${targetCol}"]`
    );

    if (targetCell) {
      targetCell.focus();
      targetCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /**
   * هندلر کلیک سراسری
   */
  _handleDocumentClick(e) {
    if (this.editingCell && !e.target.closest('.data-table-cell-editor')) {
      this._commitEdit();
    }
  }

  /**
   * رندر جدول
   */
  _renderTable() {
    this._renderHeader();
    this._renderBody();
    this._updatePagination();
    this._updateEmpty();
  }

  /**
   * رندر هدر
   */
  _renderHeader() {
    if (!this.elements.headerRow) return;

    let html = '';

    // ستون شماره ردیف
    if (this.options.showRowNumbers) {
      html += `
        <th class="data-table-header-cell data-table-header-rownum ${this.frozenColumns.has('__rownum__') ? 'frozen' : ''}"
            data-column="__rownum__"
            scope="col">
          ${this.options.selectable ? `
            <input
              type="checkbox"
              class="data-table-select-all"
              title="انتخاب همه"
              aria-label="انتخاب همه"
              ${this._isAllSelected() ? 'checked' : ''}
            />
          ` : '#'}
        </th>
      `;
    }

    // ستون‌ها
    this.options.columns.forEach(col => {
      if (!this.visibleColumns.has(col.name)) return;

      const width = this.columnWidths.get(col.name);
      const isSorted = this.currentSort.column === col.name;
      const isFrozen = this.frozenColumns.has(col.name);
      const sortIcon = isSorted
        ? (this.currentSort.direction === 'asc' ? '↑' : '↓')
        : '↕';

      html += `
        <th
          class="data-table-header-cell ${isSorted ? 'sorted' : ''} ${isFrozen ? 'frozen' : ''}"
          data-column="${StringUtils.escapeHtml(col.name)}"
          scope="col"
          ${this.options.sortable ? 'role="columnheader" tabindex="0"' : ''}
          ${width ? `style="width: ${width}px; min-width: ${width}px;"` : ''}
          title="${StringUtils.escapeHtml(col.title || col.name)}${col.type ? ` (${col.type})` : ''}"
        >
          <div class="data-table-header-content">
            <span class="data-table-header-label">
              ${StringUtils.escapeHtml(col.title || col.name)}
              ${this.options.showColumnTypes && col.type ? `<span class="data-table-header-type">${col.type}</span>` : ''}
            </span>
            ${this.options.sortable ? `
              <button class="data-table-sort-btn ${isSorted ? 'active' : ''}" aria-label="مرتب‌سازی">
                ${sortIcon}
              </button>
            ` : ''}
          </div>
          ${this.options.resizable ? `<div class="data-table-resize-handle" data-column="${col.name}"></div>` : ''}
        </th>
      `;
    });

    // ستون اکشن‌ها
    html += `<th class="data-table-header-cell data-table-header-actions" data-column="__actions__"></th>`;

    this.elements.headerRow.innerHTML = html;

    // رویدادهای هدر
    this._bindHeaderEvents();
  }

  /**
   * رویدادهای هدر
   */
  _bindHeaderEvents() {
    // انتخاب همه
    const selectAll = this.elements.headerRow.querySelector('.data-table-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectAll();
        } else {
          this.clearSelection();
        }
      });
    }

    // کلیک مرتب‌سازی
    this.elements.headerRow.querySelectorAll('.data-table-header-cell[data-column]').forEach(cell => {
      const colName = cell.dataset.column;
      if (colName.startsWith('__')) return;

      const sortBtn = cell.querySelector('.data-table-sort-btn');
      if (sortBtn) {
        sortBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleSort(colName);
        });
      }

      cell.addEventListener('dblclick', () => {
        this._toggleSort(colName);
      });
    });

    // تغییر اندازه ستون
    if (this.options.resizable) {
      this._bindColumnResize();
    }
  }

  /**
   * تغییر اندازه ستون
   */
  _bindColumnResize() {
    this.elements.headerRow.querySelectorAll('.data-table-resize-handle').forEach(handle => {
      let startX = 0;
      let startWidth = 0;
      let colName = '';

      const onMouseMove = (e) => {
        const diff = startX - e.clientX; // RTL
        const newWidth = Math.max(50, startWidth + diff);
        this._setColumnWidth(colName, newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        colName = handle.dataset.column;
        startX = e.clientX;
        const th = handle.closest('th');
        startWidth = th.offsetWidth;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  /**
   * تنظیم عرض ستون
   */
  _setColumnWidth(colName, width) {
    this.columnWidths.set(colName, width);

    const header = this.elements.headerRow.querySelector(`[data-column="${colName}"]`);
    if (header) {
      header.style.width = width + 'px';
      header.style.minWidth = width + 'px';
    }

    this.elements.body.querySelectorAll(`[data-column="${colName}"]`).forEach(cell => {
      cell.style.width = width + 'px';
      cell.style.minWidth = width + 'px';
    });
  }

  /**
   * رندر بدنه
   */
  _renderBody() {
    if (!this.elements.body) return;

    if (this.options.virtualScroll && this.options.data.length > this.currentPageSize * 2) {
      this._renderVirtualBody();
      return;
    }

    this.elements.body.innerHTML = this.options.data.map((row, i) =>
      this._renderRow(row, i)
    ).join('');

    this._bindBodyEvents();
  }

  /**
   * رندر مجازی
   */
  _renderVirtualBody() {
    const buffer = this.options.virtualBuffer;
    const rowHeight = this.options.rowHeight;
    const scrollTop = this.virtualScrollTop;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const visibleCount = Math.ceil(this.elements.bodyWrapper.clientHeight / rowHeight) + buffer * 2;
    const endIndex = Math.min(this.options.data.length, startIndex + visibleCount);

    const visibleRows = this.options.data.slice(startIndex, endIndex);

    const topPadding = startIndex * rowHeight;
    const bottomPadding = Math.max(0, (this.options.data.length - endIndex) * rowHeight);

    let html = '';
    if (topPadding > 0) {
      html += `<tr class="data-table-spacer" style="height: ${topPadding}px;"><td colspan="100"></td></tr>`;
    }

    html += visibleRows.map((row, i) => this._renderRow(row, startIndex + i)).join('');

    if (bottomPadding > 0) {
      html += `<tr class="data-table-spacer" style="height: ${bottomPadding}px;"><td colspan="100"></td></tr>`;
    }

    this.elements.body.innerHTML = html;
    this._bindBodyEvents();
  }

  /**
   * رندر ردیف
   */
  _renderRow(row, rowIndex) {
    const isSelected = this.selectedRows.has(rowIndex);
    const isEven = rowIndex % 2 === 0;

    let html = `<tr class="data-table-row ${isSelected ? 'selected' : ''} ${isEven ? 'even' : 'odd'}"
                    data-row-index="${rowIndex}"
                    ${this.options.selectable ? 'tabindex="0"' : ''}
                    role="row">`;

    // شماره ردیف / چک‌باکس
    if (this.options.showRowNumbers) {
      const isFrozen = this.frozenColumns.has('__rownum__');
      html += `
        <td class="data-table-cell data-table-cell-rownum ${isFrozen ? 'frozen' : ''}" data-column="__rownum__">
          ${this.options.selectable ? `
            <input
              type="checkbox"
              class="data-table-row-checkbox"
              ${isSelected ? 'checked' : ''}
              data-row-index="${rowIndex}"
              aria-label="انتخاب ردیف ${rowIndex + 1}"
            />
          ` : ''}
          <span class="data-table-rownum">${StringUtils.englishToPersianDigits(rowIndex + 1)}</span>
        </td>
      `;
    }

    // سلول‌های داده
    this.options.columns.forEach(col => {
      if (!this.visibleColumns.has(col.name)) return;

      const value = row[col.name];
      const displayValue = this._formatCellValue(value, col);
      const cellClass = this._getCellClass(value, col);
      const isFrozen = this.frozenColumns.has(col.name);
      const width = this.columnWidths.get(col.name);

      html += `
        <td
          class="data-table-cell ${cellClass} ${isFrozen ? 'frozen' : ''}"
          data-column="${StringUtils.escapeHtml(col.name)}"
          data-row-index="${rowIndex}"
          ${this.options.editable && col.editable !== false ? 'tabindex="0"' : ''}
          ${width ? `style="width: ${width}px; min-width: ${width}px;"` : ''}
          title="${StringUtils.escapeHtml(String(value ?? ''))}"
        >
          <div class="data-table-cell-content">
            ${displayValue}
          </div>
        </td>
      `;
    });

    // ستون اکشن‌ها
    html += `
      <td class="data-table-cell data-table-cell-actions" data-column="__actions__">
        <button class="data-table-row-menu-btn" title="عملیات" aria-label="عملیات">
          <span class="icon">⋮</span>
        </button>
      </td>
    `;

    html += '</tr>';
    return html;
  }

  /**
   * فرمت مقدار سلول
   */
  _formatCellValue(value, col) {
    if (value === null || value === undefined) {
      return '<span class="data-table-cell-null">NULL</span>';
    }

    const type = (col.type || '').toUpperCase();

    if (type.includes('INT') || type.includes('REAL') || type.includes('NUMERIC') || type.includes('DECIMAL')) {
      if (typeof value === 'number') {
        return StringUtils.englishToPersianDigits(NumberUtils.format(value));
      }
    }

    if (type.includes('BOOL')) {
      const bool = Boolean(value);
      return `<span class="data-table-bool ${bool ? 'true' : 'false'}">${bool ? '✓ بله' : '✕ خیر'}</span>`;
    }

    if (type.includes('DATE') || type.includes('TIME')) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return StringUtils.escapeHtml(DateUtils.formatPersian(date, 'YYYY/MM/DD HH:mm'));
      }
    }

    if (type.includes('BLOB')) {
      return `<span class="data-table-cell-blob">[BLOB ${StringUtils.englishToPersianDigits(value.length || 0)} بایت]</span>`;
    }

    const str = String(value);
    if (str.length > 200) {
      return `<span class="data-table-cell-truncated" title="${StringUtils.escapeHtml(str)}">${StringUtils.escapeHtml(str.substring(0, 200))}...</span>`;
    }

    return StringUtils.escapeHtml(str);
  }

  /**
   * کلاس سلول بر اساس مقدار
   */
  _getCellClass(value, col) {
    const classes = [];

    if (value === null || value === undefined) {
      classes.push('null');
    } else if (typeof value === 'number') {
      classes.push('numeric');
    } else if (typeof value === 'boolean') {
      classes.push('boolean');
    } else if (typeof value === 'string') {
      if (StringUtils.isUrl(value)) classes.push('url');
      else if (StringUtils.isEmail(value)) classes.push('email');
      else if (value.length > 50) classes.push('long');
    }

    if (col.primaryKey) classes.push('primary-key');
    if (col.notNull) classes.push('not-null');

    return classes.join(' ');
  }

  /**
   * رویدادهای بدنه
   */
  _bindBodyEvents() {
    // چک‌باکس‌ها
    this.elements.body.querySelectorAll('.data-table-row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const rowIndex = parseInt(cb.dataset.rowIndex);
        if (cb.checked) {
          this.selectedRows.add(rowIndex);
        } else {
          this.selectedRows.delete(rowIndex);
        }
        cb.closest('.data-table-row').classList.toggle('selected', cb.checked);
        this._updateSelectionUI();
      });
    });

    // منوی ردیف
    this.elements.body.querySelectorAll('.data-table-row-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.data-table-row');
        const rowIndex = parseInt(row.dataset.rowIndex);
        const rect = btn.getBoundingClientRect();
        this._showRowMenu(rect.left, rect.bottom, rowIndex);
      });
    });

    // ویرایش سلول
    if (this.options.editable) {
      this.elements.body.querySelectorAll('.data-table-cell[tabindex]').forEach(cell => {
        cell.addEventListener('dblclick', () => this._startEditing(cell));
      });
    }

    // انتخاب با کلیک روی ردیف
    this.elements.body.querySelectorAll('.data-table-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, textarea')) return;
        if (e.target.closest('.data-table-cell-editor')) return;

        const rowIndex = parseInt(row.dataset.rowIndex);

        if (e.ctrlKey || e.metaKey) {
          if (this.selectedRows.has(rowIndex)) {
            this.selectedRows.delete(rowIndex);
          } else {
            this.selectedRows.add(rowIndex);
          }
        } else if (e.shiftKey && this.selectedRows.size > 0) {
          const lastSelected = Math.max(...this.selectedRows);
          const start = Math.min(lastSelected, rowIndex);
          const end = Math.max(lastSelected, rowIndex);
          for (let i = start; i <= end; i++) {
            this.selectedRows.add(i);
          }
        } else if (!this.options.multiSelect) {
          this.selectedRows.clear();
          this.selectedRows.add(rowIndex);
        } else {
          if (!this.selectedRows.has(rowIndex)) {
            this.selectedRows.clear();
            this.selectedRows.add(rowIndex);
          }
        }

        this._updateSelectionUI();
      });
    });
  }

  /**
   * شروع ویرایش سلول
   */
  _startEditing(cell) {
    if (this.editingCell) {
      this._commitEdit();
    }

    const rowIndex = parseInt(cell.dataset.rowIndex);
    const colName = cell.dataset.column;
    const value = this.options.data[rowIndex][colName];

    cell.classList.add('editing');
    const content = cell.querySelector('.data-table-cell-content');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'data-table-cell-editor';
    input.value = value ?? '';

    content.innerHTML = '';
    content.appendChild(input);

    input.focus();
    input.select();

    this.editingCell = {
      cell,
      input,
      rowIndex,
      colName,
      originalValue: value
    };
  }

  /**
   * تأیید ویرایش
   */
  _commitEdit() {
    if (!this.editingCell) return;

    const { cell, input, rowIndex, colName, originalValue } = this.editingCell;
    const newValue = input.value;

    cell.classList.remove('editing');

    if (newValue !== String(originalValue ?? '')) {
      const oldValue = this.options.data[rowIndex][colName];
      this.options.data[rowIndex][colName] = newValue;

      if (this.options.onCellEdit) {
        const result = this.options.onCellEdit(rowIndex, colName, newValue, oldValue);
        if (result === false) {
          this.options.data[rowIndex][colName] = oldValue;
        }
      }

      this.emit('cellEdit', { rowIndex, colName, newValue, oldValue });
    }

    const col = this.options.columns.find(c => c.name === colName);
    cell.querySelector('.data-table-cell-content').innerHTML =
      this._formatCellValue(this.options.data[rowIndex][colName], col || {});

    this.editingCell = null;
  }

  /**
   * لغو ویرایش
   */
  _cancelEdit() {
    if (!this.editingCell) return;

    const { cell, rowIndex, colName } = this.editingCell;
    cell.classList.remove('editing');

    const col = this.options.columns.find(c => c.name === colName);
    cell.querySelector('.data-table-cell-content').innerHTML =
      this._formatCellValue(this.options.data[rowIndex][colName], col || {});

    this.editingCell = null;
  }

  /**
   * تغییر مرتب‌سازی
   */
  _toggleSort(colName) {
    if (!this.options.sortable) return;

    if (this.currentSort.column === colName) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.column = colName;
      this.currentSort.direction = 'asc';
    }

    this.emit('sortChange', { ...this.currentSort });

    if (this.options.onSortChange) {
      this.options.onSortChange({ ...this.currentSort });
    }
  }

  /**
   * پاک کردن مرتب‌سازی
   */
  clearSort() {
    this.currentSort = { column: null, direction: 'asc' };
    this.emit('sortChange', { ...this.currentSort });
    if (this.options.onSortChange) {
      this.options.onSortChange({ ...this.currentSort });
    }
  }

  /**
   * جستجو
   */
  _handleSearch(term) {
    this.emit('search', term);
    if (this.options.onSearch) {
      this.options.onSearch(term);
    }
  }

  /**
   * نمایش/مخفی فیلترها
   */
  _toggleFilterRow() {
    this.filterRowVisible = !this.filterRowVisible;
    if (this.elements.filterRow) {
      this.elements.filterRow.hidden = !this.filterRowVisible;
      if (this.filterRowVisible) {
        this._renderFilterRow();
      }
    }
  }

  /**
   * رندر ردیف فیلترها
   */
  _renderFilterRow() {
    if (!this.elements.filterRowInner) return;

    const columns = this.options.columns.filter(c => this.visibleColumns.has(c.name));

    this.elements.filterRowInner.innerHTML = columns.map(col => {
      const filter = this.currentFilters.find(f => f.column === col.name);

      return `
        <div class="data-table-filter-cell" data-column="${col.name}">
          <input
            type="text"
            class="data-table-filter-input"
            placeholder="فیلتر ${StringUtils.escapeHtml(col.title || col.name)}..."
            value="${filter ? StringUtils.escapeHtml(filter.value) : ''}"
            data-column="${col.name}"
          />
          ${filter ? `<button class="data-table-filter-clear" data-column="${col.name}" aria-label="پاک">✕</button>` : ''}
        </div>
      `;
    }).join('');

    // رویدادها
    this.elements.filterRowInner.querySelectorAll('.data-table-filter-input').forEach(input => {
      const debounced = debounce((value) => {
        this._applyFilter(input.dataset.column, value);
      }, 300);

      input.addEventListener('input', (e) => debounced(e.target.value));
    });

    this.elements.filterRowInner.querySelectorAll('.data-table-filter-clear').forEach(btn => {
      btn.addEventListener('click', () => {
        this._removeFilter(btn.dataset.column);
        this._renderFilterRow();
      });
    });
  }

  /**
   * اعمال فیلتر
   */
  _applyFilter(column, value) {
    const existing = this.currentFilters.findIndex(f => f.column === column);

    if (!value) {
      if (existing >= 0) this.currentFilters.splice(existing, 1);
    } else {
      if (existing >= 0) {
        this.currentFilters[existing].value = value;
      } else {
        this.currentFilters.push({ column, operator: 'contains', value });
      }
    }

    this._updateFilterBadge();
    this.emit('filterChange', [...this.currentFilters]);

    if (this.options.onFilterChange) {
      this.options.onFilterChange([...this.currentFilters]);
    }
  }

  /**
   * حذف فیلتر
   */
  _removeFilter(column) {
    const index = this.currentFilters.findIndex(f => f.column === column);
    if (index >= 0) {
      this.currentFilters.splice(index, 1);
      this._updateFilterBadge();
      this.emit('filterChange', [...this.currentFilters]);
      if (this.options.onFilterChange) {
        this.options.onFilterChange([...this.currentFilters]);
      }
    }
  }

  /**
   * به‌روزرسانی بج فیلتر
   */
  _updateFilterBadge() {
    if (!this.elements.filterBadge) return;

    if (this.currentFilters.length > 0) {
      this.elements.filterBadge.textContent = StringUtils.englishToPersianDigits(this.currentFilters.length);
      this.elements.filterBadge.hidden = false;
    } else {
      this.elements.filterBadge.hidden = true;
    }
  }

  /**
   * انتخاب همه
   */
  selectAll() {
    this.options.data.forEach((_, i) => this.selectedRows.add(i));
    this._updateSelectionUI();
  }

  /**
   * لغو انتخاب همه
   */
  clearSelection() {
    this.selectedRows.clear();
    this._updateSelectionUI();
  }

  /**
   * انتخاب ردیف
   */
  selectRow(index) {
    this.selectedRows.add(index);
    this._updateSelectionUI();
  }

  /**
   * لغو انتخاب ردیف
   */
  deselectRow(index) {
    this.selectedRows.delete(index);
    this._updateSelectionUI();
  }

  /**
   * بررسی انتخاب همه
   */
  _isAllSelected() {
    return this.options.data.length > 0 && this.selectedRows.size === this.options.data.length;
  }

  /**
   * به‌روزرسانی UI انتخاب
   */
  _updateSelectionUI() {
    // چک‌باکس‌ها
    this.elements.body.querySelectorAll('.data-table-row-checkbox').forEach(cb => {
      const rowIndex = parseInt(cb.dataset.rowIndex);
      cb.checked = this.selectedRows.has(rowIndex);
      cb.closest('.data-table-row')?.classList.toggle('selected', cb.checked);
    });

    // چک‌باکس همه
    const selectAll = this.elements.headerRow?.querySelector('.data-table-select-all');
    if (selectAll) {
      selectAll.checked = this._isAllSelected();
      selectAll.indeterminate = this.selectedRows.size > 0 && !this._isAllSelected();
    }

    // به‌روزرسانی نوار ابزار
    this._updateToolbar();

    // رویداد
    this.emit('selectionChange', Array.from(this.selectedRows));
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange(Array.from(this.selectedRows));
    }
  }

  /**
   * به‌روزرسانی نوار ابزار
   */
  _updateToolbar() {
    const total = this.elements.infoTotal;
    if (total) {
      total.textContent = StringUtils.englishToPersianDigits(this.options.total || this.options.data.length);
    }

    // اکشن‌های انتخاب
    const toolbarRight = this.element.querySelector('.data-table-toolbar-right');
    const existingActions = toolbarRight?.querySelector('.data-table-selection-actions');

    if (this.selectedRows.size > 0 && !existingActions) {
      toolbarRight.insertAdjacentHTML('afterbegin', this._renderSelectionActions());
    } else if (this.selectedRows.size === 0 && existingActions) {
      existingActions.remove();
    } else if (this.selectedRows.size > 0 && existingActions) {
      existingActions.querySelector('.data-table-selection-count').textContent =
        `${StringUtils.englishToPersianDigits(this.selectedRows.size)} مورد`;
    }

    // اطلاعات انتخاب
    if (this.elements.infoSelected) {
      this.elements.infoSelected.textContent = `(${StringUtils.englishToPersianDigits(this.selectedRows.size)} انتخاب شده)`;
    }
  }

  /**
   * به‌روزرسانی صفحه‌بندی
   */
  _updatePagination() {
    const totalPages = Math.max(1, Math.ceil((this.options.total || this.options.data.length) / this.currentPageSize));

    // شماره‌های صفحه
    if (this.elements.pageNumbers) {
      this.elements.pageNumbers.innerHTML = this._renderPageNumbers(totalPages);
    }

    // اطلاعات
    if (this.elements.pageInfo) {
      const start = (this.currentPage - 1) * this.currentPageSize + 1;
      const end = Math.min(this.currentPage * this.currentPageSize, this.options.total || this.options.data.length);
      const total = this.options.total || this.options.data.length;

      this.elements.pageInfo.textContent = total > 0
        ? `نمایش ${StringUtils.englishToPersianDigits(start)} تا ${StringUtils.englishToPersianDigits(end)} از ${StringUtils.englishToPersianDigits(total)}`
        : 'بدون داده';
    }

    // غیرفعال کردن دکمه‌ها
    const first = this.element.querySelector('[data-page="first"]');
    const prev = this.element.querySelector('[data-page="prev"]');
    const next = this.element.querySelector('[data-page="next"]');
    const last = this.element.querySelector('[data-page="last"]');

    if (first) first.disabled = this.currentPage <= 1;
    if (prev) prev.disabled = this.currentPage <= 1;
    if (next) next.disabled = this.currentPage >= totalPages;
    if (last) last.disabled = this.currentPage >= totalPages;
  }

  /**
   * رندر شماره‌های صفحه
   */
  _renderPageNumbers(totalPages) {
    const maxVisible = 7;
    const pages = [];

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const half = Math.floor(maxVisible / 2);

      if (this.currentPage <= half + 1) {
        for (let i = 1; i <= maxVisible - 2; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (this.currentPage >= totalPages - half) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - maxVisible + 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages.map(p => {
      if (p === '...') {
        return `<span class="data-table-page-ellipsis">…</span>`;
      }
      return `
        <button
          class="data-table-page-number ${p === this.currentPage ? 'active' : ''}"
          data-page="${p}"
        >${StringUtils.englishToPersianDigits(p)}</button>
      `;
    }).join('');
  }

  /**
   * ناوبری صفحه
   */
  _handlePageNavigation(direction) {
    const totalPages = Math.max(1, Math.ceil((this.options.total || this.options.data.length) / this.currentPageSize));

    switch (direction) {
      case 'first':
        this._goToPage(1);
        break;
      case 'prev':
        this._goToPage(Math.max(1, this.currentPage - 1));
        break;
      case 'next':
        this._goToPage(Math.min(totalPages, this.currentPage + 1));
        break;
      case 'last':
        this._goToPage(totalPages);
        break;
    }
  }

  /**
   * رفتن به صفحه
   */
  _goToPage(page) {
    if (page === this.currentPage) return;
    this.currentPage = page;
    this.selectedRows.clear();
    this._emitPageChange();
  }

  /**
   * انتشار تغییر صفحه
   */
  _emitPageChange() {
    const info = {
      page: this.currentPage,
      pageSize: this.currentPageSize,
      total: this.options.total,
      offset: (this.currentPage - 1) * this.currentPageSize
    };

    this.emit('pageChange', info);
    if (this.options.onPageChange) {
      this.options.onPageChange(info);
    }
  }

  /**
   * به‌روزرسانی خالی بودن
   */
  _updateEmpty() {
    if (!this.elements.empty) return;
    this.elements.empty.hidden = this.options.data.length > 0;
  }

  /**
   * بارگذاری
   */
  setLoading(loading) {
    if (this.elements.loading) {
      this.elements.loading.hidden = !loading;
    }
  }

  /**
   * بازنشانی
   */
  refresh() {
    this.emit('refresh');
    if (this.options.onRefresh) {
      this.options.onRefresh();
    }
  }

  /**
   * به‌روزرسانی داده
   */
  setData(data, options = {}) {
    this.options.data = data;
    if (options.total !== undefined) this.options.total = options.total;
    if (options.page !== undefined) this.currentPage = options.page;
    if (options.pageSize !== undefined) this.currentPageSize = options.pageSize;

    this.selectedRows.clear();
    this._renderTable();
  }

  /**
   * به‌روزرسانی ستون‌ها
   */
  setColumns(columns) {
    this.options.columns = columns;
    this.visibleColumns.clear();
    this.columnWidths.clear();
    this._initColumns();
    this._renderTable();
  }

  /**
   * نمایش منوی ستون‌ها
   */
  _showColumnsMenu() {
    const items = this.options.columns.map(col => ({
      label: col.title || col.name,
      icon: this.visibleColumns.has(col.name) ? '✓' : '',
      checked: this.visibleColumns.has(col.name),
      onClick: () => {
        if (this.visibleColumns.has(col.name)) {
          if (this.visibleColumns.size > 1) {
            this.visibleColumns.delete(col.name);
          }
        } else {
          this.visibleColumns.add(col.name);
        }
        this._renderTable();
      }
    }));

    items.push('separator');
    items.push({
      label: 'نمایش همه',
      icon: '👁️',
      onClick: () => {
        this.options.columns.forEach(c => this.visibleColumns.add(c.name));
        this._renderTable();
      }
    });
    items.push({
      label: 'بازنشانی',
      icon: '🔄',
      onClick: () => {
        this.visibleColumns.clear();
        this._initColumns();
        this._renderTable();
      }
    });

    const rect = this.elements.columnsBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * نمایش منوی صادرات
   */
  _showExportMenu() {
    const items = [
      { label: 'JSON', icon: '{}', onClick: () => this._export('json') },
      { label: 'CSV', icon: '📄', onClick: () => this._export('csv') },
      { label: 'SQL', icon: '💾', onClick: () => this._export('sql') },
      { label: 'XML', icon: '📋', onClick: () => this._export('xml') },
      { label: 'Excel', icon: '📊', onClick: () => this._export('excel') },
      { label: 'HTML', icon: '🌐', onClick: () => this._export('html') },
      'separator',
      { label: 'کپی JSON', icon: '📋', onClick: () => this._copyAs('json') },
      { label: 'کپی CSV', icon: '📋', onClick: () => this._copyAs('csv') }
    ];

    const rect = this.elements.exportBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * صادرات
   */
  _export(format) {
    const data = this.selectedRows.size > 0
      ? Array.from(this.selectedRows).map(i => this.options.data[i])
      : this.options.data;

    this.emit('export', { format, data });
  }

  /**
   * کپی
   */
  _copyAs(format) {
    const data = this.selectedRows.size > 0
      ? Array.from(this.selectedRows).map(i => this.options.data[i])
      : this.options.data;

    let text = '';
    if (format === 'json') {
      text = JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      const cols = Array.from(this.visibleColumns).filter(c => !c.startsWith('__'));
      const header = cols.join(',');
      const rows = data.map(row => cols.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','));
      text = header + '\n' + rows.join('\n');
    }

    DomUtils.copyToClipboard(text).then(ok => {
      if (ok) notificationService.success('کپی شد');
    });
  }

  /**
   * نمایش تنظیمات
   */
  _showSettingsMenu() {
    const items = [
      {
        label: 'شماره ردیف',
        checked: this.options.showRowNumbers,
        onClick: () => {
          this.options.showRowNumbers = !this.options.showRowNumbers;
          this._renderTable();
        }
      },
      {
        label: 'نوع ستون',
        checked: this.options.showColumnTypes,
        onClick: () => {
          this.options.showColumnTypes = !this.options.showColumnTypes;
          this._renderHeader();
        }
      },
      {
        label: 'هدر ثابت',
        checked: this.options.stickyHeader,
        onClick: () => {
          this.options.stickyHeader = !this.options.stickyHeader;
          this.elements.container.classList.toggle('sticky-header', this.options.stickyHeader);
        }
      },
      {
        label: 'اسکرول مجازی',
        checked: this.options.virtualScroll,
        onClick: () => {
          this.options.virtualScroll = !this.options.virtualScroll;
          this._renderBody();
        }
      }
    ];

    const rect = this.elements.settingsBtn.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * منوی زمینه سلول
   */
  _showContextMenu(x, y, rowIndex, colName) {
    const row = this.options.data[rowIndex];
    const value = row[colName];

    const items = ContextMenus.tableCell({
      onCopy: () => {
        DomUtils.copyToClipboard(String(value ?? ''));
        notificationService.success('کپی شد', { duration: 1500 });
      },
      onCopyRow: () => {
        DomUtils.copyToClipboard(JSON.stringify(row, null, 2));
        notificationService.success('ردیف کپی شد', { duration: 1500 });
      },
      onCopyAs: (format) => this._copyRowAs(row, format),
      onEdit: () => {
        const cell = this.elements.body.querySelector(`[data-row-index="${rowIndex}"][data-column="${colName}"]`);
        if (cell) this._startEditing(cell);
      },
      onInsert: (where) => this.emit('insertRow', { rowIndex, where }),
      onDelete: () => this.emit('deleteRow', { rowIndex })
    });

    contextMenu.show(x, y, items);
  }

  /**
   * کپی ردیف با فرمت
   */
  _copyRowAs(row, format) {
    let text = '';
    if (format === 'json') {
      text = JSON.stringify(row, null, 2);
    } else if (format === 'csv') {
      const cols = Object.keys(row);
      text = cols.join(',') + '\n' + cols.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(',');
    } else if (format === 'sql') {
      const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
      const vals = Object.values(row).map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`).join(', ');
      text = `INSERT INTO table_name (${cols}) VALUES (${vals});`;
    }

    DomUtils.copyToClipboard(text).then(ok => {
      if (ok) notificationService.success('کپی شد');
    });
  }

  /**
   * منوی زمینه هدر
   */
  _showHeaderContextMenu(x, y, colName) {
    const isSorted = this.currentSort.column === colName;
    const filtered = this.currentFilters.some(f => f.column === colName);
    const frozen = this.frozenColumns.has(colName);

    const items = ContextMenus.columnHeader({
      sorted: isSorted,
      filtered,
      frozen,
      onSort: (dir) => {
        this.currentSort = { column: colName, direction: dir };
        this.emit('sortChange', { ...this.currentSort });
        if (this.options.onSortChange) this.options.onSortChange({ ...this.currentSort });
      },
      onClearSort: () => this.clearSort(),
      onFilter: () => {
        this._toggleFilterRow();
        setTimeout(() => {
          this.elements.filterRowInner?.querySelector(`[data-column="${colName}"]`)?.focus();
        }, 100);
      },
      onClearFilter: () => {
        this._removeFilter(colName);
        this._renderFilterRow();
      },
      onFreeze: () => {
        if (frozen) this.frozenColumns.delete(colName);
        else this.frozenColumns.add(colName);
        this._renderTable();
      },
      onHide: () => {
        if (this.visibleColumns.size > 1) {
          this.visibleColumns.delete(colName);
          this._renderTable();
        }
      },
      onAutoFit: () => this._autoFitColumn(colName),
      onCopyName: () => {
        DomUtils.copyToClipboard(colName);
        notificationService.success('نام ستون کپی شد', { duration: 1500 });
      }
    });

    contextMenu.show(x, y, items);
  }

  /**
   * اندازه خودکار ستون
   */
  _autoFitColumn(colName) {
    const cells = this.elements.body.querySelectorAll(`[data-column="${colName}"]`);
    let maxWidth = 100;

    cells.forEach(cell => {
      const width = cell.scrollWidth;
      if (width > maxWidth) maxWidth = width;
    });

    this._setColumnWidth(colName, Math.min(maxWidth + 20, 500));
  }

  /**
   * منوی ردیف
   */
  _showRowMenu(x, y, rowIndex) {
    const items = [
      { label: 'مشاهده جزئیات', icon: '👁️', onClick: () => this.emit('viewRow', { rowIndex }) },
      { label: 'ویرایش ردیف', icon: '✏️', onClick: () => this.emit('editRow', { rowIndex }) },
      { label: 'کپی ردیف', icon: '📋', onClick: () => {
        DomUtils.copyToClipboard(JSON.stringify(this.options.data[rowIndex], null, 2));
        notificationService.success('کپی شد', { duration: 1500 });
      }},
      'separator',
      { label: 'درج بالا', icon: '⬆️', onClick: () => this.emit('insertRow', { rowIndex, where: 'above' }) },
      { label: 'درج پایین', icon: '⬇️', onClick: () => this.emit('insertRow', { rowIndex, where: 'below' }) },
      'separator',
      { label: 'حذف ردیف', icon: '🗑️', danger: true, onClick: () => this.emit('deleteRow', { rowIndex }) }
    ];

    contextMenu.show(x, y, items);
  }

  /**
   * هندلر اکشن
   */
  _handleAction(action) {
    switch (action) {
      case 'copy-selected':
        this._copySelected();
        break;
      case 'export-selected':
        this._export('json');
        break;
      case 'duplicate-selected':
        this.emit('duplicateSelected', Array.from(this.selectedRows));
        break;
      case 'delete-selected':
        this.emit('deleteSelected', Array.from(this.selectedRows));
        break;
      case 'clear-selection':
        this.clearSelection();
        break;
    }
  }

  /**
   * کپی انتخاب شده‌ها
   */
  _copySelected() {
    const data = Array.from(this.selectedRows).map(i => this.options.data[i]);
    DomUtils.copyToClipboard(JSON.stringify(data, null, 2));
    notificationService.success(`${StringUtils.englishToPersianDigits(data.length)} ردیف کپی شد`);
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
    document.removeEventListener('click', this._boundDocumentClick);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.DataTable = DataTable;