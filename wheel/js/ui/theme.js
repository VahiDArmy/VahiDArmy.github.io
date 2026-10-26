/**
 * مدیریت تم - ۵ تم
 * - Inline blocking script اولیه را از قبل اعمال کرده
 * - این ماژول فقط برای sync و toggle است
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
     * ⚠️ نکته: تم قبلاً توسط inline script در <head> اعمال شده
     * این فقط state داخلی و آیکون را sync می‌کند - بدون هیچ flash
     */
    init() {
        const initial = window.__INITIAL_THEME__ ||
                        document.documentElement.getAttribute('data-theme') ||
                        'dark';

        this.current = this.themes.includes(initial) ? initial : 'dark';

        // sync با AppState
        AppState.set('settings.theme', this.current);

        // به‌روزرسانی آیکون دکمه
        this._updateIcon();

        // re-render گردونه در صورت وجود (ممکن است رنگ‌های canvas تغییر کند)
        if (window.WheelCore && typeof WheelCore.render === 'function') {
            setTimeout(() => {
                try { WheelCore.render(); } catch (e) {}
            }, 100);
        }

        console.log('🎨 Theme ready:', this.current);
    },

    /**
     * اعمال تم - فقط در تغییر دستی یا sync با SQLite
     */
    apply(themeName, saveToDb = true) {
        if (!this.themes.includes(themeName)) {
            themeName = 'dark';
        }

        const root = document.documentElement;

        // ⚠️ فقط attribute روی html - هیچ کلاسی روی body نیست
        root.setAttribute('data-theme', themeName);
        root.style.colorScheme = themeName === 'light' ? 'light' : 'dark';

        this.current = themeName;
        AppState.set('settings.theme', themeName);

        // ذخیره‌ی sync در LocalStorage (برای لود بعدی صفحه)
        try {
            LocalStorage.set('theme', themeName);
        } catch (e) {}

        // ذخیره در SQLite (فقط اگر درخواست شده و آماده است)
        if (saveToDb) {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    SQLStorage.setSetting('theme', themeName);
                }
            } catch (e) {}
        }

        this._updateIcon();

        // re-render گردونه
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