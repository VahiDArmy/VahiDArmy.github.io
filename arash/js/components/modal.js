/* ============================================
   کامپوننت مودال
   ============================================ */

const Modal = {
    container: null,
    currentModal: null,
    
    /**
     * راه‌اندازی
     */
    init() {
        this.container = document.getElementById('modal-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'modal-container';
            document.body.appendChild(this.container);
        }
    },
    
    /**
     * نمایش مودال
     */
    show({ title, content, footer = '', size = '', closable = true, onClose = null }) {
        this.init();
        this.close();
        
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="modal ${size ? 'modal-' + size : ''}">
                ${title ? `
                    <div class="modal-header">
                        <h3 class="modal-title">${Helpers.escapeHtml(title)}</h3>
                        ${closable ? `
                            <button class="modal-close" aria-label="بستن">
                                <i class="ri-close-line"></i>
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="modal-body">${content}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;
        
        this.container.appendChild(backdrop);
        this.currentModal = backdrop;
        
        // رویدادها
        if (closable) {
            const closeBtn = backdrop.querySelector('.modal-close');
            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) this.close();
            });
        }
        
        // ESC
        const escHandler = (e) => {
            if (e.key === 'Escape' && closable) {
                this.close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // قفل اسکرول
        document.body.style.overflow = 'hidden';
        
        this.onCloseCallback = onClose;
        
        return backdrop;
    },
    
    /**
     * بستن مودال
     */
    close() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
            document.body.style.overflow = '';
            
            if (this.onCloseCallback) {
                this.onCloseCallback();
                this.onCloseCallback = null;
            }
        }
    },
    
    /**
     * مودال تایید
     */
    confirm({ title = 'تایید', message = '', confirmText = 'تایید', cancelText = 'انصراف', type = 'primary' }) {
        return new Promise((resolve) => {
            const iconMap = {
                primary: { icon: 'ri-question-line', class: 'primary' },
                danger: { icon: 'ri-error-warning-line', class: 'danger' },
                success: { icon: 'ri-checkbox-circle-line', class: 'success' },
                warning: { icon: 'ri-alert-line', class: 'warning' }
            };
            
            const cfg = iconMap[type] || iconMap.primary;
            
            const content = `
                <div class="modal-confirm">
                    <div class="modal-confirm-icon ${cfg.class}">
                        <i class="${cfg.icon}"></i>
                    </div>
                    <p class="modal-confirm-message">${Helpers.escapeHtml(message)}</p>
                </div>
            `;
            
            const footer = `
                <button class="btn btn-secondary" data-cancel>${cancelText}</button>
                <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" data-confirm>${confirmText}</button>
            `;
            
            const modal = this.show({
                title,
                content,
                footer,
                size: 'sm',
                onClose: () => resolve(false)
            });
            
            modal.querySelector('[data-confirm]').addEventListener('click', () => {
                resolve(true);
                this.close();
            });
            
            modal.querySelector('[data-cancel]').addEventListener('click', () => {
                resolve(false);
                this.close();
            });
        });
    },
    
    /**
     * مودال هشدار
     */
    alert({ title = 'توجه', message = '', buttonText = 'متوجه شدم', type = 'info' }) {
        return new Promise((resolve) => {
            const iconMap = {
                info: { icon: 'ri-information-line', class: 'info' },
                success: { icon: 'ri-checkbox-circle-line', class: 'success' },
                error: { icon: 'ri-error-warning-line', class: 'danger' },
                warning: { icon: 'ri-alert-line', class: 'warning' }
            };
            
            const cfg = iconMap[type] || iconMap.info;
            
            const content = `
                <div class="modal-confirm">
                    <div class="modal-confirm-icon ${cfg.class}">
                        <i class="${cfg.icon}"></i>
                    </div>
                    <p class="modal-confirm-message">${Helpers.escapeHtml(message)}</p>
                </div>
            `;
            
            const footer = `
                <button class="btn btn-primary" data-close>${buttonText}</button>
            `;
            
            const modal = this.show({
                title,
                content,
                footer,
                size: 'sm',
                onClose: () => resolve(true)
            });
            
            modal.querySelector('[data-close]').addEventListener('click', () => {
                resolve(true);
                this.close();
            });
        });
    },
    
    /**
     * مودال سفارشی
     */
    custom(options) {
        return this.show(options);
    }
};