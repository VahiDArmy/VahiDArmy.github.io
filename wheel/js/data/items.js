/**
 * مدیریت آیتم‌ها - متصل به SQLStorage
 * @module items
 */

const Items = {
    /**
     * دریافت همه آیتم‌ها
     */
    getAll() {
        return AppState.get('items') || [];
    },

    /**
     * دریافت با شناسه
     */
    getById(id) {
        return this.getAll().find((i) => i.id === id);
    },

    /**
     * افزودن آیتم
     */
    add(label) {
        if (!label || !label.trim()) {
            Notification.warning('نام آیتم نمی‌تواند خالی باشد');
            return null;
        }

        const trimmed = label.trim();

        // بررسی تکراری در حافظه
        if (this.getAll().some((i) => i.label === trimmed)) {
            Notification.warning('این آیتم قبلاً اضافه شده است');
            return null;
        }

        const newItem = SQLStorage.addItem(trimmed);
        if (!newItem) return null;

        const normalized = {
            ...newItem,
            createdAt: newItem.created_at,
        };

        const items = this.getAll();
        items.push(normalized);
        AppState.set('items', items);

        Notification.success(`آیتم «${trimmed}» افزوده شد`);
        this._sync();
        return normalized;
    },

    /**
     * حذف آیتم
     */
    remove(id) {
        const item = this.getById(id);
        if (!item) return false;

        SQLStorage.removeItem(id);

        const items = this.getAll().filter((i) => i.id !== id);
        AppState.set('items', items);

        Notification.info(`آیتم «${item.label}» حذف شد`);
        this._sync();
        return true;
    },

    /**
     * حذف همه
     */
    clear() {
        const items = this.getAll();
        items.forEach((i) => SQLStorage.removeItem(i.id));
        AppState.set('items', []);
        this._sync();
        Notification.info('همه آیتم‌ها حذف شدند');
    },

    /**
     * جستجو
     */
    search(query) {
        const q = query.toLowerCase();
        return this.getAll().filter((i) => i.label.toLowerCase().includes(q));
    },

    /**
     * همگام‌سازی
     */
    async _sync() {
        await SQLStorage.saveNow();
        if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
            try {
                await GitHubStorage.saveItems(this.getAll());
            } catch (e) {
                console.error('خطا در همگام‌سازی آیتم‌ها:', e);
            }
        }
    },
};

window.Items = Items;