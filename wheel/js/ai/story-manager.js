/**
 * مدیریت داستان‌های تولیدشده
 * @module storyManager
 */

const StoryManager = {
    isGenerating: false,

    /**
     * تولید داستان بر اساس context
     */
    async generate(context = {}, options = {}) {
        if (this.isGenerating) {
            Notification.warning('در حال تولید داستان قبلی هستید، کمی صبر کنید');
            return null;
        }

        if (!OpenRouter.getApiKey()) {
            Notification.error('کلید API OpenRouter را در تنظیمات وارد کنید');
            return null;
        }

        this.isGenerating = true;

        // نمایش لودینگ
        const loadingId = Notification.show(
            '🤖 در حال نوشتن داستان...',
            'info',
            0
        );

        try {
            const systemPrompt = PromptBuilder.getSystemPrompt();
            const userPrompt = PromptBuilder.buildStoryPrompt(context);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];

            const result = await OpenRouter.chat(messages, {
                temperature: AppState.get('settings.aiTemperature') || 0.8,
                maxTokens: options.maxTokens || 1000,
                model: options.model || AppState.get('settings.aiModel') || 'openrouter/free',
            });

            // ذخیره در دیتابیس
            const story = {
                id: Utils.generateId('story'),
                content: result.content || '',
                model: result.model || 'unknown',
                context: JSON.stringify({
                    winner: context.winner?.name,
                    mode: context.mode,
                    tone: context.tone,
                }),
                timestamp: Date.now(),
                usage: result.usage || {},
                wordCount: PromptBuilder.estimateWords(result.content || ''),
            };

            SQLStorage.addStory(story);

            // به‌روزرسانی State
            const stories = [story, ...(AppState.get('stories') || [])].slice(0, 100);
            AppState.set('stories', stories);

            // حذف لودینگ
            if (loadingId && loadingId.parentNode) {
                loadingId.parentNode.removeChild(loadingId);
            }

            Notification.success(`داستان با مدل «${this._shortenModelName(story.model)}» ساخته شد`);
            return story;
        } catch (error) {
            if (loadingId && loadingId.parentNode) {
                loadingId.parentNode.removeChild(loadingId);
            }
            Notification.error('خطا در تولید داستان: ' + error.message);
            console.error('خطای StoryManager:', error);
            return null;
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * دریافت همه داستان‌ها
     */
    getAll(limit = 50) {
        return SQLStorage.getAllStories(limit).map((s) => ({
            id: s.id,
            content: s.content,
            model: s.model,
            context: s.context,
            timestamp: s.timestamp,
        }));
    },

    /**
     * دریافت داستان با شناسه
     */
    getById(id) {
        return this.getAll().find((s) => s.id === id);
    },

    /**
     * حذف داستان
     */
    remove(id) {
        SQLStorage.removeStory(id);
        const stories = (AppState.get('stories') || []).filter((s) => s.id !== id);
        AppState.set('stories', stories);
        Notification.info('داستان حذف شد');
    },

    /**
     * پاک کردن همه داستان‌ها
     */
    clear() {
        SQLStorage.clearStories();
        AppState.set('stories', []);
        Notification.info('همه داستان‌ها پاک شدند');
    },

    /**
     * رندر داستان به HTML (تبدیل markdown ساده)
     */
    renderToHTML(content) {
        if (!content) return '<p class="text-muted">داستانی تولید نشده است.</p>';

        let html = content;

        // تیتر h2
        html = html.replace(/^##\s+(.+)$/gm, '<h2 class="story-title">$1</h2>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3 class="story-subtitle">$1</h3>');

        // بولد
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // ایتالیک
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // پاراگراف‌ها
        html = html.split(/\n\n+/).map((p) => {
            p = p.trim();
            if (!p) return '';
            if (p.startsWith('<h2') || p.startsWith('<h3')) return p;
            return `<p>${p}</p>`;
        }).join('');

        return html;
    },

    /**
     * دانلود داستان
     */
    download(story) {
        const text = `# داستان تولیدشده توسط هوش مصنوعی\n\n` +
            `مدل: ${story.model}\n` +
            `تاریخ: ${Utils.formatDate(story.timestamp)}\n\n` +
            `---\n\n${story.content}`;

        Utils.downloadFile(text, `story-${story.id}.txt`, 'text/plain;charset=utf-8');
    },

    /**
     * کپی به کلیپ‌بورد
     */
    async copy(story) {
        const ok = await Utils.copyToClipboard(story.content);
        if (ok) Notification.success('داستان کپی شد');
        else Notification.error('خطا در کپی');
    },

    /**
     * کوتاه کردن نام مدل
     */
    _shortenModelName(model) {
        if (!model) return 'نامشخص';
        return model.split('/').pop().split(':')[0];
    },

    /**
     * آمار
     */
    getStats() {
        const all = this.getAll(1000);
        const models = {};
        let totalWords = 0;

        all.forEach((s) => {
            const m = s.model || 'unknown';
            models[m] = (models[m] || 0) + 1;
            totalWords += (s.content || '').trim().split(/\s+/).length;
        });

        return {
            total: all.length,
            models,
            totalWords,
            avgWords: all.length > 0 ? Math.round(totalWords / all.length) : 0,
        };
    },
};

window.StoryManager = StoryManager;