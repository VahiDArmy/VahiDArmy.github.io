/**
 * مدیریت تم
 * @module theme
 */

const Theme = {
    themes: ['dark', 'darker', 'purple', 'ocean'],
    current: 'dark',

    /**
     * راه‌اندازی
     */
    init() {
        const saved = SQLStorage.getSetting('theme') || AppState.get('settings.theme') || 'dark';
        this.apply(saved);
    },

    /**
     * اعمال تم
     */
    apply(themeName) {
        if (!this.themes.includes(themeName)) {
            themeName = 'dark';
        }

        document.body.classList.remove(...this.themes.map((t) => `theme-${t}`));
        document.body.classList.add(`theme-${themeName}`);
        document.documentElement.setAttribute('data-theme', themeName);

        this.current = themeName;
        AppState.set('settings.theme', themeName);
        SQLStorage.setSetting('theme', themeName);

        this._updateIcon();
    },

    /**
     * تغییر تم
     */
    toggle() {
        const currentIndex = this.themes.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.apply(this.themes[nextIndex]);
        Notification.info(`تم: ${this._getThemeName(this.themes[nextIndex])}`);
    },

    /**
     * تغییر به تم خاص
     */
    set(themeName) {
        this.apply(themeName);
    },

    /**
     * به‌روزرسانی آیکون
     */
    _updateIcon() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) {
            const icons = { dark: '🌙', darker: '🌑', purple: '🔮', ocean: '🌊' };
            icon.textContent = icons[this.current] || '🌙';
        }
    },

    /**
     * نام فارسی تم
     */
    _getThemeName(theme) {
        const names = {
            dark: 'تاریک',
            darker: 'تاریک عمیق',
            purple: 'بنفش',
            ocean: 'اقیانوس',
        };
        return names[theme] || theme;
    },
};

window.Theme = Theme;