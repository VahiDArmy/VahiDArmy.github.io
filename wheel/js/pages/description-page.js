/**
 * منطق صفحه توصیف‌ها - با کلید ستاره مخفی
 * @module descriptionPage
 */

const DescriptionPage = {
    currentObjectKey: null,

    init() {
        this._renderObjectsList();
        this._initTextArea();
        this._initItemDropdown();
        this._bindEvents();
    },

    _renderObjectsList() {
        const container = document.getElementById('objects-list');
        if (!container) return;

        const people = AppState.get('people') || [];
        const items = AppState.get('items') || [];
        const descriptions = AppState.get('descriptions') || {};

        let html = '';

        html += `<div class="objects-section">
            <h4 class="objects-section-title">👥 افراد (${Utils.toPersianNumbers(people.length)})</h4>
            <div class="objects-grid">
                ${people.length === 0 ? '<p class="text-muted">فردی اضافه نشده</p>' : ''}
                ${people.map((p) => this._renderObjectCard('person', p.id, p.name, p.color, descriptions[p.id])).join('')}
            </div>
        </div>`;

        html += `<div class="objects-section">
            <h4 class="objects-section-title">🎁 آیتم‌ها (${Utils.toPersianNumbers(items.length)})</h4>
            <div class="objects-grid">
                ${items.length === 0 ? '<p class="text-muted">آیتمی اضافه نشده</p>' : ''}
                ${items.map((i) => this._renderObjectCard('item', i.id, i.label, '#8b5cf6', descriptions[i.id])).join('')}
            </div>
        </div>`;

        container.innerHTML = html;

        container.querySelectorAll('[data-object-key]').forEach((card) => {
            card.addEventListener('click', () => {
                this._selectObject(card.dataset.objectKey);
            });
        });
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
        }

        const nameEl = document.getElementById('current-object-name');
        if (nameEl) {
            const people = AppState.get('people') || [];
            const items = AppState.get('items') || [];
            const obj = [...people, ...items].find((o) => o.id === key);
            nameEl.textContent = obj ? (obj.name || obj.label) : 'نامشخص';

            // کلید ستاره مخفی - فقط برای افراد
            const isPerson = people.some((p) => p.id === key);
            this._renderStarToggle(key, isPerson);
        }

        const saveBtn = document.getElementById('save-description-btn');
        if (saveBtn) saveBtn.disabled = false;
    },

    /**
     * رندر کلید ستاره (مخفی)
     */
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
                const updated = People.toggleStar(key);
                if (updated) {
                    Notification.success(e.target.checked ? 'فرد اولویت‌دار شد' : 'اولویت برداشته شد');
                }
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

    _initItemDropdown() {
        const dropdownContainer = document.getElementById('item-dropdown');
        const addBtn = document.getElementById('add-item-btn');
        const newInput = document.getElementById('new-item-input');

        if (!dropdownContainer) return;

        const renderDropdown = () => {
            const items = AppState.get('items') || [];
            Dropdown.render(
                'item-dropdown',
                items.map((i) => ({ value: i.id, label: i.label, icon: '🎁' })),
                (value, label) => {
                    Notification.info(`«${label}» انتخاب شد`);
                },
                {
                    placeholder: 'انتخاب آیتم...',
                    searchable: true,
                    allowCustom: false,
                }
            );
        };

        renderDropdown();

        if (addBtn && newInput) {
            addBtn.addEventListener('click', () => {
                const label = newInput.value.trim();
                if (!label) return;
                const result = Items.add(label);
                if (result) {
                    newInput.value = '';
                    renderDropdown();
                    this._renderObjectsList();
                }
            });

            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addBtn.click();
            });
        }
    },

    _bindEvents() {
        Events.on('items-changed', () => {
            this._renderObjectsList();
        });
        Events.on('people-changed', () => {
            this._renderObjectsList();
        });
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

if (document.getElementById('objects-list')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => DescriptionPage.init(), 500);
    });
}

window.DescriptionPage = DescriptionPage;