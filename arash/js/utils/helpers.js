/* ============================================
   توابع کمکی
   ============================================ */

const Helpers = {
    /**
     * انتخاب عنصر از DOM
     */
    $(selector) {
        return document.querySelector(selector);
    },
    
    /**
     * انتخاب همه عناصر
     */
    $$(selector) {
        return document.querySelectorAll(selector);
    },
    
    /**
     * ایجاد عنصر
     */
    createElement(tag, className, content) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content) el.innerHTML = content;
        return el;
    },
    
    /**
     * تاخیر
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * اعتبارسنجی شماره موبایل ایران
     */
    validatePhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const pattern = /^09[0-9]{9}$/;
        return pattern.test(cleaned);
    },
    
    /**
     * نرمال‌سازی شماره موبایل
     */
    normalizePhone(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('98')) {
            cleaned = '0' + cleaned.slice(2);
        }
        if (!cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }
        return cleaned;
    },
    
    /**
     * تبدیل شماره به فرمت بین‌المللی
     */
    toInternationalPhone(phone) {
        const normalized = this.normalizePhone(phone);
        return '+98' + normalized.slice(1);
    },
    
    /**
     * کپی در کلیپ‌بورد
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            }
        } catch (error) {
            console.error('خطا در کپی:', error);
            return false;
        }
    },
    
    /**
     * دانلود فایل
     */
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    /**
     * اسکرول به بالا
     */
    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    
    /**
     * بررسی موبایل
     */
    isMobile() {
        return window.innerWidth <= 768;
    },
    
    /**
     * Debounce
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * تولید شناسه یکتا
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * امن‌سازی HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * گروه‌بندی آرایه
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },
    
    /**
     * مرتب‌سازی آرایه
     */
    sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (order === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
    },
    
    /**
     * جستجو در آرایه
     */
    searchInArray(array, query, fields) {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) return array;
        
        return array.filter(item => {
            return fields.some(field => {
                const value = item[field];
                return value && String(value).toLowerCase().includes(lowerQuery);
            });
        });
    },
    
    /**
     * محاسبه میانگین
     */
    average(numbers) {
        if (!numbers.length) return 0;
        return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    },
    
    /**
     * محدود کردن عدد
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * تولید رنگ تصادفی
     */
    randomColor() {
        const colors = [
            '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
            '#10B981', '#06B6D4', '#3B82F6', '#84CC16', '#F97316'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    /**
     * تشخیص نوع فایل
     */
    getFileType(file) {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        if (file.type === 'application/pdf') return 'pdf';
        return 'file';
    },
    
    /**
     * فرمت حجم فایل
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * تشخیص ادمین
     */
    isAdmin(user) {
        return user && user.role === APP_CONFIG.ROLES.ADMIN;
    },
    
    /**
     * دریافت حرف اول نام
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0);
        return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
    },
    
    /**
     * انیمیشن شماره
     */
    animateNumber(element, start, end, duration = 1000, suffix = '') {
        const startTime = performance.now();
        const diff = end - start;
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * easeOut);
            
            element.textContent = current.toLocaleString('fa-IR') + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    },
    
    /**
     * ذخیره‌سازی موقت
     */
    debouncedSave: null,
    
    /**
     * بررسی آنلاین بودن
     */
    isOnline() {
        return navigator.onLine;
    },
    
    /**
     * دریافت پارامتر URL
     */
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },
    
    /**
     * تنظیم پارامتر URL
     */
    setUrlParam(param, value) {
        const url = new URL(window.location);
        url.searchParams.set(param, value);
        window.history.pushState({}, '', url);
    },
    
    /**
     * حذف پارامتر URL
     */
    removeUrlParam(param) {
        const url = new URL(window.location);
        url.searchParams.delete(param);
        window.history.pushState({}, '', url);
    }
};

// نرمال‌سازی تابع debouncedSave
Helpers.debouncedSave = Helpers.debounce((fn) => fn(), 500);