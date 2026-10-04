/**
 * ارتباط با OpenRouter
 * - پشتیبانی از SSE + JSON (تشخیص خودکار)
 * - Fallback خودکار از استریم به معمولی
 * - لاگ کامل درخواست و پاسخ
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
     * هدرها
     */
    _getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin || 'https://localhost',
            'X-Title': 'Charkh Falak',
        };
    },

    /**
     * ساخت body
     */
    _buildBody(messages, options, stream) {
        return {
            model: options.model || this.getModel(),
            messages,
            temperature: options.temperature ?? AppState.get('settings.aiTemperature') ?? 0.8,
            max_tokens: options.maxTokens || 2000,
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
            url,
            model: body.model,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            messagesCount: messages.length,
            stream: false,
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
            throw new Error(
                'خطای شبکه: به اینترنت متصل نیستید یا OpenRouter در دسترس نیست.'
            );
        }

        const duration = Date.now() - startTime;
        const contentType = response.headers.get('content-type') || '';

        Logger.debug('OpenRouter.chat', '📥 پاسخ دریافت شد', {
            status: response.status,
            contentType,
            duration: duration + 'ms',
        });

        let data;
        const rawText = await response.text();

        Logger.debug('OpenRouter.chat', '📄 متن خام پاسخ (200 کاراکتر اول)', {
            rawPreview: rawText.substring(0, 200),
            rawLength: rawText.length,
        });

        try {
            data = JSON.parse(rawText);
        } catch (e) {
            Logger.error('OpenRouter.chat.parse', new Error('پاسخ JSON نامعتبر'), {
                rawText: rawText.substring(0, 500),
                status: response.status,
            });
            throw new Error(`پاسخ نامعتبر از سرور (کد ${response.status})`);
        }

        if (!response.ok) {
            Logger.error('OpenRouter.chat.http', new Error('خطای HTTP'), {
                status: response.status,
                errorData: data,
            });
            throw new Error(this._parseError(response.status, data, body.model));
        }

        // استخراج محتوا
        let content = '';
        let modelUsed = data.model || body.model;

        if (data.choices?.[0]?.message?.content) {
            content = data.choices[0].message.content;
        } else if (data.choices?.[0]?.message?.reasoning) {
            content = data.choices[0].message.reasoning;
            Logger.warn('OpenRouter.chat', 'استفاده از reasoning به جای content');
        } else if (data.choices?.[0]?.text) {
            content = data.choices[0].text;
            Logger.warn('OpenRouter.chat', 'استفاده از text به جای content');
        }

        Logger.debug('OpenRouter.chat', '✅ محتوا استخراج شد', {
            contentLength: content.length,
            model: modelUsed,
            finishReason: data.choices?.[0]?.finish_reason,
            usage: data.usage,
        });

        if (!content || !content.trim()) {
            const err = new Error(
                `پاسخ خالی از مدل «${modelUsed}» دریافت شد`
            );
            Logger.error('OpenRouter.chat.empty', err, {
                fullData: JSON.stringify(data).substring(0, 500),
                finishReason: data.choices?.[0]?.finish_reason,
            });
            throw err;
        }

        return { content, model: modelUsed, usage: data.usage || {} };
    },

    // ═══════════════════════════════════════════
    // درخواست استریم (با تشخیص خودکار)
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
            url,
            model: body.model,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            messagesCount: messages.length,
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
            Logger.error('OpenRouter.stream.network', networkError, { url });
            throw new Error('خطای شبکه: ' + networkError.message);
        }

        const duration = Date.now() - startTime;
        const contentType = response.headers.get('content-type') || '';

        Logger.debug('OpenRouter.stream', '📥 پاسخ استریم دریافت شد', {
            status: response.status,
            contentType,
            duration: duration + 'ms',
        });

        // خطای HTTP
        if (!response.ok) {
            let errData = {};
            try {
                const txt = await response.text();
                errData = JSON.parse(txt);
            } catch (e) {}

            Logger.error('OpenRouter.stream.http', new Error('خطای HTTP'), {
                status: response.status,
                errorData: errData,
            });
            throw new Error(this._parseError(response.status, errData, body.model));
        }

        // ─── حالت ۱: پاسخ SSE ───
        if (contentType.includes('text/event-stream')) {
            Logger.debug('OpenRouter.stream', '🎬 نوع: SSE');
            return await this._parseSSE(response, body.model, onChunk);
        }

        // ─── حالت ۲: پاسخ JSON معمولی (سرور استریم را نادیده گرفته) ───
        Logger.warn(
            'OpenRouter.stream',
            '⚠️ سرور SSE نداد - به JSON معمولی برمی‌گردیم',
            { contentType }
        );

        const rawText = await response.text();
        Logger.debug('OpenRouter.stream', '📄 متن خام JSON', {
            rawLength: rawText.length,
            rawPreview: rawText.substring(0, 300),
        });

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            Logger.error('OpenRouter.stream.parseJSON', e, {
                rawText: rawText.substring(0, 500),
            });
            throw new Error('پاسخ نامعتبر از سرور (نه SSE نه JSON)');
        }

        const content = data.choices?.[0]?.message?.content || '';
        const modelUsed = data.model || body.model;

        Logger.debug('OpenRouter.stream', '✅ محتوا از JSON استخراج شد', {
            contentLength: content.length,
            model: modelUsed,
        });

        if (!content.trim()) {
            Logger.error('OpenRouter.stream.emptyJSON', new Error('JSON خالی'), {
                fullData: JSON.stringify(data).substring(0, 500),
            });
            throw new Error(`پاسخ خالی از مدل «${modelUsed}» دریافت شد`);
        }

        if (typeof onChunk === 'function') {
            onChunk(content, modelUsed, content);
        }

        return { content, model: modelUsed };
    },

    /**
     * پارس SSE
     */
    async _parseSSE(response, fallbackModel, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let modelUsed = fallbackModel;
        let chunkCount = 0;
        let emptyChunkCount = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // پردازش خط به خط
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // فقط data: را پردازش کن
                    if (!trimmed.startsWith('data:')) {
                        // خطوط event: و id: و... را نادیده بگیر
                        continue;
                    }

                    const data = trimmed.slice(5).trim();
                    if (data === '[DONE]') {
                        Logger.debug('OpenRouter.stream', '🏁 [DONE] دریافت شد');
                        continue;
                    }
                    if (!data) continue;

                    let parsed;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        emptyChunkCount++;
                        if (emptyChunkCount <= 3) {
                            Logger.debug('OpenRouter.stream', 'خطای پارس chunk', {
                                preview: data.substring(0, 100),
                            });
                        }
                        continue;
                    }

                    if (parsed.model) modelUsed = parsed.model;
                    chunkCount++;

                    // استخراج chunk از delta
                    const delta = parsed.choices?.[0]?.delta || {};
                    let chunk = '';
                    if (delta.content) chunk = delta.content;
                    else if (delta.reasoning) chunk = delta.reasoning;

                    if (chunk) {
                        fullContent += chunk;
                        if (typeof onChunk === 'function') {
                            onChunk(chunk, modelUsed, fullContent);
                        }
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

        Logger.debug('OpenRouter.stream', '✅ استریم تمام شد', {
            chunkCount,
            emptyChunkCount,
            contentLength: fullContent.length,
            model: modelUsed,
        });

        // ─── Fallback: اگر خالی بود، به حالت غیراستریم برو ───
        if (!fullContent.trim()) {
            Logger.warn(
                'OpenRouter.stream',
                '⚠️ استریم خالی بود - تلاش با حالت غیراستریم',
                { chunkCount, emptyChunkCount }
            );

            // دوباره از chat استفاده کن (با همان پیام‌ها)
            // نکته: اینجا باید پیام‌ها را داشته باشیم
            // اما در این متد به آن‌ها دسترسی نداریم. پس خطا می‌دهیم
            // که بالاتر fallback کند
            throw new Error(
                `استریم از مدل «${modelUsed}» خالی بود. ` +
                `دوباره تلاش کنید.`
            );
        }

        return { content: fullContent, model: modelUsed };
    },

    /**
     * تست اتصال - هم SSE هم غیراستریم
     */
    async testConnection() {
        const result = {
            apiKey: !!this.getApiKey(),
            model: this.getModel(),
            nonStream: null,
            stream: null,
            timestamp: Date.now(),
        };

        if (!result.apiKey) {
            result.error = 'کلید API خالی است';
            return { success: false, message: 'کلید API خالی است', details: result };
        }

        // تست ۱: غیراستریم
        try {
            const r = await this.chat(
                [{ role: 'user', content: 'سلام' }],
                { maxTokens: 20 }
            );
            result.nonStream = {
                ok: true,
                contentLength: r.content.length,
                model: r.model,
            };
        } catch (e) {
            result.nonStream = { ok: false, error: e.message };
        }

        // تست ۲: استریم
        try {
            let totalLen = 0;
            await this.chatStream(
                [{ role: 'user', content: 'سلام' }],
                { maxTokens: 20 },
                (chunk) => { totalLen += chunk.length; }
            );
            result.stream = { ok: true, contentLength: totalLen };
        } catch (e) {
            result.stream = { ok: false, error: e.message };
        }

        // نتیجه‌گیری
        if (result.nonStream.ok && result.stream.ok) {
            return {
                success: true,
                message: `اتصال برقرار است - مدل: ${result.nonStream.model}`,
                details: result,
            };
        } else if (result.nonStream.ok) {
            return {
                success: true,
                message: `غیراستریم کار می‌کند، استریم ممکن است کند باشد`,
                details: result,
            };
        } else {
            return {
                success: false,
                message: result.nonStream.error || 'خطای ناشناخته',
                details: result,
            };
        }
    },

    /**
     * ترجمه خطاها
     */
    _parseError(status, data, model) {
        const msg = data?.error?.message || data?.message || '';

        if (status === 401) return 'کلید API نامعتبر است (۴۰۱)';
        if (status === 402) return 'اعتبار کافی نیست (۴۰۲): ' + msg;
        if (status === 403) return 'دسترسی ممنوع (۴۰۳): ' + msg;
        if (status === 404) return `مدل «${model}» پیدا نشد`;
        if (status === 408) return 'زمان درخواست تمام شد (۴۰۸)';
        if (status === 429) return 'درخواست‌ها زیاد است (۴۲۹) - کمی صبر کنید';
        if (status === 502) return 'خطای دروازه (۵۰۲) - مدل در دسترس نیست';
        if (status === 503) return 'سرویس در دسترس نیست (۵۰۳)';
        if (status >= 500) return 'خطای سرور OpenRouter (۵xx)';
        return msg || `خطای ${status}`;
    },
};

window.OpenRouter = OpenRouter;