/* ============================================
   روتر SPA - نسخه ۲.۰
   با ریدایرکت خودکار کاربران احراز شده
   ============================================ */

const Router = {
    currentRoute: null,
    currentPage: null,
    
    // مسیرهای عمومی (بدون نیاز به ورود)
    publicRoutes: ['welcome', 'auth'],
    
    // مسیرهای محافظت‌شده
    protectedRoutes: [
        'coins', 'payment', 'status', 'location', 'profile',
        'admin-dashboard', 'admin-participants', 
        'admin-settings', 'admin-reports'
    ],
    
    // مسیرهای ادمین
    adminRoutes: [
        'admin-dashboard', 'admin-participants', 
        'admin-settings', 'admin-reports'
    ],
    
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
        
        // بررسی احراز هویت
        const user = Storage.getUser();
        const isAuthenticated = !!user;
        const isAdmin = user?.role === 'admin';
        
        // ═══════════════════════════════════════════
        // قانون ۱: کاربر احراز شده نباید welcome یا auth ببیند
        // ═══════════════════════════════════════════
        if (isAuthenticated && (hash === 'welcome' || hash === 'auth')) {
            // ادمین → داشبورد
            if (isAdmin) {
                this.navigate('admin-dashboard');
                return;
            }
            
            // کاربر عادی → بررسی تراکنش‌ها
            // اگر تراکنشی دارد → status، وگرنه → coins
            try {
                const latestTx = await PaymentService.getLatestTransaction(user.id);
                if (latestTx) {
                    this.navigate('status');
                } else {
                    this.navigate('coins');
                }
            } catch (error) {
                this.navigate('coins');
            }
            return;
        }
        
        // ═══════════════════════════════════════════
        // قانون ۲: کاربر احراز نشده نباید به صفحات محافظت‌شده برود
        // ═══════════════════════════════════════════
        if (!isAuthenticated && this.protectedRoutes.includes(hash)) {
            this.navigate('welcome');
            return;
        }
        
        // ═══════════════════════════════════════════
        // قانون ۳: بررسی دسترسی ادمین
        // ═══════════════════════════════════════════
        if (this.adminRoutes.includes(hash) && !isAdmin) {
            Toast.error('دسترسی', 'شما دسترسی به این بخش ندارید');
            this.navigate(isAuthenticated ? 'profile' : 'welcome');
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
        
        if (main) {
            main.style.opacity = '0.5';
            main.style.transition = 'opacity 0.2s ease';
        }
        
        Navbar.render();
        Sidebar.render();
        
        try {
            const content = page.render();
            if (content) {
                main.innerHTML = content;
            }
            
            if (page.init) {
                await page.init();
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (error) {
            console.error('خطا در رندر صفحه:', error);
            main.innerHTML = `
                <div class="empty-state" style="min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
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
        if (window.location.hash === `#${route}`) {
            // اگر همان مسیر است، دوباره رندر کن
            this.handleRoute();
        } else {
            window.location.hash = route;
        }
    },
    
    /**
     * رفرش
     */
    refresh() {
        this.handleRoute();
    }
};