/**
 * منطق صفحه گردونه - شامل حقه فشار/کشیدن
 * @module wheelPage
 */

const WheelPage = {
    lever: null,
    pointerDownTime: 0,
    pointerDownY: 0,
    isDragging: false,
    dragThreshold: 40,        // پیکسل برای تشخیص کشیدن
    timeThreshold: 400,        // میلی‌ثانیه - کمتر از این = فشار
    lastPointerY: 0,
    dragDistance: 0,

    /**
     * راه‌اندازی
     */
    init() {
        this._initWheel();
        this._initLever();
        this._initControls();
        this._initModeSelector();
        this._renderPeopleList();
        this._bindEvents();
    },

    /**
     * راه‌اندازی گردونه
     */
    _initWheel() {
        WheelCore.init('wheel-canvas');
        const people = AppState.get('people') || [];
        WheelCore.setItems(people);
    },

    /**
     * راه‌اندازی اهرم
     */
    _initLever() {
        this.lever = document.getElementById('lever');
        if (!this.lever) return;

        // Pointer Events برای پشتیبانی از موس و لمس
        this.lever.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        document.addEventListener('pointermove', (e) => this._onPointerMove(e));
        document.addEventListener('pointerup', (e) => this._onPointerUp(e));
        document.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    },

    /**
     * شروع لمس/کلیک
     */
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

    /**
     * حرکت
     */
    _onPointerMove(e) {
        if (!this.isDragging) return;

        const deltaY = e.clientY - this.lastPointerY;
        this.dragDistance += Math.abs(deltaY);
        this.lastPointerY = e.clientY;

        // اگر کاربر شروع به کشیدن کرد
        if (this.dragDistance > 10) {
            this.lever.classList.add('lever-dragging');

            // انیمیشن کشیدن - حرکت اهرم به سمت پایین
            const totalDrag = Math.max(0, e.clientY - this.pointerDownY);
            const visualDrag = Math.min(totalDrag, 80);
            this.lever.style.transform = `translateY(${visualDrag}px)`;
        }
    },

    /**
     * رها کردن - اینجا تصمیم نهایی گرفته می‌شود
     */
    _onPointerUp(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        const duration = Date.now() - this.pointerDownTime;
        const totalDrag = this.dragDistance;

        this.lever.classList.remove('lever-active');
        this.lever.classList.remove('lever-dragging');
        this.lever.style.transform = '';

        // 🎯 **تصمیم‌گیری حقه اصلی**
        // اگر کشیده شده (فاصله زیاد یا زمان طولانی) → ستاره‌دارها
        // اگر فقط فشار داده شده (سریع، بدون حرکت) → تصادفی کامل
        const isDrag = totalDrag >= this.dragThreshold || duration > this.timeThreshold;

        if (isDrag) {
            this._spinStarred();
        } else {
            this._spinRandom();
        }
    },

    /**
     * چرخش تصادفی (فشار)
     */
    _spinRandom() {
        const people = AppState.get('people') || [];
        if (people.length === 0) {
            Notification.warning('ابتدا افراد را اضافه کنید');
            return;
        }

        this._showSpinTypeIndicator('🎲 چرخش تصادفی');
        WheelCore.spinRandom();
    },

    /**
     * چرخش از ستاره‌دارها (کشیدن - حقه)
     */
    _spinStarred() {
        const starred = (AppState.get('people') || []).filter((p) => p.starred);
        if (starred.length === 0) {
            Notification.warning('هیچ فرد ستاره‌داری وجود ندارد - به صورت تصادفی چرخیده می‌شود');
            this._spinRandom();
            return;
        }

        this._showSpinTypeIndicator('⭐ چرخش از ستاره‌دارها');
        WheelCore.spinStarred();
    },

    /**
     * نمایش نشانگر نوع چرخش
     */
    _showSpinTypeIndicator(text) {
        const indicator = document.getElementById('spin-type-indicator');
        if (!indicator) return;

        indicator.textContent = text;
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 2000);
    },

    /**
     * دکمه‌ها و کنترل‌ها
     */
    _initControls() {
        // دکمه چرخش سریع
        const spinBtn = document.getElementById('spin-btn');
        if (spinBtn) {
            spinBtn.addEventListener('click', () => this._spinRandom());
        }

        // دکمه چرخش ستاره‌دارها (فقط برای تست و شفافیت - معمولاً مخفی)
        const starredBtn = document.getElementById('starred-spin-btn');
        if (starredBtn) {
            starredBtn.addEventListener('click', () => this._spinStarred());
        }

        // پاک کردن گردونه
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

    /**
     * انتخاب حالت (تک‌نفره / حذفی)
     */
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
     * رندر لیست افراد
     */
    _renderPeopleList() {
        const container = document.getElementById('wheel-people-list');
        if (!container) return;

        const people = AppState.get('people') || [];

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
                <div class="wheel-person-item ${p.starred ? 'starred' : ''}" data-id="${p.id}">
                    <button class="star-btn" data-action="star" data-id="${p.id}" title="ستاره‌دار">
                        ${p.starred ? '⭐' : '☆'}
                    </button>
                    <span class="person-color" style="background: ${p.color}"></span>
                    <span class="person-name">${this._escape(p.name)}</span>
                    <button class="remove-btn" data-action="remove" data-id="${p.id}" title="حذف">×</button>
                </div>
            `
            )
            .join('');

        // رویدادها
        container.querySelectorAll('[data-action="star"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                People.toggleStar(btn.dataset.id);
                this._renderPeopleList();
                WheelCore.setItems(AppState.get('people'));
            });
        });

        container.querySelectorAll('[data-action="remove"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                People.remove(btn.dataset.id);
                this._renderPeopleList();
                WheelCore.setItems(AppState.get('people'));
            });
        });
    },

    /**
     * افزودن سریع
     */
    async _quickAdd() {
        const name = await Modal.prompt('نام فرد جدید:');
        if (name && name.trim()) {
            People.add({ name: name.trim() });
            this._renderPeopleList();
            WheelCore.setItems(AppState.get('people'));
        }
    },

    /**
     * رویدادهای صفحه
     */
    _bindEvents() {
        // به‌روزرسانی لیست وقتی افراد تغییر کنند
        Events.on('people-changed', () => {
            this._renderPeopleList();
            WheelCore.setItems(AppState.get('people'));
        });

        // دکمه افزودن فرد
        const addBtn = document.getElementById('add-person-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._quickAdd());
        }
    },

    /**
     * پس از اتمام چرخش
     */
    onSpinComplete(winner) {
        if (!winner) return;

        const mode = AppState.get('wheel.currentMode') || 'single';
        const spinType = this._lastSpinType || 'random';

        // ثبت در تاریخچه
        History.add({
            winner,
            mode,
            spinType,
        });

        // نمایش برنده
        this._showWinner(winner);

        // حالت حذفی: حذف برنده
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

    /**
     * نمایش برنده
     */
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

        // ذخیره برنده در state
        AppState.set('wheel.lastResult', winner);

        // دکمه ساخت داستان
        const storyBtn = document.getElementById('make-story-btn');
        if (storyBtn) {
            storyBtn.addEventListener('click', () => {
                // ذخیره در localStorage برای انتقال به صفحه AI
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

        // دکمه بستن
        const closeBtn = document.getElementById('close-winner-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.classList.remove('show');
            });
        }

        // بستن خودکار بعد از ۱۰ ثانیه
        setTimeout(() => {
            container.classList.remove('show');
        }, 10000);
    },

    /**
     * escape HTML
     */
    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

// ذخیره نوع آخرین چرخش
Object.defineProperty(WheelPage, '_lastSpinType', {
    get() {
        return AppState.get('wheel.lastSpinType') || 'random';
    },
    set(value) {
        AppState.set('wheel.lastSpinType', value);
    },
});

// راه‌اندازی در صفحه گردونه
if (document.getElementById('wheel-canvas')) {
    document.addEventListener('DOMContentLoaded', () => {
        // پس از آماده شدن SQL
        setTimeout(() => WheelPage.init(), 500);
    });
}

window.WheelPage = WheelPage;