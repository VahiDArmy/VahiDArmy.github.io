/* ============================================
   سیستم اعلان‌ها (Toast)
   ============================================ */

const Toast = {
    container: null,
    
    /**
     * راه‌اندازی
     */
    init() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    /**
     * نمایش اعلان
     */
    show({ type = 'info', title = '', message = '', duration = 5000, closable = true }) {
        if (!this.container) this.init();
        
        const icons = {
            success: 'ri-checkbox-circle-fill',
            error: 'ri-error-warning-fill',
            warning: 'ri-alert-fill',
            info: 'ri-information-fill'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${Helpers.escapeHtml(title)}</div>` : ''}
                ${message ? `<div class="toast-message">${Helpers.escapeHtml(message)}</div>` : ''}
            </div>
            ${closable ? '<button class="toast-close"><i class="ri-close-line"></i></button>' : ''}
        `;
        
        // دکمه بستن
        if (closable) {
            toast.querySelector('.toast-close').addEventListener('click', () => {
                this.dismiss(toast);
            });
        }
        
        this.container.appendChild(toast);
        
        // حذف خودکار
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }
        
        return toast;
    },
    
    /**
     * حذف اعلان
     */
    dismiss(toast) {
        if (!toast || !toast.parentElement) return;
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 250);
    },
    
    /**
     * اعلان موفقیت
     */
    success(title, message = '', duration = 4000) {
        return this.show({ type: 'success', title, message, duration });
    },
    
    /**
     * اعلان خطا
     */
    error(title, message = '', duration = 6000) {
        return this.show({ type: 'error', title, message, duration });
    },
    
    /**
     * اعلان هشدار
     */
    warning(title, message = '', duration = 5000) {
        return this.show({ type: 'warning', title, message, duration });
    },
    
    /**
     * اعلان اطلاعات
     */
    info(title, message = '', duration = 4000) {
        return this.show({ type: 'info', title, message, duration });
    },
    
    /**
     * اعلان لودینگ
     */
    loading(title = 'در حال پردازش...', message = '') {
        return this.show({
            type: 'info',
            title,
            message,
            duration: 0,
            closable: false
        });
    },
    
    /**
     * حذف همه
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};