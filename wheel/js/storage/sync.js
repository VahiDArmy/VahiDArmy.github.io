/**
 * همگام‌سازی بین SQLite محلی و GitHub
 * @module sync
 */

const Sync = {
    _autoSyncTimer: null,
    _isSyncing: false,

    /**
     * شروع همگام‌سازی خودکار
     */
    startAutoSync() {
        if (this._autoSyncTimer) return;
        const interval = AppState.get('settings.syncInterval') || 60000;
        
        this._autoSyncTimer = setInterval(async () => {
            if (this._isSyncing) return;
            try {
                await this.fullSync();
            } catch (e) {
                console.warn('خطا در همگام‌سازی خودکار:', e);
            }
        }, interval);

        console.log(`🔄 همگام‌سازی خودکار هر ${interval / 1000} ثانیه فعال شد`);
    },

    /**
     * توقف همگام‌سازی خودکار
     */
    stopAutoSync() {
        if (this._autoSyncTimer) {
            clearInterval(this._autoSyncTimer);
            this._autoSyncTimer = null;
            console.log('⏹ همگام‌سازی خودکار متوقف شد');
        }
    },

    /**
     * همگام‌سازی کامل (دو طرفه)
     */
    async fullSync() {
        if (this._isSyncing) return;
        if (!GitHubStorage.isConfigured()) return;

        this._isSyncing = true;
        try {
            // ۱. ذخیره SQLite به GitHub
            await SQLStorage.pushToGitHub('همگام‌سازی خودکار');
            
            // ۲. ذخیره فایل‌های JSON
            await this.syncJSONFiles();
            
            console.log('✅ همگام‌سازی کامل شد');
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * ذخیره فایل‌های JSON در GitHub
     */
    async syncJSONFiles() {
        const tasks = [
            GitHubStorage.savePeople(AppState.get('people')),
            GitHubStorage.saveItems(AppState.get('items')),
            GitHubStorage.saveDescriptions(AppState.get('descriptions')),
            GitHubStorage.saveHistory(AppState.get('history')),
        ];
        await Promise.allSettled(tasks);
    },

    /**
     * بارگذاری از GitHub (اولین بار)
     */
    async initialPull() {
        if (!GitHubStorage.isConfigured()) return false;

        try {
            const data = await GitHubStorage.loadAll();

            // بارگذاری به SQL
            if (data.people && data.people.length > 0) {
                data.people.forEach((p) => {
                    SQLStorage.addPerson(p);
                });
            }

            if (data.items && data.items.length > 0) {
                data.items.forEach((i) => {
                    try {
                        SQLStorage.addItem(i.label);
                    } catch (e) {
                        // ممکن است تکراری باشد
                    }
                });
            }

            if (data.descriptions) {
                Object.entries(data.descriptions).forEach(([key, value]) => {
                    SQLStorage.setDescription(key, value);
                });
            }

            await SQLStorage.saveNow();
            Notification.success('داده‌ها از GitHub بارگذاری شد');
            return true;
        } catch (error) {
            console.error('خطا در بارگذاری اولیه:', error);
            return false;
        }
    },

    /**
     * تست اتصال GitHub
     */
    async testGitHubConnection() {
        if (!GitHubStorage.isConfigured()) {
            return { success: false, message: 'تنظیمات کامل نیست' };
        }

        try {
            const user = await GitHubStorage.testConnection();
            if (user) {
                return { success: true, message: 'اتصال برقرار است' };
            }
            return { success: false, message: 'توکن نامعتبر' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },
};

window.Sync = Sync;