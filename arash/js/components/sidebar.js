/* ============================================
   کامپوننت سایدبار (پنل ادمین)
   نسخه ۲.۰ - با بسته شدن با کلیک بیرون
   ============================================ */

const Sidebar = {
    el: null,
    overlay: null,
    isOpen: false,
    outsideClickHandler: null,
    
    /**
     * رندر
     */
    render() {
        this.el = document.getElementById('sidebar');
        if (!this.el) return;
        
        const user = Storage.getUser();
        const isAdmin = user?.role === 'admin';
        const currentRoute = Router.currentRoute;
        
        if (!isAdmin || !currentRoute?.startsWith('admin')) {
            this.el.style.display = 'none';
            document.getElementById('app')?.classList.remove('has-sidebar');
            this.close();
            return;
        }
        
        this.el.style.display = 'flex';
        document.getElementById('app')?.classList.add('has-sidebar');
        
        const menuItems = [
            { route: 'admin-dashboard', icon: 'ri-dashboard-line', label: 'داشبورد', badge: null },
            { route: 'admin-participants', icon: 'ri-group-line', label: 'مشارکت‌کنندگان', badge: 'pending' },
            { route: 'admin-reports', icon: 'ri-bar-chart-line', label: 'گزارش‌ها', badge: null },
            { route: 'admin-settings', icon: 'ri-settings-line', label: 'تنظیمات', badge: null }
        ];
        
        this.el.innerHTML = `
            <div class="sidebar-inner">
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <i class="ri-heart-2-fill"></i>
                    </div>
                    <div class="sidebar-brand">
                        <span>شادباش ازدواج</span>
                        <small>پنل مدیریت</small>
                    </div>
                    <button class="sidebar-close" id="sidebar-close" aria-label="بستن">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                
                <nav class="sidebar-nav">
                    <div class="sidebar-section">
                        <div class="sidebar-section-title">مدیریت</div>
                        ${menuItems.map(item => `
                            <a href="#${item.route}" class="sidebar-link ${currentRoute === item.route ? 'active' : ''}" data-nav>
                                <i class="${item.icon}"></i>
                                <span>${item.label}</span>
                                ${item.badge === 'pending' ? `
                                    <span class="sidebar-badge" id="sidebar-pending-badge">0</span>
                                ` : ''}
                            </a>
                        `).join('')}
                    </div>
                    
                    <div class="sidebar-section">
                        <div class="sidebar-section-title">سایر</div>
                        <a href="#welcome" class="sidebar-link" data-nav>
                            <i class="ri-home-line"></i>
                            <span>صفحه اصلی</span>
                        </a>
                        <button class="sidebar-link" id="sidebar-logout">
                            <i class="ri-logout-box-line"></i>
                            <span>خروج</span>
                        </button>
                    </div>
                </nav>
                
                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <div class="avatar avatar-sm" style="background: ${Helpers.randomColor()}">
                            ${Helpers.getInitials(user.name)}
                        </div>
                        <div class="sidebar-user-info">
                            <span class="sidebar-user-name">${Helpers.escapeHtml(user.name)}</span>
                            <span class="sidebar-user-role">مدیر سیستم</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.attachEvents();
        this.loadPendingCount();
    },
    
    /**
     * بارگذاری تعداد در انتظار
     */
    async loadPendingCount() {
        try {
            const result = await AdminService.getDashboardStats();
            if (result.success) {
                const badge = document.getElementById('sidebar-pending-badge');
                if (badge && result.stats.pendingTransactions > 0) {
                    badge.textContent = result.stats.pendingTransactions;
                    badge.style.display = 'inline-flex';
                } else if (badge) {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('خطا در بارگذاری تعداد:', error);
        }
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        const closeBtn = this.el.querySelector('#sidebar-close');
        const logoutBtn = this.el.querySelector('#sidebar-logout');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: 'خروج از حساب',
                    message: 'آیا از خروج مطمئن هستید؟',
                    confirmText: 'خروج',
                    type: 'danger'
                });
                
                if (confirmed) {
                    await AuthService.logout();
                    Toast.success('با موفقیت خارج شدید');
                    Router.navigate('welcome');
                }
            });
        }
        
        // بستن با کلیک روی لینک‌ها در موبایل
        this.el.querySelectorAll('[data-nav]').forEach(link => {
            link.addEventListener('click', () => {
                if (Helpers.isMobile()) {
                    this.close();
                }
            });
        });
    },
    
    /**
     * باز کردن
     */
    open() {
        if (!this.el) return;
        
        this.el.classList.add('open');
        document.body.classList.add('sidebar-open');
        this.isOpen = true;
        
        // ساخت overlay
        this.createOverlay();
        
        // اضافه کردن listener برای بستن با کلیک بیرون (بعد از تاخیر)
        setTimeout(() => {
            this.outsideClickHandler = (e) => {
                if (!this.el.contains(e.target) && !e.target.closest('.navbar-toggle')) {
                    this.close();
                }
            };
            document.addEventListener('click', this.outsideClickHandler, true);
            document.addEventListener('touchstart', this.outsideClickHandler, true);
        }, 50);
        
        // جلوگیری از اسکرول بادی
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * بستن
     */
    close() {
        if (!this.el) return;
        
        this.el.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        this.isOpen = false;
        
        // حذف overlay
        this.removeOverlay();
        
        // حذف listener
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler, true);
            document.removeEventListener('touchstart', this.outsideClickHandler, true);
            this.outsideClickHandler = null;
        }
        
        // برگرداندن اسکرول
        document.body.style.overflow = '';
    },
    
    /**
     * تغییر وضعیت
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },
    
    /**
     * ساخت overlay
     */
    createOverlay() {
        this.removeOverlay();
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay-global';
        this.overlay.setAttribute('aria-hidden', 'true');
        
        // کلیک روی overlay = بستن
        this.overlay.addEventListener('click', () => this.close());
        this.overlay.addEventListener('touchstart', () => this.close(), { passive: true });
        
        document.body.appendChild(this.overlay);
        
        // انیمیشن ورود
        requestAnimationFrame(() => {
            this.overlay.classList.add('show');
        });
    },
    
    /**
     * حذف overlay
     */
    removeOverlay() {
        if (this.overlay && this.overlay.parentElement) {
            this.overlay.classList.remove('show');
            const overlay = this.overlay;
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
            }, 250);
        }
        this.overlay = null;
    }
};