/**
 * مدیریت تم
 * @module theme
 */

const Theme = {
    themes: ['dark', 'darker', 'purple', 'ocean'],
    current: 'dark',

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
        if (!this.themes.includes(themeName)) {
            themeName = 'dark';
        }

        document.body.classList.remove(...this.themes.map((t) => `theme-${t}`));
        document.body.classList.add(`theme-${themeName}`);
        document.documentElement.setAttribute('data-theme', themeName);

        this.current = themeName;
        AppState.set('settings.theme', themeName);

        if (saveToDb) {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    SQLStorage.setSetting('theme', themeName);
                }
            } catch (e) {
                // نادیده بگیر
            }
        }

        this._updateIcon();
    },

    toggle() {
        const currentIndex = this.themes.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        const nextTheme = this.themes[nextIndex];
        
        this.apply(nextTheme);
        
        try {
            if (typeof Notification !== 'undefined') {
                Notification.info(`تم: ${this._getThemeName(nextTheme)}`);
            }
        } catch (e) {}
    },

    set(themeName) {
        this.apply(themeName);
    },

    _updateIcon() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) {
            const icons = { dark: '🌙', darker: '🌑', purple: '🔮', ocean: '🌊' };
            icon.textContent = icons[this.current] || '🌙';
        }
    },

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