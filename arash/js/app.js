/* ============================================
   نقطه ورود اپلیکیشن - شادباش ازدواج
   نسخه ۲.۰ - رفع مشکل خروج خودکار
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
            Modal.init();
            Toast.init();
            
            // ✅ قدم مهم: بررسی کاربر جاری قبل از راه‌اندازی روتر
            await this.checkCurrentUser();
            
            // راه‌اندازی listener (بعد از check، نه قبل)
            this.setupAuthListener();
            
            // راه‌اندازی روتر
            Router.init();
            
            // رویدادهای شبکه
            this.setupNetworkListeners();
            
            Storage.set('last_visit', new Date().toISOString());
            
            this.hideLoader();
            this.initialized = true;
            
            // 🐛 در حالت development
            if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
                setTimeout(() => debugSession(), 1000);
            }
            
        } catch (error) {
            console.error('خطا در راه‌اندازی:', error);
            this.showFatalError(error.message);
        }
    },
    
    /**
     * ✅ بررسی کاربر جاری (بدون logout تصادفی)
     */
    async checkCurrentUser() {
        try {
            // مرحله ۱: بررسی Session از Supabase
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            
            if (sessionError) {
                console.warn('خطا در دریافت Session:', sessionError.message);
                // خطا را نادیده بگیر - ممکن است شبکه مشکل داشته باشد
            }
            
            if (!session?.user) {
                // کاربر واقعاً وارد نشده - پاکسازی
                console.log('🔓 کاربر وارد نشده است');
                Storage.removeUser();
                Storage.removeToken();
                return null;
            }
            
            console.log('🔐 Session یافت شد:', session.user.email);
            
            // مرحله ۲: بررسی کاربر ذخیره‌شده در LocalStorage
            let profile = Storage.getUser();
            
            if (profile && profile.id === session.user.id) {
                // کاربر ذخیره‌شده معتبر است
                console.log('✅ کاربر از cache بارگذاری شد:', profile.name);
                return profile;
            }
            
            // مرحله ۳: اگر profile در cache نبود، از دیتابیس بگیر
            console.log('📥 دریافت پروفایل از دیتابیس...');
            
            // تلاش تا ۳ بار
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { data, error } = await supabaseClient
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    
                    if (error && error.code !== 'PGRST116') {
                        // PGRST116 = no rows found (خطای واقعی نیست)
                        console.warn(`تلاش ${attempt}: خطا در دریافت پروفایل -`, error.message);
                    }
                    
                    if (data) {
                        Storage.setUser(data);
                        Storage.setToken(session.access_token);
                        console.log('✅ پروفایل دریافت شد:', data.name);
                        return data;
                    }
                } catch (e) {
                    console.warn(`تلاش ${attempt} با خطا:`, e.message);
                }
                
                if (attempt < 3) await Helpers.delay(500);
            }
            
            // اگر پروفایل پیدا نشد، سعی کن بسازی
            console.warn('⚠️ پروفایل یافت نشد - تلاش برای ساخت دستی');
            const name = session.user.user_metadata?.name || 'کاربر';
            const phone = session.user.user_metadata?.phone || 
                         session.user.email?.replace('@shadbash.local', '') || '';
            
            try {
                const { data } = await supabaseClient
                    .from('profiles')
                    .insert({
                        id: session.user.id,
                        name,
                        phone,
                        role: 'user',
                        total_coins: 0,
                        status: 'active'
                    })
                    .select()
                    .single();
                
                if (data) {
                    Storage.setUser(data);
                    Storage.setToken(session.access_token);
                    console.log('✅ پروفایل دستی ساخته شد:', data.name);
                    return data;
                }
            } catch (insertError) {
                console.error('خطا در ساخت دستی:', insertError.message);
            }
            
            // اگر همه تلاش‌ها ناموفق بود، اما Session داریم
            // کاربر را نگه‌دار و بعداً دوباره تلاش کن
            console.warn('⚠️ نتوانستیم پروفایل را بارگذاری کنیم، اما Session معتبر است');
            Storage.setToken(session.access_token);
            
            // حداقل یک آبجکت موقت بساز
            const tempProfile = {
                id: session.user.id,
                name: session.user.user_metadata?.name || 'کاربر',
                phone: session.user.user_metadata?.phone || '',
                role: 'user',
                total_coins: 0,
                status: 'active',
                _temp: true
            };
            Storage.setUser(tempProfile);
            
            return tempProfile;
            
        } catch (error) {
            console.error('خطا در بررسی کاربر:', error);
            // ✅ نکته مهم: در صورت خطا، کاربر را logout نکن
            // فقط اگر profile قبلاً ذخیره شده، همان را برگردان
            return Storage.getUser();
        }
    },
    
    /**
     * گوش دادن به تغییرات احراز هویت
     */
    setupAuthListener() {
        AuthService.onAuthStateChange((event, profile) => {
            console.log('🔔 تغییر وضعیت auth:', event);
            
            if (event === 'signed_out') {
                // فقط در logout واقعی، کاربر را بیرون کن
                const protectedRoutes = [
                    'coins', 'payment', 'status', 'location', 'profile',
                    'admin-dashboard', 'admin-participants', 
                    'admin-settings', 'admin-reports'
                ];
                
                if (protectedRoutes.includes(Router.currentRoute)) {
                    Toast.info('خروج', 'برای ادامه وارد شوید');
                    Router.navigate('welcome');
                }
            }
            
            // بروزرسانی نوار بالا
            Navbar.update();
        });
    },
    
    /**
     * رویدادهای شبکه
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            Toast.success('آنلاین شدید', 'اتصال برقرار شد');
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
        }, 300);
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
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.addEventListener('error', (e) => {
    console.error('خطای سراسری:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promis رد شده:', e.reason);
});