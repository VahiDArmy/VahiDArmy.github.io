/**
 * مدیریت دراپ‌دان‌ها
 * @module dropdown
 */

const Dropdown = {
    activeDropdown: null,

    /**
     * راه‌اندازی خودکار روی همه عناصر
     */
    initAll() {
        document.querySelectorAll('[data-dropdown]').forEach((el) => {
            this.init(el);
        });
    },

    /**
     * راه‌اندازی یک دراپ‌دان
     */
    init(el) {
        const trigger = el.querySelector('[data-dropdown-trigger]') || el;
        const menu = el.querySelector('[data-dropdown-menu]');
        if (!menu) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(el);
        });
    },

    /**
     * باز/بسته کردن
     */
    toggle(el) {
        if (this.activeDropdown && this.activeDropdown !== el) {
            this.close(this.activeDropdown);
        }

        const isOpen = el.classList.contains('dropdown-open');
        if (isOpen) {
            this.close(el);
        } else {
            this.open(el);
        }
    },

    /**
     * باز کردن
     */
    open(el) {
        el.classList.add('dropdown-open');
        this.activeDropdown = el;

        // بستن با کلیک بیرون
        setTimeout(() => {
            document.addEventListener('click', this._outsideHandler);
        }, 0);
    },

    /**
     * بستن
     */
    close(el) {
        el.classList.remove('dropdown-open');
        if (this.activeDropdown === el) {
            this.activeDropdown = null;
        }
        document.removeEventListener('click', this._outsideHandler);
    },

    /**
     * بستن همه
     */
    closeAll() {
        document.querySelectorAll('.dropdown-open').forEach((el) => {
            this.close(el);
        });
    },

    _outsideHandler(e) {
        if (!e.target.closest('[data-dropdown]')) {
            Dropdown.closeAll();
        }
    },

    /**
     * ساخت دراپ‌دان پویا (مثلاً برای آیتم‌ها)
     */
    render(elementId, options, onSelect, config = {}) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const {
            placeholder = 'انتخاب کنید...',
            searchable = false,
            allowCustom = false,
            onAdd = null,
        } = config;

        const selectedValue = el.dataset.value || '';

        el.classList.add('dropdown');
        el.dataset.dropdown = '';
        el.innerHTML = `
            <div class="dropdown-trigger" data-dropdown-trigger>
                <span class="dropdown-value">${selectedValue || placeholder}</span>
                <span class="dropdown-arrow">▾</span>
            </div>
            <div class="dropdown-menu" data-dropdown-menu>
                ${searchable ? '<input type="text" class="dropdown-search" placeholder="جستجو...">' : ''}
                <div class="dropdown-items">
                    ${options.map((opt) => `
                        <div class="dropdown-item" data-value="${opt.value}">
                            ${opt.icon ? `<span class="dropdown-item-icon">${opt.icon}</span>` : ''}
                            <span class="dropdown-item-label">${opt.label}</span>
                        </div>
                    `).join('')}
                </div>
                ${allowCustom ? `
                    <div class="dropdown-custom">
                        <input type="text" class="input input-sm" placeholder="افزودن جدید..." id="${elementId}-new">
                        <button class="btn btn-sm btn-primary" id="${elementId}-add">افزودن</button>
                    </div>
                ` : ''}
            </div>
        `;

        // انتخاب گزینه
        el.querySelectorAll('.dropdown-item').forEach((item) => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                const label = item.querySelector('.dropdown-item-label').textContent;
                el.dataset.value = value;
                el.querySelector('.dropdown-value').textContent = label;
                this.close(el);
                if (onSelect) onSelect(value, label);
            });
        });

        // جستجو
        if (searchable) {
            const searchInput = el.querySelector('.dropdown-search');
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                el.querySelectorAll('.dropdown-item').forEach((item) => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(q) ? '' : 'none';
                });
            });
        }

        // افزودن جدید
        if (allowCustom) {
            const newInput = el.querySelector(`#${elementId}-new`);
            const addBtn = el.querySelector(`#${elementId}-add`);
            const handleAdd = () => {
                const value = newInput.value.trim();
                if (!value) return;
                if (onAdd) onAdd(value);
                newInput.value = '';
            };
            addBtn.addEventListener('click', handleAdd);
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAdd();
            });
        }

        this.init(el);
        return el;
    },
};

window.Dropdown = Dropdown;