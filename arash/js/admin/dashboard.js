/* ============================================
   داشبورد ادمین - شادباش ازدواج
   نسخه ۲.۰ - با جدول برترین‌ها
   ============================================ */

const AdminDashboard = {
    stats: null,
    chart: null,
    
    render() {
        return `
            <div class="admin-dashboard">
                <div class="dashboard-header">
                    <div>
                        <h1 class="dashboard-title">
                            <i class="ri-dashboard-3-line"></i>
                            <span>داشبورد مدیریت</span>
                        </h1>
                        <p class="dashboard-subtitle">نمای کلی از عملکرد و آمار سامانه شادباش ازدواج</p>
                    </div>
                    <div class="dashboard-header-actions">
                        <button class="btn btn-secondary btn-sm" id="refresh-btn">
                            <i class="ri-refresh-line"></i>
                            <span>بروزرسانی</span>
                        </button>
                        <button class="btn btn-primary btn-sm" id="export-btn">
                            <i class="ri-download-2-line"></i>
                            <span>خروجی گزارش</span>
                        </button>
                    </div>
                </div>
                
                <div id="dashboard-content">
                    <div class="loading-state">
                        <div class="loader-coin"><i class="ri-coin-line"></i></div>
                        <p>در حال بارگذاری آمار...</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init() {
        const isAdmin = await AuthService.isAdmin();
        if (!isAdmin) {
            Toast.error('دسترسی', 'شما دسترسی به این بخش ندارید');
            Router.navigate('welcome');
            return;
        }
        
        await this.loadDashboard();
        this.attachEvents();
    },
    
    /**
     * بارگذاری
     */
    async loadDashboard() {
        const container = document.getElementById('dashboard-content');
        
        const [statsResult, participantsResult, logsResult, leaderboardData] = await Promise.all([
            AdminService.getDashboardStats(),
            AdminService.getParticipants({ limit: 5 }),
            AdminService.getActivityLogs({ limit: 8 }),
            this.loadLeaderboardData()
        ]);
        
        if (!statsResult.success) {
            container.innerHTML = this.renderError(statsResult.error);
            return;
        }
        
        this.stats = statsResult.stats;
        
        container.innerHTML = this.renderDashboard(
            statsResult.stats,
            participantsResult.participants || [],
            logsResult.logs || [],
            leaderboardData
        );
        
        this.animateNumbers();
        this.renderLeaderboard(leaderboardData);
    },
    
    /**
     * دریافت داده‌های leaderboard از دیتابیس
     */
    async loadLeaderboardData() {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .select(`
                    coin_count,
                    user:user_id (name)
                `)
                .eq('status', 'approved')
                .order('coin_count', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            return (data || []).map(t => ({
                name: t.user?.name || 'کاربر',
                amount: t.coin_count * APP_CONFIG.COIN_PRICE
            }));
        } catch (error) {
            console.error('خطا در دریافت leaderboard:', error);
            return [];
        }
    },
    
    /**
     * رندر leaderboard
     */
    renderLeaderboard(data) {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <div class="card-header-title">
                            <i class="ri-trophy-line"></i>
                            <span>برترین‌های مشارکت</span>
                        </div>
                    </div>
                    <div class="dashboard-card-body">
                        <div class="empty-small">
                            <i class="ri-inbox-line"></i>
                            <p>هنوز مشارکت تایید شده‌ای وجود ندارد</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        Leaderboard.render('leaderboard-container', {
            title: 'برترین‌های مشارکت',
            subtitle: '۱۰ مشارکت‌کننده برتر بر اساس مبلغ',
            data: data
        });
    },
    
    /**
     * رندر داشبورد
     */
    renderDashboard(stats, participants, logs, leaderboardData) {
        return `
            <!-- کارت‌های آماری اصلی -->
            <div class="stats-cards">
                <div class="admin-stat-card stat-primary">
                    <div class="admin-stat-top">
                        <div class="admin-stat-icon">
                            <i class="ri-group-3-line"></i>
                        </div>
                        <div class="admin-stat-trend trend-up">
                            <i class="ri-arrow-up-line"></i>
                            <span>فعال</span>
                        </div>
                    </div>
                    <div class="admin-stat-value" data-count="${stats.totalUsers}">۰</div>
                    <div class="admin-stat-label">کاربران ثبت‌نام شده</div>
                    <div class="admin-stat-footer">
                        <i class="ri-user-add-line"></i>
                        <span>مشارکت‌کنندگان در طرح</span>
                    </div>
                </div>
                
                <div class="admin-stat-card stat-gold">
                    <div class="admin-stat-top">
                        <div class="admin-stat-icon">
                            <i class="ri-coins-line"></i>
                        </div>
                        <div class="admin-stat-trend trend-up">
                            <i class="ri-check-line"></i>
                            <span>تایید شده</span>
                        </div>
                    </div>
                    <div class="admin-stat-value" data-count="${stats.totalCoins}">۰</div>
                    <div class="admin-stat-label">مجموع سکه‌های تایید شده</div>
                    <div class="admin-stat-footer">
                        <i class="ri-money-dollar-circle-line"></i>
                        <span>${Format.price(stats.totalAmount)}</span>
                    </div>
                </div>
                
                <div class="admin-stat-card stat-warning">
                    <div class="admin-stat-top">
                        <div class="admin-stat-icon">
                            <i class="ri-time-line"></i>
                        </div>
                        <div class="admin-stat-trend trend-pending">
                            <i class="ri-hourglass-line"></i>
                            <span>در انتظار</span>
                        </div>
                    </div>
                    <div class="admin-stat-value" data-count="${stats.pendingTransactions}">۰</div>
                    <div class="admin-stat-label">فیش‌های در انتظار تایید</div>
                    <div class="admin-stat-footer">
                        <i class="ri-arrow-left-line"></i>
                        <a href="#admin-participants" data-nav>مشاهده و بررسی</a>
                    </div>
                </div>
                
                <div class="admin-stat-card stat-success">
                    <div class="admin-stat-top">
                        <div class="admin-stat-icon">
                            <i class="ri-bar-chart-2-line"></i>
                        </div>
                        <div class="admin-stat-trend trend-up">
                            <i class="ri-line-chart-line"></i>
                            <span>میانگین</span>
                        </div>
                    </div>
                    <div class="admin-stat-value" data-count="${stats.averageCoins}">۰</div>
                    <div class="admin-stat-label">میانگین سکه هر نفر</div>
                    <div class="admin-stat-footer">
                        <i class="ri-checkbox-circle-line"></i>
                        <span>${Format.number(stats.approvedTransactions)} تراکنش موفق</span>
                    </div>
                </div>
            </div>
            
            <!-- ✅ جدول برترین‌ها (فقط ادمین) -->
            <div class="dashboard-row-single" id="leaderboard-container">
                <!-- توسط renderLeaderboard پر می‌شود -->
            </div>
            
            <!-- ردیف دوم -->
            <div class="dashboard-row">
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <div class="card-header-title">
                            <i class="ri-pie-chart-2-line"></i>
                            <span>وضعیت تراکنش‌ها</span>
                        </div>
                        <a href="#admin-participants" class="card-header-action" data-nav>
                            <span>مشاهده همه</span>
                            <i class="ri-arrow-left-line"></i>
                        </a>
                    </div>
                    <div class="dashboard-card-body">
                        ${this.renderTransactionChart(stats)}
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <div class="card-header-title">
                            <i class="ri-user-line"></i>
                            <span>آخرین مشارکت‌کنندگان</span>
                        </div>
                        <a href="#admin-participants" class="card-header-action" data-nav>
                            <span>مشاهده همه</span>
                            <i class="ri-arrow-left-line"></i>
                        </a>
                    </div>
                    <div class="dashboard-card-body">
                        ${this.renderRecentParticipants(participants)}
                    </div>
                </div>
            </div>
            
            <!-- ردیف سوم -->
            <div class="dashboard-row">
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <div class="card-header-title">
                            <i class="ri-history-line"></i>
                            <span>لاگ فعالیت‌های اخیر</span>
                        </div>
                    </div>
                    <div class="dashboard-card-body">
                        ${this.renderActivityLogs(logs)}
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <div class="card-header-title">
                            <i class="ri-flashlight-line"></i>
                            <span>اقدامات سریع</span>
                        </div>
                    </div>
                    <div class="dashboard-card-body">
                        <div class="quick-actions-grid">
                            <a href="#admin-participants" class="quick-action-item" data-nav>
                                <div class="quick-action-icon quick-action-warning">
                                    <i class="ri-time-line"></i>
                                </div>
                                <div class="quick-action-content">
                                    <strong>بررسی فیش‌ها</strong>
                                    <span>${Format.number(stats.pendingTransactions)} مورد در انتظار</span>
                                </div>
                            </a>
                            
                            <a href="#admin-participants" class="quick-action-item" data-nav>
                                <div class="quick-action-icon quick-action-primary">
                                    <i class="ri-list-check-2"></i>
                                </div>
                                <div class="quick-action-content">
                                    <strong>مدیریت کاربران</strong>
                                    <span>${Format.number(stats.totalUsers)} کاربر فعال</span>
                                </div>
                            </a>
                            
                            <a href="#admin-reports" class="quick-action-item" data-nav>
                                <div class="quick-action-icon quick-action-success">
                                    <i class="ri-file-chart-line"></i>
                                </div>
                                <div class="quick-action-content">
                                    <strong>گزارش‌ها</strong>
                                    <span>خروجی Excel و PDF</span>
                                </div>
                            </a>
                            
                            <a href="#admin-settings" class="quick-action-item" data-nav>
                                <div class="quick-action-icon quick-action-info">
                                    <i class="ri-settings-3-line"></i>
                                </div>
                                <div class="quick-action-content">
                                    <strong>تنظیمات سیستم</strong>
                                    <span>قیمت، حدود، پیام‌ها</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * نمودار تراکنش‌ها
     */
    renderTransactionChart(stats) {
        const total = stats.approvedTransactions + stats.pendingTransactions + (stats.totalTransactions - stats.approvedTransactions - stats.pendingTransactions);
        const approvedPct = total > 0 ? Math.round((stats.approvedTransactions / total) * 100) : 0;
        const pendingPct = total > 0 ? Math.round((stats.pendingTransactions / total) * 100) : 0;
        const rejectedPct = 100 - approvedPct - pendingPct;
        
        return `
            <div class="transaction-chart">
                <div class="chart-donut-wrap">
                    <svg viewBox="0 0 36 36" class="chart-donut">
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="var(--color-gray-200)" stroke-width="3"></circle>
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" 
                            stroke="var(--color-success-500)" 
                            stroke-width="3"
                            stroke-dasharray="${approvedPct} ${100 - approvedPct}"
                            stroke-dashoffset="25"
                            stroke-linecap="round"></circle>
                        <circle cx="18" cy="18" r="15.9155" fill="transparent" 
                            stroke="var(--color-warning-500)" 
                            stroke-width="3"
                            stroke-dasharray="${pendingPct} ${100 - pendingPct}"
                            stroke-dashoffset="${25 - approvedPct}"
                            stroke-linecap="round"></circle>
                    </svg>
                    <div class="chart-donut-center">
                        <div class="chart-donut-value">${Format.number(total)}</div>
                        <div class="chart-donut-label">کل تراکنش</div>
                    </div>
                </div>
                
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-color" style="background: var(--color-success-500)"></div>
                        <div class="legend-info">
                            <span class="legend-label">تایید شده</span>
                            <strong>${Format.number(stats.approvedTransactions)} <small>(${Format.percent(approvedPct)})</small></strong>
                        </div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: var(--color-warning-500)"></div>
                        <div class="legend-info">
                            <span class="legend-label">در انتظار</span>
                            <strong>${Format.number(stats.pendingTransactions)} <small>(${Format.percent(pendingPct)})</small></strong>
                        </div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: var(--color-danger-500)"></div>
                        <div class="legend-info">
                            <span class="legend-label">رد شده</span>
                            <strong>${Format.number(total - stats.approvedTransactions - stats.pendingTransactions)} <small>(${Format.percent(rejectedPct)})</small></strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * مشارکت‌کنندگان اخیر
     */
    renderRecentParticipants(participants) {
        if (participants.length === 0) {
            return `
                <div class="empty-small">
                    <i class="ri-inbox-line"></i>
                    <p>هنوز مشارکتی ثبت نشده است</p>
                </div>
            `;
        }
        
        return `
            <div class="recent-participants">
                ${participants.map(p => {
                    const status = Format.status(p.status);
                    return `
                        <div class="recent-participant-item">
                            <div class="recent-participant-avatar" style="background: ${Helpers.randomColor()}">
                                ${Helpers.getInitials(p.user?.name || 'کاربر')}
                            </div>
                            <div class="recent-participant-info">
                                <strong>${Helpers.escapeHtml(p.user?.name || 'نامشخص')}</strong>
                                <span>${Format.phone(p.user?.phone || '')}</span>
                            </div>
                            <div class="recent-participant-meta">
                                <div class="recent-amount">${Format.coin(p.coin_count)}</div>
                                <span class="badge ${status.class}">${status.text}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    /**
     * لاگ فعالیت‌ها
     */
    renderActivityLogs(logs) {
        if (logs.length === 0) {
            return `
                <div class="empty-small">
                    <i class="ri-inbox-line"></i>
                    <p>فعالیتی ثبت نشده است</p>
                </div>
            `;
        }
        
        const actionMap = {
            'login': { icon: 'ri-login-box-line', color: 'info', text: 'ورود به سیستم' },
            'logout': { icon: 'ri-logout-box-line', color: 'gray', text: 'خروج از سیستم' },
            'transaction_created': { icon: 'ri-add-circle-line', color: 'primary', text: 'ثبت تراکنش جدید' },
            'transaction_approved': { icon: 'ri-check-line', color: 'success', text: 'تایید تراکنش' },
            'transaction_rejected': { icon: 'ri-close-line', color: 'danger', text: 'رد تراکنش' },
            'transaction_updated': { icon: 'ri-edit-line', color: 'warning', text: 'ویرایش تراکنش' },
            'transaction_deleted': { icon: 'ri-delete-bin-line', color: 'danger', text: 'حذف تراکنش' },
            'user_status_changed': { icon: 'ri-user-settings-line', color: 'warning', text: 'تغییر وضعیت کاربر' },
            'setting_updated': { icon: 'ri-settings-line', color: 'info', text: 'بروزرسانی تنظیمات' },
            'physical_coin_request': { icon: 'ri-hand-coin-line', color: 'primary', text: 'درخواست سکه فیزیکی' }
        };
        
        return `
            <div class="activity-logs">
                ${logs.map(log => {
                    const action = actionMap[log.action] || { icon: 'ri-record-circle-line', color: 'gray', text: log.action };
                    return `
                        <div class="log-item">
                            <div class="log-icon log-icon-${action.color}">
                                <i class="${action.icon}"></i>
                            </div>
                            <div class="log-content">
                                <div class="log-title">
                                    <strong>${action.text}</strong>
                                    ${log.user ? `<span class="log-user">توسط ${Helpers.escapeHtml(log.user.name)}</span>` : ''}
                                </div>
                                <div class="log-time">
                                    <i class="ri-time-line"></i>
                                    <span>${Format.timeAgo(log.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    /**
     * انیمیشن اعداد
     */
    animateNumbers() {
        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseInt(el.dataset.count);
            Helpers.animateNumber(el, 0, target, 1500);
        });
    },
    
    /**
     * خطا
     */
    renderError(message) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="ri-error-warning-line"></i>
                </div>
                <h3 class="empty-state-title">خطا در بارگذاری</h3>
                <p class="empty-state-text">${Helpers.escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="ri-refresh-line"></i>
                    <span>تلاش مجدد</span>
                </button>
            </div>
        `;
    },
    
    /**
     * رویدادها
     */
    attachEvents() {
        document.getElementById('refresh-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.classList.add('loading');
            btn.disabled = true;
            
            await this.loadDashboard();
            
            Toast.success('بروزرسانی', 'اطلاعات با موفقیت بروزرسانی شد');
            btn.classList.remove('loading');
            btn.disabled = false;
        });
        
        document.getElementById('export-btn')?.addEventListener('click', () => {
            Router.navigate('admin-reports');
        });
    }
};