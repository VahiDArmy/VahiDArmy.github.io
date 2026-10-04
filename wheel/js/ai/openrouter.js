/**
 * ارتباط با OpenRouter
 * @module openRouter
 */

const OpenRouter = {
    baseUrl: 'https://openrouter.ai/api/v1',

    /**
     * دریافت کلید API
     */
    getApiKey() {
        return AppState.get('settings.openrouterApiKey') || '';
    },

    /**
     * دریافت مدل
     */
    getModel() {
        return AppState.get('settings.aiModel') || 'openrouter/free';
    },

    /**
     * ارسال درخواست چت
     */
    async chat(messages, options = {}) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('کلید API OpenRouter تنظیم نشده است');
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

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'گردونه شانس',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `خطای OpenRouter: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                content: data.choices?.[0]?.message?.content || '',
                model: data.model || model,
                usage: data.usage || {},
                id: data.id,
            };
        } catch (error) {
            console.error('خطای OpenRouter:', error);
            throw error;
        }
    },

    /**
     * تولید داستان
     */
    async generateStory(context, options = {}) {
        const systemPrompt = AppState.get('settings.aiSystemPrompt') || 
            'تو یک داستان‌نویس خلاق و بامزه هستی که داستان‌های کوتاه خنده‌دار می‌نویسد.';
        
        const userPrompt = this._buildStoryPrompt(context);
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];

        const result = await this.chat(messages, {
            maxTokens: 800,
            ...options,
        });

        // ذخیره داستان
        const story = {
            id: Utils.generateId('story'),
            content: result.content,
            model: result.model,
            timestamp: Date.now(),
            context: Utils.truncate(JSON.stringify(context), 200),
            usage: result.usage,
        };

        const stories = AppState.get('stories') || [];
        stories.unshift(story);
        AppState.set('stories', stories.slice(0, 100));

        return story;
    },

    /**
     * ساخت پرامپت داستان
     */
    _buildStoryPrompt(context) {
        const { winner, allPeople, descriptions, items, mode } = context;
        
        let prompt = 'یک داستان کوتاه خنده‌دار و جذاب به زبان فارسی بنویس.\n\n';
        
        if (winner) {
            prompt += `شخصیت اصلی داستان: ${winner.name || winner.label}\n`;
            if (winner.description) {
                prompt += `توصیف شخصیت: ${winner.description}\n`;
            }
        }
        
        if (allPeople && allPeople.length > 0) {
            prompt += `\nسایر شخصیت‌های حاضر در داستان: ${allPeople.map((p) => p.name).join('، ')}\n`;
        }
        
        if (descriptions) {
            const descEntries = Object.entries(descriptions).filter(([, v]) => v);
            if (descEntries.length > 0) {
                prompt += '\nتوصیفات موجود:\n';
                descEntries.forEach(([key, value]) => {
                    prompt += `- ${key}: ${value}\n`;
                });
            }
        }
        
        if (items && items.length > 0) {
            prompt += `\nآیتم‌های موجود: ${items.map((i) => i.label).join('، ')}\n`;
        }
        
        if (mode === 'elimination') {
            prompt += '\nاین داستان در یک بازی حذفی اتفاق می‌افتد.\n';
        }
        
        prompt += '\nداستان باید بین ۱۰۰ تا ۲۰۰ کلمه باشد، طنز داشته باشد و پایان‌بندی جالبی داشته باشد.';
        
        return prompt;
    },

    /**
     * دریافت لیست مدل‌های رایگان
     */
    async getFreeModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`);
            const data = await response.json();
            return data.data?.filter((m) => m.id.includes(':free') || m.id === 'openrouter/free') || [];
        } catch (error) {
            console.error('خطا در دریافت مدل‌ها:', error);
            return [];
        }
    },

    /**
     * تست اتصال
     */
    async testConnection() {
        try {
            await this.chat([
                { role: 'user', content: 'سلام' },
            ], { maxTokens: 10 });
            return true;
        } catch (error) {
            return false;
        }
    },
};

window.OpenRouter = OpenRouter;