/* ============================================
   صفحه پروفایل کاربر
   ============================================ */

const ProfilePage = {
    user: null,
    stats: null,
    
    render() {
        return `
            <div class="profile-page">
                <div class="page-header">
                    <div class="page-badge">
                        <i class="ri-user-3-line"></i>
                        <span>حساب کاربری</span>
                    </div>
                    <h1 class="page-title">پروفایل من</h1>
                </div>
                
                <div id="profile-content">
                    <div class="loading-state">
                        <div class="loader-coin"><i class="ri-coin-line"></i></div>
                        <p>در حال بارگذاری...</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init() {
        const user = Storage.getUser();
        if (!user) {
            Router.navigate('auth');
            return;
        }
        
        this.user = user;
        await this.loadProfile();
    },
    
    /**
     * بارگذاری
     */
    async loadProfile() {
        const container = document.getElementById('profile-content');
        
        const [fullProfile, stats] = await Promise.all([
            UserService.getFullProfile(this.user.id),
            CoinService.getUserStats(this.user.id)
        ]);
        
        this.stats = stats;
        
        this.renderContent(container, fullProfile.profile || this.user, stats);
    },
    
    /**
     * رندر
     */
    renderContent(container, profile, stats) {
        const color = Helpers.randomColor();
        
        container.innerHTML = `
            <!-- کارت پروفایل -->
            <div class="profile-hero">
                <div class="profile-hero-bg"></div>
                <div class="profile-hero-content">
                    <div class="profile-avatar-wrap">
                        <div class="profile-avatar" style="background: ${color}">
                            ${Helpers.getInitials(profile.name)}
                        </div>
                        <div class="profile-avatar-badge">
                            <i class="ri-verified-badge-fill"></i>
                        </div>
                    </div>
                    <div class="profile-info">
                        <h2 class="profile-name">${Helpers.escapeHtml(profile.name)}</h2>
                        <div class="profile-phone">
                            <i class="ri-smartphone-line"></i>
                            <span>${Format.phone(profile.phone)}</span>
                        </div>
                        <div class="profile-meta">
                            <div class="meta-item">
                                <i class="ri-calendar-line"></i>
                                <span>عضو از ${Format.date(profile.created_at)}</span>
                            </div>
                            <span class="badge badge-success">
                                <i class="ri-check-line"></i>
                                فعال
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-stats">
                    <div class="profile-stat">
                        <div class="profile-stat-value">${Format.number(stats.totalCoins)}</div>
                        <div class="profile-stat-label">سکه تایید شده</div>
                    </div>
                    <div class="profile-stat-divider"></div>
                    <div class="profile-stat">
                        <div class="profile-stat-value">${Format.number(stats.approvedCount)}</div>
                        <div class="profile-stat-label">تراکنش موفق</div>
                    </div>
                    <div class="profile-stat-divider"></div>
                    <div class="profile-stat">
                        <div class="profile-stat-value">${Format.number(stats.pendingCount)}</div>
                        <div class="profile-stat-label">در انتظار</div>
                    </div>
                </div>
            </div>
            
            <!-- اقدامات سریع -->
            <div class="profile-actions">
                <a href="#coins" class="action-tile" data-nav>
                    <div class="action-tile-icon action-tile-primary">
                        <i class="ri-add-circle-line"></i>
                    </div>
                    <div class="action-tile-content">
                        <strong>مشارکت جدید</strong>
                        <span>خرید سکه و مشارکت در طرح</span>
                    </div>
                    <i class="ri-arrow-left-s-line action-tile-arrow"></i>
                </a>
                
                <a href="#status" class="action-tile" data-nav>
                    <div class="action-tile-icon action-tile-gold">
                        <i class="ri-file-list-line"></i>
                    </div>
                    <div class="action-tile-content">
                        <strong>وضعیت تراکنش‌ها</strong>
                        <span>پیگیری فیش‌های ارسالی</span>
                    </div>
                    <i class="ri-arrow-left-s-line action-tile-arrow"></i>
                </a>
                
                <a href="#location" class="action-tile" data-nav>
                    <div class="action-tile-icon action-tile-success">
                        <i class="ri-map-pin-2-line"></i>
                    </div>
                    <div class="action-tile-content">
                        <strong>موقعیت مهمانی</strong>
                        <span>مشاهده مکان صبحانه</span>
                    </div>
                    <i class="ri-arrow-left-s-line action-tile-arrow"></i>
                </a>
                
                <button class="action-tile" id="edit-name-btn">
                    <div class="action-tile-icon action-tile-info">
                        <i class="ri-edit-line"></i>
                    </div>
                    <div class="action-tile-content">
                        <strong>ویرایش نام</strong>
                        <span>تغییر نام و نام خانوادگی</span>
                    </div>
                    <i class="ri-arrow-left-s-line action-tile-arrow"></i>
                </button>
            </div>
            
            <!-- آخرین تراکنش‌ها -->
            <div class="profile-section">
                <div class="section-title-bar">
                    <h3>آخرین تراکنش‌ها</h3>
                    <a href="#status" class="link-more" data-nav>
                        <span>مشاهده همه</span>
                        <i class="ri-arrow-left-s-line"></i>
                    </a>
                </div>
                <div id="profile-transactions">
                    ${this.renderRecentTransactions()}
                </div>
            </div>
            
            <!-- دکمه خروج -->
            <div class="profile-danger-zone">
                <button class="btn btn-outline danger" id="logout-profile-btn">
                    <i class="ri-logout-box-line"></i>
                    <span>خروج از حساب</span>
                </button>
            </div>
        `;
        
        this.attachEvents();
    },
    
    /**
     * تراکنش‌های اخیر
     */
    renderRecentTransactions() {
        // این اطلاعات از قبل در user.service بارگذاری شده
        // برای سادگی یک نسخه ساده نمایش می‌دهیم
        return `
            <div class="mini-transactions">
                <p class="mini-transactions-empty">
                    برای مشاهده کامل تراکنش‌ها به صفحه وضعیت بروید
                </p>
            </div>
        `;
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        // ویرایش نام
        document.getElementById('edit-name-btn')?.addEventListener('click', () => {
            this.showEditNameModal();
        });
        
        // خروج
        document.getElementById('logout-profile-btn')?.addEventListener('click', async () => {
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
    },
    
    /**
     * مودال ویرایش نام
     */
    showEditNameModal() {
        const content = `
            <div class="form-group">
                <label class="form-label required" for="edit-name">نام و نام خانوادگی</label>
                <input 
                    type="text" 
                    id="edit-name" 
                    class="form-input" 
                    value="${Helpers.escapeHtml(this.user.name)}"
                    maxlength="50"
                >
                <div class="form-hint">نام جدید را وارد کنید</div>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" data-cancel>انصراف</button>
            <button class="btn btn-primary" data-save>ذخیره تغییرات</button>
        `;
        
        const modal = Modal.show({
            title: 'ویرایش نام',
            content,
            footer,
            size: 'sm'
        });
        
        const input = modal.querySelector('#edit-name');
        input.focus();
        
        modal.querySelector('[data-cancel]').addEventListener('click', () => Modal.close());
        
        modal.querySelector('[data-save]').addEventListener('click', async () => {
            const newName = input.value.trim();
            const check = Validate.name(newName);
            
            if (!check.valid) {
                Validate.showError(input, check.message);
                return;
            }
            
            const btn = modal.querySelector('[data-save]');
            btn.classList.add('loading');
            btn.disabled = true;
            
            const result = await AuthService.updateName(newName);
            
            if (result.success) {
                this.user = result.profile;
                Toast.success('موفق', 'نام شما با موفقیت تغییر کرد');
                Modal.close();
                
                // رفرش محتوا
                await this.loadProfile();
            } else {
                Toast.error('خطا', result.error);
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        });
        
        // Enter برای ذخیره
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                modal.querySelector('[data-save]').click();
            }
        });
    }
};