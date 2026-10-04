/**
 * مدیریت توصیفات - متصل به SQLStorage
 * @module descriptions
 */

const Descriptions = {
    /**
     * دریافت همه توصیفات
     */
    getAll() {
        return AppState.get('descriptions') || {};
    },

    /**
     * دریافت توصیف
     */
    get(key) {
        return this.getAll()[key] || '';
    },

    /**
     * تنظیم توصیف
     */
    set(key, value) {
        if (!key) return;

        SQLStorage.setDescription(key, value);

        const descriptions = { ...this.getAll() };
        descriptions[key] = value;
        AppState.set('descriptions', descriptions);

        this._sync();
    },

    /**
     * حذف توصیف
     */
    remove(key) {
        SQLStorage.removeDescription(key);

        const descriptions = { ...this.getAll() };
        delete descriptions[key];
        AppState.set('descriptions', descriptions);

        this._sync();
        Notification.info('توصیف حذف شد');
    },

    /**
     * دریافت کلیدها
     */
    getKeys() {
        return Object.keys(this.getAll());
    },

    /**
     * جستجو
     */
    search(query) {
        const q = query.toLowerCase();
        const results = {};
        Object.entries(this.getAll()).forEach(([key, value]) => {
            if (key.toLowerCase().includes(q) || (value && value.toLowerCase().includes(q))) {
                results[key] = value;
            }
        });
        return results;
    },

    /**
     * همگام‌سازی
     */
    async _sync() {
        await SQLStorage.saveNow();
        if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
            try {
                await GitHubStorage.saveDescriptions(this.getAll());
            } catch (e) {
                console.error('خطا در همگام‌سازی توصیفات:', e);
            }
        }
    },
};

window.Descriptions = Descriptions;