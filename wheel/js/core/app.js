/**
 * راه‌انداز اصلی برنامه
 * @module app
 */

const App = {
    async init() {
        console.log('🚀 راه‌اندازی چرخ فلک...');

        try {
            Notification.init();
            Confetti.init();
            Modal.init();
        } catch (e) {
            console.error('خطا در راه‌اندازی UI پایه:', e);
        }

        try { Theme.init(); } catch (e) { console.error('خطا در تم:', e); }
        try { Events.init(); } catch (e) { console.error('خطا در رویدادها:', e); }

        try {
            if (AppState.get('settings.particlesEnabled') !== false) {
                Particles.init('particles-canvas');
            }
        } catch (e) { console.error('خطا در ذرات:', e); }

        try {
            console.log('📦 در حال راه‌اندازی دیتابیس SQLite...');
            await SQLStorage.init();
            this._loadDataFromSQL();
            console.log('✅ دیتابیس آماده است');
        } catch (e) {
            console.error('❌ خطا در راه‌اندازی دیتابیس:', e);
            Notification.warning(
                'دیتابیس در دسترس نیست. صفحه را رفرش کنید.',
                8000
            );
        }

        try { Router.init(); } catch (e) { console.error('خطا در روتر:', e); }

        try {
            if (document.getElementById('wheel-canvas')) {
                WheelCore.init('wheel-canvas');
                WheelCore.setItems(AppState.get('people') || []);
            }
        } catch (e) { console.error('خطا در گردونه:', e); }

        try {
            if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
                Sync.startAutoSync();
            }
        } catch (e) { console.error('خطا در همگام‌سازی خودکار:', e); }

        console.log('✅ چرخ فلک آماده است');
    },

    _loadDataFromSQL() {
        try {
            const people = SQLStorage.getAllPeople().map((p) => ({
                ...p,
                starred: p.starred === 1,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
            AppState.set('people', people);

            const items = SQLStorage.getAllItems().map((i) => ({
                ...i,
                createdAt: i.created_at,
            }));
            AppState.set('items', items);

            const descriptions = {};
            SQLStorage.getAllDescriptions().forEach((d) => {
                descriptions[d.key] = d.value;
            });
            AppState.set('descriptions', descriptions);

            const history = SQLStorage.getHistory(500);
            AppState.set('history', history);

            const stories = SQLStorage.getAllStories(100);
            AppState.set('stories', stories);

            this._loadSettingsFromSQL();
        } catch (e) {
            console.error('خطا در بارگذاری داده‌ها:', e);
        }
    },

    /**
     * بارگذاری تنظیمات از SQLite
     * ⚠️ نکته: githubBranch اینجا اضافه شده
     */
    _loadSettingsFromSQL() {
        const keys = [
            'theme',
            'wheelSize',
            'spinDuration',
            'soundEnabled',
            'confettiEnabled',
            'particlesEnabled',
            'githubToken',
            'githubRepo',
            'githubUsername',
            'githubBranch',      // ✅ اضافه شد
            'openrouterApiKey',
            'aiModel',
            'aiTemperature',
            'aiSystemPrompt',
            'autoSync',
            'syncInterval',
            'language',
            'rtlEnabled',
        ];

        const settings = {};
        keys.forEach((key) => {
            try {
                const value = SQLStorage.getSetting(key);
                if (value !== null && value !== undefined && value !== '') {
                    settings[key] = value;
                }
            } catch (e) {}
        });

        // اگر branch خالی بود، از LocalStorage بخوان
        if (!settings.githubBranch) {
            const localBranch = LocalStorage.get('secret_githubBranch', null) ||
                               LocalStorage.get('githubBranch', null);
            if (localBranch) settings.githubBranch = localBranch;
        }

        if (Object.keys(settings).length > 0) {
            const merged = Utils.deepMerge(AppState.get('settings'), settings);
            AppState.set('settings', merged);
            console.log('📥 تنظیمات بارگذاری شد:', Object.keys(settings).join(', '));
        }
    },

    saveSettingsToSQL() {
        try {
            const settings = AppState.get('settings');
            Object.entries(settings).forEach(([key, value]) => {
                SQLStorage.setSetting(key, value);
            });
        } catch (e) {
            console.error('خطا در ذخیره تنظیمات:', e);
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;