/**
 * منطق صفحه هوش مصنوعی - با قابلیت حذف داستان
 * @module aiPage
 */

const AIPage = {
    selectedWinner: null,

    init() {
        this._checkApiKey();
        this._initWinnerSelector();
        this._initForm();
        this._initStoryList();
        this._initClearStoriesButton();
        this._loadWinnerFromQuery();
    },

    _checkApiKey() {
        const hasKey = !!OpenRouter.getApiKey();
        const warning = document.getElementById('api-warning');
        if (warning) warning.style.display = hasKey ? 'none' : 'block';
    },

    _loadWinnerFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const winnerId = params.get('winner');

        if (winnerId) {
            const winner = People.getById(winnerId) ||
                (AppState.get('items') || []).find((i) => i.id === winnerId);
            if (winner) {
                this.selectedWinner = {
                    id: winner.id,
                    name: winner.name || winner.label,
                    description: Descriptions.get(winner.id) || '',
                    starred: winner.starred || false,
                };
                this._updateWinnerDisplay();
            }
        } else {
            try {
                if (typeof SQLStorage !== 'undefined' && SQLStorage.isReady) {
                    const lastWinner = SQLStorage.getSetting('last_winner_for_story');
                    if (lastWinner && Date.now() - lastWinner.timestamp < 300000) {
                        this.selectedWinner = lastWinner;
                        this._updateWinnerDisplay();
                    }
                }
            } catch (e) {}
        }
    },

    _initWinnerSelector() {
        const container = document.getElementById('winner-selector');
        if (!container) return;

        const people = AppState.get('people') || [];
        Dropdown.render(
            'winner-selector',
            people.map((p) => ({
                value: p.id,
                label: p.name,
                icon: '👤',
            })),
            (value) => {
                const person = People.getById(value);
                if (person) {
                    this.selectedWinner = {
                        id: person.id,
                        name: person.name,
                        description: Descriptions.get(person.id) || '',
                        starred: person.starred,
                    };
                    this._updateWinnerDisplay();
                }
            },
            { placeholder: 'انتخاب برنده...', searchable: true }
        );
    },

    _updateWinnerDisplay() {
        const container = document.getElementById('winner-display');
        if (!container) return;

        if (!this.selectedWinner) {
            container.innerHTML = '<p class="text-muted">برنده‌ای انتخاب نشده است</p>';
            return;
        }

        const w = this.selectedWinner;
        container.innerHTML = `
            <div class="winner-chip">
                <span class="winner-chip-icon">🏆</span>
                <span class="winner-chip-name">${this._escape(w.name)}</span>
                <button class="winner-chip-close" id="clear-winner" type="button" title="حذف">×</button>
            </div>
            ${w.description ? `<div class="winner-desc">${this._escape(w.description)}</div>` : ''}
        `;

        const clearBtn = document.getElementById('clear-winner');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.selectedWinner = null;
                this._updateWinnerDisplay();
            });
        }
    },

    _initForm() {
        const generateBtn = document.getElementById('generate-story-btn');
        if (!generateBtn) return;

        generateBtn.addEventListener('click', async () => {
            if (!this.selectedWinner) {
                Notification.warning('ابتدا یک برنده انتخاب کنید');
                return;
            }

            if (!OpenRouter.getApiKey()) {
                Notification.error('کلید API OpenRouter را در تنظیمات وارد کنید');
                return;
            }

            generateBtn.disabled = true;
            generateBtn.textContent = 'در حال تولید...';

            // نمایش حالت لودینگ
            const output = document.getElementById('story-output');
            if (output) {
                output.innerHTML = `
                    <div class="story-loading">
                        <div class="spinner"></div>
                        <p>در حال نوشتن داستان...</p>
                    </div>
                `;
            }

            try {
                const context = {
                    winner: this.selectedWinner,
                    allPeople: AppState.get('people') || [],
                    supportingCharacters: (AppState.get('people') || [])
                        .filter((p) => p.id !== this.selectedWinner.id)
                        .map((p) => ({
                            name: p.name,
                            description: Descriptions.get(p.id) || '',
                        })),
                    descriptions: this._collectDescriptions(),
                    items: (AppState.get('items') || []).map((i) => ({
                        label: i.label,
                        description: Descriptions.get(i.id) || '',
                    })),
                    topic: '',
                    type: 'provide',
                    mode: AppState.get('wheel.currentMode') || 'single',
                    tone: document.getElementById('tone-select')?.value || 'funny',
                    length: document.getElementById('length-select')?.value || 'medium',
                    extras: document.getElementById('story-extras')?.value || '',
                };

                const story = await StoryManager.generate(context);

                if (story) {
                    this._renderStory(story);
                    this._initStoryList();
                } else {
                    // اگر خطا داد
                    if (output) {
                        output.innerHTML = `
                            <div class="empty-output">
                                <div class="empty-icon-big">⚠️</div>
                                <p>خطا در ساخت داستان</p>
                                <p class="text-muted">دوباره تلاش کنید یا مدل را در تنظیمات بررسی کنید</p>
                            </div>
                        `;
                    }
                }
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '✨ ساخت داستان';
            }
        });
    },

    _collectDescriptions() {
        const all = Descriptions.getAll();
        const filtered = {};
        (AppState.get('people') || []).forEach((p) => {
            if (all[p.id]) filtered[p.name] = all[p.id];
        });
        (AppState.get('items') || []).forEach((i) => {
            if (all[i.id]) filtered[i.label] = all[i.id];
        });
        return filtered;
    },

    _renderStory(story) {
        const container = document.getElementById('story-output');
        if (!container) return;

        const html = StoryManager.renderToHTML(story.content);

        container.innerHTML = `
            <div class="story-card">
                <div class="story-content">${html}</div>
                <div class="story-actions">
                    <button class="btn btn-sm btn-secondary" id="copy-story" type="button">📋 کپی</button>
                    <button class="btn btn-sm btn-secondary" id="download-story" type="button">💾 دانلود</button>
                    <button class="btn btn-sm btn-secondary" id="regen-story" type="button">🔄 دوباره</button>
                </div>
                <div class="story-footer">
                    <div class="story-footer-item">
                        <span class="story-footer-icon">🤖</span>
                        <span class="story-footer-label">مدل:</span>
                        <span class="story-footer-value">${this._escape(story.model || 'نامشخص')}</span>
                    </div>
                    <div class="story-footer-item">
                        <span class="story-footer-icon">🕐</span>
                        <span class="story-footer-value">${Utils.formatDate(story.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('copy-story')?.addEventListener('click', () => StoryManager.copy(story));
        document.getElementById('download-story')?.addEventListener('click', () => StoryManager.download(story));
        document.getElementById('regen-story')?.addEventListener('click', () => {
            document.getElementById('generate-story-btn')?.click();
        });

        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * رندر لیست داستان‌ها با دکمه حذف
     */
    _initStoryList() {
        const container = document.getElementById('stories-list');
        if (!container) return;

        const stories = StoryManager.getAll(50);

        if (stories.length === 0) {
            container.innerHTML = `
                <div class="empty-stories">
                    <div class="empty-stories-icon">📚</div>
                    <p class="text-muted">هنوز داستانی ساخته نشده است</p>
                </div>
            `;
            this._updateClearButtonState();
            return;
        }

        container.innerHTML = stories.map((s) => {
            const preview = this._escape(Utils.truncate(s.content, 120));
            const modelShort = this._shortenModel(s.model);
            return `
                <div class="story-list-item" data-story-id="${s.id}">
                    <div class="story-list-body" data-action="open" data-story-id="${s.id}">
                        <div class="story-list-meta">
                            <span class="story-list-model">🤖 ${this._escape(modelShort)}</span>
                            <span class="text-muted">${Utils.formatDate(s.timestamp)}</span>
                        </div>
                        <div class="story-list-excerpt">${preview}</div>
                    </div>
                    <div class="story-list-actions">
                        <button class="story-list-delete" data-action="delete" data-story-id="${s.id}" type="button" title="حذف داستان">
                            🗑
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // رویداد باز کردن
        container.querySelectorAll('[data-action="open"]').forEach((el) => {
            el.addEventListener('click', () => {
                const story = StoryManager.getById(el.dataset.storyId);
                if (story) this._renderStory(story);
            });
        });

        // رویداد حذف تکی
        container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const storyId = btn.dataset.storyId;
                await this._deleteStory(storyId);
            });
        });

        this._updateClearButtonState();
    },

    /**
     * حذف تکی داستان با تأییدیه
     */
    async _deleteStory(storyId) {
        const story = StoryManager.getById(storyId);
        if (!story) {
            Notification.warning('داستان پیدا نشد');
            this._initStoryList();
            return;
        }

        const ok = await Modal.confirm(
            'این داستان حذف شود؟\n(این عمل غیرقابل بازگشت است)',
            {
                danger: true,
                title: 'حذف داستان',
                confirmLabel: 'بله، حذف کن',
                cancelLabel: 'انصراف',
            }
        );

        if (!ok) return;

        try {
            StoryManager.remove(storyId);
            Notification.success('داستان حذف شد');
            this._initStoryList();
        } catch (error) {
            Logger.error('AIPage.deleteStory', error, { storyId });
            Notification.error('خطا در حذف: ' + error.message);
        }
    },

    /**
     * دکمه پاک کردن همه داستان‌ها
     */
    _initClearStoriesButton() {
        const btn = document.getElementById('clear-stories-btn');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const all = StoryManager.getAll(1000);
            if (all.length === 0) {
                Notification.info('داستانی برای حذف وجود ندارد');
                return;
            }

            const ok = await Modal.confirm(
                `آیا از حذف همه‌ی ${Utils.toPersianNumbers(all.length)} داستان مطمئن هستید؟\n(این عمل غیرقابل بازگشت است)`,
                {
                    danger: true,
                    title: 'پاک کردن همه داستان‌ها',
                    confirmLabel: 'بله، همه را حذف کن',
                    cancelLabel: 'انصراف',
                }
            );

            if (!ok) return;

            try {
                StoryManager.clear();
                Notification.success('همه داستان‌ها حذف شدند');
                this._initStoryList();

                // پاک کردن خروجی فعلی
                const output = document.getElementById('story-output');
                if (output) {
                    output.innerHTML = `
                        <div class="empty-output">
                            <div class="empty-icon-big">📖</div>
                            <p>داستان تولیدشده اینجا نمایش داده می‌شود</p>
                            <p class="text-muted">برنده را انتخاب کنید و دکمه «ساخت داستان» را بزنید</p>
                        </div>
                    `;
                }
            } catch (error) {
                Logger.error('AIPage.clearAll', error);
                Notification.error('خطا در حذف: ' + error.message);
            }
        });
    },

    /**
     * فعال/غیرفعال کردن دکمه پاک کردن همه بر اساس وجود داستان
     */
    _updateClearButtonState() {
        const btn = document.getElementById('clear-stories-btn');
        if (!btn) return;
        const count = StoryManager.getAll(1000).length;
        btn.disabled = count === 0;
        btn.style.opacity = count === 0 ? '0.4' : '1';
    },

    /**
     * کوتاه کردن نام مدل برای نمایش
     */
    _shortenModel(model) {
        if (!model) return 'نامشخص';
        return model.split('/').pop().replace(':free', '').substring(0, 30);
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};

if (document.getElementById('story-output')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => AIPage.init(), 500);
    });
}

window.AIPage = AIPage;