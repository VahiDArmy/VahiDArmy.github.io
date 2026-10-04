/**
 * مدیریت داستان‌ها - با پشتیبانی Streaming
 * @module storyManager
 */

const StoryManager = {
    isGenerating: false,

    /**
     * تولید استریم - نتیجه تدریجی برمی‌گردد
     */
    async generateStream(context, callbacks = {}) {
        const { onChunk, onComplete, onError } = callbacks;

        if (this.isGenerating) {
            const err = new Error('در حال تولید داستان قبلی هستید');
            if (onError) onError(err);
            return null;
        }

        if (!OpenRouter.getApiKey()) {
            const err = new Error('کلید API OpenRouter تنظیم نشده است');
            if (onError) onError(err);
            return null;
        }

        this.isGenerating = true;

        try {
            const systemPrompt = PromptBuilder.getSystemPrompt();
            const userPrompt = PromptBuilder.buildStoryPrompt(context);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];

            let fullContent = '';
            let modelUsed = OpenRouter.getModel();

            const result = await OpenRouter.chatStream(
                messages,
                {
                    temperature: AppState.get('settings.aiTemperature') || 0.8,
                    maxTokens: 1500,
                },
                (chunk, model) => {
                    fullContent += chunk;
                    if (model) modelUsed = model;
                    if (onChunk) onChunk(chunk, model, fullContent);
                }
            );

            const story = {
                id: Utils.generateId('story'),
                content: result.content || fullContent,
                model: result.model || modelUsed,
                context: JSON.stringify({
                    winner: context.winner?.name,
                    mode: context.mode,
                    tone: context.tone,
                }),
                timestamp: Date.now(),
                wordCount: (result.content || fullContent).trim().split(/\s+/).length,
            };

            // ذخیره در دیتابیس
            try { SQLStorage.addStory(story); } catch (e) {}

            const stories = [story, ...(AppState.get('stories') || [])].slice(0, 100);
            AppState.set('stories', stories);

            if (onComplete) onComplete(story);

            return story;
        } catch (error) {
            console.error('خطای StoryManager:', error);
            if (onError) onError(error);
            return null;
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * تولید معمولی (بدون استریم) - برای سازگاری
     */
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