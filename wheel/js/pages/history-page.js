/**
 * منطق صفحه تاریخچه
 * @module historyPage
 */

const HistoryPage = {
    currentFilter: 'all',

    /**
     * راه‌اندازی
     */
    init() {
        this._renderStats();
        this._renderHistoryList();
        this._initFilters();
        this._initActions();
        this._bindEvents();
    },

    /**
     * نمایش آمار
     */
    _renderStats() {
        const stats = History.getStats();

        this._setText('h-total', Utils.toPersianNumbers(stats.total));
        this._setText('h-random', Utils.toPersianNumbers(stats.randomCount));
        this._setText('h-starred', Utils.toPersianNumbers(stats.starredCount));

        const topEl = document.getElementById('h-top-winner');
        if (topEl) {
            if (stats.topWinner) {
                topEl.textContent = `${stats.topWinner.name} (${Utils.toPersianNumbers(stats.topWinner.wins)} برد)`;
            } else {
                topEl.textContent = '—';
            }
        }
    },

    /**
     * رندر لیست تاریخچه
     */
    _renderHistoryList() {
        const container = document.getElementById('history-list');
        if (!container) return;

        let history = History.getAll();

        // فیلتر
        if (this.currentFilter === 'random') {
            history = history.filter((h) => h.spinType === 'random');
        } else if (this.currentFilter === 'starred') {
            history = history.filter((h) => h.spinType === 'starred');
        } else if (this.currentFilter === 'elimination') {
            history = history.filter((h) => h.mode === 'elimination');
        }

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📜</div>
                    <p>تاریخچه‌ای برای نمایش وجود ندارد</p>
                </div>
            `;
            return;
        }

        container.innerHTML = history
            .map(
                (h) => `
                <div class="history-item" data-id="${h.id}">
                    <div class="history-icon">${h.spinType === 'starred' ? '⭐' : '🎲'}</div>
                    <div class="history-info">
                        <div class="history-winner">${this._escape(h.winner_name || 'نامشخص')}</div>
                        <div class="history-meta">
                            <span class="badge badge-${h.spinType}">${h.spinType === 'starred' ? 'ستاره‌دار' : 'تصادفی'}</span>
                            <span class="badge badge-${h.mode}">${h.mode === 'elimination' ? 'حذفی' : 'تک‌نفره'}</span>
                            <span class="text-muted">${Utils.formatDate(h.timestamp)}</span>
                        </div>
                    </div>
                    <button class="icon-btn history-delete" data-delete-id="${h.id}" title="حذف">🗑</button>
                </div>
            `
            )
            .join('');

        container.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.deleteId;
                const ok = await Modal.confirm('این رکورد حذف شود؟', { danger: true });
                if (ok) {
                    History.remove(id);
                    this._renderStats();
                    this._renderHistoryList();
                }
            });
        });
    },

    /**
     * فیلترها
     */
    _initFilters() {
        document.querySelectorAll('[data-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this._renderHistoryList();
            });
        });
    },

    /**
     * دکمه‌های عملیات
     */
    _initActions() {
        const clearBtn = document.getElementById('clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm(
                    'همه تاریخچه پاک شود؟ این عمل قابل بازگشت نیست.',
                    { danger: true }
                );
                if (ok) {
                    History.clear();
                    this._renderStats();
                    this._renderHistoryList();
                }
            });
        }

        const exportBtn = document.getElementById('export-history-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = JSON.stringify(History.getAll(), null, 2);
                Utils.downloadFile(data, `history-${Date.now()}.json`);
                Notification.success('فایل دانلود شد');
            });
        }
    },

    /**
     * رویدادها
     */
    _bindEvents() {
        Events.on('history-changed', () => {
            this._renderStats();
            this._renderHistoryList();
        });
    },

    _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

if (document.getElementById('history-list')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => HistoryPage.init(), 500);
    });
}

window.HistoryPage = HistoryPage;