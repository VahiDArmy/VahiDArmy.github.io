/**
 * منطق صفحه توصیف‌ها (جعبه ابزار)
 * @module descriptionPage
 */

const DescriptionPage = {
    currentObjectKey: null,

    init() {
        this._initCreatePersonButton();
        this._initTextArea();
        this._initItemDropdown();
        this._renderObjectsList();
        this._bindEvents();
    },

    // ═══════════════════════════════════════════
    // دکمه ایجاد فرد در سایدبار
    // ═══════════════════════════════════════════

    _initCreatePersonButton() {
        const btn = document.getElementById('create-person-btn');
        if (btn) {
            btn.addEventListener('click', () => this._createPerson());
        }
    },

    async _createPerson() {
        const name = await Modal.prompt('نام فرد جدید:');
        if (!name || !name.trim()) return;

        const person = People.add({ name: name.trim() }, false);
        if (person) {
            Notification.success(`«${person.name}» به جعبه ابزار اضافه شد`);
            this._renderObjectsList();
            setTimeout(() => this._selectObject(person.id), 200);
        }
    },

    // ═══════════════════════════════════════════
    // رندر لیست
    // ═══════════════════════════════════════════

    _renderObjectsList() {
        const container = document.getElementById('objects-list');
        if (!container) return;

        const people = People.getAll();
        const items = Items.getAll();
        const descriptions = Descriptions.getAll();

        let html = '';

        // ─── بخش افراد ───
        html += `<div class="objects-section">
            <h4 class="objects-section-title">
                👥 افراد (${Utils.toPersianNumbers(people.length)})
            </h4>
            <div class="objects-grid">`;

        if (people.length === 0) {
            html += `
                <button class="empty-add-btn" id="empty-add-person-btn" type="button">
                    <span class="empty-add-icon">+</span>
                    <span class="empty-add-text">افزودن اولین فرد</span>
                </button>
            `;
        } else {
            html += people.map((p) => this._renderPersonCard(p, descriptions[p.id])).join('');
        }

        html += `</div></div>`;

        // ─── بخش آیتم‌ها ───
        html += `<div class="objects-section">
            <h4 class="objects-section-title">
                🎁 آیتم‌ها (${Utils.toPersianNumbers(items.length)})
            </h4>
            <div class="objects-grid">`;

        if (items.length === 0) {
            html += `
                <button class="empty-add-btn" id="empty-add-item-btn" type="button">
                    <span class="empty-add-icon">+</span>
                    <span class="empty-add-text">افزودن اولین آیتم</span>
                </button>
            `;
        } else {
            html += items.map((i) => this._renderObjectCard('item', i.id, i.label, '#8b5cf6', descriptions[i.id])).join('');
        }

        html += `</div></div>`;

        container.innerHTML = html;

        // ─── رویدادها ───
        this._attachObjectCardEvents(container);
        this._attachEmptyStateEvents();
    },

    _attachEmptyStateEvents() {
        const emptyAddPerson = document.getElementById('empty-add-person-btn');
        if (emptyAddPerson) {
            emptyAddPerson.addEventListener('click', () => this._createPerson());
        }

        const emptyAddItem = document.getElementById('empty-add-item-btn');
        if (emptyAddItem) {
            emptyAddItem.addEventListener('click', () => {
                const input = document.getElementById('new-item-input');
                if (input) {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    },

    _attachObjectCardEvents(container) {
        // کلیک روی کارت‌ها
        container.querySelectorAll('[data-object-key]').forEach((card) => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                this._selectObject(card.dataset.objectKey);
            });
        });

        // دکمه toggle در گردونه
        container.querySelectorAll('[data-action="toggle-wheel"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const person = People.getById(id);
                if (!person) return;

                if (person.inWheel) {
                    People.removeFromWheel(id);
                } else {
                    People.addToWheel(id);
                }
                this._renderObjectsList();
            });
        });

        // دکمه حذف
        container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const person = People.getById(id);
                if (!person) return;

                const ok = await Modal.confirm(
                    `«${person.name}» از جعبه ابزار حذف شود؟\n(این عمل غیرقابل بازگشت است)`,
                    { danger: true }
                );
                if (ok) {
                    People.remove(id);
                    if (this.currentObjectKey === id) {
                        this.currentObjectKey = null;
                        const textarea = document.getElementById('description-textarea');
                        if (textarea) {
                            textarea.value = '';
                            textarea.disabled = true;
                        }
                        const nameEl = document.getElementById('current-object-name');
                        if (nameEl) nameEl.textContent = '—';
                        const starContainer = document.getElementById('star-toggle-container');
                        if (starContainer) starContainer.style.display = 'none';
                        const saveBtn = document.getElementById('save-description-btn');
                        if (saveBtn) saveBtn.disabled = true;
                    }
                    this._renderObjectsList();
                }
            });
        });
    },

    // ═══════════════════════════════════════════
    // رندر کارت‌ها
    // ═══════════════════════════════════════════

    _renderPersonCard(person, description) {
        const hasDesc = description && description.trim();
        const inWheel = person.inWheel;
        const starred = person.starred;

        return `
            <div class="object-card ${hasDesc ? 'has-description' : ''}" data-object-key="${person.id}">
                <div class="object-card-color" style="background: ${person.color}"></div>
                <div class="object-card-info">
                    <div class="object-card-name">
                        ${starred ? '⭐ ' : ''}${this._escape(person.name)}
                    </div>
                    <div class="object-card-desc">
                        ${hasDesc ? this._escape(Utils.truncate(description, 60)) : '<span class="text-muted">بدون توصیف</span>'}
                    </div>
                </div>
                <div class="object-card-actions">
                    <button
                        class="toggle-wheel-btn ${inWheel ? 'active' : ''}"
                        data-action="toggle-wheel"
                        data-id="${person.id}"
                        title="${inWheel ? 'حذف از گردونه' : 'افزودن به گردونه'}"
                        type="button"
                    >${inWheel ? '🎡' : '○'}</button>
                    <button
                        class="icon-btn icon-btn-sm"
                        data-action="delete"
                        data-id="${person.id}"
                        title="حذف از جعبه ابزار"
                        type="button"
                    >🗑</button>
                </div>
            </div>
        `;
    },

    _renderObjectCard(type, id, name, color, description) {
        const hasDesc = description && description.trim();
        return `
            <div class="object-card ${hasDesc ? 'has-description' : ''}" data-object-key="${id}">
                <div class="object-card-color" style="background: ${color}"></div>
                <div class="object-card-info">
                    <div class="object-card-name">${this._escape(name)}</div>
                    <div class="object-card-desc">
                        ${hasDesc ? this._escape(Utils.truncate(description, 60)) : '<span class="text-muted">بدون توصیف</span>'}
                    </div>
                </div>
                <div class="object-card-badge">${type === 'person' ? '👤' : '🎁'}</div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    // انتخاب و ویرایش
    // ═══════════════════════════════════════════

    _selectObject(key) {
        this.currentObjectKey = key;

        document.querySelectorAll('.object-card').forEach((c) => c.classList.remove('active'));
        const card = document.querySelector(`[data-object-key="${key}"]`);
        if (card) card.classList.add('active');

        const description = Descriptions.get(key) || '';
        const textarea = document.getElementById('description-textarea');
        if (textarea) {
            textarea.value = description;
            textarea.disabled = false;
            textarea.focus();
        }

        const nameEl = document.getElementById('current-object-name');
        if (nameEl) {
            const person = People.getById(key);
            const item = Items.getAll().find((i) => i.id === key);
            const obj = person || item;
            nameEl.textContent = obj ? (obj.name || obj.label) : 'نامشخص';
            this._renderStarToggle(key, !!person);
        }

        const saveBtn = document.getElementById('save-description-btn');
        if (saveBtn) saveBtn.disabled = false;
    },

    _renderStarToggle(key, isPerson) {
        const container = document.getElementById('star-toggle-container');
        if (!container) return;

        if (!isPerson) {
            container.style.display = 'none';
            return;
        }

        const person = People.getById(key);
        const isStarred = person?.starred || false;

        container.style.display = 'block';
        container.innerHTML = `
            <label class="star-toggle">
                <input type="checkbox" ${isStarred ? 'checked' : ''} id="star-checkbox">
                <span>⭐ اولویت در انتخاب</span>
            </label>
        `;

        const checkbox = document.getElementById('star-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                People.toggleStar(key);
                this._renderObjectsList();
                if (e.target.checked) Notification.success('اولویت‌دار شد');
                else Notification.info('اولویت برداشته شد');
            });
        }
    },

    _initTextArea() {
        const textarea = document.getElementById('description-textarea');
        const saveBtn = document.getElementById('save-description-btn');
        if (!textarea) return;
        textarea.disabled = true;

        const autoSave = Utils.debounce(() => {
            if (this.currentObjectKey) {
                Descriptions.set(this.currentObjectKey, textarea.value);
                this._renderObjectsList();
            }
        }, 1000);

        textarea.addEventListener('input', autoSave);

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (this.currentObjectKey) {
                    Descriptions.set(this.currentObjectKey, textarea.value);
                    Notification.success('توصیف ذخیره شد');
                    this._renderObjectsList();
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    // مدیریت آیتم‌ها
    // ═══════════════════════════════════════════

    _initItemDropdown() {
        const dropdownContainer = document.getElementById('item-dropdown');
        const addBtn = document.getElementById('add-item-btn');
        const newInput = document.getElementById('new-item-input');

        if (!dropdownContainer) return;

        const renderDropdown = () => {
            const items = Items.getAll();
            Dropdown.render(
                'item-dropdown',
                items.map((i) => ({ value: i.id, label: i.label, icon: '🎁' })),
                (value) => {
                    this._selectObject(value);
                },
                { placeholder: 'انتخاب آیتم...', searchable: true, allowCustom: false }
            );
        };

        renderDropdown();

        if (addBtn && newInput) {
            const addItem = () => {
                const label = newInput.value.trim();
                if (!label) return;
                const result = Items.add(label);
                if (result) {
                    newInput.value = '';
                    renderDropdown();
                    this._renderObjectsList();
                }
            };

            addBtn.addEventListener('click', addItem);
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                }
            });
        }
    },

    _bindEvents() {
        Events.on('items-changed', () => this._renderObjectsList());
        Events.on('people-changed', () => this._renderObjectsList());
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};

if (document.getElementById('objects-list')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => DescriptionPage.init(), 500);
    });
}

window.DescriptionPage = DescriptionPage;