/**
 * صفحه گردونه - با Setup Panel
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
        this._initSetupPanel();
        this._initControls();
        this._initModeSelector();
        this._renderPeopleList();
        this._bindEvents();
    },

    // ═══════════════════════════════════════════
    // Setup Panel
    // ═══════════════════════════════════════════

    _initSetupPanel() {
        const setup = this._getSetup();

        // بارگذاری مقادیر
        const topicInput = document.getElementById('setup-topic');
        if (topicInput) {
            topicInput.value = setup.topic || '';
            topicInput.addEventListener('input', Utils.debounce(() => {
                this._updateSetup({ topic: topicInput.value.trim() });
            }, 400));
            topicInput.addEventListener('focus', () => this._showTopicSuggestions());
            topicInput.addEventListener('blur', () => {
                setTimeout(() => this._hideTopicSuggestions(), 200);
            });
        }

        // Type
        document.querySelectorAll('#type-selector .type-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.type === (setup.type || 'provide'));
            btn.addEventListener('click', () => {
                document.querySelectorAll('#type-selector .type-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this._updateSetup({ type: btn.dataset.type });
            });
        });

        // ذخیره موضوع
        const saveTopicBtn = document.getElementById('save-topic-btn');
        if (saveTopicBtn) {
            saveTopicBtn.addEventListener('click', () => this._saveTopicToLibrary());
        }

        // افزودن آیتم
        const addItemBtn = document.getElementById('add-setup-item-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => this._openItemPicker());
        }

        // بازنشانی
        const resetBtn = document.getElementById('reset-setup-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const ok = await Modal.confirm('تنظیمات این چرخش بازنشانی شود؟');
                if (ok) {
                    this._updateSetup({ topic: '', type: 'provide', items: [] });
                    this._renderSetupPanel();
                }
            });
        }

        this._renderSetupItems();
    },

    _getSetup() {
        const stored = AppState.get('wheel.setup');
        if (stored && typeof stored === 'object') return stored;
        return { topic: '', type: 'provide', items: [] };
    },

    _updateSetup(partial) {
        const current = this._getSetup();
        const next = { ...current, ...partial };
        AppState.set('wheel.setup', next);

        try {
            if (SQLStorage.isReady) SQLStorage.setSetting('wheel_setup', next);
        } catch (e) {}

        if ('items' in partial) this._renderSetupItems();
    },

    _renderSetupPanel() {
        const setup = this._getSetup();
        const topicInput = document.getElementById('setup-topic');
        if (topicInput) topicInput.value = setup.topic || '';

        document.querySelectorAll('#type-selector .type-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.type === (setup.type || 'provide'));
        });

        this._renderSetupItems();
    },

    _renderSetupItems() {
        const list = document.getElementById('setup-items-list');
        const empty = document.getElementById('setup-items-empty');
        if (!list) return;

        const setup = this._getSetup();
        const items = setup.items || [];

        if (items.length === 0) {
            list.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';

        list.innerHTML = items.map((it) => `
            <div class="setup-item-row" data-setup-item-id="${it.id}">
                <span style="font-size: 1.1rem;">🎁</span>
                <span class="setup-item-label">${this._escape(it.label)}</span>
                <div class="setup-item-qty">
                    <button class="qty-btn" data-qty-action="dec" data-id="${it.id}" type="button" ${it.quantity <= 1 ? 'disabled' : ''}>−</button>
                    <span class="qty-value">${Utils.toPersianNumbers(it.quantity)}</span>
                    <button class="qty-btn" data-qty-action="inc" data-id="${it.id}" type="button" ${it.quantity >= 99 ? 'disabled' : ''}>+</button>
                </div>
                <button class="setup-item-remove" data-qty-action="remove" data-id="${it.id}" type="button" title="حذف">×</button>
            </div>
        `).join('');

        list.querySelectorAll('[data-qty-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const action = btn.dataset.qtyAction;
                this._handleQtyAction(id, action);
            });
        });
    },

    _handleQtyAction(id, action) {
        const setup = this._getSetup();
        const items = [...(setup.items || [])];
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return;

        if (action === 'inc') {
            items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + 1) };
        } else if (action === 'dec') {
            items[idx] = { ...items[idx], quantity: Math.max(1, items[idx].quantity - 1) };
        } else if (action === 'remove') {
            items.splice(idx, 1);
        }

        this._updateSetup({ items });
    },

    _openItemPicker() {
        const allItems = Items.getAll();
        const setup = this._getSetup();
        const usedIds = new Set((setup.items || []).map((i) => i.id));

        const listHtml = allItems.length === 0
            ? `<div class="items-picker-empty">جعبه ابزار آیتم خالی است - از فیلد پایین آیتم جدید بسازید</div>`
            : allItems.map((it) => {
                const isUsed = usedIds.has(it.id);
                return `
                    <div class="items-picker-item ${isUsed ? 'added' : ''}" data-item-id="${it.id}" data-label="${this._escape(it.label)}">
                        <span class="items-picker-icon">🎁</span>
                        <span class="items-picker-label">${this._escape(it.label)}</span>
                        ${isUsed ? '<span class="badge badge-sm">افزوده شد</span>' : ''}
                    </div>
                `;
            }).join('');

        const content = `
            <div>
                <div class="items-picker-list">${listHtml}</div>
                <div class="items-picker-new">
                    <input type="text" id="new-item-in-picker" class="input" placeholder="آیتم جدید (اضافه به جعبه ابزار)">
                    <button id="add-new-item-in-picker" class="btn btn-primary">+ افزودن</button>
                </div>
            </div>
        `;

        Modal.open({
            title: '🎁 افزودن آیتم به این چرخش',
            content,
            size: 'md',
            buttons: [{ label: 'تمام', class: 'btn-secondary' }],
        });

        setTimeout(() => {
            // انتخاب آیتم موجود
            document.querySelectorAll('.items-picker-item').forEach((el) => {
                el.addEventListener('click', () => {
                    if (el.classList.contains('added')) return;
                    const id = el.dataset.itemId;
                    const label = el.dataset.label;
                    this._addItemToSetup(id, label);
                    el.classList.add('added');
                    el.insertAdjacentHTML('beforeend', '<span class="badge badge-sm">افزوده شد</span>');
                });
            });

            // آیتم جدید
            const newInput = document.getElementById('new-item-in-picker');
            const addBtn = document.getElementById('add-new-item-in-picker');
            if (addBtn && newInput) {
                const addNew = () => {
                    const label = newInput.value.trim();
                    if (!label) return;
                    const created = Items.add(label);
                    if (created) {
                        newInput.value = '';
                        this._addItemToSetup(created.id, created.label);
                        // اضافه به لیست نمایش
                        const list = document.querySelector('.items-picker-list');
                        if (list) {
                            const emptyEl = list.querySelector('.items-picker-empty');
                            if (emptyEl) emptyEl.remove();
                            const newEl = document.createElement('div');
                            newEl.className = 'items-picker-item added';
                            newEl.dataset.itemId = created.id;
                            newEl.dataset.label = created.label;
                            newEl.innerHTML = `
                                <span class="items-picker-icon">🎁</span>
                                <span class="items-picker-label">${this._escape(created.label)}</span>
                                <span class="badge badge-sm">افزوده شد</span>
                            `;
                            list.appendChild(newEl);
                        }
                    }
                };
                addBtn.addEventListener('click', addNew);
                newInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') addNew();
                });
            }
        }, 100);
    },

    _addItemToSetup(id, label) {
        const setup = this._getSetup();
        const items = [...(setup.items || [])];
        if (items.find((i) => i.id === id)) return;
        items.push({ id, label, quantity: 1 });
        this._updateSetup({ items });
        Notification.success(`«${label}» افزوده شد`);
    },

    // ═══════════════════════════════════════════
    // Topics
    // ═══════════════════════════════════════════

    _getTopics() {
        try {
            if (SQLStorage.isReady) {
                const stored = SQLStorage.getSetting('topics_list');
                if (Array.isArray(stored)) return stored;
            }
        } catch (e) {}
        return [];
    },

    _saveTopicToLibrary() {
        const input = document.getElementById('setup-topic');
        if (!input) return;
        const topic = input.value.trim();
        if (!topic) {
            Notification.warning('موضوع خالی است');
            return;
        }

        const topics = this._getTopics();
        if (topics.includes(topic)) {
            Notification.info('این موضوع قبلاً ذخیره شده');
            return;
        }

        topics.push(topic);
        try {
            if (SQLStorage.isReady) SQLStorage.setSetting('topics_list', topics);
        } catch (e) {}

        Notification.success(`موضوع «${topic}» ذخیره شد`);
    },

    _showTopicSuggestions() {
        const dropdown = document.getElementById('topics-dropdown');
        if (!dropdown) return;

        const topics = this._getTopics();
        if (topics.length === 0) {
            dropdown.innerHTML = '<div class="topic-suggestion-empty">هنوز موضوعی ذخیره نشده</div>';
            dropdown.classList.add('show');
            return;
        }

        dropdown.innerHTML = topics.map((t) => `
            <div class="topic-suggestion-item" data-topic="${this._escape(t)}">${this._escape(t)}</div>
        `).join('');
        dropdown.classList.add('show');

        dropdown.querySelectorAll('.topic-suggestion-item').forEach((el) => {
            el.addEventListener('click', () => {
                const topic = el.dataset.topic;
                const input = document.getElementById('setup-topic');
                if (input) input.value = topic;
                this._updateSetup({ topic });
                this._hideTopicSuggestions();
            });
        });
    },

    _hideTopicSuggestions() {
        const dropdown = document.getElementById('topics-dropdown');
        if (dropdown) dropdown.classList.remove('show');
    },

    // ═══════════════════════════════════════════
    // Wheel
    // ═══════════════════════════════════════════

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
            this.lever.style.transform = `translateX(-50%) translateY(${Math.min(totalDrag, 80)}px)`;
        }
    },

    _onPointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        const duration = Date.now() - this.pointerDownTime;

        this.lever.classList.remove('lever-active');
        this.lever.classList.remove('lever-dragging');
        this.lever.style.transform = 'translateX(-50%)';

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

    // ═══════════════════════════════════════════
    // Controls / Mode
    // ═══════════════════════════════════════════

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
                AppState.set('wheel.currentMode', btn.dataset.mode);
            });
        });
    },

    // ═══════════════════════════════════════════
    // People List
    // ═══════════════════════════════════════════

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
                    <button class="btn btn-primary btn-sm" id="open-toolbox" type="button">📦 افزودن از جعبه ابزار</button>
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
                <button class="remove-btn" data-action="remove" data-id="${p.id}" title="حذف از گردونه" type="button">×</button>
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

    _openToolboxPicker() {
        const allPeople = People.getAll();

        if (allPeople.length === 0) {
            Modal.alert('جعبه ابزار خالی است. ابتدا از صفحه «توصیف‌ها» افراد را اضافه کنید.');
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
                        Modal.closeAll();
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

        Events.on('items-changed', () => {
            // آیتم‌های setup ممکن است تغییر کرده باشند - دوباره رندر
            this._renderSetupItems();
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

    // ═══════════════════════════════════════════
    // Spin Complete
    // ═══════════════════════════════════════════

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
                    <button class="btn btn-secondary btn-sm" id="close-winner-btn" type="button">بستن</button>
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

        People.getInWheel().forEach((p) => {
            if (all[p.id]) filtered[p.name] = all[p.id];
        });

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

        const setup = this._getSetup();
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
            topic: setup.topic || '',
            items: (setup.items || []).map((it) => ({
                label: it.label,
                quantity: it.quantity,
                description: Descriptions.get(it.id) || '',
            })),
            type: setup.type || 'provide', // 'provide' یا 'receive'
            descriptions: this._collectDescriptions(),
            mode: AppState.get('wheel.currentMode') || 'single',
            tone: 'funny',
            length: 'medium',
        };

        section.innerHTML = `
            <div class="story-streaming">
                <div class="story-streaming-content" id="streaming-content"></div>
                <span class="story-streaming-cursor">▊</span>
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
                    <button class="btn btn-sm btn-secondary" id="copy-popup-story" type="button">📋 کپی</button>
                    <button class="btn btn-sm btn-secondary" id="download-popup-story" type="button">💾 دانلود</button>
                    <button class="btn btn-sm btn-secondary" id="regen-popup-story" type="button">🔄 دوباره</button>
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