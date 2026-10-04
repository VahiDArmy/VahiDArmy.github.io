/**
 * ذخیره‌سازی محلی
 * @module localStorage
 */

const LocalStorage = {
    prefix: 'wheel_app_',

    /**
     * ذخیره
     */
    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('خطا در ذخیره‌سازی:', e);
            return false;
        }
    },

    /**
     * بازیابی
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(this.prefix + key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('خطا در بازیابی:', e);
            return defaultValue;
        }
    },

    /**
     * حذف
     */
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    },

    /**
     * پاک کردن همه
     */
    clear() {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(this.prefix))
            .forEach((k) => localStorage.removeItem(k));
    },

    /**
     * ذخیره افراد
     */
    savePeople() {
        this.set('people', AppState.get('people'));
    },

    /**
     * ذخیره آیتم‌ها
     */
    saveItems() {
        this.set('items', AppState.get('items'));
    },

    /**
     * ذخیره توصیفات
     */
    saveDescriptions() {
        this.set('descriptions', AppState.get('descriptions'));
    },

    /**
     * ذخیره تاریخچه
     */
    saveHistory() {
        this.set('history', AppState.get('history'));
    },

    /**
     * ذخیره تنظیمات
     */
    saveSettings() {
        this.set('settings', AppState.get('settings'));
    },

    /**
     * بارگذاری همه
     */
    loadAll() {
        const people = this.get('people', []);
        const items = this.get('items', []);
        const descriptions = this.get('descriptions', {});
        const history = this.get('history', []);
        const stories = this.get('stories', []);
        const settings = this.get('settings', {});

        AppState.set('people', people);
        AppState.set('items', items);
        AppState.set('descriptions', descriptions);
        AppState.set('history', history);
        AppState.set('stories', stories);
        
        if (Object.keys(settings).length > 0) {
            AppState.set('settings', Utils.deepMerge(AppState.get('settings'), settings));
        }
    },

    /**
     * بررسی فضای مصرفی
     */
    getStorageSize() {
        let total = 0;
        Object.keys(localStorage)
            .filter((k) => k.startsWith(this.prefix))
            .forEach((k) => {
                total += localStorage.getItem(k).length;
            });
        return total;
    },
};

window.LocalStorage = LocalStorage;