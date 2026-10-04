/**
 * مدیریت داستان‌ها - با fallback خودکار
 * @module storyManager
 */

const StoryManager = {
    isGenerating: false,

    async generateStream(context, callbacks = {}) {
        const { onChunk, onComplete, onError } = callbacks;

        if (this.isGenerating) {
            const err = new Error('در حال تولید داستان قبلی هستید');
            Logger.warn('StoryManager', err.message);
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
            Logger.info('StoryManager', '🎬 شروع تولید داستان', {
                model: OpenRouter.getModel(),
                temperature: AppState.get('settings.aiTemperature'),
            });

            const systemPrompt = PromptBuilder.getSystemPrompt();
            const userPrompt = PromptBuilder.buildStoryPrompt(context);

            Logger.debug('StoryManager', '📝 پرامپت‌ها آماده شدند', {
                systemLength: systemPrompt.length,
                userLength: userPrompt.length,
            });

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];

            // ─── تلاش ۱: استریم ───
            let result = null;
            let usedStream = true;

            try {
                result = await this._tryStream(messages, onChunk);
            } catch (streamErr) {
                Logger.warn(
                    'StoryManager',
                    '⚠️ استریم شکست خورد، تلاش با حالت غیراستریم',
                    { error: streamErr.message }
                );
                usedStream = false;

                // ─── تلاش ۲: غیراستریم ───
                try {
                    result = await this._tryNonStream(messages);
                    // محتوا را به صورت یکجا به onChunk بده
                    if (onChunk && result) {
                        onChunk(result.content, result.model, result.content);
                    }
                } catch (nonStreamErr) {
                    Logger.error('StoryManager.bothFailed', nonStreamErr, {
                        streamError: streamErr.message,
                        nonStreamError: nonStreamErr.message,
                    });
                    throw nonStreamErr;
                }
            }

            if (!result || !result.content || !result.content.trim()) {
                const err = new Error('پاسخ خالی از هر دو حالت دریافت شد');
                Logger.error('StoryManager.emptyResult', err);
                throw err;
            }

            const finalContent = result.content;

            const story = {
                id: Utils.generateId('story'),
                content: finalContent,
                model: result.model || OpenRouter.getModel(),
                context: JSON.stringify({
                    winner: context.winner?.name,
                    mode: context.mode,
                    tone: context.tone,
                }),
                timestamp: Date.now(),
                wordCount: finalContent.trim().split(/\s+/).length,
                usedStream,
            };

            try {
                SQLStorage.addStory(story);
            } catch (e) {
                Logger.warn('StoryManager.saveStory', 'ذخیره داستان ناموفق', {
                    error: e.message,
                });
            }

            const stories = [story, ...(AppState.get('stories') || [])].slice(0, 100);
            AppState.set('stories', stories);

            Logger.info('StoryManager', '✅ داستان ساخته شد', {
                length: finalContent.length,
                model: result.model,
                usedStream,
            });

            if (onComplete) onComplete(story);
            return story;
        } catch (error) {
            Logger.error('StoryManager.generateStream', error, {
                model: OpenRouter.getModel(),
                hasApiKey: !!OpenRouter.getApiKey(),
            });
            if (onError) onError(error);
            return null;
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * تلاش با استریم
     */
    async _tryStream(messages, onChunk) {
        return await OpenRouter.chatStream(
            messages,
            {
                temperature: AppState.get('settings.aiTemperature') || 0.8,
                maxTokens: 2000,
            },
            onChunk
        );
    },

    /**
     * تلاش غیراستریم
     */
    async _tryNonStream(messages) {
        return await OpenRouter.chat(messages, {
            temperature: AppState.get('settings.aiTemperature') || 0.8,
            maxTokens: 2000,
        });
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
            Logger.error('StoryManager.getAll', e);
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
        const text = `# داستان تولیدشده\n\n` +
            `مدل: ${story.model}\n` +
            `تاریخ: ${Utils.formatDate(story.timestamp)}\n\n` +
            `---\n\n${story.content}`;

        Utils.downloadFile(text, `story-${story.id}.txt`, 'text/plain;charset=utf-8');
    },

    async copy(story) {
        const ok = await Utils.copyToClipboard(story.content);
        if (ok) Notification.success('داستان کپی شد');
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