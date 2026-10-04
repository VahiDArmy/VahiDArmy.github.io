/**
 * سیستم لاگ خطا
 * @module logger
 */

const Logger = {
    MAX_LOGS: 200,
    STORAGE_KEY: 'error_logs',
    DEBUG_STORAGE_KEY: 'debug_logs',

    _logs: [],
    _debugLogs: [],
    _isDebugEnabled: false,

    init() {
        try {
            const stored = LocalStorage.get(this.STORAGE_KEY, []);
            if (Array.isArray(stored)) this._logs = stored.slice(-this.MAX_LOGS);

            const debugStored = LocalStorage.get(this.DEBUG_STORAGE_KEY, []);
            if (Array.isArray(debugStored)) this._debugLogs = debugStored.slice(-500);

            this._isDebugEnabled = LocalStorage.get('debug_enabled', false) === true;
        } catch (e) {
            console.error('خطا در بارگذاری لاگ‌ها:', e);
        }

        console.log('🔎 Logger init - debug:', this._isDebugEnabled);
    },

    enableDebug(enabled = true) {
        this._isDebugEnabled = enabled;
        try { LocalStorage.set('debug_enabled', enabled); } catch (e) {}
        console.log(`🔎 Debug mode: ${enabled ? 'فعال' : 'غیرفعال'}`);
    },

    debug(context, message, meta = {}) {
        const entry = {
            level: 'debug',
            timestamp: Date.now(),
            context,
            message,
            meta,
        };

        this._debugLogs.push(entry);
        if (this._debugLogs.length > 500) {
            this._debugLogs = this._debugLogs.slice(-500);
        }
        try { LocalStorage.set(this.DEBUG_STORAGE_KEY, this._debugLogs); } catch (e) {}

        if (this._isDebugEnabled) {
            console.log(`🔍 [${context}]`, message, meta);
        }

        return entry;
    },

    error(context, error, meta = {}) {
        const entry = {
            id: Utils.generateId('err'),
            level: 'error',
            timestamp: Date.now(),
            context,
            message: error?.message || String(error),
            stack: error?.stack || '',
            meta,
            url: window.location.href,
            userAgent: navigator.userAgent,
        };

        this._logs.push(entry);
        if (this._logs.length > this.MAX_LOGS) {
            this._logs = this._logs.slice(-this.MAX_LOGS);
        }

        try { LocalStorage.set(this.STORAGE_KEY, this._logs); } catch (e) {}

        console.group(`❌ [${context}]`);
        console.error('پیام:', entry.message);
        if (meta && Object.keys(meta).length > 0) console.error('اطلاعات:', meta);
        if (entry.stack) console.error('Stack:', entry.stack);
        console.groupEnd();

        return entry;
    },

    warn(context, message, meta = {}) {
        console.warn(`⚠️ [${context}]`, message, meta);
    },

    info(context, message, meta = {}) {
        console.log(`ℹ️ [${context}]`, message, meta);
    },

    getAll() { return [...this._logs]; },
    getDebugLogs() { return [...this._debugLogs]; },
    getLast() { return this._logs[this._logs.length - 1] || null; },

    clear() {
        this._logs = [];
        this._debugLogs = [];
        try {
            LocalStorage.set(this.STORAGE_KEY, []);
            LocalStorage.set(this.DEBUG_STORAGE_KEY, []);
        } catch (e) {}
    },

    export() {
        const errors = this._logs
            .map((log) =>
                `[${new Date(log.timestamp).toISOString()}] ❌ ${log.level}\n` +
                `Context: ${log.context}\n` +
                `Message: ${log.message}\n` +
                `Meta: ${JSON.stringify(log.meta, null, 2)}\n` +
                `${'─'.repeat(60)}`
            ).join('\n\n');

        const debugLogs = this._debugLogs
            .slice(-100)
            .map((log) =>
                `[${new Date(log.timestamp).toISOString()}] ${log.level}\n` +
                `Context: ${log.context}\n` +
                `Message: ${log.message}\n` +
                `Meta: ${JSON.stringify(log.meta, null, 2)}\n` +
                `${'─'.repeat(40)}`
            ).join('\n');

        const content =
            `══════ ERROR LOGS ══════\n\n${errors || 'خطایی ثبت نشده'}\n\n` +
            `══════ DEBUG LOGS (100 آخر) ══════\n\n${debugLogs || 'لاگی موجود نیست'}`;

        Utils.downloadFile(content, `debug-logs-${Date.now()}.txt`, 'text/plain;charset=utf-8');
    },

    validateOpenRouter() {
        const errors = [];
        if (typeof OpenRouter === 'undefined') {
            errors.push('ماژول OpenRouter بارگذاری نشده');
            return { ok: false, errors };
        }
        if (!OpenRouter.getApiKey()) {
            errors.push('کلید API OpenRouter تنظیم نشده');
        }
        const model = AppState.get('settings.aiModel');
        if (!model || !model.trim()) {
            errors.push('مدل هوش مصنوعی انتخاب نشده');
        }
        return { ok: errors.length === 0, errors };
    },
};

window.Logger = Logger;