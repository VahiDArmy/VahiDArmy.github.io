/**
 * مدیریت داستان‌ها - با فیلتر قوی برای متن غیرفارسی
 * @module storyManager
 */

const StoryManager = {
    isGenerating: false,

    async generateStream(context, callbacks = {}) {
        const { onChunk, onComplete, onError } = callbacks;

        if (this.isGenerating) {
            const err = new Error('در حال تولید داستان قبلی هستید');
            if (onError) onError(err);
            return null;
        }

        if (!OpenRouter.getApiKey()) {
            const err = new Error('کلید API OpenRouter تنظیم نشده است');
            Logger.error('StoryManager.noApiKey', err);
            if (onError) onError(err);
            return null;
        }

        this.isGenerating = true;

        try {
            const systemPrompt = PromptBuilder.getSystemPrompt();
            const userPrompt = PromptBuilder.buildStoryPrompt(context);

            Logger.debug('StoryManager', '📝 پرامپت آماده', {
                systemLength: systemPrompt.length,
                userLength: userPrompt.length,
                model: OpenRouter.getModel(),
            });

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];

            let result = null;
            try {
                result = await OpenRouter.chatStream(
                    messages,
                    {
                        temperature: AppState.get('settings.aiTemperature') || 0.9,
                        maxTokens: 3000,
                    },
                    onChunk
                );
            } catch (streamErr) {
                Logger.warn('StoryManager', 'استریم شکست خورد - fallback', {
                    error: streamErr.message,
                });

                result = await OpenRouter.chat(messages, {
                    temperature: AppState.get('settings.aiTemperature') || 0.9,
                    maxTokens: 3000,
                });

                if (onChunk && result) {
                    onChunk(result.content, result.model, result.content);
                }
            }

            if (!result || !result.content) {
                throw new Error('پاسخ خالی از سرور');
            }

            const cleanedContent = this._cleanStoryContent(result.content);

            if (!cleanedContent.trim()) {
                throw new Error('پس از پاکسازی، محتوا خالی شد');
            }

            // بررسی: آیا خروجی عمدتاً فارسی است؟
            const persianCheck = this._checkPersianRatio(cleanedContent);
            Logger.debug('StoryManager', '📊 بررسی فارسی', persianCheck);

            if (!persianCheck.ok && persianCheck.reason) {
                Logger.warn('StoryManager', '⚠️ خروجی فارسی نیست', persianCheck);
            }

            const story = {
                id: Utils.generateId('story'),
                content: cleanedContent,
                model: result.model || OpenRouter.getModel(),
                context: JSON.stringify({
                    winner: context.winner?.name,
                    mode: context.mode,
                }),
                timestamp: Date.now(),
                wordCount: cleanedContent.trim().split(/\s+/).length,
            };

            try { SQLStorage.addStory(story); } catch (e) {}

            const stories = [story, ...(AppState.get('stories') || [])].slice(0, 100);
            AppState.set('stories', stories);

            Logger.info('StoryManager', '✅ داستان ساخته شد', {
                length: cleanedContent.length,
                model: result.model,
                persianRatio: persianCheck.ratio,
            });

            if (onComplete) onComplete(story);
            return story;
        } catch (error) {
            Logger.error('StoryManager.generateStream', error);
            if (onError) onError(error);
            return null;
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * بررسی نسبت فارسی
     */
    _checkPersianRatio(text) {
        const persianChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        const total = persianChars + englishChars;

        if (total === 0) {
            return { ok: false, reason: 'no letters', ratio: 0, persianChars, englishChars };
        }

        const ratio = persianChars / total;

        if (ratio < 0.7) {
            return {
                ok: false,
                reason: 'mostly non-persian',
                ratio,
                persianChars,
                englishChars,
            };
        }

        return { ok: true, ratio, persianChars, englishChars };
    },

    /**
     * پاکسازی محتوا از متن غیرفارسی
     */
    _cleanStoryContent(content) {
        if (!content) return '';

        let cleaned = content;

        // ۱. حذف بلوک‌های thinking / reasoning
        cleaned = cleaned.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '');
        cleaned = cleaned.replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, '');
        cleaned = cleaned.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '');
        cleaned = cleaned.replace(/<reasoning[^>]*>[\s\S]*?<\/reasoning>/gi, '');

        // ۲. حذف خطوطی که با کلمات انگلیسی شروع می‌شوند
        cleaned = cleaned.replace(/^(thinking|reasoning|analysis|let me think|okay|well|sure|here|title|story|chapter|draft|outline)[:：].*/gim, '');

        // ۳. حذف خطوط توضیحی در پرانتز که عمدتاً انگلیسی هستند
        cleaned = cleaned.replace(/^\s*\([^)]*[a-zA-Z]{5,}[^)]*\)\s*$/gm, '');

        // ۴. حذف خطوطی که بیشتر از ۵۰٪ انگلیسی هستند
        const lines = cleaned.split('\n');
        const filtered = lines.filter((line) => {
            const trimmed = line.trim();
            if (!trimmed) return true;

            const persianChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
            const englishChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
            const total = persianChars + englishChars;

            if (total === 0) return true;

            const englishRatio = englishChars / total;

            // اگر خط بیش از ۵۰٪ انگلیسی است، حذف کن
            if (englishRatio > 0.5) {
                Logger.debug('StoryManager.clean', 'خط انگلیسی حذف شد', {
                    preview: trimmed.substring(0, 80),
                    ratio: englishRatio.toFixed(2),
                });
                return false;
            }

            return true;
        });

        cleaned = filtered.join('\n');

        // ۵. حذف کلمات انگلیسی تک‌افتاده در متن فارسی (کلمات بیش از ۸ حرف)
        cleaned = cleaned.replace(/\b[a-zA-Z]{9,}\b/g, '');

        // ۶. حذف خطوط خالی اضافه
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.trim();

        return cleaned;
    },

    async generate(context, options = {}) {
        return new Promise((resolve) => {
            this.generateStream(context, {
                onComplete: (story) => resolve(story),
                onError: (err) => {
                    Notification.error('خطا در تولید داستان: ' + err.message);
                    resolve(null);
                },
            });
        });
    },

    getAll(limit = 50) {
        try {
            return SQLStorage.getAllStories(limit).map((s) => ({
                id: s.id,
                content: s.content,
                model: s.model,
                context: s.context,
                timestamp: s.timestamp,
            }));
        } catch (e) {
            return [];
        }
    },

    getById(id) {
        return this.getAll(500).find((s) => s.id === id);
    },

    remove(id) {
        try { SQLStorage.removeStory(id); } catch (e) {}
        const stories = (AppState.get('stories') || []).filter((s) => s.id !== id);
        AppState.set('stories', stories);
    },

    clear() {
        try { SQLStorage.clearStories(); } catch (e) {}
        AppState.set('stories', []);
    },

    renderToHTML(content) {
        if (!content) return '<p class="text-muted">داستانی تولید نشده است.</p>';

        let html = content;

        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        html = html.replace(/^##\s+(.+)$/gm, '<h2 class="story-title">$1</h2>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3 class="story-subtitle">$1</h3>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        html = html.split(/\n\n+/).map((p) => {
            p = p.trim();
            if (!p) return '';
            if (p.startsWith('<h2') || p.startsWith('<h3')) return p;
            return `<p>${p}</p>`;
        }).join('');

        return html;
    },

    download(story) {
        const text = `# داستان\n\n` +
            `مدل: ${story.model}\n` +
            `تاریخ: ${Utils.formatDate(story.timestamp)}\n\n` +
            `---\n\n${story.content}`;

        Utils.downloadFile(text, `story-${story.id}.txt`, 'text/plain;charset=utf-8');
    },

    async copy(story) {
        const ok = await Utils.copyToClipboard(story.content);
        if (ok) Notification.success('کپی شد');
        else Notification.error('خطا در کپی');
    },

    getStats() {
        const all = this.getAll(1000);
        const models = {};
        let totalWords = 0;

        all.forEach((s) => {
            const m = s.model || 'unknown';
            models[m] = (models[m] || 0) + 1;
            totalWords += (s.content || '').trim().split(/\s+/).length;
        });

        return { total: all.length, models, totalWords };
    },
};

window.StoryManager = StoryManager;