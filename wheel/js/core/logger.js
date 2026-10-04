/**
 * سیستم لاگ خطا
 * - نگهداری ۱۰۰ خطای آخر در حافظه
 * - ذخیره در LocalStorage
 * - نمایش در کنسول با فرمت خوانا
 * @module logger
 */

const Logger = {
    MAX_LOGS: 100,
    STORAGE_KEY: 'error_logs',

    _logs: [],

    init() {
        try {
            const stored = LocalStorage.get(this.STORAGE_KEY, []);
            if (Array.isArray(stored)) {
                this._logs = stored.slice(-this.MAX_LOGS);
            }
        } catch (e) {
            console.error('خطا در بارگذاری لاگ‌ها:', e);
        }
    },

    /**
     * ثبت خطا
     */
    error(context, error, meta = {}) {
        const entry = {
            id: Utils.generateId('err'),
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

        try {
            LocalStorage.set(this.STORAGE_KEY, this._logs);
        } catch (e) {}

        // نمایش در کنسول
        console.group(`❌ [${context}]`);
        console.error('پیام:', entry.message);
        if (meta && Object.keys(meta).length > 0) {
            console.error('اطلاعات:', meta);
        }
        if (entry.stack) {
            console.error('Stack:', entry.stack);
        }
        console.groupEnd();

        return entry;
    },

    /**
     * ثبت هشدار
     */
    warn(context, message, meta = {}) {
        console.warn(`⚠️ [${context}]`, message, meta);
    },

    /**
     * ثبت اطلاعات
     */
    info(context, message, meta = {}) {
        console.log(`ℹ️ [${context}]`, message, meta);
    },

    /**
     * دریافت همه لاگ‌ها
     */
    getAll() {
        return [...this._logs];
    },

    /**
     * دریافت آخرین خطا
     */
    getLast() {
        return this._logs[this._logs.length - 1] || null;
    },

    /**
     * پاک کردن
     */
    clear() {
        this._logs = [];
        try {
            LocalStorage.set(this.STORAGE_KEY, []);
        } catch (e) {}
    },

    /**
     * خروجی به فایل
     */
    export() {
        const content = this._logs
            .map((log) =>
                `[${new Date(log.timestamp).toISOString()}]\n` +
                `Context: ${log.context}\n` +
                `Message: ${log.message}\n` +
                `Meta: ${JSON.stringify(log.meta, null, 2)}\n` +
                `Stack: ${log.stack}\n` +
                `${'─'.repeat(60)}\n`
            )
            .join('\n');

        Utils.downloadFile(
            content || 'لاگی موجود نیست',
            `error-logs-${Date.now()}.txt`,
            'text/plain;charset=utf-8'
        );
    },

    /**
     * اعتبارسنجی تنظیمات قبل از درخواست
     */
    validateOpenRouter() {
        const errors = [];

        if (typeof OpenRouter === 'undefined') {
            errors.push('ماژول OpenRouter بارگذاری نشده');
            return { ok: false, errors };
        }

        if (!OpenRouter.getApiKey()) {
            errors.push('کلید API OpenRouter تنظیم نشده - از صفحه تنظیمات وارد کنید');
        }

        const model = AppState.get('settings.aiModel');
        if (!model || !model.trim()) {
            errors.push('مدل هوش مصنوعی انتخاب نشده - مقدار پیش‌فرض: openrouter/free');
        }

        return { ok: errors.length === 0, errors };
    },
};

window.Logger = Logger;