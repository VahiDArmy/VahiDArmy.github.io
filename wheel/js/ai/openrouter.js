/**
 * ارتباط با OpenRouter
 * @module openRouter
 */

const OpenRouter = {
    baseUrl: 'https://openrouter.ai/api/v1',

    /**
     * مدل پیش‌فرض - دقیقاً همان که کاربر گفت
     */
    DEFAULT_MODEL: 'openrouter/free',

    /**
     * دریافت کلید API
     */
    getApiKey() {
        const key = AppState.get('settings.openrouterApiKey') || '';
        return key.trim();
    },

    /**
     * دریافت مدل - دقیقاً همان که کاربر وارد کرده
     */
    getModel() {
        const model = (AppState.get('settings.aiModel') || '').trim();
        if (!model) {
            return this.DEFAULT_MODEL;
        }
        return model;
    },

    /**
     * ارسال درخواست چت
     */
    async chat(messages, options = {}) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('کلید API OpenRouter تنظیم نشده است. ابتدا آن را در تنظیمات وارد کنید.');
        }

        const model = options.model || this.getModel();
        const temperature = options.temperature ?? AppState.get('settings.aiTemperature') ?? 0.8;
        const maxTokens = options.maxTokens || 1000;

        const body = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
        };

        console.log('📤 درخواست به OpenRouter:', { model, temperature, maxTokens });

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin || 'https://localhost',
                    'X-Title': 'Charkh Falak',
                },
                body: JSON.stringify(body),
            });
        } catch (networkError) {
            console.error('❌ خطای شبکه:', networkError);
            throw new Error(
                'خطای شبکه: به اینترنت متصل نیستید یا OpenRouter در دسترس نیست. ' +
                'اگر از VPN استفاده می‌کنید، ممکن است مشکل از آن باشد.'
            );
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`خطای ناشناخته از سرور (کد ${response.status})`);
        }

        if (!response.ok) {
            console.error('❌ خطای OpenRouter:', data);

            const errMsg = data?.error?.message || data?.message || `خطای ${response.status}`;

            if (response.status === 401) {
                throw new Error('کلید API نامعتبر است (۴۰۱)');
            }
            if (response.status === 402) {
                throw new Error('اعتبار حساب کافی نیست (۴۰۲). ' + errMsg);
            }
            if (response.status === 403) {
                throw new Error('دسترسی ممنوع (۴۰۳): ' + errMsg);
            }
            if (response.status === 404) {
                throw new Error(`مدل «${model}» پیدا نشد. مدل را در تنظیمات بررسی کنید.`);
            }
            if (response.status === 429) {
                throw new Error('درخواست‌ها زیاد است (۴۲۹). کمی صبر کنید.');
            }
            if (response.status >= 500) {
                throw new Error('خطای سرور OpenRouter (۵xx). چند دقیقه دیگر امتحان کنید.');
            }

            throw new Error(errMsg);
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ ساختار پاسخ نامعتبر:', data);
            throw new Error('پاسخ نامعتبر از سرور.');
        }

        return {
            content: data.choices[0].message.content || '',
            model: data.model || model,
            usage: data.usage || {},
            id: data.id,
        };
    },

    /**
     * تست اتصال
     */
    async testConnection() {
        try {
            const apiKey = this.getApiKey();
            if (!apiKey) {
                return {
                    success: false,
                    message: 'کلید API خالی است. فیلد را پر کنید.',
                };
            }

            const model = this.getModel();
            console.log('🧪 تست اتصال با مدل:', model);

            const result = await this.chat(
                [{ role: 'user', content: 'سلام' }],
                { maxTokens: 20 }
            );

            return {
                success: true,
                message: `اتصال برقرار است - مدل: ${result.model}`,
                model: result.model,
            };
        } catch (error) {
            console.error('❌ تست ناموفق:', error);
            return {
                success: false,
                message: error.message,
                error: error,
            };
        }
    },

    /**
     * دریافت لیست مدل‌های موجود
     */
    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`);
            if (!response.ok) throw new Error('خطا در دریافت مدل‌ها');
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('خطا در دریافت مدل‌ها:', error);
            return [];
        }
    },
};

window.OpenRouter = OpenRouter;