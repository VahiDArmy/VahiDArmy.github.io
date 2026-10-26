/**
 * مدیریت تم - ۵ تم
 * - dark, darker, purple, ocean, light
 * - اعمال همزمان روی html[data-theme] و body.theme-X
 * - تنظیم color-scheme برای کنترل‌های بومی
 * @module theme
 */

const Theme = {
    themes: ['dark', 'darker', 'purple', 'ocean', 'light'],
    current: 'dark',

    NAMES: {
        dark: 'تاریک',
        darker: 'تاریک عمیق',
        purple: 'بنفش',
        ocean: 'اقیانوس',
        light: 'روشن',
    },

    ICONS: {
        dark: '🌙',
        darker: '🌑',
        purple: '🔮',
        ocean: '🌊',
        light: '☀️',
    },

    init() {
        let saved = 'dark';
        try {
            if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                saved = SQLStorage.getSetting('theme') || AppState.get('settings.theme') || 'dark';
            } else {
                saved = AppState.get('settings.theme') || 'dark';
            }
        } catch (e) {
            saved = 'dark';
        }
        this.apply(saved, false);
    },

    apply(themeName, saveToDb = true) {
        // اعتبارسنجی
        if (!this.themes.includes(themeName)) {
            themeName = 'dark';
        }

        const root = document.documentElement;
        const body = document.body;

        // حذف همه‌ی کلاس‌های تم از body
        this.themes.forEach((t) => {
            body.classList.remove(`theme-${t}`);
        });

        // اعمال تم جدید
        body.classList.add(`theme-${themeName}`);
        root.setAttribute('data-theme', themeName);

        // تنظیم color-scheme برای کنترل‌های بومی (input, select, scrollbar)
        if (themeName === 'light') {
            root.style.colorScheme = 'light';
        } else {
            root.style.colorScheme = 'dark';
        }

        // به‌روزرسانی state
        this.current = themeName;
        AppState.set('settings.theme', themeName);

        // ذخیره در دیتابیس
        if (saveToDb) {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    SQLStorage.setSetting('theme', themeName);
                }
            } catch (e) {}
        }

        this._updateIcon();

        // اجبار به re-render canvas (wheel) برای اعمال رنگ‌های جدید
        if (window.WheelCore && typeof WheelCore.render === 'function') {
            setTimeout(() => {
                try { WheelCore.render(); } catch (e) {}
            }, 50);
        }
    },

    toggle() {
        const idx = this.themes.indexOf(this.current);
        const next = this.themes[(idx + 1) % this.themes.length];
        this.apply(next);
        if (typeof Notification !== 'undefined') {
            Notification.info(`تم: ${this.NAMES[next] || next}`);
        }
    },

    set(themeName) {
        this.apply(themeName);
    },

    _updateIcon() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) {
            icon.textContent = this.ICONS[this.current] || '🌙';
        }
    },
};

window.Theme = Theme;