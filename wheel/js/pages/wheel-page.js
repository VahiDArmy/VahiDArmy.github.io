/**
 * منطق صفحه گردونه
 * - حالت عادی: هر چرخش = یک برنده + داستان
 * - حالت حذفی: هر چرخش = یک نفر حذف (کاربر دستی هر بار می‌کشد)
 *              وقتی ۱ نفر ماند → آن یک نفر برنده + داستان
 * - استریم داستان در پاپ‌آپ
 */

const WheelPage = {
    lever: null,
    pointerDownTime: 0,
    pointerDownY: 0,
    isDragging: false,
    dragThreshold: 40,
    timeThreshold: 400,
    lastPointerY: 0,
    dragDistance: 0,
    _isGeneratingStory: false,

    init() {
        this._initWheel();
        this._initLever();
        this._initControls();
        this._initModeSelector();
        this._renderPeopleList();
        this._bindEvents();
    },

    _initWheel() {
        WheelCore.init('wheel-canvas');
        WheelCore.setItems(AppState.get('people') || []);
    },

    _initLever() {
        this.lever = document.getElementById('lever');
        if (!this.lever) return;

        this.lever.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        document.addEventListener('pointermove', (e) => this._onPointerMove(e));
        document.addEventListener('pointerup', (e) => this._onPointerUp(e));
        document.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    },

    _onPointerDown(e) {
        if (WheelCore.isSpinning) return;
        if (!this.lever.contains(e.target) && e.target !== this.lever) return;

        this.isDragging = true;
        this.pointerDownTime = Date.now();
        this.pointerDownY = e.clientY;
        this.lastPointerY = e.clientY;
        this.dragDistance = 0;

        this.lever.setPointerCapture?.(e.pointerId);
        this.lever.classList.add('lever-active');
    },

    _onPointerMove(e) {
        if (!this.isDragging) return;

        const deltaY = e.clientY - this.lastPointerY;
        this.dragDistance += Math.abs(deltaY);
        this.lastPointerY = e.clientY;

        if (this.dragDistance > 10) {
            this.lever.classList.add('lever-dragging');
            const totalDrag = Math.max(0, e.clientY - this.pointerDownY);
            this.lever.style.transform = `translateY(${Math.min(totalDrag, 80)}px)`;
        }
    },

    _onPointerUp(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const duration = Date.now() - this.pointerDownTime;

        this.lever.classList.remove('lever-active');
        this.lever.classList.remove('lever-dragging');
        this.lever.style.transform = '';

        const isDrag = this.dragDistance >= this.dragThreshold || duration > this.timeThreshold;

        if (isDrag) this._spinStarred();
        else this._spinRandom();
    },

    _spinRandom() {
        const people = AppState.get('people') || [];
        if (people.length === 0) {
            Notification.warning('ابتدا افراد را اضافه کنید');
            return;
        }
        if (people.length === 1) {
            // اگر فقط یک نفر مانده، اهرم دیگر نمی‌چرخد
            Notification.info('فقط یک نفر باقی مانده - بازی تمام شد');
            return;
        }
        this._showSpinTypeIndicator('🎲');
        WheelCore.spinRandom();
    },

    _spinStarred() {
        const starred = (AppState.get('people') || []).filter((p) => p.starred);
        if (starred.length === 0) {
            this._spinRandom();
            return;
        }
        if (starred.length === 1 && (AppState.get('people') || []).length === 1) {
            Notification.info('فقط یک نفر باقی مانده - بازی تمام شد');
            return;
        }
        this._showSpinTypeIndicator('🎲');
        WheelCore.spinStarred();
    },

    _showSpinTypeIndicator(text) {
        const indicator = document.getElementById('spin-type-indicator');
        if (!indicator) return;
        indicator.textContent = text;
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 1500);
    },

    _initControls() {
        const clearBtn = document.getElementById('clear-wheel-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm('همه افراد حذف شوند؟', { danger: true });
                if (ok) {
                    People.clear();
                    WheelCore.setItems([]);
                    this._renderPeopleList();
                }
            });
        }
    },

    _initModeSelector() {
        const currentMode = AppState.get('wheel.currentMode') || 'single';
        document.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
            btn.addEventListener('click', () => {
                if (WheelCore.isSpinning) return;
                document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.mode;
                AppState.set('wheel.currentMode', mode);
                Notification.info(`حالت: ${mode === 'single' ? 'انتخاب تک‌نفره' : 'حذفی'}`);
            });
        });
    },

    _renderPeopleList() {
        const container = document.getElementById('wheel-people-list');
        if (!container) return;

        const people = AppState.get('people') || [];
        const countEl = document.getElementById('people-count');
        if (countEl) countEl.textContent = Utils.toPersianNumbers(people.length);

        if (people.length === 0) {
            container.innerHTML = `
                <div class="empty-state-sm">
                    <p>هنوز فردی اضافه نشده</p>
                    <button class="btn btn-primary btn-sm" id="quick-add-person">افزودن سریع</button>
                </div>
            `;
            const addBtn = document.getElementById('quick-add-person');
            if (addBtn) addBtn.addEventListener('click', () => this._quickAdd());
            return;
        }

        container.innerHTML = people.map((p) => `
            <div class="wheel-person-item" data-id="${p.id}">
                <span class="person-color" style="background: ${p.color}"></span>
                <span class="person-name">${this._escape(p.name)}</span>
                <button class="remove-btn" data-action="remove" data-id="${p.id}" title="حذف">×</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="remove"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                People.remove(btn.dataset.id);
                this._renderPeopleList();
                WheelCore.setItems(AppState.get('people'));
            });
        });
    },

    async _quickAdd() {
        const name = await Modal.prompt('نام فرد جدید:');
        if (name && name.trim()) {
            People.add({ name: name.trim() });
            this._renderPeopleList();
            WheelCore.setItems(AppState.get('people'));
        }
    },

    _bindEvents() {
        Events.on('people-changed', () => {
            this._renderPeopleList();
            WheelCore.setItems(AppState.get('people'));
        });

        const addBtn = document.getElementById('add-person-btn');
        if (addBtn) addBtn.addEventListener('click', () => this._quickAdd());

        const searchInput = document.getElementById('people-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this._filterPeople(e.target.value);
            }, 200));
        }
    },

    _filterPeople(query) {
        const items = document.querySelectorAll('.wheel-person-item');
        const q = (query || '').toLowerCase();
        items.forEach((item) => {
            const name = item.querySelector('.person-name')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(q) ? '' : 'none';
        });
    },

    /**
     * ═══════════════════════════════════════════
     * بعد از اتمام چرخش
     * ═══════════════════════════════════════════
     */
    onSpinComplete(winner) {
        if (!winner) return;

        const mode = AppState.get('wheel.currentMode') || 'single';

        if (mode === 'elimination') {
            this._handleElimination(winner);
        } else {
            History.add({ winner, mode: 'single', spinType: 'random' });
            this._showWinnerWithStory(winner);
        }
    },

    /**
     * حالت حذفی: هر بار کاربر اهرم می‌کشد = یک نفر حذف
     * وقتی ۱ نفر ماند → برنده + داستان
     */
    _handleElimination(winner) {
        const eliminatedName = winner.name || winner.label;

        History.add({
            winner,
            mode: 'elimination',
            spinType: 'random',
        });

        // حذف برنده از لیست
        if (winner.id) {
            People.remove(winner.id);
            WheelCore.setItems(AppState.get('people'));
            this._renderPeopleList();
        }

        const remaining = AppState.get('people') || [];

        if (remaining.length === 1) {
            // نفر آخر برنده است
            const finalWinner = remaining[0];

            History.add({
                winner: finalWinner,
                mode: 'elimination',
                spinType: 'final',
            });

            Notification.success(`🏆 برنده نهایی: ${finalWinner.name}`, 3000);

            // با تاخیر کوچک تا کاربر ببیند چه شد، پاپ‌آپ را نشان بده
            setTimeout(() => {
                this._showWinnerWithStory(finalWinner);
            }, 1200);
        } else if (remaining.length > 1) {
            // فقط نوتیفیکیشن که یک نفر حذف شد
            Notification.info(`❌ حذف شد: ${eliminatedName} - ${Utils.toPersianNumbers(remaining.length)} نفر باقی مانده`, 2500);
            // ⚠️ خودکار ادامه نمی‌دهد - کاربر باید دستی اهرم را بکشد
        } else {
            Notification.warning('همه حذف شدند');
        }
    },

    /**
     * نمایش پاپ‌آپ برنده + استریم داستان
     */
    _showWinnerWithStory(winner) {
        const container = document.getElementById('winner-display');
        if (!container) return;

        const name = winner.name || winner.label || 'نامشخص';
        this._isGeneratingStory = false;

        container.innerHTML = `
            <div class="winner-popup winner-popup-with-story">
                <div class="winner-popup-header">
                    <div class="winner-popup-icon">🏆</div>
                    <div class="winner-popup-label">برنده</div>
                    <div class="winner-popup-name">${this._escape(name)}</div>
                </div>

                <div class="winner-popup-story" id="winner-story-section">
                    <div class="story-loading">
                        <div class="spinner"></div>
                        <p>در حال نوشتن داستان...</p>
                    </div>
                </div>

                <div class="winner-popup-actions">
                    <button class="btn btn-secondary btn-sm" id="close-winner-btn">
                        بستن
                    </button>
                </div>
            </div>
        `;

        container.classList.add('show');
        AppState.set('wheel.lastResult', winner);

        try {
            if (SQLStorage.isReady) {
                SQLStorage.setSetting('last_winner_for_story', {
                    id: winner.id,
                    name: winner.name || winner.label,
                    description: winner.description || '',
                    timestamp: Date.now(),
                });
            }
        } catch (e) {}

        const closeBtn = document.getElementById('close-winner-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.classList.remove('show');
            });
        }

        this._generateAutoStory(winner);
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

    /**
     * ساخت خودکار داستان با استریم
     */
    async _generateAutoStory(winner) {
        if (this._isGeneratingStory) return;
        this._isGeneratingStory = true;

        const section = document.getElementById('winner-story-section');
        if (!section) {
            this._isGeneratingStory = false;
            return;
        }

        if (!OpenRouter.getApiKey()) {
            section.innerHTML = `
                <div class="story-error">
                    <p>⚠️ برای ساخت خودکار داستان، ابتدا کلید OpenRouter را در
                    <a href="settings.html">تنظیمات</a> وارد کنید</p>
                </div>
            `;
            this._isGeneratingStory = false;
            return;
        }

        const context = {
            winner: {
                id: winner.id,
                name: winner.name || winner.label,
                description: Descriptions.get(winner.id) || '',
                starred: winner.starred || false,
            },
            allPeople: AppState.get('people') || [],
            descriptions: this._collectDescriptions(),
            items: AppState.get('items') || [],
            mode: AppState.get('wheel.currentMode') || 'single',
            tone: 'funny',
            length: 'medium',
            extras: '',
        };

        section.innerHTML = `
            <div class="story-streaming">
                <div class="story-streaming-content" id="streaming-content"></div>
                <span class="story-streaming-cursor" id="streaming-cursor">▊</span>
            </div>
        `;

        let fullContent = '';
        let lastRenderTime = 0;

        try {
            await StoryManager.generateStream(context, {
                onChunk: (chunk, model, accumulated) => {
                    fullContent = accumulated;

                    const now = Date.now();
                    if (now - lastRenderTime < 60) return;
                    lastRenderTime = now;

                    const contentEl = document.getElementById('streaming-content');
                    if (contentEl) {
                        contentEl.innerHTML = StoryManager.renderToHTML(fullContent);
                        section.scrollTop = section.scrollHeight;
                    }
                },
                onComplete: (finalStory) => {
                    this._renderStoryInPopup(finalStory);
                },
                onError: (err) => {
                    section.innerHTML = `
                        <div class="story-error">
                            <p>خطا: ${this._escape(err.message || 'مشکل در ساخت داستان')}</p>
                        </div>
                    `;
                },
            });
        } catch (error) {
            console.error('خطا در ساخت داستان:', error);
            section.innerHTML = `
                <div class="story-error">
                    <p>خطا: ${this._escape(error.message || 'مشکل در ساخت داستان')}</p>
                </div>
            `;
        } finally {
            this._isGeneratingStory = false;
        }
    },

    /**
     * نمایش داستان نهایی
     */
    _renderStoryInPopup(story) {
        const section = document.getElementById('winner-story-section');
        if (!section) return;

        const html = StoryManager.renderToHTML(story.content);

        section.innerHTML = `
            <div class="story-in-popup">
                <div class="story-in-popup-content">${html}</div>
                <div class="story-in-popup-footer">
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
                <div class="story-in-popup-actions">
                    <button class="btn btn-sm btn-secondary" id="copy-popup-story">📋 کپی</button>
                    <button class="btn btn-sm btn-secondary" id="download-popup-story">💾 دانلود</button>
                    <button class="btn btn-sm btn-secondary" id="regen-popup-story">🔄 دوباره</button>
                </div>
            </div>
        `;

        const copyBtn = document.getElementById('copy-popup-story');
        if (copyBtn) copyBtn.addEventListener('click', () => StoryManager.copy(story));

        const downloadBtn = document.getElementById('download-popup-story');
        if (downloadBtn) downloadBtn.addEventListener('click', () => StoryManager.download(story));

        const regenBtn = document.getElementById('regen-popup-story');
        if (regenBtn) {
            regenBtn.addEventListener('click', () => {
                const winner = AppState.get('wheel.lastResult');
                if (winner) {
                    section.innerHTML = `
                        <div class="story-loading">
                            <div class="spinner"></div>
                            <p>در حال نوشتن داستان...</p>
                        </div>
                    `;
                    this._isGeneratingStory = false;
                    this._generateAutoStory(winner);
                }
            });
        }
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};

if (document.getElementById('wheel-canvas')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => WheelPage.init(), 500);
    });
}

window.WheelPage = WheelPage;