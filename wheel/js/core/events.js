/**
 * مدیریت رویدادهای سراسری برنامه
 * @module events
 */

const Events = {
    _handlers: {},

    /**
     * راه‌اندازی رویدادهای عمومی
     */
    init() {
        this._initHeaderEvents();
        this._initKeyboardEvents();
        this._initWindowEvents();
        this._initStorageEvents();
        console.log('✅ رویدادها راه‌اندازی شد');
    },

    /**
     * ثبت شنونده رویداد سفارشی
     */
    on(eventName, callback) {
        if (!this._handlers[eventName]) {
            this._handlers[eventName] = [];
        }
        this._handlers[eventName].push(callback);
        return () => this.off(eventName, callback);
    },

    /**
     * حذف شنونده
     */
    off(eventName, callback) {
        if (!this._handlers[eventName]) return;
        this._handlers[eventName] = this._handlers[eventName].filter(
            (cb) => cb !== callback
        );
    },

    /**
     * انتشار رویداد سفارشی
     */
    emit(eventName, data) {
        if (!this._handlers[eventName]) return;
        this._handlers[eventName].forEach((cb) => {
            try {
                cb(data);
            } catch (e) {
                console.error(`خطا در اجرای رویداد ${eventName}:`, e);
            }
        });
    },

    /**
     * رویدادهای هدر
     */
    _initHeaderEvents() {
        // دکمه تغییر تم
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => Theme.toggle());
        }

        // دکمه همگام‌سازی
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this._handleManualSync());
        }

        // منوی موبایل
        const navToggle = document.getElementById('nav-toggle');
        const nav = document.querySelector('.header-nav');
        if (navToggle && nav) {
            navToggle.addEventListener('click', () => {
                nav.classList.toggle('open');
            });
        }
    },

    /**
     * همگام‌سازی دستی
     */
    async _handleManualSync() {
        if (!GitHubStorage.isConfigured()) {
            Notification.warning('ابتدا تنظیمات GitHub را در صفحه تنظیمات وارد کنید');
            return;
        }

        const btn = document.getElementById('sync-btn');
        if (btn) btn.disabled = true;

        try {
            await Sync.fullSync();
            Notification.success('همگام‌سازی با موفقیت انجام شد');
        } catch (error) {
            Notification.error('خطا در همگام‌سازی: ' + error.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    /**
     * رویدادهای کیبورد
     */
    _initKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Escape برای بستن مودال
            if (e.key === 'Escape') {
                Modal.closeAll();
            }

            // Ctrl+S برای ذخیره
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this._handleManualSave();
            }

            // Space برای چرخش گردونه (اگر در صفحه گردونه باشیم)
            if (e.code === 'Space' && AppState.get('ui.currentPage') === 'wheel') {
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName === 'INPUT') return;
                e.preventDefault();
                if (window.WheelPage && !WheelCore.isSpinning) {
                    WheelPage.handleSpin('press');
                }
            }

            // Ctrl+K برای جستجو
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.emit('open-search');
            }
        });
    },

    /**
     * ذخیره دستی
     */
    async _handleManualSave() {
        try {
            await SQLStorage.saveNow();
            Notification.success('داده‌ها ذخیره شد');
        } catch (error) {
            Notification.error('خطا در ذخیره‌سازی: ' + error.message);
        }
    },

    /**
     * رویدادهای پنجره
     */
    _initWindowEvents() {
        // ذخیره قبل از بستن
        window.addEventListener('beforeunload', () => {
            SQLStorage.saveNow();
        });

        // ذخیره در حالت مخفی
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                SQLStorage.saveNow();
            }
        });

        // آنلاین/آفلاین
        window.addEventListener('online', () => {
            Notification.info('اتصال اینترنت برقرار شد');
        });

        window.addEventListener('offline', () => {
            Notification.warning('اتصال اینترنت قطع شد - حالت آفلاین');
        });
    },

    /**
     * رویدادهای ذخیره‌سازی
     */
    _initStorageEvents() {
        // تغییرات در State
        AppState.subscribe('people', () => this.emit('people-changed'));
        AppState.subscribe('items', () => this.emit('items-changed'));
        AppState.subscribe('history', () => this.emit('history-changed'));
        AppState.subscribe('stories', () => this.emit('stories-changed'));
    },
};

window.Events = Events;