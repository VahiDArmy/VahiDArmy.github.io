/**
 * مدیریت تم - ۵ تم
 * - LocalStorage: منبع فوری (sync)
 * - SQLite: پشتیبان (async, بین دستگاه‌ها)
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

    /**
     * راه‌اندازی
     * ⚠️ مهم: از LocalStorage می‌خواند نه SQLite
     * چون باید قبل از SQLStorage.init() اجرا شود
     */
    init() {
        // اولویت ۱: LocalStorage (sync، فوری)
        let saved = LocalStorage.get('theme', null);

        // اولویت ۲: AppState (اگر جای دیگری ست شده باشد)
        if (!saved) {
            saved = AppState.get('settings.theme') || 'dark';
        }

        console.log('🎨 Theme.init - saved from LocalStorage:', saved);

        // اعمال فوری (بدون ذخیره در DB - چون هنوز آماده نیست)
        this.apply(saved, false);
    },

    /**
     * اعمال تم
     * @param {string} themeName - نام تم
     * @param {boolean} saveToDb - آیا در SQLite هم ذخیره شود
     */
    apply(themeName, saveToDb = true) {
        // اعتبارسنجی
        if (!this.themes.includes(themeName)) {
            themeName = 'dark';
        }

        const root = document.documentElement;
        const body = document.body;

        if (!body) return;

        // حذف همه‌ی کلاس‌های تم از body
        this.themes.forEach((t) => {
            body.classList.remove(`theme-${t}`);
        });

        // اعمال تم جدید روی DOM
        body.classList.add(`theme-${themeName}`);
        root.setAttribute('data-theme', themeName);

        // تنظیم color-scheme برای کنترل‌های بومی
        root.style.colorScheme = themeName === 'light' ? 'light' : 'dark';

        // به‌روزرسانی state
        this.current = themeName;
        AppState.set('settings.theme', themeName);

        // ✅ ذخیره فوری در LocalStorage (sync)
        try {
            LocalStorage.set('theme', themeName);
        } catch (e) {
            console.warn('خطا در ذخیره تم در LocalStorage:', e);
        }

        // ✅ ذخیره در SQLite فقط اگر درخواست شده و آماده است
        if (saveToDb) {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    SQLStorage.setSetting('theme', themeName);
                }
            } catch (e) {
                console.warn('خطا در ذخیره تم در SQLite:', e);
            }
        }

        // به‌روزرسانی آیکون
        this._updateIcon();

        // Re-render canvas گردونه (اگر وجود دارد)
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