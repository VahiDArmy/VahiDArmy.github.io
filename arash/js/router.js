/* ============================================
   روتر SPA
   ============================================ */

const Router = {
    currentRoute: null,
    currentPage: null,
    
    /**
     * نقشه مسیرها
     */
    routes: {
        'welcome': () => WelcomePage,
        'auth': () => AuthPage,
        'coins': () => CoinsPage,
        'payment': () => PaymentPage,
        'status': () => StatusPage,
        'location': () => LocationPage,
        'profile': () => ProfilePage,
        'admin-dashboard': () => AdminDashboard,
        'admin-participants': () => AdminParticipants,
        'admin-settings': () => AdminSettings,
        'admin-reports': () => AdminReports
    },
    
    /**
     * راه‌اندازی
     */
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },
    
    /**
     * مدیریت مسیر
     */
    async handleRoute() {
        let hash = window.location.hash.replace('#', '') || 'welcome';
        
        // اگر کاربر وارد نشده و مسیر محافظت شده
        const publicRoutes = ['welcome', 'auth'];
        const user = Storage.getUser();
        
        if (!publicRoutes.includes(hash) && !user) {
            this.navigate('auth');
            return;
        }
        
        // بررسی دسترسی ادمین
        const adminRoutes = ['admin-dashboard', 'admin-participants', 'admin-settings', 'admin-reports'];
        if (adminRoutes.includes(hash) && user?.role !== 'admin') {
            Toast.error('دسترسی', 'شما دسترسی به این بخش ندارید');
            this.navigate(user ? 'profile' : 'welcome');
            return;
        }
        
        // ذخیره مسیر
        Storage.setLastRoute(hash);
        this.currentRoute = hash;
        
        // دریافت صفحه
        const page = this.routes[hash]?.();
        if (!page) {
            this.navigate('welcome');
            return;
        }
        
        this.currentPage = page;
        
        // رندر
        await this.renderPage(page);
    },
    
    /**
     * رندر صفحه
     */
    async renderPage(page) {
        const main = document.getElementById('main-content');
        const app = document.getElementById('app');
        
        // نمایش لودینگ ملایم
        if (main) {
            main.style.opacity = '0.5';
            main.style.transition = 'opacity 0.2s ease';
        }
        
        // رندر نوار بالا
        Navbar.render();
        Sidebar.render();
        
        // رندر محتوا
        try {
            const content = page.render();
            if (content) {
                main.innerHTML = content;
            }
            
            // مقداردهی
            if (page.init) {
                await page.init();
            }
            
            // اسکرول بالا
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (error) {
            console.error('خطا در رندر صفحه:', error);
            main.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ri-error-warning-line"></i></div>
                    <h3 class="empty-state-title">خطا در بارگذاری صفحه</h3>
                    <p class="empty-state-text">متأسفانه خطایی رخ داد. لطفاً مجدداً تلاش کنید.</p>
                    <a href="#welcome" class="btn btn-primary" data-nav>
                        <i class="ri-home-line"></i>
                        <span>بازگشت به خانه</span>
                    </a>
                </div>
            `;
        } finally {
            if (main) {
                main.style.opacity = '1';
            }
        }
    },
    
    /**
     * ناوبری
     */
    navigate(route) {
        window.location.hash = route;
    },
    
    /**
     * رفرش
     */
    refresh() {
        this.handleRoute();
    }
};