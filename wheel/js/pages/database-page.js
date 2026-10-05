/**
 * صفحه مدیریت دیتابیس
 * @module databasePage
 */

const DatabasePage = {
    currentTable: 'people',
    currentSearch: '',
    currentSort: 'newest',
    currentPage: 1,
    itemsPerPage: 20,
    _allRows: [],
    _filteredRows: [],

    // پیکربندی هر جدول
    TABLES: {
        people: {
            title: '👥 افراد',
            icon: '👥',
            emptyText: 'هنوز فردی اضافه نشده است',
            columns: [
                { key: 'name', label: 'نام', width: '1.4fr' },
                { key: 'description', label: 'توصیف', width: '2.5fr' },
                { key: 'flags', label: 'وضعیت', width: '110px', align: 'center' },
                { key: 'createdAt', label: 'تاریخ', width: '120px', align: 'center' },
            ],
        },
        items: {
            title: '🎁 آیتم‌ها',
            icon: '🎁',
            emptyText: 'هنوز آیتمی اضافه نشده است',
            columns: [
                { key: 'label', label: 'نام', width: '1.5fr' },
                { key: 'description', label: 'توصیف', width: '3fr' },
                { key: 'createdAt', label: 'تاریخ', width: '120px', align: 'center' },
            ],
        },
        descriptions: {
            title: '📝 توصیفات',
            icon: '📝',
            emptyText: 'هیچ توصیفی ثبت نشده است',
            columns: [
                { key: 'ownerName', label: 'مربوط به', width: '1.2fr' },
                { key: 'ownerType', label: 'نوع', width: '90px', align: 'center' },
                { key: 'value', label: 'متن توصیف', width: '3fr' },
                { key: 'updatedAt', label: 'تاریخ', width: '120px', align: 'center' },
            ],
        },
        history: {
            title: '🎯 چرخش‌ها',
            icon: '🎯',
            emptyText: 'هیچ چرخشی ثبت نشده است',
            columns: [
                { key: 'winner', label: 'برنده', width: '1.2fr' },
                { key: 'mode', label: 'حالت', width: '110px', align: 'center' },
                { key: 'spinType', label: 'نوع', width: '110px', align: 'center' },
                { key: 'timestamp', label: 'تاریخ', width: '130px', align: 'center' },
            ],
        },
        stories: {
            title: '📚 داستان‌ها',
            icon: '📚',
            emptyText: 'هنوز داستانی ساخته نشده است',
            columns: [
                { key: 'model', label: 'مدل', width: '1.1fr' },
                { key: 'preview', label: 'پیش‌نمایش', width: '3fr' },
                { key: 'words', label: 'کلمات', width: '80px', align: 'center' },
                { key: 'timestamp', label: 'تاریخ', width: '130px', align: 'center' },
            ],
        },
        settings: {
            title: '⚙️ تنظیمات',
            icon: '⚙️',
            emptyText: 'هیچ تنظیماتی ذخیره نشده است',
            columns: [
                { key: 'key', label: 'کلید', width: '1fr' },
                { key: 'value', label: 'مقدار', width: '3fr' },
                { key: 'type', label: 'نوع', width: '90px', align: 'center' },
            ],
        },
    },

    init() {
        this._initTabs();
        this._initToolbar();
        this._initActions();
        this._loadTable('people');
        this._renderOverview();
    },

    // ═══════════════════════════════════════════
    // Overview
    // ═══════════════════════════════════════════

    _renderOverview() {
        try {
            const info = SQLStorage.getInfo();
            if (!info) {
                setTimeout(() => this._renderOverview(), 800);
                return;
            }

            const total = (info.peopleCount || 0) + (info.itemsCount || 0) +
                          (info.historyCount || 0) + (info.storiesCount || 0);

            this._setText('ov-size', info.sizeFormatted);
            this._setText('ov-total', Utils.toPersianNumbers(total));
            this._setText('ov-people', Utils.toPersianNumbers(info.peopleCount));
            this._setText('ov-stories', Utils.toPersianNumbers(info.storiesCount));

            // آپدیت شمارنده‌ی تب‌ها
            this._updateTabCounts(info);
        } catch (e) {
            Logger.error('DatabasePage._renderOverview', e);
        }
    },

    _updateTabCounts(info) {
        this._setText('tab-count-people', Utils.toPersianNumbers(info.peopleCount || 0));
        this._setText('tab-count-items', Utils.toPersianNumbers(info.itemsCount || 0));
        this._setText('tab-count-history', Utils.toPersianNumbers(info.historyCount || 0));
        this._setText('tab-count-stories', Utils.toPersianNumbers(info.storiesCount || 0));

        try {
            const descriptionsCount = SQLStorage.getAllDescriptions().length;
            this._setText('tab-count-descriptions', Utils.toPersianNumbers(descriptionsCount));
        } catch (e) {
            this._setText('tab-count-descriptions', '۰');
        }

        try {
            const settingsRows = SQLStorage.query('SELECT COUNT(*) as c FROM settings');
            const count = settingsRows[0]?.c || 0;
            this._setText('tab-count-settings', Utils.toPersianNumbers(count));
        } catch (e) {
            this._setText('tab-count-settings', '۰');
        }
    },

    _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    // ═══════════════════════════════════════════
    // Tabs
    // ═══════════════════════════════════════════

    _initTabs() {
        document.querySelectorAll('.db-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.db-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTable = tab.dataset.table;
                this.currentPage = 1;
                this.currentSearch = '';
                const searchInput = document.getElementById('db-search');
                if (searchInput) searchInput.value = '';
                this._loadTable(this.currentTable);
            });
        });
    },

    // ═══════════════════════════════════════════
    // Toolbar
    // ═══════════════════════════════════════════

    _initToolbar() {
        const searchInput = document.getElementById('db-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.currentSearch = e.target.value.toLowerCase().trim();
                this.currentPage = 1;
                this._applyFilters();
            }, 250));
        }

        const sortSelect = document.getElementById('db-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.currentPage = 1;
                this._applyFilters();
            });
        }

        const deleteFiltered = document.getElementById('db-delete-filtered');
        if (deleteFiltered) {
            deleteFiltered.addEventListener('click', () => this._deleteFiltered());
        }
    },

    // ═══════════════════════════════════════════
    // Actions
    // ═══════════════════════════════════════════

    _initActions() {
        const pushBtn = document.getElementById('db-push');
        if (pushBtn) {
            pushBtn.addEventListener('click', async () => {
                if (!GitHubStorage.isConfigured()) {
                    Notification.warning('ابتدا تنظیمات GitHub را وارد کنید');
                    return;
                }
                pushBtn.disabled = true;
                pushBtn.textContent = 'در حال ارسال...';
                try {
                    await SQLStorage.pushToGitHub('ارسال از صفحه دیتابیس');
                    Notification.success('دیتابیس ارسال شد');
                } catch (e) {
                    Notification.error(e.message, 12000);
                } finally {
                    pushBtn.disabled = false;
                    pushBtn.textContent = '☁️ ارسال به GitHub';
                }
            });
        }

        const pullBtn = document.getElementById('db-pull');
        if (pullBtn) {
            pullBtn.addEventListener('click', async () => {
                if (!GitHubStorage.isConfigured()) {
                    Notification.warning('ابتدا تنظیمات GitHub را وارد کنید');
                    return;
                }
                const ok = await Modal.confirm('دیتابیس محلی با نسخه GitHub جایگزین شود؟', { danger: true });
                if (!ok) return;

                pullBtn.disabled = true;
                pullBtn.textContent = 'در حال دریافت...';
                try {
                    await SQLStorage.pullFromGitHub();
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._reload();
                    Notification.success('داده‌ها دریافت شد');
                } catch (e) {
                    Notification.error(e.message, 12000);
                } finally {
                    pullBtn.disabled = false;
                    pullBtn.textContent = '⬇️ دریافت از GitHub';
                }
            });
        }

        const downloadBtn = document.getElementById('db-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                SQLStorage.downloadDatabase();
                Notification.success('فایل دانلود شد');
            });
        }

        const uploadInput = document.getElementById('db-upload');
        if (uploadInput) {
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const ok = await Modal.confirm('دیتابیس فعلی جایگزین شود؟', { danger: true });
                if (!ok) { uploadInput.value = ''; return; }
                try {
                    await SQLStorage.loadFromFile(file);
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                    this._reload();
                    Notification.success('دیتابیس بارگذاری شد');
                } catch (err) {
                    Notification.error('خطا: ' + err.message);
                } finally {
                    uploadInput.value = '';
                }
            });
        }

        const refreshBtn = document.getElementById('db-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this._reload();
                Notification.success('به‌روزرسانی شد');
            });
        }

        const dangerBtn = document.getElementById('db-danger-btn');
        if (dangerBtn) {
            dangerBtn.addEventListener('click', () => this._showDangerModal());
        }
    },

    _showDangerModal() {
        const content = `
            <div class="danger-modal">
                <div class="danger-warning">
                    ⚠️ <strong>هشدار</strong>
                    <p>این عملیات غیرقابل بازگشت هستند</p>
                </div>
                <div class="danger-options">
                    <button class="danger-option" data-action="reset-db" type="button">
                        <div class="danger-option-icon">🔄</div>
                        <div class="danger-option-text">
                            <strong>بازنشانی کل دیتابیس</strong>
                            <span>همه جداول پاک و از نو ساخته می‌شوند</span>
                        </div>
                    </button>
                    <button class="danger-option" data-action="clear-people" type="button">
                        <div class="danger-option-icon">👥</div>
                        <div class="danger-option-text">
                            <strong>حذف همه افراد</strong>
                            <span>شامل توصیفات و ارتباطات</span>
                        </div>
                    </button>
                    <button class="danger-option" data-action="clear-items" type="button">
                        <div class="danger-option-icon">🎁</div>
                        <div class="danger-option-text">
                            <strong>حذف همه آیتم‌ها</strong>
                            <span>شامل توصیفات آیتم‌ها</span>
                        </div>
                    </button>
                    <button class="danger-option" data-action="clear-history" type="button">
                        <div class="danger-option-icon">🎯</div>
                        <div class="danger-option-text">
                            <strong>حذف تاریخچه چرخش‌ها</strong>
                            <span>همه رکوردهای چرخش</span>
                        </div>
                    </button>
                    <button class="danger-option" data-action="clear-stories" type="button">
                        <div class="danger-option-icon">📚</div>
                        <div class="danger-option-text">
                            <strong>حذف همه داستان‌ها</strong>
                            <span>همه داستان‌های ساخته‌شده</span>
                        </div>
                    </button>
                </div>
            </div>
        `;

        Modal.open({
            title: '⚠️ منطقه خطر',
            content,
            size: 'md',
            buttons: [{ label: 'بستن', class: 'btn-secondary' }],
        });

        setTimeout(() => {
            document.querySelectorAll('[data-action]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const action = btn.dataset.action;
                    await this._handleDangerAction(action);
                });
            });
        }, 100);
    },

    async _handleDangerAction(action) {
        const configs = {
            'reset-db': {
                title: 'بازنشانی کل دیتابیس',
                message: 'تمام داده‌ها (افراد، آیتم‌ها، تاریخچه، داستان‌ها) پاک می‌شوند.\nمطمئن هستید؟',
                run: async () => {
                    await SQLStorage.reset();
                    if (App._loadDataFromSQL) App._loadDataFromSQL();
                },
            },
            'clear-people': {
                title: 'حذف همه افراد',
                message: 'همه‌ی افراد حذف می‌شوند. مطمئن هستید؟',
                run: async () => {
                    People.clear();
                },
            },
            'clear-items': {
                title: 'حذف همه آیتم‌ها',
                message: 'همه‌ی آیتم‌ها حذف می‌شوند. مطمئن هستید؟',
                run: async () => {
                    Items.clear();
                },
            },
            'clear-history': {
                title: 'حذف تاریخچه چرخش‌ها',
                message: 'همه‌ی چرخش‌ها حذف می‌شوند. مطمئن هستید؟',
                run: async () => {
                    History.clear();
                },
            },
            'clear-stories': {
                title: 'حذف همه داستان‌ها',
                message: 'همه‌ی داستان‌ها حذف می‌شوند. مطمئن هستید؟',
                run: async () => {
                    StoryManager.clear();
                },
            },
        };

        const config = configs[action];
        if (!config) return;

        const ok = await Modal.confirm(
            config.message,
            { danger: true, title: config.title, confirmLabel: 'بله، حذف کن' }
        );
        if (!ok) return;

        try {
            await config.run();
            Notification.success('انجام شد');
            Modal.closeAll();
            setTimeout(() => this._reload(), 300);
        } catch (e) {
            Logger.error('DatabasePage._handleDangerAction', e, { action });
            Notification.error('خطا: ' + e.message);
        }
    },

    _reload() {
        this._renderOverview();
        this._loadTable(this.currentTable);
    },

    // ═══════════════════════════════════════════
    // Load Table
    // ═══════════════════════════════════════════

    _loadTable(tableName) {
        const container = document.getElementById('db-table-content');
        if (!container) return;

        container.innerHTML = `
            <div class="db-empty">
                <div class="spinner"></div>
                <p>در حال بارگذاری...</p>
            </div>
        `;

        try {
            this._allRows = this._getRows(tableName);
            this._applyFilters();
        } catch (e) {
            Logger.error('DatabasePage._loadTable', e, { tableName });
            container.innerHTML = `
                <div class="db-empty">
                    <div class="db-empty-icon">⚠️</div>
                    <p>خطا در بارگذاری جدول</p>
                    <p class="text-muted">${this._escape(e.message)}</p>
                </div>
            `;
        }
    },

    /**
     * خواندن رکوردهای هر جدول
     */
    _getRows(tableName) {
        if (tableName === 'people') {
            const descriptions = {};
            SQLStorage.getAllDescriptions().forEach((d) => {
                descriptions[d.key] = d.value;
            });

            return SQLStorage.getAllPeople().map((p) => ({
                id: p.id,
                name: p.name || '—',
                description: descriptions[p.id] || p.description || '—',
                starred: p.starred === 1,
                inWheel: p.in_wheel === 1,
                color: p.color || '#8b5cf6',
                createdAt: p.created_at,
                _search: ((p.name || '') + ' ' + (descriptions[p.id] || '')).toLowerCase(),
            }));
        }

        if (tableName === 'items') {
            const descriptions = {};
            SQLStorage.getAllDescriptions().forEach((d) => {
                descriptions[d.key] = d.value;
            });

            return SQLStorage.getAllItems().map((i) => ({
                id: i.id,
                label: i.label || '—',
                description: descriptions[i.id] || '—',
                inWheel: i.in_wheel === 1,
                createdAt: i.created_at,
                _search: ((i.label || '') + ' ' + (descriptions[i.id] || '')).toLowerCase(),
            }));
        }

        if (tableName === 'descriptions') {
            // نقشه‌ی نام
            const peopleMap = {};
            SQLStorage.getAllPeople().forEach((p) => {
                peopleMap[p.id] = { name: p.name, type: 'person' };
            });
            const itemsMap = {};
            SQLStorage.getAllItems().forEach((i) => {
                itemsMap[i.id] = { name: i.label, type: 'item' };
            });

            return SQLStorage.getAllDescriptions().map((d) => {
                let ownerName = '—';
                let ownerType = '—';

                if (peopleMap[d.key]) {
                    ownerName = peopleMap[d.key].name;
                    ownerType = '👤 فرد';
                } else if (itemsMap[d.key]) {
                    ownerName = itemsMap[d.key].name;
                    ownerType = '🎁 آیتم';
                }

                return {
                    id: d.key,
                    key: d.key,
                    ownerName,
                    ownerType,
                    value: d.value || '—',
                    updatedAt: d.updated_at,
                    _search: ((ownerName || '') + ' ' + (d.value || '')).toLowerCase(),
                };
            });
        }

        if (tableName === 'history') {
            return SQLStorage.getHistory(1000).map((h) => ({
                id: h.id,
                winner: h.winner_name || '—',
                mode: h.mode === 'elimination' ? '🔥 حذفی' : '🎯 تک‌نفره',
                modeRaw: h.mode,
                spinType: h.spin_type === 'starred' ? '⭐ ستاره‌دار' : '🎲 تصادفی',
                spinTypeRaw: h.spin_type,
                timestamp: h.timestamp,
                _search: (h.winner_name || '').toLowerCase(),
            }));
        }

        if (tableName === 'stories') {
            return SQLStorage.getAllStories(1000).map((s) => {
                const plain = (s.content || '')
                    .replace(/^#+\s+/gm, '')
                    .replace(/\*\*(.+?)\*\*/g, '$1')
                    .replace(/\*(.+?)\*/g, '$1')
                    .replace(/\n+/g, ' ')
                    .trim();

                return {
                    id: s.id,
                    model: s.model || '—',
                    preview: plain.substring(0, 200),
                    fullContent: s.content,
                    words: (plain.match(/\S+/g) || []).length,
                    timestamp: s.timestamp,
                    _search: (plain + ' ' + (s.model || '')).toLowerCase(),
                };
            });
        }

        if (tableName === 'settings') {
            return SQLStorage.query('SELECT key, value FROM settings').map((s) => {
                let parsed = s.value;
                let type = 'string';

                try {
                    const p = JSON.parse(s.value);
                    parsed = p;
                    if (Array.isArray(p)) type = 'array';
                    else if (typeof p === 'object' && p !== null) type = 'object';
                    else type = typeof p;
                } catch (e) {
                    type = 'string';
                }

                const displayValue = typeof parsed === 'object'
                    ? JSON.stringify(parsed, null, 0).substring(0, 200)
                    : String(parsed);

                return {
                    id: s.key,
                    key: s.key,
                    value: displayValue,
                    rawValue: s.value,
                    type,
                    _search: (s.key + ' ' + displayValue).toLowerCase(),
                };
            });
        }

        return [];
    },

    // ═══════════════════════════════════════════
    // Filter + Sort + Paginate
    // ═══════════════════════════════════════════

    _applyFilters() {
        let rows = [...this._allRows];

        // فیلتر جستجو
        if (this.currentSearch) {
            rows = rows.filter((r) => (r._search || '').includes(this.currentSearch));
        }

        // مرتب‌سازی
        const sort = this.currentSort;
        rows.sort((a, b) => {
            if (sort === 'newest') {
                return (b.createdAt || b.timestamp || b.updatedAt || 0) -
                       (a.createdAt || a.timestamp || a.updatedAt || 0);
            }
            if (sort === 'oldest') {
                return (a.createdAt || a.timestamp || a.updatedAt || 0) -
                       (b.createdAt || b.timestamp || b.updatedAt || 0);
            }
            if (sort === 'name-asc' || sort === 'name-desc') {
                const an = (a.name || a.label || a.winner || a.model || a.key || '').toString();
                const bn = (b.name || b.label || b.winner || b.model || b.key || '').toString();
                const cmp = an.localeCompare(bn, 'fa');
                return sort === 'name-asc' ? cmp : -cmp;
            }
            return 0;
        });

        this._filteredRows = rows;
        this._renderTable();
    },

    _renderTable() {
        const container = document.getElementById('db-table-content');
        if (!container) return;

        const config = this.TABLES[this.currentTable];
        if (!config) return;

        const rows = this._filteredRows;

        if (rows.length === 0) {
            const isFiltered = this.currentSearch || this._allRows.length > 0;
            container.innerHTML = `
                <div class="db-empty">
                    <div class="db-empty-icon">${isFiltered ? '🔍' : config.icon}</div>
                    <p>${isFiltered ? 'نتیجه‌ای برای این جستجو یافت نشد' : config.emptyText}</p>
                    ${isFiltered ? `<button class="btn btn-secondary btn-sm" id="clear-search-btn" type="button">پاک کردن فیلتر</button>` : ''}
                </div>
            `;
            document.getElementById('clear-search-btn')?.addEventListener('click', () => {
                this.currentSearch = '';
                const si = document.getElementById('db-search');
                if (si) si.value = '';
                this._applyFilters();
            });
            this._renderPagination(0);
            return;
        }

        // صفحه‌بندی
        const totalPages = Math.ceil(rows.length / this.itemsPerPage);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const pageRows = rows.slice(start, start + this.itemsPerPage);

        // Grid template
        const gridTemplate = config.columns.map((c) => c.width).join(' ') + ' 60px';

        // Header
        const headerHtml = config.columns
            .map((c) => `<div class="db-col" style="text-align: ${c.align || 'right'};">${c.label}</div>`)
            .join('') + '<div class="db-col db-col-actions">عملیات</div>';

        // Rows
        const rowsHtml = pageRows.map((row) => this._renderRow(row, config, gridTemplate)).join('');

        container.innerHTML = `
            <div class="db-table">
                <div class="db-table-header" style="grid-template-columns: ${gridTemplate};">
                    ${headerHtml}
                </div>
                <div class="db-table-body">
                    ${rowsHtml}
                </div>
            </div>
        `;

        // رویدادها
        container.querySelectorAll('[data-row-id]').forEach((row) => {
            row.querySelectorAll('[data-cell-action]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.cellAction;
                    const id = btn.dataset.id;

                    if (action === 'delete') {
                        this._deleteRow(id);
                    } else if (action === 'view') {
                        this._viewRow(id);
                    } else if (action === 'edit-description') {
                        window.location.href = 'description.html';
                    } else if (action === 'copy-key') {
                        Utils.copyToClipboard(id).then((ok) => {
                            if (ok) Notification.success('کپی شد');
                        });
                    }
                });
            });
        });

        this._renderPagination(rows.length);
    },

    _renderRow(row, config, gridTemplate) {
        let cells = '';

        for (const col of config.columns) {
            cells += this._renderCell(col, row);
        }

        // دکمه‌های عملیات
        const deleteAllowed = this.currentTable !== 'settings';
        const actionsHtml = `
            <div class="db-cell db-cell-actions">
                ${this.currentTable === 'stories' ? `
                    <button class="db-row-btn" data-cell-action="view" data-id="${row.id}" type="button" title="مشاهده">👁</button>
                ` : ''}
                ${this.currentTable === 'descriptions' ? `
                    <button class="db-row-btn" data-cell-action="edit-description" data-id="${row.id}" type="button" title="ویرایش در صفحه توصیف‌ها">✏️</button>
                ` : ''}
                ${deleteAllowed ? `
                    <button class="db-row-btn db-row-btn-danger" data-cell-action="delete" data-id="${row.id}" type="button" title="حذف">🗑</button>
                ` : `
                    <button class="db-row-btn" data-cell-action="copy-key" data-id="${row.id}" type="button" title="کپی کلید">📋</button>
                `}
            </div>
        `;

        return `
            <div class="db-row" data-row-id="${row.id}" style="grid-template-columns: ${gridTemplate};">
                ${cells}
                ${actionsHtml}
            </div>
        `;
    },

    _renderCell(col, row) {
        const value = row[col.key];
        const align = col.align || 'right';
        const alignStyle = `text-align: ${align};`;

        // انواع خاص
        if (this.currentTable === 'people') {
            if (col.key === 'name') {
                return `
                    <div class="db-cell" style="${alignStyle}">
                        <span class="db-dot" style="background: ${row.color};"></span>
                        <strong>${this._escape(value)}</strong>
                    </div>
                `;
            }
            if (col.key === 'flags') {
                const flags = [];
                if (row.starred) flags.push('<span class="db-flag" title="ستاره‌دار">⭐</span>');
                if (row.inWheel) flags.push('<span class="db-flag" title="در گردونه">🎡</span>');
                return `<div class="db-cell db-cell-flags" style="${alignStyle}">${flags.join('') || '—'}</div>`;
            }
            if (col.key === 'createdAt') {
                return `<div class="db-cell db-cell-muted" style="${alignStyle}">${Utils.formatDate(value).split('،')[0] || '—'}</div>`;
            }
            if (col.key === 'description') {
                const text = Utils.truncate(String(value || ''), 80);
                return `<div class="db-cell db-cell-muted" style="${alignStyle}">${this._escape(text)}</div>`;
            }
        }

        if (this.currentTable === 'items') {
            if (col.key === 'label') {
                return `<div class="db-cell" style="${alignStyle}"><span class="db-icon">🎁</span> <strong>${this._escape(value)}</strong></div>`;
            }
            if (col.key === 'description') {
                const text = Utils.truncate(String(value || ''), 100);
                return `<div class="db-cell db-cell-muted" style="${alignStyle}">${this._escape(text)}</div>`;
            }
        }

        if (this.currentTable === 'descriptions') {
            if (col.key === 'value') {
                const text = Utils.truncate(String(value || ''), 100);
                return `<div class="db-cell" style="${alignStyle}">${this._escape(text)}</div>`;
            }
            if (col.key === 'ownerType') {
                return `<div class="db-cell" style="${alignStyle}">${this._escape(value)}</div>`;
            }
        }

        if (this.currentTable === 'history') {
            if (col.key === 'mode' || col.key === 'spinType') {
                return `<div class="db-cell" style="${alignStyle}"><span class="db-tag">${this._escape(value)}</span></div>`;
            }
        }

        if (this.currentTable === 'stories') {
            if (col.key === 'model') {
                const short = this._shortenModel(value);
                return `<div class="db-cell" style="${alignStyle}"><span class="db-model-badge">${this._escape(short)}</span></div>`;
            }
            if (col.key === 'words') {
                return `<div class="db-cell" style="${alignStyle}"><span class="db-count">${Utils.toPersianNumbers(value || 0)}</span></div>`;
            }
            if (col.key === 'preview') {
                const text = Utils.truncate(String(value || ''), 130);
                return `<div class="db-cell db-cell-muted" style="${alignStyle}">${this._escape(text)}</div>`;
            }
        }

        if (this.currentTable === 'settings') {
            if (col.key === 'key') {
                return `<div class="db-cell" style="${alignStyle}"><code class="db-code">${this._escape(value)}</code></div>`;
            }
            if (col.key === 'value') {
                return `<div class="db-cell db-cell-muted" style="${alignStyle}"><code class="db-code db-code-sm">${this._escape(Utils.truncate(value, 80))}</code></div>`;
            }
            if (col.key === 'type') {
                return `<div class="db-cell" style="${alignStyle}"><span class="db-tag">${this._escape(value)}</span></div>`;
            }
        }

        // پیش‌فرض
        if (col.key === 'createdAt' || col.key === 'timestamp' || col.key === 'updatedAt') {
            return `<div class="db-cell db-cell-muted" style="${alignStyle}">${Utils.formatDate(value).split('،')[0] || '—'}</div>`;
        }

        return `<div class="db-cell" style="${alignStyle}">${this._escape(String(value || '—'))}</div>`;
    },

    // ═══════════════════════════════════════════
    // Pagination
    // ═══════════════════════════════════════════

    _renderPagination(totalRows) {
        const container = document.getElementById('db-pagination');
        if (!container) return;

        if (totalRows === 0) {
            container.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalRows / this.itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = `
                <div class="db-pagination-info">
                    نمایش ${Utils.toPersianNumbers(totalRows)} مورد
                </div>
            `;
            return;
        }

        const pages = [];
        const current = this.currentPage;

        // صفحه‌های اطراف
        pages.push(1);
        for (let i = current - 1; i <= current + 1; i++) {
            if (i > 1 && i < totalPages) pages.push(i);
        }
        if (totalPages > 1) pages.push(totalPages);

        // حذف تکراری + مرتب‌سازی
        const unique = [...new Set(pages)].sort((a, b) => a - b);

        // ساخت HTML
        let paginationHtml = '';
        let prevPage = 0;
        for (const p of unique) {
            if (p - prevPage > 1) {
                paginationHtml += '<span class="db-page-dots">…</span>';
            }
            paginationHtml += `
                <button class="db-page-btn ${p === current ? 'active' : ''}" data-page="${p}" type="button">
                    ${Utils.toPersianNumbers(p)}
                </button>
            `;
            prevPage = p;
        }

        container.innerHTML = `
            <button class="db-page-btn db-page-nav" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} type="button">‹ قبلی</button>
            <div class="db-page-numbers">${paginationHtml}</div>
            <button class="db-page-btn db-page-nav" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''} type="button">بعدی ›</button>
            <div class="db-pagination-info">
                ${Utils.toPersianNumbers((current - 1) * this.itemsPerPage + 1)} - ${Utils.toPersianNumbers(Math.min(current * this.itemsPerPage, totalRows))} از ${Utils.toPersianNumbers(totalRows)}
            </div>
        `;

        container.querySelectorAll('[data-page]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page);
                if (p < 1 || p > totalPages || p === current) return;
                this.currentPage = p;
                this._renderTable();
                document.querySelector('.db-table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    },

    // ═══════════════════════════════════════════
    // Row Actions
    // ═══════════════════════════════════════════

    async _deleteRow(id) {
        const names = {
            people: 'این فرد',
            items: 'این آیتم',
            descriptions: 'این توصیف',
            history: 'این چرخش',
            stories: 'این داستان',
        };
        const name = names[this.currentTable] || 'این مورد';

        const ok = await Modal.confirm(
            `${name} حذف شود؟\n(این عمل غیرقابل بازگشت است)`,
            { danger: true, confirmLabel: 'حذف کن', title: 'تأیید حذف' }
        );
        if (!ok) return;

        try {
            if (this.currentTable === 'people') People.remove(id);
            else if (this.currentTable === 'items') Items.remove(id);
            else if (this.currentTable === 'descriptions') Descriptions.remove(id);
            else if (this.currentTable === 'history') History.remove(id);
            else if (this.currentTable === 'stories') StoryManager.remove(id);

            Notification.success('حذف شد');
            this._reload();
        } catch (e) {
            Logger.error('DatabasePage._deleteRow', e, { table: this.currentTable, id });
            Notification.error('خطا: ' + e.message);
        }
    },

    _viewRow(id) {
        if (this.currentTable !== 'stories') return;

        const story = this.getAllStories().find((s) => s.id === id);
        if (!story) return;

        const html = StoryManager.renderToHTML(story.content);

        const content = `
            <div class="story-view-modal">
                <div class="story-view-content">${html}</div>
                <div class="story-view-footer">
                    <span>🤖 ${this._escape(this._shortenModel(story.model))}</span>
                    <span>📏 ${Utils.toPersianNumbers((story.content || '').split(/\s+/).length)} کلمه</span>
                    <span>🕐 ${Utils.formatDate(story.timestamp)}</span>
                </div>
            </div>
        `;

        Modal.open({
            title: '📖 مشاهده داستان',
            content,
            size: 'lg',
            buttons: [{ label: 'بستن', class: 'btn-secondary' }],
        });
    },

    getAllStories() {
        try {
            return SQLStorage.getAllStories(1000).map((s) => ({
                id: s.id,
                content: s.content,
                model: s.model,
                timestamp: s.timestamp,
            }));
        } catch (e) {
            return [];
        }
    },

    async _deleteFiltered() {
        if (this._filteredRows.length === 0) {
            Notification.info('نتیجه‌ای برای حذف وجود ندارد');
            return;
        }

        if (this.currentTable === 'settings') {
            Notification.warning('حذف تنظیمات از این صفحه مجاز نیست');
            return;
        }

        const names = {
            people: 'فرد',
            items: 'آیتم',
            descriptions: 'توصیف',
            history: 'چرخش',
            stories: 'داستان',
        };

        const ok = await Modal.confirm(
            `آیا از حذف ${Utils.toPersianNumbers(this._filteredRows.length)} ${names[this.currentTable]} مطمئن هستید؟\n(این عمل غیرقابل بازگشت است)`,
            { danger: true, title: 'حذف نتایج فیلتر', confirmLabel: 'بله، حذف کن' }
        );
        if (!ok) return;

        try {
            const ids = this._filteredRows.map((r) => r.id);

            if (this.currentTable === 'people') ids.forEach((id) => People.remove(id));
            else if (this.currentTable === 'items') ids.forEach((id) => Items.remove(id));
            else if (this.currentTable === 'descriptions') ids.forEach((id) => Descriptions.remove(id));
            else if (this.currentTable === 'history') ids.forEach((id) => History.remove(id));
            else if (this.currentTable === 'stories') ids.forEach((id) => StoryManager.remove(id));

            Notification.success(`${Utils.toPersianNumbers(ids.length)} مورد حذف شد`);
            this._reload();
        } catch (e) {
            Logger.error('DatabasePage._deleteFiltered', e);
            Notification.error('خطا: ' + e.message);
        }
    },

    _shortenModel(model) {
        if (!model) return 'نامشخص';
        let m = model.replace(':free', '');
        if (m.includes('/')) m = m.split('/').pop();
        if (m.length > 22) m = m.substring(0, 22) + '…';
        return m;
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};

if (document.getElementById('db-tabs')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => DatabasePage.init(), 500);
    });
}

window.DatabasePage = DatabasePage;