/**
 * منطق صفحه گردونه - با حقه مخفی فشار/کشیدن
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
        const people = AppState.get('people') || [];
        WheelCore.setItems(people);
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
            const visualDrag = Math.min(totalDrag, 80);
            this.lever.style.transform = `translateY(${visualDrag}px)`;
        }
    },

    _onPointerUp(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const duration = Date.now() - this.pointerDownTime;
        const totalDrag = this.dragDistance;

        this.lever.classList.remove('lever-active');
        this.lever.classList.remove('lever-dragging');
        this.lever.style.transform = '';

        // 🎯 تصمیم‌گیری حقه اصلی (کاملاً مخفی)
        const isDrag = totalDrag >= this.dragThreshold || duration > this.timeThreshold;

        if (isDrag) {
            this._spinStarred();
        } else {
            this._spinRandom();
        }
    },

    _spinRandom() {
        const people = AppState.get('people') || [];
        if (people.length === 0) {
            Notification.warning('ابتدا افراد را اضافه کنید');
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
        document.querySelectorAll('[data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.mode;
                AppState.set('wheel.currentMode', mode);
                Notification.info(`حالت: ${mode === 'single' ? 'انتخاب تک‌نفره' : 'حذفی'}`);
            });
        });
    },

    /**
     * رندر لیست افراد - بدون دکمه ستاره
     */
    _renderPeopleList() {
        const container = document.getElementById('wheel-people-list');
        if (!container) return;

        const people = AppState.get('people') || [];

        // به‌روزرسانی شمارنده
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
            if (addBtn) {
                addBtn.addEventListener('click', () => this._quickAdd());
            }
            return;
        }

        container.innerHTML = people
            .map(
                (p) => `
                <div class="wheel-person-item" data-id="${p.id}">
                    <span class="person-color" style="background: ${p.color}"></span>
                    <span class="person-name">${this._escape(p.name)}</span>
                    <button class="remove-btn" data-action="remove" data-id="${p.id}" title="حذف">×</button>
                </div>
            `
            )
            .join('');

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
        if (addBtn) {
            addBtn.addEventListener('click', () => this._quickAdd());
        }

        // جستجو
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
        const spinType = 'random';

        History.add({
            winner,
            mode,
            spinType,
        });

        this._showWinner(winner);

        if (mode === 'elimination') {
            setTimeout(() => {
                const winnerId = winner.id;
                if (winnerId) {
                    People.remove(winnerId);
                    WheelCore.setItems(AppState.get('people'));
                    this._renderPeopleList();
                }
            }, 3000);
        }
    },

    _showWinner(winner) {
        const container = document.getElementById('winner-display');
        if (!container) return;

        const name = winner.name || winner.label || 'نامشخص';
        container.innerHTML = `
            <div class="winner-popup">
                <div class="winner-popup-icon">🏆</div>
                <div class="winner-popup-label">برنده</div>
                <div class="winner-popup-name">${this._escape(name)}</div>
                <div class="winner-popup-actions">
                    <button class="btn btn-primary btn-sm" id="make-story-btn">
                        🤖 ساخت داستان
                    </button>
                    <button class="btn btn-secondary btn-sm" id="close-winner-btn">
                        بستن
                    </button>
                </div>
            </div>
        `;

        container.classList.add('show');
        AppState.set('wheel.lastResult', winner);

        const storyBtn = document.getElementById('make-story-btn');
        if (storyBtn) {
            storyBtn.addEventListener('click', () => {
                SQLStorage.setSetting('last_winner_for_story', {
                    id: winner.id,
                    name: winner.name || winner.label,
                    description: winner.description || '',
                    starred: winner.starred,
                    timestamp: Date.now(),
                });
                window.location.href = 'ai.html?winner=' + winner.id;
            });
        }

        const closeBtn = document.getElementById('close-winner-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.classList.remove('show');
            });
        }

        setTimeout(() => {
            container.classList.remove('show');
        }, 10000);
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

if (document.getElementById('wheel-canvas')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => WheelPage.init(), 500);
    });
}

window.WheelPage = WheelPage;