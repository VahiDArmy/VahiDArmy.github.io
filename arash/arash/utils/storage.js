/* ============================================
   مدیریت LocalStorage و SessionStorage
   ============================================ */

const Storage = {
    prefix: 'coin_app_',
    
    /**
     * ذخیره‌سازی
     */
    set(key, value, useSession = false) {
        try {
            const storage = useSession ? sessionStorage : localStorage;
            storage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره‌سازی:', error);
            return false;
        }
    },
    
    /**
     * دریافت
     */
    get(key, defaultValue = null, useSession = false) {
        try {
            const storage = useSession ? sessionStorage : localStorage;
            const item = storage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('خطا در خواندن:', error);
            return defaultValue;
        }
    },
    
    /**
     * حذف
     */
    remove(key, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        storage.removeItem(this.prefix + key);
    },
    
    /**
     * پاک کردن همه
     */
    clear(useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const keys = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        keys.forEach(key => storage.removeItem(key));
    },
    
    /**
     * ذخیره توکن
     */
    setToken(token) {
        this.set('access_token', token);
    },
    
    /**
     * دریافت توکن
     */
    getToken() {
        return this.get('access_token');
    },
    
    /**
     * حذف توکن
     */
    removeToken() {
        this.remove('access_token');
    },
    
    /**
     * ذخیره اطلاعات کاربر
     */
    setUser(user) {
        this.set('user', user);
    },
    
    /**
     * دریافت اطلاعات کاربر
     */
    getUser() {
        return this.get('user');
    },
    
    /**
     * حذف اطلاعات کاربر
     */
    removeUser() {
        this.remove('user');
    },
    
    /**
     * ذخیره وضعیت
     */
    setState(key, value) {
        this.set('state_' + key, value);
    },
    
    /**
     * دریافت وضعیت
     */
    getState(key, defaultValue = null) {
        return this.get('state_' + key, defaultValue);
    },
    
    /**
     * ذخیره آخرین مسیر
     */
    setLastRoute(route) {
        this.set('last_route', route);
    },
    
    /**
     * دریافت آخرین مسیر
     */
    getLastRoute() {
        return this.get('last_route', null);
    },
    
    /**
     * ذخیره اطلاعات موقت
     */
    setTemp(key, value) {
        this.set(key, value, true);
    },
    
    /**
     * دریافت اطلاعات موقت
     */
    getTemp(key, defaultValue = null) {
        return this.get(key, defaultValue, true);
    },
    
    /**
     * بررسی وجود کلید
     */
    has(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }
};