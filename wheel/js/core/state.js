/**
 * مدیریت State مرکزی
 * @module state
 */

const AppState = {
    _state: {
        people: [],
        items: [],
        descriptions: {},
        history: [],
        stories: [],
        settings: {
            theme: 'dark',
            wheelSize: 500,
            spinDuration: 5000,
            soundEnabled: true,
            confettiEnabled: true,
            particlesEnabled: true,
            githubToken: '',
            githubRepo: '',
            githubUsername: '',
            openrouterApiKey: '',
            aiModel: 'openrouter/free',
            aiTemperature: 0.8,
            aiSystemPrompt: 'تو یک داستان‌نویس خلاق و بامزه هستی که داستان‌های کوتاه خنده‌دار می‌نویسد.',
            autoSync: false,
            syncInterval: 60000,
            language: 'fa',
            rtlEnabled: true,
        },
        ui: {
            currentPage: 'home',
            sidebarOpen: false,
            modalOpen: null,
            loading: false,
            notifications: [],
        },
        wheel: {
            rotation: 0,
            isSpinning: false,
            isDragging: false,
            dragStartAngle: 0,
            dragStartRotation: 0,
            currentMode: 'single', // 'single' | 'elimination'
            eliminationCount: 0,
            winners: [],
            lastResult: null,
        },
    },

    _listeners: {},

    /**
     * دریافت مقدار
     */
    get(key) {
        const keys = key.split('.');
        let value = this._state;
        for (const k of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[k];
        }
        return value;
    },

    /**
     * تنظیم مقدار
     */
    set(key, value) {
        const keys = key.split('.');
        let target = this._state;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
        }
        const oldValue = target[keys[keys.length - 1]];
        target[keys[keys.length - 1]] = value;
        this._emit(key, value, oldValue);
    },

    /**
     * به‌روزرسانی بخشی از state
     */
    update(partialState) {
        this._state = Utils.deepMerge(this._state, partialState);
        this._emit('*', this._state);
    },

    /**
     * ثبت شنونده
     */
    subscribe(key, callback) {
        if (!this._listeners[key]) {
            this._listeners[key] = [];
        }
        this._listeners[key].push(callback);
        return () => {
            this._listeners[key] = this._listeners[key].filter((cb) => cb !== callback);
        };
    },

    /**
     * انتشار رویداد
     */
    _emit(key, newValue, oldValue) {
        if (this._listeners[key]) {
            this._listeners[key].forEach((cb) => cb(newValue, oldValue));
        }
        if (this._listeners['*']) {
            this._listeners['*'].forEach((cb) => cb(this._state, key, newValue, oldValue));
        }
    },

    /**
     * بازنشانی state
     */
    reset() {
        this._state = {
            people: [],
            items: [],
            descriptions: {},
            history: [],
            stories: [],
            settings: { ...this._state.settings },
            ui: {
                currentPage: 'home',
                sidebarOpen: false,
                modalOpen: null,
                loading: false,
                notifications: [],
            },
            wheel: {
                rotation: 0,
                isSpinning: false,
                isDragging: false,
                dragStartAngle: 0,
                dragStartRotation: 0,
                currentMode: 'single',
                eliminationCount: 0,
                winners: [],
                lastResult: null,
            },
        };
        this._emit('*', this._state);
    },
};

window.AppState = AppState;