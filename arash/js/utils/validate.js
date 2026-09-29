/* ============================================
   توابع اعتبارسنجی
   ============================================ */

const Validate = {
    /**
     * اعتبارسنجی نام
     */
    name(value) {
        if (!value || !value.trim()) {
            return { valid: false, message: 'نام را وارد کنید' };
        }
        if (value.trim().length < 2) {
            return { valid: false, message: 'نام باید حداقل ۲ حرف باشد' };
        }
        if (value.trim().length > 50) {
            return { valid: false, message: 'نام نباید بیش از ۵۰ حرف باشد' };
        }
        return { valid: true, message: '' };
    },
    
    /**
     * اعتبارسنجی شماره موبایل
     */
    phone(value) {
        if (!value || !value.trim()) {
            return { valid: false, message: 'شماره موبایل را وارد کنید' };
        }
        const cleaned = value.replace(/\D/g, '');
        if (!/^09[0-9]{9}$/.test(cleaned)) {
            return { valid: false, message: 'شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد' };
        }
        return { valid: true, message: '' };
    },
    
    /**
     * اعتبارسنجی تعداد سکه
     */
    coins(value) {
        const num = parseInt(value);
        if (isNaN(num)) {
            return { valid: false, message: 'تعداد سکه را وارد کنید' };
        }
        if (num < APP_CONFIG.MIN_COINS) {
            return { valid: false, message: `حداقل ${APP_CONFIG.MIN_COINS} سکه` };
        }
        if (num > APP_CONFIG.MAX_COINS) {
            return { valid: false, message: `حداکثر ${APP_CONFIG.MAX_COINS} سکه` };
        }
        return { valid: true, message: '' };
    },
    
    /**
     * اعتبارسنجی فایل
     */
    file(file) {
        if (!file) {
            return { valid: false, message: 'فایلی انتخاب نشده است' };
        }
        if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
            return { valid: false, message: `حجم فایل نباید بیش از ${Format.fileSize(APP_CONFIG.MAX_FILE_SIZE)} باشد` };
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, message: 'فرمت فایل پشتیبانی نمی‌شود' };
        }
        return { valid: true, message: '' };
    },
    
    /**
     * اعتبارسنجی متن
     */
    text(value, minLength = 1, maxLength = 500) {
        if (!value || !value.trim()) {
            return { valid: false, message: 'متن را وارد کنید' };
        }
        if (value.trim().length < minLength) {
            return { valid: false, message: `متن باید حداقل ${minLength} حرف باشد` };
        }
        if (value.trim().length > maxLength) {
            return { valid: false, message: `متن نباید بیش از ${maxLength} حرف باشد` };
        }
        return { valid: true, message: '' };
    },
    
    /**
     * نمایش خطا
     */
    showError(input, message) {
        input.classList.add('error');
        input.classList.remove('success');
        
        let errorEl = input.parentElement.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            input.parentElement.appendChild(errorEl);
        }
        errorEl.innerHTML = `<i class="ri-error-warning-line"></i> ${message}`;
    },
    
    /**
     * نمایش موفقیت
     */
    showSuccess(input) {
        input.classList.remove('error');
        input.classList.add('success');
        
        const errorEl = input.parentElement.querySelector('.form-error');
        if (errorEl) errorEl.remove();
    },
    
    /**
     * پاک کردن وضعیت
     */
    clear(input) {
        input.classList.remove('error', 'success');
        const errorEl = input.parentElement.querySelector('.form-error');
        if (errorEl) errorEl.remove();
    },
    
    /**
     * اعتبارسنجی فرم کامل
     */
    form(fields) {
        let isValid = true;
        const errors = {};
        
        for (const [name, config] of Object.entries(fields)) {
            const input = config.element;
            const value = input.value;
            const result = config.validator(value);
            
            if (!result.valid) {
                isValid = false;
                errors[name] = result.message;
                this.showError(input, result.message);
            } else {
                this.showSuccess(input);
            }
        }
        
        return { valid: isValid, errors };
    }
};