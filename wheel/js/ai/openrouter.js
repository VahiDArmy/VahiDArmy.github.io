/**
 * ارتباط با OpenRouter
 * @module openRouter
 */

const OpenRouter = {
    baseUrl: 'https://openrouter.ai/api/v1',

    /**
     * مدل پیش‌فرض - یک مدل رایگان واقعی
     */
    DEFAULT_MODEL: 'meta-llama/llama-3.3-70b-instruct:free',

    /**
     * مدل‌های رایگان پیشنهادی
     */
    FREE_MODELS: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-flash-1.5-8b:free',
        'mistralai/mistral-7b-instruct:free',
        'mistralai/mistral-nemo:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'deepseek/deepseek-chat:free',
        'openrouter/auto',
    ],

    /**
     * دریافت کلید API
     */
    getApiKey() {
        const key = AppState.get('settings.openrouterApiKey') || '';
        return key.trim();
    },

    /**
     * دریافت مدل
     */
    getModel() {
        let model = AppState.get('settings.aiModel') || '';
        model = model.trim();
        
        // اگر خالی بود یا مدل معتبر نبود، از پیش‌فرض استفاده کن
        if (!model || model === 'openrouter/free') {
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

        console.log('📤 ارسال درخواست به OpenRouter:', { model, temperature, maxTokens });

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

        // خواندن پاسخ
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`خطای ناشناخته از سرور (کد ${response.status})`);
        }

        // بررسی خطاها
        if (!response.ok) {
            console.error('❌ خطای OpenRouter:', data);
            
            const errMsg = data?.error?.message || data?.message || `خطای ${response.status}`;
            
            // ترجمه خطاهای رایج
            if (response.status === 401) {
                throw new Error('کلید API نامعتبر است (۴۰۱)');
            }
            if (response.status === 402) {
                throw new Error('اعتبار حساب کافی نیست. اگر از مدل رایگان استفاده می‌کنید، از مدلی با پسوند ":free" استفاده کنید.');
            }
            if (response.status === 403) {
                throw new Error('دسترسی ممنوع (۴۰۳): ' + errMsg);
            }
            if (response.status === 404) {
                throw new Error(`مدل «${model}» پیدا نشد. یک مدل رایگان معتبر انتخاب کنید.`);
            }
            if (response.status === 429) {
                throw new Error('درخواست‌ها زیاد است (۴۲۹). کمی صبر کنید و دوباره امتحان کنید.');
            }
            if (response.status >= 500) {
                throw new Error('خطای سرور OpenRouter (۵xx). چند دقیقه دیگر امتحان کنید.');
            }
            
            throw new Error(errMsg);
        }

        // بررسی ساختار پاسخ
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ ساختار پاسخ نامعتبر:', data);
            throw new Error('پاسخ نامعتبر از سرور. مدل شاید مشکل داشته باشد.');
        }

        return {
            content: data.choices[0].message.content || '',
            model: data.model || model,
            usage: data.usage || {},
            id: data.id,
        };
    },

    /**
     * تست اتصال - حالا پیام خطای واقعی را برمی‌گرداند
     */
    async testConnection() {
        try {
            const apiKey = this.getApiKey();
            if (!apiKey) {
                return {
                    success: false,
                    message: 'کلید API خالی است. فیلد را پر کنید و دوباره امتحان کنید.',
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

    /**
     * دریافت لیست مدل‌های رایگان
     */
    async getFreeModels() {
        const models = await this.getModels();
        return models.filter((m) => m.id.includes(':free') || m.id === 'openrouter/auto');
    },
};

window.OpenRouter = OpenRouter;