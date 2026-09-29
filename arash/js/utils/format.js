/* ============================================
   توابع فرمت‌دهی
   ============================================ */

const Format = {
    /**
     * فرمت اعداد با جداکننده هزارگان فارسی
     */
    number(num) {
        if (num === null || num === undefined) return '۰';
        return Number(num).toLocaleString('fa-IR');
    },
    
    /**
     * فرمت قیمت (تومان)
     */
    price(amount) {
        if (amount === null || amount === undefined) return '۰ تومان';
        return this.number(amount) + ' تومان';
    },
    
    /**
     * فرمت سکه
     */
    coin(count) {
        if (count === null || count === undefined) return '۰ سکه';
        return this.number(count) + ' سکه';
    },
    
    /**
     * فرمت تاریخ شمسی
     */
    date(date) {
        if (!date) return '—';
        const d = new Date(date);
        return d.toLocaleDateString('fa-IR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    /**
     * فرمت تاریخ و ساعت شمسی
     */
    dateTime(date) {
        if (!date) return '—';
        const d = new Date(date);
        return d.toLocaleDateString('fa-IR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * فرمت زمان نسبی
     */
    timeAgo(date) {
        if (!date) return '—';
        const now = new Date();
        const then = new Date(date);
        const diff = now - then;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        
        if (seconds < 60) return 'همین الان';
        if (minutes < 60) return `${this.number(minutes)} دقیقه پیش`;
        if (hours < 24) return `${this.number(hours)} ساعت پیش`;
        if (days < 7) return `${this.number(days)} روز پیش`;
        if (weeks < 4) return `${this.number(weeks)} هفته پیش`;
        if (months < 12) return `${this.number(months)} ماه پیش`;
        return `${this.number(years)} سال پیش`;
    },
    
    /**
     * فرمت شماره موبایل
     */
    phone(phone) {
        if (!phone) return '—';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
        }
        return cleaned;
    },
    
    /**
     * فرمت شماره کارت
     */
    cardNumber(card) {
        if (!card) return '—';
        const cleaned = card.replace(/\D/g, '');
        return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    },
    
    /**
     * فرمت درصد
     */
    percent(value) {
        if (value === null || value === undefined) return '۰٪';
        return this.number(Math.round(value)) + '٪';
    },
    
    /**
     * فرمت اندازه فایل
     */
    fileSize(bytes) {
        if (!bytes) return '۰ بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return this.number(parseFloat((bytes / Math.pow(k, i)).toFixed(1))) + ' ' + sizes[i];
    },
    
    /**
     * فرمت مدت زمان
     */
    duration(seconds) {
        if (!seconds) return '۰ ثانیه';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        const parts = [];
        if (h > 0) parts.push(`${this.number(h)} ساعت`);
        if (m > 0) parts.push(`${this.number(m)} دقیقه`);
        if (s > 0 || parts.length === 0) parts.push(`${this.number(s)} ثانیه`);
        
        return parts.join(' و ');
    },
    
    /**
     * فرمت وضعیت
     */
    status(status) {
        const statusMap = {
            [APP_CONFIG.STATUS.PENDING]: { text: 'در انتظار تایید', class: 'badge-warning', icon: 'ri-time-line' },
            [APP_CONFIG.STATUS.APPROVED]: { text: 'تایید شده', class: 'badge-success', icon: 'ri-check-line' },
            [APP_CONFIG.STATUS.REJECTED]: { text: 'رد شده', class: 'badge-danger', icon: 'ri-close-line' }
        };
        return statusMap[status] || { text: 'نامشخص', class: 'badge-gray', icon: 'ri-question-line' };
    },
    
    /**
     * فرمت نقش
     */
    role(role) {
        const roleMap = {
            [APP_CONFIG.ROLES.USER]: { text: 'کاربر', class: 'badge-info' },
            [APP_CONFIG.ROLES.ADMIN]: { text: 'مدیر', class: 'badge-primary' }
        };
        return roleMap[role] || { text: 'نامشخص', class: 'badge-gray' };
    },
    
    /**
     * کوتاه کردن متن
     */
    truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },
    
    /**
     * فرمت اسم
     */
    name(name) {
        if (!name) return 'کاربر ناشناس';
        return name.trim();
    },
    
    /**
     * فرمت شماره تراکنش
     */
    transactionId(id) {
        if (!id) return '—';
        return '#' + id.toString().padStart(6, '0');
    }
};