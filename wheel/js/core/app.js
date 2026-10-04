/**
 * راه‌انداز اصلی برنامه
 * @module app
 */

const App = {
    /**
     * راه‌اندازی
     */
    async init() {
        console.log('🚀 راه‌اندازی چرخ فلک...');

        // ═══════════════════════════════════════
        // فاز ۱: UI پایه (بدون هیچ وابستگی)
        // ═══════════════════════════════════════
        try {
            Notification.init();
            Confetti.init();
            Modal.init();
        } catch (e) {
            console.error('خطا در راه‌اندازی UI پایه:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۲: تم (قبل از Events)
        // ═══════════════════════════════════════
        try {
            Theme.init();
        } catch (e) {
            console.error('خطا در راه‌اندازی تم:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۳: رویدادها (دکمه‌ها اینجا وصل می‌شوند!)
        // این باید قبل از SQL اجرا شود تا دکمه‌ها همیشه کار کنند
        // ═══════════════════════════════════════
        try {
            Events.init();
        } catch (e) {
            console.error('خطا در راه‌اندازی رویدادها:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۴: ذرات پس‌زمینه
        // ═══════════════════════════════════════
        try {
            if (AppState.get('settings.particlesEnabled') !== false) {
                Particles.init('particles-canvas');
            }
        } catch (e) {
            console.error('خطا در راه‌اندازی ذرات:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۵: دیتابیس SQLite (ممکن است خطا بدهد)
        // ═══════════════════════════════════════
        try {
            console.log('📦 در حال راه‌اندازی دیتابیس SQLite...');
            await SQLStorage.init();
            this._loadDataFromSQL();
            console.log('✅ دیتابیس آماده است');
        } catch (e) {
            console.error('❌ خطا در راه‌اندازی دیتابیس:', e);
            Notification.warning(
                'دیتابیس در دسترس نیست. ممکن است برخی امکانات کار نکنند. صفحه را رفرش کنید.',
                8000
            );
        }

        // ═══════════════════════════════════════
        // فاز ۶: مسیریابی
        // ═══════════════════════════════════════
        try {
            Router.init();
        } catch (e) {
            console.error('خطا در مسیریابی:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۷: گردونه (فقط در صفحه گردونه)
        // ═══════════════════════════════════════
        try {
            if (document.getElementById('wheel-canvas')) {
                WheelCore.init('wheel-canvas');
                const people = AppState.get('people') || [];
                WheelCore.setItems(people);
            }
        } catch (e) {
            console.error('خطا در راه‌اندازی گردونه:', e);
        }

        // ═══════════════════════════════════════
        // فاز ۸: همگام‌سازی خودکار
        // ═══════════════════════════════════════
        try {
            if (AppState.get('settings.autoSync') && GitHubStorage.isConfigured()) {
                Sync.startAutoSync();
            }
        } catch (e) {
            console.error('خطا در همگام‌سازی خودکار:', e);
        }

        console.log('✅ چرخ فلک آماده است');
    },

    /**
     * بارگذاری داده‌ها از SQLite به AppState
     */
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
            try {
                const value = SQLStorage.getSetting(key);
                if (value !== null) settings[key] = value;
            } catch (e) {
                // نادیده بگیر
            }
        });

        if (Object.keys(settings).length > 0) {
            AppState.set('settings', Utils.deepMerge(AppState.get('settings'), settings));
        }
    },

    /**
     * ذخیره تنظیمات در SQLite
     */
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