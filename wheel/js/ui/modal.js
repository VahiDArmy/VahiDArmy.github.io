/**
 * مدیریت مودال‌ها
 * @module modal
 */

const Modal = {
    container: null,
    activeModals: [],

    /**
     * راه‌اندازی
     */
    init() {
        this.container = document.getElementById('modal-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'modal-container';
            this.container.className = 'modal-container';
            document.body.appendChild(this.container);
        }
    },

    /**
     * باز کردن مودال
     */
    open(options = {}) {
        if (!this.container) this.init();

        const {
            title = '',
            content = '',
            size = 'md', // sm | md | lg | xl
            closable = true,
            buttons = [],
            onClose = null,
            id = Utils.generateId('modal'),
        } = options;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.dataset.modalId = id;

        const buttonsHtml = buttons
            .map(
                (btn, i) =>
                    `<button class="btn ${btn.class || 'btn-secondary'}" data-btn-index="${i}">
                        ${btn.icon || ''} ${btn.label || ''}
                    </button>`
            )
            .join('');

        modal.innerHTML = `
            <div class="modal modal-${size}" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    ${closable ? '<button class="modal-close" aria-label="بستن">×</button>' : ''}
                </div>
                <div class="modal-body">${content}</div>
                ${buttons.length > 0 ? `<div class="modal-footer">${buttonsHtml}</div>` : ''}
            </div>
        `;

        // رویداد بستن با کلیک روی overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal && closable) {
                this.close(id);
            }
        });

        // دکمه بستن
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(id));
        }

        // دکمه‌های footer
        modal.querySelectorAll('[data-btn-index]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const index = parseInt(btn.dataset.btnIndex);
                const buttonConfig = buttons[index];
                if (buttonConfig.onClick) {
                    const result = await buttonConfig.onClick(modal);
                    if (result !== false && buttonConfig.closeOnClick !== false) {
                        this.close(id);
                    }
                } else {
                    this.close(id);
                }
            });
        });

        this.container.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('modal-show'));

        this.activeModals.push({ id, onClose });

        // فوکوس روی اولین input
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 100);

        return { id, element: modal };
    },

    /**
     * بستن مودال
     */
    close(id) {
        const modal = this.container?.querySelector(`[data-modal-id="${id}"]`);
        if (!modal) return;

        modal.classList.remove('modal-show');
        modal.classList.add('modal-hide');

        const index = this.activeModals.findIndex((m) => m.id === id);
        if (index !== -1) {
            const { onClose } = this.activeModals[index];
            if (onClose) onClose();
            this.activeModals.splice(index, 1);
        }

        setTimeout(() => {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 300);
    },

    /**
     * بستن همه
     */
    closeAll() {
        [...this.activeModals].forEach((m) => this.close(m.id));
    },

    /**
     * مودال تأیید
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            this.open({
                title: options.title || 'تأیید',
                content: `<p class="modal-message">${message}</p>`,
                size: 'sm',
                buttons: [
                    {
                        label: options.cancelLabel || 'انصراف',
                        class: 'btn-secondary',
                        onClick: () => {
                            resolve(false);
                        },
                    },
                    {
                        label: options.confirmLabel || 'تأیید',
                        class: options.danger ? 'btn-danger' : 'btn-primary',
                        onClick: () => {
                            resolve(true);
                        },
                    },
                ],
                onClose: () => resolve(false),
            });
        });
    },

    /**
     * مودال پرامپت
     */
    prompt(message, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const inputId = Utils.generateId('prompt-input');
            this.open({
                title: options.title || 'ورودی',
                content: `
                    <p class="modal-message">${message}</p>
                    <input type="${options.type || 'text'}" 
                           id="${inputId}" 
                           class="input" 
                           value="${defaultValue}" 
                           placeholder="${options.placeholder || ''}"
                           style="margin-top: 1rem; width: 100%;" />
                `,
                size: 'sm',
                buttons: [
                    {
                        label: 'انصراف',
                        class: 'btn-secondary',
                        onClick: () => resolve(null),
                    },
                    {
                        label: options.confirmLabel || 'تأیید',
                        class: 'btn-primary',
                        onClick: (modal) => {
                            const input = modal.querySelector(`#${inputId}`);
                            resolve(input ? input.value : null);
                        },
                    },
                ],
                onClose: () => resolve(null),
            });
        });
    },

    /**
     * مودال هشدار
     */
    alert(message, options = {}) {
        return new Promise((resolve) => {
            this.open({
                title: options.title || 'اطلاع',
                content: `<p class="modal-message">${message}</p>`,
                size: 'sm',
                buttons: [
                    {
                        label: 'متوجه شدم',
                        class: 'btn-primary',
                        onClick: () => resolve(true),
                    },
                ],
                onClose: () => resolve(true),
            });
        });
    },
};

window.Modal = Modal;