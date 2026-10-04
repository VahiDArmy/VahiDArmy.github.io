/**
 * مدیریت رویدادهای سراسری برنامه
 * @module events
 */

const Events = {
    _handlers: {},

    init() {
        this._initHeaderEvents();
        this._initKeyboardEvents();
        this._initWindowEvents();
        this._initStorageEvents();
        console.log('✅ رویدادها راه‌اندازی شد');
    },

    on(eventName, callback) {
        if (!this._handlers[eventName]) {
            this._handlers[eventName] = [];
        }
        this._handlers[eventName].push(callback);
        return () => this.off(eventName, callback);
    },

    off(eventName, callback) {
        if (!this._handlers[eventName]) return;
        this._handlers[eventName] = this._handlers[eventName].filter(
            (cb) => cb !== callback
        );
    },

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
        // ─── دکمه منوی موبایل (همبرگری) ───
        const navToggle = document.getElementById('nav-toggle');
        const nav = document.querySelector('.header-nav');
        
        if (navToggle && nav) {
            navToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = nav.classList.toggle('open');
                navToggle.classList.toggle('active', isOpen);
            });
        }

        // ─── بستن منو هنگام کلیک روی لینک ───
        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                if (nav) nav.classList.remove('open');
                if (navToggle) navToggle.classList.remove('active');
            });
        });

        // ─── بستن منو هنگام کلیک بیرون ───
        document.addEventListener('click', (e) => {
            if (!nav || !nav.classList.contains('open')) return;
            if (nav.contains(e.target) || (navToggle && navToggle.contains(e.target))) return;
            nav.classList.remove('open');
            if (navToggle) navToggle.classList.remove('active');
        });

        // ─── دکمه تغییر تم ───
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    Theme.toggle();
                } catch (err) {
                    console.error('خطا در تغییر تم:', err);
                }
            });
        }

        // ─── دکمه همگام‌سازی ───
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._handleManualSync();
            });
        }
    },

    /**
     * همگام‌سازی دستی
     */
    async _handleManualSync() {
        try {
            if (typeof GitHubStorage === 'undefined' || !GitHubStorage.isConfigured()) {
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
        } catch (e) {
            console.error('خطا در همگام‌سازی دستی:', e);
        }
    },

    /**
     * رویدادهای کیبورد
     */
    _initKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Escape برای بستن مودال
            if (e.key === 'Escape') {
                try {
                    if (typeof Modal !== 'undefined') Modal.closeAll();
                } catch (err) {}
            }

            // Ctrl+S برای ذخیره
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this._handleManualSave();
            }

            // Space برای چرخش گردونه
            if (e.code === 'Space' && AppState.get('ui.currentPage') === 'wheel') {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    return;
                }
                e.preventDefault();
                if (window.WheelPage && typeof WheelCore !== 'undefined' && !WheelCore.isSpinning) {
                    if (WheelPage._spinRandom) WheelPage._spinRandom();
                }
            }
        });
    },

    async _handleManualSave() {
        try {
            if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                await SQLStorage.saveNow();
                Notification.success('داده‌ها ذخیره شد');
            }
        } catch (error) {
            Notification.error('خطا در ذخیره‌سازی: ' + error.message);
        }
    },

    /**
     * رویدادهای پنجره
     */
    _initWindowEvents() {
        window.addEventListener('beforeunload', () => {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    SQLStorage.saveNow();
                }
            } catch (e) {}
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                try {
                    if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                        SQLStorage.saveNow();
                    }
                } catch (e) {}
            }
        });

        window.addEventListener('online', () => {
            try { Notification.info('اتصال اینترنت برقرار شد'); } catch (e) {}
        });

        window.addEventListener('offline', () => {
            try { Notification.warning('اتصال اینترنت قطع شد - حالت آفلاین'); } catch (e) {}
        });
    },

    /**
     * رویدادهای ذخیره‌سازی
     */
    _initStorageEvents() {
        AppState.subscribe('people', () => this.emit('people-changed'));
        AppState.subscribe('items', () => this.emit('items-changed'));
        AppState.subscribe('history', () => this.emit('history-changed'));
        AppState.subscribe('stories', () => this.emit('stories-changed'));
    },
};

window.Events = Events;