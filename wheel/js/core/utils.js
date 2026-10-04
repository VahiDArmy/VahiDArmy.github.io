/**
 * توابع کمکی عمومی
 * @module utils
 */

const Utils = {
    /**
     * تولید شناسه یکتا
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * تبدیل اعداد انگلیسی به فارسی
     */
    toPersianNumbers(str) {
        const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(str).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
    },

    /**
     * تبدیل اعداد فارسی به انگلیسی
     */
    toEnglishNumbers(str) {
        const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        let result = String(str);
        persianDigits.forEach((pd, i) => {
            result = result.replace(new RegExp(pd, 'g'), englishDigits[i]);
        });
        return result;
    },

    /**
     * فرمت تاریخ به فارسی
     */
    formatDate(date = new Date()) {
        const d = new Date(date);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };
        return this.toPersianNumbers(d.toLocaleDateString('fa-IR', options));
    },

    /**
     * تأخیر
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /**
     * محدود کردن عدد
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * درهم‌آمیزی آرایه (Fisher-Yates)
     */
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    /**
     * انتخاب تصادفی از آرایه
     */
    randomPick(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * انتخاب تصادفی با وزن
     */
    weightedRandom(items, weights) {
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) return items[i];
        }
        return items[items.length - 1];
    },

    /**
     * کپی عمیق
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * ادغام عمیق اشیاء
     */
    deepMerge(target, source) {
        const output = { ...target };
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                output[key] = this.deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    },

    /**
     * اعتبارسنجی ایمیل
     */
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * کوتاه کردن متن
     */
    truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substr(0, length) + '...';
    },

    /**
     * کپی به کلیپ‌بورد
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('خطا در کپی:', err);
            return false;
        }
    },

    /**
     * دانلود فایل
     */
    downloadFile(content, filename, type = 'application/json') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * خواندن فایل
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    },

    /**
     * اعتبارسنجی JSON
     */
    isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * فرمت حجم فایل
     */
    formatBytes(bytes) {
        if (bytes === 0) return '۰ بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return this.toPersianNumbers(parseFloat((bytes / Math.pow(k, i)).toFixed(2))) + ' ' + sizes[i];
    },

    /**
     * تشخیص دستگاه موبایل
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    /**
     * تولید رنگ تصادفی
     */
    randomColor() {
        const colors = [
            '#8b5cf6', '#06b6d4', '#ec4899', '#10b981',
            '#f59e0b', '#ef4444', '#3b82f6', '#f97316',
            '#a855f7', '#14b8a6', '#f43f5e', '#eab308',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    /**
     * تبدیل HEX به RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        } : null;
    },

    /**
     * محاسبه روشنایی رنگ
     */
    getLuminance(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return 0.5;
        const { r, g, b } = rgb;
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    },

    /**
     * تشخیص رنگ متن مناسب
     */
    getContrastColor(hex) {
        return this.getLuminance(hex) > 0.5 ? '#000000' : '#ffffff';
    },

    /**
     * ذخیره‌سازی با کدگذاری
     */
    encodeData(data) {
        try {
            return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        } catch (e) {
            console.error('خطا در کدگذاری:', e);
            return null;
        }
    },

    /**
     * بازیابی داده کدگذاری‌شده
     */
    decodeData(encoded) {
        try {
            return JSON.parse(decodeURIComponent(escape(atob(encoded))));
        } catch (e) {
            console.error('خطا در رمزگشایی:', e);
            return null;
        }
    },
};

// صادرات
window.Utils = Utils;