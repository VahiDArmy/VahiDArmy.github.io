/* ============================================
   کامپوننت جدول قابل استفاده مجدد
   شادباش ازدواج
   ============================================ */

const Table = {
    container: null,
    options: {},
    data: [],
    filteredData: [],
    currentPage: 1,
    perPage: 10,
    sortKey: null,
    sortOrder: 'asc',
    searchQuery: '',
    
    /**
     * رندر جدول
     * @param {string} containerId - شناسه کانتینر
     * @param {object} options - تنظیمات
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`کانتینر با شناسه "${containerId}" یافت نشد`);
            return;
        }
        
        // تنظیمات پیش‌فرض
        this.options = {
            columns: [],
            data: [],
            searchable: true,
            searchPlaceholder: 'جستجو...',
            searchFields: [],
            sortable: true,
            pagination: true,
            perPage: 10,
            perPageOptions: [10, 25, 50, 100],
            selectable: false,
            striped: true,
            hoverable: true,
            bordered: false,
            compact: false,
            emptyMessage: 'داده‌ای برای نمایش وجود ندارد',
            loadingMessage: 'در حال بارگذاری...',
            actions: [],
            onRowClick: null,
            onSelectionChange: null,
            rowKey: 'id',
            ...options
        };
        
        this.data = this.options.data || [];
        this.filteredData = [...this.data];
        this.perPage = this.options.perPage;
        this.currentPage = 1;
        
        this.renderTable();
        this.attachEvents();
    },
    
    /**
     * رندر ساختار اصلی
     */
    renderTable() {
        const o = this.options;
        
        this.container.innerHTML = `
            <div class="table-wrapper ${o.striped ? 'table-striped' : ''} ${o.hoverable ? 'table-hoverable' : ''} ${o.bordered ? 'table-bordered' : ''} ${o.compact ? 'table-compact' : ''}">
                
                ${o.searchable || o.actions.length > 0 ? `
                    <div class="table-toolbar">
                        ${o.searchable ? `
                            <div class="table-search">
                                <i class="ri-search-line"></i>
                                <input type="text" 
                                       class="table-search-input" 
                                       placeholder="${o.searchPlaceholder}"
                                       value="${this.searchQuery}">
                                <button class="table-search-clear" style="display: ${this.searchQuery ? 'flex' : 'none'};">
                                    <i class="ri-close-line"></i>
                                </button>
                            </div>
                        ` : '<div></div>'}
                        
                        ${o.actions.length > 0 ? `
                            <div class="table-actions">
                                ${o.actions.map((action, idx) => `
                                    <button class="btn btn-${action.type || 'secondary'} btn-sm" data-action-index="${idx}">
                                        ${action.icon ? `<i class="${action.icon}"></i>` : ''}
                                        <span>${action.label}</span>
                                    </button>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="table-responsive">
                    <table class="table-component">
                        <thead>
                            <tr>
                                ${o.selectable ? `
                                    <th class="table-checkbox-cell">
                                        <label class="table-checkbox">
                                            <input type="checkbox" class="table-check-all">
                                            <span class="table-checkbox-mark"></span>
                                        </label>
                                    </th>
                                ` : ''}
                                ${o.columns.map(col => `
                                    <th class="table-th ${col.sortable && o.sortable ? 'sortable' : ''}" 
                                        data-key="${col.key}"
                                        style="${col.width ? `width: ${col.width};` : ''} ${col.align ? `text-align: ${col.align};` : ''}">
                                        <div class="th-content">
                                            <span>${col.label}</span>
                                            ${col.sortable && o.sortable ? `
                                                <span class="sort-indicator ${this.sortKey === col.key ? 'active' : ''}">
                                                    <i class="ri-arrow-up-s-line ${this.sortKey === col.key && this.sortOrder === 'asc' ? 'active' : ''}"></i>
                                                    <i class="ri-arrow-down-s-line ${this.sortKey === col.key && this.sortOrder === 'desc' ? 'active' : ''}"></i>
                                                </span>
                                            ` : ''}
                                        </div>
                                    </th>
                                `).join('')}
                                ${this.hasRowActions() ? '<th class="table-actions-cell">اقدامات</th>' : ''}
                            </tr>
                        </thead>
                        <tbody class="table-tbody">
                            ${this.renderRows()}
                        </tbody>
                    </table>
                </div>
                
                ${this.options.pagination ? this.renderPagination() : ''}
            </div>
        `;
    },
    
    /**
     * بررسی وجود اقدامات ردیف
     */
    hasRowActions() {
        return this.options.columns.some(c => c.rowActions && c.rowActions.length > 0) || 
               this.options.rowActions?.length > 0;
    },
    
    /**
     * رندر ردیف‌ها
     */
    renderRows() {
        const o = this.options;
        
        if (this.filteredData.length === 0) {
            return `
                <tr class="table-empty-row">
                    <td colspan="${o.columns.length + (o.selectable ? 1 : 0) + (this.hasRowActions() ? 1 : 0)}">
                        <div class="table-empty">
                            <i class="ri-inbox-line"></i>
                            <p>${this.searchQuery ? 'نتیجه‌ای برای جستجوی شما یافت نشد' : o.emptyMessage}</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        // صفحه‌بندی
        let rows = this.filteredData;
        if (o.pagination) {
            const start = (this.currentPage - 1) * this.perPage;
            rows = rows.slice(start, start + this.perPage);
        }
        
        return rows.map((row, idx) => this.renderRow(row, idx)).join('');
    },
    
    /**
     * رندر یک ردیف
     */
    renderRow(row, idx) {
        const o = this.options;
        const rowKey = row[o.rowKey];
        const rowActions = o.rowActions || 
                          o.columns.find(c => c.rowActions)?.rowActions || [];
        
        return `
            <tr class="table-row" data-id="${rowKey}" data-index="${idx}">
                ${o.selectable ? `
                    <td class="table-checkbox-cell">
                        <label class="table-checkbox">
                            <input type="checkbox" class="table-check-row" data-id="${rowKey}">
                            <span class="table-checkbox-mark"></span>
                        </label>
                    </td>
                ` : ''}
                ${o.columns.map(col => {
                    if (col.rowActions) return '';
                    const value = this.getValue(row, col.key);
                    const rendered = col.render ? col.render(value, row) : this.escape(value);
                    
                    return `
                        <td class="table-td ${col.className || ''}" 
                            style="${col.align ? `text-align: ${col.align};` : ''}">
                            ${rendered}
                        </td>
                    `;
                }).join('')}
                ${rowActions.length > 0 ? `
                    <td class="table-actions-cell">
                        <div class="table-row-actions">
                            ${rowActions.map((action, aIdx) => `
                                <button class="table-action-btn table-action-${action.type || 'default'}" 
                                        data-action="${aIdx}" 
                                        data-id="${rowKey}"
                                        title="${action.label}">
                                    <i class="${action.icon}"></i>
                                </button>
                            `).join('')}
                        </div>
                    </td>
                ` : ''}
            </tr>
        `;
    },
    
    /**
     * دریافت مقدار از مسیر تودرتو
     */
    getValue(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    },
    
    /**
     * Escape HTML
     */
    escape(value) {
        if (value === null || value === undefined) return '—';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    /**
     * رندر صفحه‌بندی
     */
    renderPagination() {
        const total = this.filteredData.length;
        const totalPages = Math.ceil(total / this.perPage);
        
        if (total === 0) return '';
        
        const start = (this.currentPage - 1) * this.perPage + 1;
        const end = Math.min(this.currentPage * this.perPage, total);
        
        // صفحات قابل نمایش
        const pages = this.getPaginationRange(this.currentPage, totalPages);
        
        return `
            <div class="table-pagination">
                <div class="pagination-info">
                    نمایش <strong>${Format.number(start)}</strong> 
                    تا <strong>${Format.number(end)}</strong> 
                    از <strong>${Format.number(total)}</strong> مورد
                </div>
                
                <div class="pagination-controls">
                    <button class="pagination-btn pagination-first" 
                            data-page="1" 
                            ${this.currentPage === 1 ? 'disabled' : ''}
                            title="اولین صفحه">
                        <i class="ri-arrow-right-double-line"></i>
                    </button>
                    
                    <button class="pagination-btn pagination-prev" 
                            data-page="${this.currentPage - 1}" 
                            ${this.currentPage === 1 ? 'disabled' : ''}
                            title="قبلی">
                        <i class="ri-arrow-right-s-line"></i>
                    </button>
                    
                    <div class="pagination-pages">
                        ${pages.map(p => {
                            if (p === '...') {
                                return '<span class="pagination-ellipsis">...</span>';
                            }
                            return `
                                <button class="pagination-page ${p === this.currentPage ? 'active' : ''}" 
                                        data-page="${p}">
                                    ${Format.number(p)}
                                </button>
                            `;
                        }).join('')}
                    </div>
                    
                    <button class="pagination-btn pagination-next" 
                            data-page="${this.currentPage + 1}" 
                            ${this.currentPage === totalPages ? 'disabled' : ''}
                            title="بعدی">
                        <i class="ri-arrow-left-s-line"></i>
                    </button>
                    
                    <button class="pagination-btn pagination-last" 
                            data-page="${totalPages}" 
                            ${this.currentPage === totalPages ? 'disabled' : ''}
                            title="آخرین صفحه">
                        <i class="ri-arrow-left-double-line"></i>
                    </button>
                </div>
                
                <div class="pagination-per-page">
                    <label>در هر صفحه:</label>
                    <select class="pagination-select">
                        ${this.options.perPageOptions.map(n => `
                            <option value="${n}" ${n === this.perPage ? 'selected' : ''}>
                                ${Format.number(n)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    },
    
    /**
     * محاسبه صفحات نمایش
     */
    getPaginationRange(current, total) {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let l;
        
        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }
        
        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }
        
        return rangeWithDots;
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        // جستجو
        const searchInput = this.container.querySelector('.table-search-input');
        const searchClear = this.container.querySelector('.table-search-clear');
        
        if (searchInput) {
            searchInput.addEventListener('input', Helpers.debounce((e) => {
                this.searchQuery = e.target.value;
                if (searchClear) {
                    searchClear.style.display = this.searchQuery ? 'flex' : 'none';
                }
                this.applyFilters();
            }, 300));
        }
        
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                searchClear.style.display = 'none';
                this.applyFilters();
            });
        }
        
        // مرتب‌سازی
        this.container.querySelectorAll('.table-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.key;
                this.sort(key);
            });
        });
        
        // انتخاب همه
        const checkAll = this.container.querySelector('.table-check-all');
        if (checkAll) {
            checkAll.addEventListener('change', () => {
                const checked = checkAll.checked;
                this.container.querySelectorAll('.table-check-row').forEach(cb => {
                    cb.checked = checked;
                });
                this.notifySelectionChange();
            });
        }
        
        // انتخاب ردیف‌ها
        this.container.querySelectorAll('.table-check-row').forEach(cb => {
            cb.addEventListener('change', () => {
                this.notifySelectionChange();
                this.updateCheckAll();
            });
        });
        
        // صفحه‌بندی
        this.container.querySelectorAll('.pagination-page, .pagination-prev, .pagination-next, .pagination-first, .pagination-last').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const page = parseInt(btn.dataset.page);
                this.goToPage(page);
            });
        });
        
        // تعداد در صفحه
        const perPageSelect = this.container.querySelector('.pagination-select');
        if (perPageSelect) {
            perPageSelect.addEventListener('change', () => {
                this.perPage = parseInt(perPageSelect.value);
                this.currentPage = 1;
                this.renderTable();
                this.attachEvents();
            });
        }
        
        // اقدامات نوار ابزار
        this.container.querySelectorAll('[data-action-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.actionIndex);
                const action = this.options.actions[idx];
                if (action.onClick) {
                    action.onClick(this.getSelection(), this);
                }
            });
        });
        
        // اقدامات ردیف
        this.container.querySelectorAll('.table-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const actionIdx = parseInt(btn.dataset.action);
                const row = this.data.find(r => String(r[this.options.rowKey]) === String(id));
                
                if (!row) return;
                
                const rowActions = this.options.rowActions || 
                                  this.options.columns.find(c => c.rowActions)?.rowActions || [];
                const action = rowActions[actionIdx];
                
                if (action && action.onClick) {
                    action.onClick(row, id, this);
                }
            });
        });
        
        // کلیک روی ردیف
        if (this.options.onRowClick) {
            this.container.querySelectorAll('.table-row').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('.table-checkbox') || 
                        e.target.closest('.table-action-btn')) return;
                    
                    const id = tr.dataset.id;
                    const row = this.data.find(r => String(r[this.options.rowKey]) === String(id));
                    
                    if (row) {
                        this.options.onRowClick(row, id);
                    }
                });
            });
        }
    },
    
    /**
     * اعمال فیلترها
     */
    applyFilters() {
        let data = [...this.data];
        
        // جستجو
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            const fields = this.options.searchFields.length > 0 
                ? this.options.searchFields 
                : this.options.columns.map(c => c.key);
            
            data = data.filter(row => {
                return fields.some(field => {
                    const value = this.getValue(row, field);
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(q);
                });
            });
        }
        
        // مرتب‌سازی
        if (this.sortKey) {
            data = Helpers.sortBy(data, this.sortKey, this.sortOrder);
        }
        
        this.filteredData = data;
        this.currentPage = 1;
        
        this.renderTable();
        this.attachEvents();
    },
    
    /**
     * مرتب‌سازی
     */
    sort(key) {
        if (this.sortKey === key) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortKey = key;
            this.sortOrder = 'asc';
        }
        
        this.applyFilters();
    },
    
    /**
     * رفتن به صفحه
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.perPage);
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        
        this.renderTable();
        this.attachEvents();
        
        // اسکرول به بالای جدول
        this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    
    /**
     * دریافت انتخاب‌های فعلی
     */
    getSelection() {
        const checked = this.container.querySelectorAll('.table-check-row:checked');
        const ids = Array.from(checked).map(cb => cb.dataset.id);
        return this.data.filter(row => ids.includes(String(row[this.options.rowKey])));
    },
    
    /**
     * بروزرسانی check-all
     */
    updateCheckAll() {
        const checkAll = this.container.querySelector('.table-check-all');
        if (!checkAll) return;
        
        const total = this.container.querySelectorAll('.table-check-row').length;
        const checked = this.container.querySelectorAll('.table-check-row:checked').length;
        
        checkAll.checked = total > 0 && total === checked;
        checkAll.indeterminate = checked > 0 && checked < total;
    },
    
    /**
     * اطلاع‌رسانی تغییر انتخاب
     */
    notifySelectionChange() {
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelection());
        }
    },
    
    /**
     * بروزرسانی داده‌ها
     */
    setData(newData) {
        this.data = newData;
        this.filteredData = [...newData];
        this.currentPage = 1;
        this.renderTable();
        this.attachEvents();
    },
    
    /**
     * افزودن داده
     */
    addRow(row) {
        this.data.push(row);
        this.applyFilters();
    },
    
    /**
     * حذف داده
     */
    removeRow(id) {
        this.data = this.data.filter(r => String(r[this.options.rowKey]) !== String(id));
        this.applyFilters();
    },
    
    /**
     * بروزرسانی ردیف
     */
    updateRow(id, updates) {
        const idx = this.data.findIndex(r => String(r[this.options.rowKey]) === String(id));
        if (idx !== -1) {
            this.data[idx] = { ...this.data[idx], ...updates };
            this.applyFilters();
        }
    },
    
    /**
     * پاک کردن
     */
    clear() {
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.sortKey = null;
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    },
    
    /**
     * نمایش حالت لودینگ
     */
    showLoading() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="table-loading">
                <div class="table-loading-spinner"></div>
                <p>${this.options.loadingMessage}</p>
            </div>
        `;
    },
    
    /**
     * خروجی CSV
     */
    exportCSV(filename = 'export.csv') {
        if (this.filteredData.length === 0) {
            Toast.warning('خروجی', 'داده‌ای برای خروجی وجود ندارد');
            return;
        }
        
        const columns = this.options.columns.filter(c => !c.rowActions && !c.hidden);
        const headers = columns.map(c => c.label);
        const rows = this.filteredData.map(row => {
            return columns.map(col => {
                const value = this.getValue(row, col.key);
                if (col.exportValue) return col.exportValue(value, row);
                return value ?? '';
            });
        });
        
        const csv = [
            '\uFEFF' + headers.map(h => `"${h}"`).join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        Helpers.downloadFile(csv, filename, 'text/csv;charset=utf-8');
        Toast.success('خروجی', 'فایل با موفقیت دانلود شد');
    }
};