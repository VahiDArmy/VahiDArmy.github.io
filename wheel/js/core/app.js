/**
 * راه‌انداز اصلی برنامه
 * @module app
 */

const App = {
    /**
     * راه‌اندازی
     */
    async init() {
        console.log('🚀 راه‌اندازی گردونه شانس...');

        try {
            // ۱. راه‌اندازی نوتیفیکیشن (اول از همه)
            Notification.init();

            // ۲. راه‌اندازی کانفتی
            Confetti.init();

            // ۳. راه‌اندازی دیتابیس SQLite
            console.log('📦 در حال راه‌اندازی دیتابیس SQLite...');
            await SQLStorage.init();

            // ۴. بارگذاری داده‌ها از SQLite به State
            console.log('📥 بارگذاری داده‌ها از دیتابیس...');
            this._loadDataFromSQL();

            // ۵. راه‌اندازی پس‌زمینه ذرات
            if (AppState.get('settings.particlesEnabled')) {
                Particles.init('particles-canvas');
            }

            // ۶. راه‌اندازی تم
            Theme.init();

            // ۷. راه‌اندازی رویدادها
            Events.init();

            // ۸. راه‌اندازی گردونه (اگر canvas موجود باشد)
            if (document.getElementById('wheel-canvas')) {
                WheelCore.init('wheel-canvas');
                WheelCore.setItems(AppState.get('people') || []);
            }

            // ۹. راه‌اندازی روتر
            Router.init();

            // ۱۰. بررسی همگام‌سازی خودکار
            if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
                Sync.startAutoSync();
            }

            console.log('✅ برنامه با موفقیت راه‌اندازی شد');
            Notification.success('برنامه با موفقیت راه‌اندازی شد');
        } catch (error) {
            console.error('❌ خطا در راه‌اندازی برنامه:', error);
            Notification.error('خطا در راه‌اندازی برنامه: ' + error.message);
        }
    },

    /**
     * بارگذاری داده‌ها از SQLite به AppState
     */
    _loadDataFromSQL() {
        // افراد
        const people = SQLStorage.getAllPeople().map((p) => ({
            ...p,
            starred: p.starred === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
        }));
        AppState.set('people', people);

        // آیتم‌ها
        const items = SQLStorage.getAllItems().map((i) => ({
            ...i,
            createdAt: i.created_at,
        }));
        AppState.set('items', items);

        // توصیفات
        const descriptions = {};
        SQLStorage.getAllDescriptions().forEach((d) => {
            descriptions[d.key] = d.value;
        });
        AppState.set('descriptions', descriptions);

        // تاریخچه
        const history = SQLStorage.getHistory(500);
        AppState.set('history', history);

        // داستان‌ها
        const stories = SQLStorage.getAllStories(100);
        AppState.set('stories', stories);

        // تنظیمات
        this._loadSettingsFromSQL();
    },

    /**
     * بارگذاری تنظیمات از SQLite
     */
    _loadSettingsFromSQL() {
        const keys = [
            'theme', 'wheelSize', 'spinDuration', 'soundEnabled',
            'confettiEnabled', 'particlesEnabled', 'githubToken',
            'githubRepo', 'githubUsername', 'openrouterApiKey',
            'aiModel', 'aiTemperature', 'aiSystemPrompt',
            'autoSync', 'syncInterval', 'language', 'rtlEnabled',
        ];

        const settings = {};
        keys.forEach((key) => {
            const value = SQLStorage.getSetting(key);
            if (value !== null) settings[key] = value;
        });

        if (Object.keys(settings).length > 0) {
            AppState.set('settings', Utils.deepMerge(AppState.get('settings'), settings));
        }
    },

    /**
     * ذخیره تنظیمات در SQLite
     */
    saveSettingsToSQL() {
        const settings = AppState.get('settings');
        Object.entries(settings).forEach(([key, value]) => {
            SQLStorage.setSetting(key, value);
        });
    },
};

// راه‌اندازی پس از بارگذاری DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;