/* ============================================
   کامپوننت نوار بالا
   ============================================ */

const Navbar = {
    el: null,
    
    /**
     * رندر
     */
    render() {
        this.el = document.getElementById('navbar');
        if (!this.el) return;
        
        const user = Storage.getUser();
        const isAuth = !!user;
        const isAdmin = user?.role === 'admin';
        const currentRoute = Router.currentRoute;
        
        // در صفحه خوش‌آمدگویی نوار مخفی
        if (!isAuth && (currentRoute === 'welcome' || currentRoute === 'auth')) {
            this.el.style.display = 'none';
            return;
        }
        
        this.el.style.display = 'flex';
        
        this.el.innerHTML = `
            <div class="navbar-inner">
                <div class="navbar-start">
                    ${isAdmin ? `
                        <button class="navbar-toggle" id="navbar-toggle" aria-label="منو">
                            <i class="ri-menu-line"></i>
                        </button>
                    ` : ''}
                    <a href="#welcome" class="navbar-brand" data-nav>
                        <div class="brand-icon">
                            <i class="ri-heart-2-fill"></i>
                        </div>
                        <div class="brand-text">
                            <span class="brand-title">شادباش ازدواج</span>
                            <span class="brand-subtitle">هدیه‌ای برای آغاز زیبا</span>
                        </div>
                    </a>
                </div>
                
                <nav class="navbar-nav">
                    ${isAuth ? `
                        <a href="#${isAdmin ? 'admin-dashboard' : 'profile'}" class="nav-link ${this.isActive(currentRoute, 'profile') || this.isActive(currentRoute, 'admin-dashboard') ? 'active' : ''}" data-nav>
                            <i class="ri-dashboard-line"></i>
                            <span>${isAdmin ? 'داشبورد' : 'پروفایل'}</span>
                        </a>
                        ${isAdmin ? `
                            <a href="#admin-participants" class="nav-link ${this.isActive(currentRoute, 'admin-participants') ? 'active' : ''}" data-nav>
                                <i class="ri-group-line"></i>
                                <span>مشارکت‌کنندگان</span>
                            </a>
                            <a href="#admin-reports" class="nav-link ${this.isActive(currentRoute, 'admin-reports') ? 'active' : ''}" data-nav>
                                <i class="ri-bar-chart-line"></i>
                                <span>گزارش‌ها</span>
                            </a>
                        ` : `
                            <a href="#coins" class="nav-link ${this.isActive(currentRoute, 'coins') ? 'active' : ''}" data-nav>
                                <i class="ri-coins-line"></i>
                                <span>خرید سکه</span>
                            </a>
                            <a href="#status" class="nav-link ${this.isActive(currentRoute, 'status') ? 'active' : ''}" data-nav>
                                <i class="ri-file-list-line"></i>
                                <span>وضعیت</span>
                            </a>
                        `}
                    ` : ''}
                </nav>
                
                <div class="navbar-end">
                    ${isAuth ? `
                        ${!isAdmin ? `
                            <a href="#coins" class="navbar-cta" data-nav>
                                <i class="ri-add-circle-line"></i>
                                <span>مشارکت</span>
                            </a>
                        ` : ''}
                        
                        <div class="navbar-user" id="navbar-user">
                            <button class="user-btn">
                                <div class="avatar avatar-sm" style="background: ${Helpers.randomColor()}">
                                    ${Helpers.getInitials(user.name)}
                                </div>
                                <div class="user-info">
                                    <span class="user-name">${Helpers.escapeHtml(user.name)}</span>
                                    <span class="user-role">${isAdmin ? 'مدیر' : Format.phone(user.phone)}</span>
                                </div>
                                <i class="ri-arrow-down-s-line"></i>
                            </button>
                            
                            <div class="user-menu" id="user-menu">
                                <div class="user-menu-header">
                                    <div class="avatar avatar-lg" style="background: ${Helpers.randomColor()}">
                                        ${Helpers.getInitials(user.name)}
                                    </div>
                                    <div>
                                        <div class="user-menu-name">${Helpers.escapeHtml(user.name)}</div>
                                        <div class="user-menu-phone">${Format.phone(user.phone)}</div>
                                    </div>
                                </div>
                                <div class="user-menu-body">
                                    ${!isAdmin ? `
                                        <a href="#profile" class="user-menu-item" data-nav>
                                            <i class="ri-user-line"></i>
                                            <span>پروفایل من</span>
                                        </a>
                                        <a href="#status" class="user-menu-item" data-nav>
                                            <i class="ri-file-list-line"></i>
                                            <span>وضعیت فیش‌ها</span>
                                        </a>
                                    ` : `
                                        <a href="#admin-dashboard" class="user-menu-item" data-nav>
                                            <i class="ri-dashboard-line"></i>
                                            <span>داشبورد</span>
                                        </a>
                                        <a href="#admin-settings" class="user-menu-item" data-nav>
                                            <i class="ri-settings-line"></i>
                                            <span>تنظیمات</span>
                                        </a>
                                    `}
                                    <div class="user-menu-divider"></div>
                                    <button class="user-menu-item danger" id="logout-btn">
                                        <i class="ri-logout-box-line"></i>
                                        <span>خروج</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <a href="#auth" class="btn btn-primary btn-sm" data-nav>
                            <i class="ri-login-box-line"></i>
                            <span>ورود</span>
                        </a>
                    `}
                </div>
            </div>
        `;
        
        this.attachEvents();
    },
    
    /**
     * بررسی فعال بودن لینک
     */
    isActive(current, target) {
        if (target === 'profile' && (current === 'profile' || current === 'status' || current === 'payment')) return true;
        if (target === 'admin-dashboard' && current?.startsWith('admin')) return true;
        return current === target;
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        // منوی کاربر
        const userBtn = this.el.querySelector('.user-btn');
        const userMenu = this.el.querySelector('#user-menu');
        
        if (userBtn && userMenu) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('show');
            });
            
            document.addEventListener('click', () => {
                userMenu.classList.remove('show');
            });
            
            userMenu.addEventListener('click', (e) => e.stopPropagation());
        }
        
        // منوی موبایل (ادمین)
        const toggle = this.el.querySelector('#navbar-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                Sidebar.toggle();
            });
        }
        
        // خروج
        const logoutBtn = this.el.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: 'خروج از حساب',
                    message: 'آیا از خروج از حساب خود مطمئن هستید؟',
                    confirmText: 'خروج',
                    type: 'danger'
                });
                
                if (confirmed) {
                    Toast.loading('در حال خروج...');
                    await AuthService.logout();
                    Toast.clear();
                    Toast.success('با موفقیت خارج شدید');
                    Router.navigate('welcome');
                }
            });
        }
    },
    
    /**
     * به‌روزرسانی
     */
    update() {
        this.render();
    }
};