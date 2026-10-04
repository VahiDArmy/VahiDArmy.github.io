/**
 * ارتباط با OpenRouter
 * - فقط content را برمی‌گرداند (نه reasoning)
 * - Fallback خودکار از استریم به JSON
 * @module openRouter
 */

const OpenRouter = {
    baseUrl: 'https://api.openrouter.ai/api/v1',

    getApiKey() {
        return (AppState.get('settings.openrouterApiKey') || '').trim();
    },

    getModel() {
        const model = (AppState.get('settings.aiModel') || '').trim();
        return model || 'openrouter/free';
    },

    _getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin || 'https://localhost',
            'X-Title': 'Charkh Falak',
        };
    },

    _buildBody(messages, options, stream) {
        return {
            model: options.model || this.getModel(),
            messages,
            temperature: options.temperature ?? AppState.get('settings.aiTemperature') ?? 0.8,
            max_tokens: options.maxTokens || 2500,
            stream,
        };
    },

    // ═══════════════════════════════════════════
    // درخواست معمولی (بدون استریم)
    // ═══════════════════════════════════════════

    async chat(messages, options = {}) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            const err = new Error('کلید API OpenRouter تنظیم نشده است');
            Logger.error('OpenRouter.chat', err);
            throw err;
        }

        const body = this._buildBody(messages, options, false);
        const url = `${this.baseUrl}/chat/completions`;

        Logger.debug('OpenRouter.chat', '📤 ارسال درخواست', {
            url, model: body.model, temperature: body.temperature,
        });

        let response;
        const startTime = Date.now();

        try {
            response = await fetch(url, {
                method: 'POST',
                headers: this._getHeaders(apiKey),
                body: JSON.stringify(body),
            });
        } catch (networkError) {
            Logger.error('OpenRouter.chat.network', networkError, { url });
            throw new Error('خطای شبکه: به اینترنت متصل نیستید یا OpenRouter در دسترس نیست.');
        }

        const duration = Date.now() - startTime;
        const rawText = await response.text();

        Logger.debug('OpenRouter.chat', '📥 پاسخ', {
            status: response.status, duration: duration + 'ms',
            rawLength: rawText.length,
        });

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            Logger.error('OpenRouter.chat.parse', e, {
                rawText: rawText.substring(0, 500), status: response.status,
            });
            throw new Error(`پاسخ نامعتبر از سرور (کد ${response.status})`);
        }

        if (!response.ok) {
            Logger.error('OpenRouter.chat.http', new Error('خطای HTTP'), {
                status: response.status, errorData: data,
            });
            throw new Error(this._parseError(response.status, data, body.model));
        }

        // ⚠️ فقط content را استفاده کن - نه reasoning
        const choice = data.choices?.[0];
        const message = choice?.message || {};
        const content = (message.content || '').trim();
        const modelUsed = data.model || body.model;

        Logger.debug('OpenRouter.chat', '📊 استخراج محتوا', {
            hasContent: !!content,
            contentLength: content.length,
            hasReasoning: !!message.reasoning,
            reasoningLength: (message.reasoning || '').length,
            finishReason: choice?.finish_reason,
            model: modelUsed,
        });

        // اگر content خالی ولی reasoning دارد
        if (!content && message.reasoning) {
            const err = new Error(
                `مدل «${modelUsed}» فقط reasoning برگرداند و content خالی است. ` +
                `یک مدل دیگر انتخاب کنید.`
            );
            Logger.error('OpenRouter.chat.reasoningOnly', err);
            throw err;
        }

        if (!content) {
            const err = new Error(`پاسخ خالی از مدل «${modelUsed}» دریافت شد`);
            Logger.error('OpenRouter.chat.empty', err, {
                finishReason: choice?.finish_reason,
            });
            throw err;
        }

        return { content, model: modelUsed, usage: data.usage || {} };
    },

    // ═══════════════════════════════════════════
    // درخواست استریم
    // ═══════════════════════════════════════════

    async chatStream(messages, options = {}, onChunk) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            const err = new Error('کلید API OpenRouter تنظیم نشده است');
            Logger.error('OpenRouter.stream', err);
            throw err;
        }

        const body = this._buildBody(messages, options, true);
        const url = `${this.baseUrl}/chat/completions`;

        Logger.debug('OpenRouter.stream', '📤 ارسال درخواست استریم', {
            url, model: body.model,
        });

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: this._getHeaders(apiKey),
                body: JSON.stringify(body),
            });
        } catch (networkError) {
            Logger.error('OpenRouter.stream.network', networkError, { url });
            throw new Error('خطای شبکه: ' + networkError.message);
        }

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
            let errData = {};
            try {
                const txt = await response.text();
                errData = JSON.parse(txt);
            } catch (e) {}
            Logger.error('OpenRouter.stream.http', new Error('خطای HTTP'), {
                status: response.status, errorData: errData,
            });
            throw new Error(this._parseError(response.status, errData, body.model));
        }

        // SSE
        if (contentType.includes('text/event-stream')) {
            return await this._parseSSE(response, body.model, onChunk);
        }

        // JSON معمولی
        Logger.warn('OpenRouter.stream', '⚠️ سرور SSE نداد - JSON');
        const rawText = await response.text();

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            Logger.error('OpenRouter.stream.parseJSON', e);
            throw new Error('پاسخ نامعتبر از سرور');
        }

        const choice = data.choices?.[0];
        const message = choice?.message || {};
        const content = (message.content || '').trim();
        const modelUsed = data.model || body.model;

        // اگر فقط reasoning داشت
        if (!content && message.reasoning) {
            throw new Error(
                `مدل «${modelUsed}» فقط reasoning برگرداند. مدل دیگری انتخاب کنید.`
            );
        }

        if (!content) {
            throw new Error(`پاسخ خالی از مدل «${modelUsed}»`);
        }

        if (typeof onChunk === 'function') {
            onChunk(content, modelUsed, content);
        }

        return { content, model: modelUsed };
    },

    /**
     * پارس SSE - ⚠️ فقط content، نه reasoning
     */
    async _parseSSE(response, fallbackModel, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let reasoningContent = '';
        let modelUsed = fallbackModel;
        let chunkCount = 0;
        let contentChunks = 0;

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
                    if (!data) continue;

                    let parsed;
                    try { parsed = JSON.parse(data); } catch (e) { continue; }

                    if (parsed.model) modelUsed = parsed.model;
                    chunkCount++;

                    const delta = parsed.choices?.[0]?.delta || {};

                    // ⚠️ فقط content را اضافه کن
                    if (delta.content) {
                        fullContent += delta.content;
                        contentChunks++;
                        if (typeof onChunk === 'function') {
                            onChunk(delta.content, modelUsed, fullContent);
                        }
                    }

                    // reasoning را فقط برای لاگ نگه‌دار (نمایش نده)
                    if (delta.reasoning) {
                        reasoningContent += delta.reasoning;
                    }
                }
            }
        } catch (e) {
            Logger.error('OpenRouter.stream.read', e, {
                chunksReceived: chunkCount,
                contentSoFar: fullContent.length,
            });
            if (!fullContent) throw e;
        } finally {
            try { reader.releaseLock(); } catch (e) {}
        }

        Logger.debug('OpenRouter.stream', '🏁 استریم تمام شد', {
            totalChunks: chunkCount,
            contentChunks,
            contentLength: fullContent.length,
            reasoningLength: reasoningContent.length,
            model: modelUsed,
        });

        // اگر content نداشت ولی reasoning داشت
        if (!fullContent.trim() && reasoningContent.trim()) {
            const err = new Error(
                `مدل «${modelUsed}» فقط reasoning برگرداند و داستان تولید نکرد. ` +
                `لطفاً یک مدل دیگر انتخاب کنید.`
            );
            Logger.error('OpenRouter.stream.reasoningOnly', err, {
                reasoningPreview: reasoningContent.substring(0, 300),
            });
            throw err;
        }

        if (!fullContent.trim()) {
            throw new Error(`استریم از مدل «${modelUsed}» خالی بود`);
        }

        return { content: fullContent, model: modelUsed };
    },

    async testConnection() {
        const result = {
            apiKey: !!this.getApiKey(),
            model: this.getModel(),
            nonStream: null,
            timestamp: Date.now(),
        };

        if (!result.apiKey) {
            result.error = 'کلید API خالی است';
            return { success: false, message: 'کلید API خالی است', details: result };
        }

        try {
            const r = await this.chat(
                [{ role: 'user', content: 'یک جمله فارسی بگو' }],
                { maxTokens: 50 }
            );
            result.nonStream = {
                ok: true,
                contentLength: r.content.length,
                model: r.model,
                preview: r.content.substring(0, 100),
            };
        } catch (e) {
            result.nonStream = { ok: false, error: e.message };
        }

        if (result.nonStream.ok) {
            return {
                success: true,
                message: `اتصال برقرار - مدل: ${result.nonStream.model}`,
                details: result,
            };
        }

        return {
            success: false,
            message: result.nonStream.error,
            details: result,
        };
    },

    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`);
            if (!response.ok) throw new Error('خطا در دریافت مدل‌ها');
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            Logger.error('OpenRouter.getModels', error);
            return [];
        }
    },

    _parseError(status, data, model) {
        const msg = data?.error?.message || data?.message || '';
        if (status === 401) return 'کلید API نامعتبر است (۴۰۱)';
        if (status === 402) return 'اعتبار کافی نیست (۴۰۲): ' + msg;
        if (status === 403) return 'دسترسی ممنوع (۴۰۳): ' + msg;
        if (status === 404) return `مدل «${model}» پیدا نشد`;
        if (status === 408) return 'زمان درخواست تمام شد (۴۰۸)';
        if (status === 429) return 'درخواست‌ها زیاد است (۴۲۹)';
        if (status === 502) return 'خطای دروازه (۵۰۲)';
        if (status === 503) return 'سرویس در دسترس نیست (۵۰۳)';
        if (status >= 500) return 'خطای سرور OpenRouter (۵xx)';
        return msg || `خطای ${status}`;
    },
};

window.OpenRouter = OpenRouter;