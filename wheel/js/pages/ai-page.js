/**
 * منطق صفحه هوش مصنوعی
 * @module aiPage
 */

const AIPage = {
    selectedWinner: null,

    init() {
        this._checkApiKey();
        this._initWinnerSelector();
        this._initForm();
        this._initStoryList();
        this._loadWinnerFromQuery();
    },

    _checkApiKey() {
        const hasKey = !!OpenRouter.getApiKey();
        const warning = document.getElementById('api-warning');
        if (warning) {
            warning.style.display = hasKey ? 'none' : 'block';
        }
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
            (value, label) => {
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
                <button class="winner-chip-close" id="clear-winner">×</button>
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

            try {
                const context = {
                    winner: this.selectedWinner,
                    allPeople: AppState.get('people') || [],
                    descriptions: this._collectDescriptions(),
                    items: AppState.get('items') || [],
                    mode: AppState.get('wheel.currentMode') || 'single',
                    tone: document.getElementById('tone-select')?.value || 'funny',
                    length: document.getElementById('length-select')?.value || 'medium',
                    extras: document.getElementById('story-extras')?.value || '',
                };

                const story = await StoryManager.generate(context);
                if (story) {
                    this._renderStory(story);
                    this._initStoryList();
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
        return filtered;
    },

    /**
     * رندر داستان - مدل در انتهای داستان
     */
    _renderStory(story) {
        const container = document.getElementById('story-output');
        if (!container) return;

        const html = StoryManager.renderToHTML(story.content);

        container.innerHTML = `
            <div class="story-card">
                <div class="story-content">${html}</div>
                <div class="story-actions">
                    <button class="btn btn-sm btn-secondary" id="copy-story">📋 کپی</button>
                    <button class="btn btn-sm btn-secondary" id="download-story">💾 دانلود</button>
                    <button class="btn btn-sm btn-secondary" id="regenerate-story">🔄 دوباره</button>
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

        document.getElementById('copy-story').addEventListener('click', () => StoryManager.copy(story));
        document.getElementById('download-story').addEventListener('click', () => StoryManager.download(story));
        document.getElementById('regenerate-story').addEventListener('click', () => {
            document.getElementById('generate-story-btn').click();
        });

        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _initStoryList() {
        const container = document.getElementById('stories-list');
        if (!container) return;

        const stories = StoryManager.getAll(20);

        if (stories.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">هنوز داستانی ساخته نشده است</p>';
            return;
        }

        container.innerHTML = stories
            .map(
                (s) => `
                <div class="story-list-item" data-story-id="${s.id}">
                    <div class="story-list-meta">
                        <span class="text-muted">${Utils.formatDate(s.timestamp)}</span>
                    </div>
                    <div class="story-list-excerpt">${this._escape(Utils.truncate(s.content, 120))}</div>
                </div>
            `
            )
            .join('');

        container.querySelectorAll('[data-story-id]').forEach((item) => {
            item.addEventListener('click', () => {
                const story = StoryManager.getById(item.dataset.storyId);
                if (story) this._renderStory(story);
            });
        });
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

if (document.getElementById('story-output')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => AIPage.init(), 500);
    });
}

window.AIPage = AIPage;