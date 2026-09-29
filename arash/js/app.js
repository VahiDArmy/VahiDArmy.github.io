/* ============================================
   نقطه ورود اپلیکیشن - شادباش ازدواج
   ============================================ */

const App = {
    initialized: false,
    
    /**
     * راه‌اندازی
     */
    async init() {
        console.log('%c🌹 شادباش ازدواج', 'color: #EC4899; font-size: 20px; font-weight: bold;');
        console.log('%cسامانه مشارکت سکه‌ای', 'color: #F59E0B; font-size: 12px;');
        
        try {
            // اطمینان از ایجاد کانتینر مودال
            Modal.init();
            Toast.init();
            
            // گوش دادن به تغییرات احراز هویت
            this.setupAuthListener();
            
            // بررسی کاربر جاری
            await this.checkCurrentUser();
            
            // راه‌اندازی روتر
            Router.init();
            
            // تنظیمات کلیک روی لینک‌های ناوبری
            this.setupNavigation();
            
            // گوش دادن به آنلاین/آفلاین
            this.setupNetworkListeners();
            
            // ذخیره آخرین بازدید
            Storage.set('last_visit', new Date().toISOString());
            
            // مخفی کردن لودر
            this.hideLoader();
            
            this.initialized = true;
            
        } catch (error) {
            console.error('خطا در راه‌اندازی:', error);
            this.showFatalError(error.message);
        }
    },
    
    /**
     * بررسی کاربر جاری
     */
    async checkCurrentUser() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (session?.user) {
                // بررسی اعتبار نشست و دریافت پروفایل
                const profile = await AuthService.getCurrentUser();
                if (profile) {
                    Storage.setUser(profile);
                } else {
                    Storage.removeUser();
                    Storage.removeToken();
                }
            } else {
                Storage.removeUser();
                Storage.removeToken();
            }
        } catch (error) {
            console.error('خطا در بررسی کاربر:', error);
        }
    },
    
    /**
     * گوش دادن به تغییرات احراز هویت
     */
    setupAuthListener() {
        AuthService.onAuthStateChange((event, profile) => {
            console.log('تغییر وضعیت احراز هویت:', event);
            
            if (event === 'signed_out') {
                // اگر در صفحه محافظت شده هستیم، برو به welcome
                const protectedRoutes = ['coins', 'payment', 'status', 'location', 'profile', 'admin-dashboard', 'admin-participants', 'admin-settings', 'admin-reports'];
                if (protectedRoutes.includes(Router.currentRoute)) {
                    Router.navigate('welcome');
                }
            }
            
            // بروزرسانی نوار بالا
            Navbar.update();
        });
    },
    
    /**
     * تنظیم ناوبری
     */
    setupNavigation() {
        // کلیک روی لینک‌های data-nav
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-nav]');
            if (link) {
                // اگر لینک # دارد، پیش‌فرض رفتار مرورگر
                // فقط برای موارد خاص مخفی
            }
        });
        
        // دکمه‌های back/forward مرورگر
        window.addEventListener('popstate', () => {
            // روتر خودش گوش می‌دهد
        });
    },
    
    /**
     * گوش دادن به آنلاین/آفلاین
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            Toast.success('آنلاین شدید', 'اتصال اینترنت برقرار شد');
        });
        
        window.addEventListener('offline', () => {
            Toast.warning('آفلاین شدید', 'اتصال اینترنت قطع شد');
        });
    },
    
    /**
     * مخفی کردن لودر
     */
    hideLoader() {
        const loader = document.getElementById('initial-loader');
        const app = document.getElementById('app');
        
        if (app) app.style.display = 'flex';
        
        setTimeout(() => {
            if (loader) {
                loader.classList.add('hidden');
                setTimeout(() => {
                    if (loader.parentElement) {
                        loader.parentElement.removeChild(loader);
                    }
                }, 500);
            }
        }, 400);
    },
    
    /**
     * خطای مهلک
     */
    showFatalError(message) {
        const app = document.getElementById('app');
        const loader = document.getElementById('initial-loader');
        
        if (loader) loader.classList.add('hidden');
        
        if (app) {
            app.style.display = 'flex';
            const main = document.getElementById('main-content');
            if (main) {
                main.innerHTML = `
                    <div class="empty-state" style="min-height: 80vh; justify-content: center;">
                        <div class="empty-state-icon" style="color: var(--color-danger-500);">
                            <i class="ri-error-warning-fill"></i>
                        </div>
                        <h3 class="empty-state-title">خطای مهلک در راه‌اندازی</h3>
                        <p class="empty-state-text">${Helpers.escapeHtml(message)}</p>
                        <p style="color: var(--text-tertiary); font-size: var(--font-size-sm); margin-top: var(--space-4);">
                            لطفاً اتصال اینترنت خود را بررسی کرده و صفحه را مجدداً بارگذاری کنید.
                        </p>
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: var(--space-6);">
                            <i class="ri-refresh-line"></i>
                            <span>تلاش مجدد</span>
                        </button>
                    </div>
                `;
            }
        }
    }
};

/* ============================================
   راه‌اندازی پس از بارگذاری DOM
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

/* ============================================
   مدیریت خطاهای سراسری
   ============================================ */
window.addEventListener('error', (e) => {
    console.error('خطای سراسری:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promis رد شده:', e.reason);
});