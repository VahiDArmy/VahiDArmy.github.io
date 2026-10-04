/**
 * منطق صفحه گردونه (کارگاه)
 * - فقط از جعبه ابزار استفاده می‌کند
 * - افزودن/حذف از گردونه = فقط علامت‌گذاری
 * @module wheelPage
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
        WheelCore.setItems(People.getInWheel());
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
        const people = People.getInWheel();
        if (people.length === 0) {
            Notification.warning('گردونه خالی است - از جعبه ابزار اضافه کنید');
            return;
        }
        if (people.length === 1 && AppState.get('wheel.currentMode') === 'elimination') {
            Notification.info('فقط یک نفر باقی مانده - بازی تمام شد');
            return;
        }
        this._showSpinTypeIndicator('🎲');
        WheelCore.setItems(people);
        WheelCore.spinRandom();
    },

    _spinStarred() {
        const starred = People.getStarredInWheel();
        if (starred.length === 0) { this._spinRandom(); return; }
        this._showSpinTypeIndicator('🎲');
        WheelCore.setItems(People.getInWheel());
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
                const ok = await Modal.confirm(
                    'همه افراد از گردونه حذف شوند؟\n(در جعبه ابزار باقی می‌مانند)',
                    { danger: true }
                );
                if (ok) {
                    People.getInWheel().forEach((p) => People.removeFromWheel(p.id));
                    WheelCore.setItems([]);
                    this._renderPeopleList();
                    Notification.info('گردونه خالی شد');
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

    /**
     * رندر لیست افراد در گردونه
     */
    _renderPeopleList() {
        const container = document.getElementById('wheel-people-list');
        if (!container) return;

        const inWheel = People.getInWheel();
        const countEl = document.getElementById('people-count');
        if (countEl) countEl.textContent = Utils.toPersianNumbers(inWheel.length);

        if (inWheel.length === 0) {
            container.innerHTML = `
                <div class="empty-state-sm">
                    <p>گردونه خالی است</p>
                    <button class="btn btn-primary btn-sm" id="open-toolbox">📦 افزودن از جعبه ابزار</button>
                </div>
            `;
            const btn = document.getElementById('open-toolbox');
            if (btn) btn.addEventListener('click', () => this._openToolboxPicker());
            return;
        }

        container.innerHTML = inWheel.map((p) => `
            <div class="wheel-person-item" data-id="${p.id}">
                <span class="person-color" style="background: ${p.color}"></span>
                <span class="person-name">${this._escape(p.name)}</span>
                <button class="remove-btn" data-action="remove" data-id="${p.id}" title="حذف از گردونه">×</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="remove"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                People.removeFromWheel(btn.dataset.id);
                this._renderPeopleList();
                WheelCore.setItems(People.getInWheel());
            });
        });
    },

    /**
     * پاپ‌آپ انتخاب از جعبه ابزار
     */
    _openToolboxPicker() {
        const allPeople = People.getAll();

        if (allPeople.length === 0) {
            Modal.alert(
                'جعبه ابزار خالی است.\nابتدا از صفحه «توصیف‌ها» افراد را اضافه کنید.'
            );
            return;
        }

        const inWheelIds = new Set(People.getInWheel().map((p) => p.id));

        const content = `
            <div class="toolbox-picker">
                <input type="text" id="picker-search" class="input" placeholder="🔍 جستجو در جعبه ابزار...">
                <div class="picker-list" id="picker-list">
                    ${allPeople.map((p) => {
                        const isIn = inWheelIds.has(p.id);
                        return `
                            <label class="picker-item ${isIn ? 'in-wheel' : ''}" data-name="${this._escape(p.name.toLowerCase())}">
                                <input type="checkbox" data-id="${p.id}" ${isIn ? 'disabled' : ''}>
                                <span class="person-color" style="background: ${p.color}"></span>
                                <span class="picker-name">${this._escape(p.name)}</span>
                                ${isIn ? '<span class="picker-badge">در گردونه</span>' : ''}
                            </label>
                        `;
                    }).join('')}
                </div>
                <div class="picker-footer-note">
                    💡 این افراد در جعبه ابزار باقی می‌مانند - فقط در گردونه استفاده می‌شوند
                </div>
            </div>
        `;

        Modal.open({
            title: '📦 افزودن از جعبه ابزار',
            content,
            size: 'md',
            buttons: [
                {
                    label: 'ایجاد فرد جدید',
                    class: 'btn-outline',
                    closeOnClick: false,
                    onClick: async (modal) => {
                        Modal.close(modal.dataset.modalId);
                        setTimeout(() => this._createNewPerson(), 200);
                    },
                },
                {
                    label: 'افزودن انتخاب‌شده‌ها',
                    class: 'btn-primary',
                    onClick: (modal) => {
                        const ids = [...modal.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)')]
                            .map((cb) => cb.dataset.id);

                        if (ids.length === 0) {
                            Notification.warning('هیچ فردی انتخاب نشده');
                            return false;
                        }

                        People.addManyToWheel(ids);
                        this._renderPeopleList();
                        WheelCore.setItems(People.getInWheel());
                        Notification.success(`${Utils.toPersianNumbers(ids.length)} نفر افزوده شد`);
                    },
                },
            ],
        });

        // جستجو
        setTimeout(() => {
            const searchInput = document.getElementById('picker-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    document.querySelectorAll('.picker-item').forEach((item) => {
                        const name = item.dataset.name || '';
                        item.style.display = name.includes(q) ? '' : 'none';
                    });
                });
            }
        }, 100);
    },

    /**
     * ایجاد فرد جدید - هم در جعبه ابزار، هم در گردونه
     */
    async _createNewPerson() {
        const name = await Modal.prompt('نام فرد جدید:');
        if (!name || !name.trim()) return;

        People.add({ name: name.trim() }, true);
        this._renderPeopleList();
        WheelCore.setItems(People.getInWheel());
        Notification.success(`«${name}» ساخته شد و به گردونه اضافه شد`);
    },

    _bindEvents() {
        Events.on('people-changed', () => {
            this._renderPeopleList();
            WheelCore.setItems(People.getInWheel());
        });

        const addBtn = document.getElementById('add-person-btn');
        if (addBtn) addBtn.addEventListener('click', () => this._openToolboxPicker());

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

    _handleElimination(winner) {
        const eliminatedName = winner.name || winner.label;

        History.add({ winner, mode: 'elimination', spinType: 'random' });

        // فقط از گردونه حذف (نه از جعبه ابزار)
        if (winner.id) {
            People.removeFromWheel(winner.id);
            WheelCore.setItems(People.getInWheel());
            this._renderPeopleList();
        }

        const remaining = People.getInWheel();

        if (remaining.length === 1) {
            const finalWinner = remaining[0];
            History.add({ winner: finalWinner, mode: 'elimination', spinType: 'final' });
            Notification.success(`🏆 برنده نهایی: ${finalWinner.name}`, 3000);

            setTimeout(() => this._showWinnerWithStory(finalWinner), 1200);
        } else if (remaining.length > 1) {
            Notification.info(
                `❌ حذف شد: ${eliminatedName} - ${Utils.toPersianNumbers(remaining.length)} نفر باقی مانده`,
                2500
            );
        }
    },

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
                    <button class="btn btn-secondary btn-sm" id="close-winner-btn">بستن</button>
                </div>
            </div>
        `;

        container.classList.add('show');
        AppState.set('wheel.lastResult', winner);

        const closeBtn = document.getElementById('close-winner-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => container.classList.remove('show'));

        this._generateAutoStory(winner);
    },

    _collectDescriptions() {
        const all = Descriptions.getAll();
        const filtered = {};

        // توصیفات افراد حاضر در گردونه
        People.getInWheel().forEach((p) => {
            if (all[p.id]) filtered[p.name] = all[p.id];
        });

        // توصیفات آیتم‌ها
        (AppState.get('items') || []).forEach((i) => {
            if (all[i.id]) filtered[i.label] = all[i.id];
        });

        return filtered;
    },

    async _generateAutoStory(winner) {
        if (this._isGeneratingStory) return;
        this._isGeneratingStory = true;

        const section = document.getElementById('winner-story-section');
        if (!section) { this._isGeneratingStory = false; return; }

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

        // برنده + سایر افراد گردونه + آیتم‌ها + توصیفات
        const otherWheelPeople = People.getInWheel().filter((p) => p.id !== winner.id);

        const context = {
            winner: {
                id: winner.id,
                name: winner.name || winner.label,
                description: Descriptions.get(winner.id) || '',
                starred: winner.starred || false,
            },
            supportingCharacters: otherWheelPeople.map((p) => ({
                name: p.name,
                description: Descriptions.get(p.id) || '',
            })),
            items: (AppState.get('items') || []).map((i) => ({
                label: i.label,
                description: Descriptions.get(i.id) || '',
            })),
            descriptions: this._collectDescriptions(),
            mode: AppState.get('wheel.currentMode') || 'single',
            tone: 'funny',
            length: 'medium',
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
                onComplete: (s) => this._renderStoryInPopup(s),
                onError: (err) => {
                    section.innerHTML = `<div class="story-error"><p>خطا: ${this._escape(err.message)}</p></div>`;
                },
            });
        } catch (error) {
            section.innerHTML = `<div class="story-error"><p>خطا: ${this._escape(error.message)}</p></div>`;
        } finally {
            this._isGeneratingStory = false;
        }
    },

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

        document.getElementById('copy-popup-story')?.addEventListener('click', () => StoryManager.copy(story));
        document.getElementById('download-popup-story')?.addEventListener('click', () => StoryManager.download(story));
        document.getElementById('regen-popup-story')?.addEventListener('click', () => {
            const w = AppState.get('wheel.lastResult');
            if (w) {
                section.innerHTML = `<div class="story-loading"><div class="spinner"></div><p>در حال نوشتن داستان...</p></div>`;
                this._isGeneratingStory = false;
                this._generateAutoStory(w);
            }
        });
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