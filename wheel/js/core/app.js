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
            Notification.warning('دیتابیس در دسترس نیست. صفحه را رفرش کنید.', 8000);
        }

        try { Router.init(); } catch (e) { console.error('خطا در روتر:', e); }

        try {
            if (document.getElementById('wheel-canvas')) {
                WheelCore.init('wheel-canvas');
                WheelCore.setItems(People.getInWheel());

                // ⚡ بازیابی زاویه چرخش
                const savedRotation = AppState.get('wheel.rotation');
                if (typeof savedRotation === 'number' && savedRotation !== 0) {
                    WheelCore.rotation = savedRotation;
                    WheelCore.render();
                    console.log('🔄 زاویه گردونه بازیابی شد:', savedRotation);
                }
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
                inWheel: p.in_wheel === 1,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
            }));
            AppState.set('people', people);

            const items = SQLStorage.getAllItems().map((i) => ({
                ...i,
                inWheel: i.in_wheel === 1,
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
            'githubBranch',
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

        // ═══════════════════════════════════════
        // ⚡ بازیابی وضعیت گردونه (session)
        // ═══════════════════════════════════════
        try {
            const wheelState = SQLStorage.getSetting('wheel_state');

            if (wheelState && typeof wheelState === 'object') {
                if (wheelState.currentMode) {
                    AppState.set('wheel.currentMode', wheelState.currentMode);
                }
                if (wheelState.lastResult) {
                    AppState.set('wheel.lastResult', wheelState.lastResult);
                }
                if (wheelState.setup && typeof wheelState.setup === 'object') {
                    AppState.set('wheel.setup', wheelState.setup);
                }
                if (typeof wheelState.rotation === 'number') {
                    AppState.set('wheel.rotation', wheelState.rotation);
                }

                console.log('🔄 وضعیت گردونه بازیابی شد:', {
                    mode: wheelState.currentMode,
                    hasLastResult: !!wheelState.lastResult,
                    hasSetup: !!wheelState.setup,
                    hasItems: !!(wheelState.setup && wheelState.setup.items && wheelState.setup.items.length),
                    rotation: wheelState.rotation,
                });
            }
        } catch (e) {
            console.error('خطا در بازیابی وضعیت گردونه:', e);
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