/**
 * ارتباط با OpenRouter - با پشتیبانی از Streaming
 * @module openRouter
 */

const OpenRouter = {
    baseUrl: 'https://openrouter.ai/api/v1',
    DEFAULT_MODEL: 'openrouter/free',

    getApiKey() {
        return (AppState.get('settings.openrouterApiKey') || '').trim();
    },

    getModel() {
        const model = (AppState.get('settings.aiModel') || '').trim();
        return model || this.DEFAULT_MODEL;
    },

    /**
     * درخواست غیر-استریم (معمولی)
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

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this._getHeaders(apiKey),
                body: JSON.stringify(body),
            });
        } catch (e) {
            throw new Error('خطای شبکه: ' + e.message);
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`خطای ${response.status}`);
        }

        if (!response.ok) {
            throw new Error(this._parseError(response.status, data, model));
        }

        if (!data.choices?.[0]?.message) {
            throw new Error('پاسخ نامعتبر از سرور');
        }

        return {
            content: data.choices[0].message.content || '',
            model: data.model || model,
            usage: data.usage || {},
        };
    },

    /**
     * درخواست استریم (SSE) - روی هر chunk callback صدا زده می‌شود
     */
    async chatStream(messages, options = {}, onChunk) {
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
            stream: true,
        };

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this._getHeaders(apiKey),
                body: JSON.stringify(body),
            });
        } catch (e) {
            throw new Error('خطای شبکه: ' + e.message);
        }

        if (!response.ok) {
            let errData = {};
            try { errData = await response.json(); } catch (e) {}
            throw new Error(this._parseError(response.status, errData, model));
        }

        if (!response.body) {
            throw new Error('مرورگر از Streaming پشتیبانی نمی‌کند');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let modelUsed = model;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) continue;

                    const data = trimmed.slice(5).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        
                        if (parsed.model) modelUsed = parsed.model;

                        const chunk = parsed.choices?.[0]?.delta?.content;
                        if (chunk) {
                            fullContent += chunk;
                            if (typeof onChunk === 'function') {
                                onChunk(chunk, parsed.model || modelUsed);
                            }
                        }

                        const finishReason = parsed.choices?.[0]?.finish_reason;
                        if (finishReason && finishReason !== 'stop') {
                            console.warn('پایان با دلیل:', finishReason);
                        }
                    } catch (e) {
                        // نادیده بگیر
                    }
                }
            }
        } finally {
            try { reader.releaseLock(); } catch (e) {}
        }

        return {
            content: fullContent,
            model: modelUsed,
        };
    },

    /**
     * تست اتصال
     */
    async testConnection() {
        try {
            if (!this.getApiKey()) {
                return { success: false, message: 'کلید API خالی است' };
            }

            const result = await this.chat(
                [{ role: 'user', content: 'سلام' }],
                { maxTokens: 20 }
            );

            return {
                success: true,
                message: `اتصال برقرار است - مدل: ${result.model}`,
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    _getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin || 'https://localhost',
            'X-Title': 'Charkh Falak',
        };
    },

    _parseError(status, data, model) {
        const msg = data?.error?.message || data?.message || '';

        if (status === 401) return 'کلید API نامعتبر است (۴۰۱)';
        if (status === 402) return 'اعتبار کافی نیست (۴۰۲): ' + msg;
        if (status === 403) return 'دسترسی ممنوع (۴۰۳): ' + msg;
        if (status === 404) return `مدل «${model}» پیدا نشد`;
        if (status === 429) return 'درخواست‌ها زیاد است (۴۲۹) - کمی صبر کنید';
        if (status >= 500) return 'خطای سرور OpenRouter (۵xx)';
        return msg || `خطای ${status}`;
    },
};

window.OpenRouter = OpenRouter;