/* ============================================
   صفحه وضعیت تراکنش‌ها
   نسخه ۳.۰ - فقط کاربر عادی (بدون leaderboard)
   ============================================ */

const StatusPage = {
    transactions: [],
    
    render() {
        return `
            <div class="status-page">
                <div class="page-header">
                    <div class="page-badge">
                        <i class="ri-file-list-line"></i>
                        <span>پیگیری</span>
                    </div>
                    <h1 class="page-title">وضعیت مشارکت‌های شما</h1>
                    <p class="page-subtitle">تمام تراکنش‌ها و فیش‌های ارسالی خود را اینجا ببینید</p>
                </div>
                
                <div id="status-content">
                    <div class="loading-state">
                        <div class="loader-coin">
                            <i class="ri-coin-line"></i>
                        </div>
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
        
        await this.loadTransactions(user.id);
    },
    
    /**
     * بارگذاری تراکنش‌ها
     */
    async loadTransactions(userId) {
        const container = document.getElementById('status-content');
        
        const [stats, transactionsResult] = await Promise.all([
            CoinService.getUserStats(userId),
            PaymentService.getUserTransactions(userId)
        ]);
        
        this.transactions = transactionsResult.transactions || [];
        
        this.renderContent(container, stats, this.transactions);
    },
    
    /**
     * رندر محتوا
     */
    renderContent(container, stats, transactions) {
        const user = Storage.getUser();
        
        container.innerHTML = `
            <!-- کارت‌های آمار -->
            <div class="status-stats">
                <div class="status-stat-card">
                    <div class="status-stat-icon status-icon-gold">
                        <i class="ri-coins-line"></i>
                    </div>
                    <div class="status-stat-content">
                        <div class="status-stat-label">سکه‌های تایید شده</div>
                        <div class="status-stat-value">${Format.coin(stats.totalCoins)}</div>
                    </div>
                </div>
                
                <div class="status-stat-card">
                    <div class="status-stat-icon status-icon-warning">
                        <i class="ri-time-line"></i>
                    </div>
                    <div class="status-stat-content">
                        <div class="status-stat-label">در انتظار تایید</div>
                        <div class="status-stat-value">${Format.number(stats.pendingCount)} مورد</div>
                    </div>
                </div>
                
                <div class="status-stat-card">
                    <div class="status-stat-icon status-icon-success">
                        <i class="ri-checkbox-circle-line"></i>
                    </div>
                    <div class="status-stat-content">
                        <div class="status-stat-label">تایید شده</div>
                        <div class="status-stat-value">${Format.number(stats.approvedCount)} مورد</div>
                    </div>
                </div>
                
                <div class="status-stat-card">
                    <div class="status-stat-icon status-icon-primary">
                        <i class="ri-money-dollar-circle-line"></i>
                    </div>
                    <div class="status-stat-content">
                        <div class="status-stat-label">مجموع مبلغ</div>
                        <div class="status-stat-value">${Format.price(stats.totalAmount)}</div>
                    </div>
                </div>
            </div>
            
            <!-- دکمه مشارکت جدید -->
            <div class="status-cta">
                <div class="status-cta-content">
                    <i class="ri-add-circle-line"></i>
                    <div>
                        <strong>مشارکت بیشتر</strong>
                        <span>می‌خواهید سکه بیشتری خریداری کنید؟</span>
                    </div>
                </div>
                <a href="#coins" class="btn btn-gold" data-nav>
                    <i class="ri-arrow-left-line"></i>
                    <span>مشارکت جدید</span>
                </a>
            </div>
            
            <!-- لیست تراکنش‌ها -->
            <div class="transactions-section">
                <div class="section-title-bar">
                    <h2>تاریخچه تراکنش‌ها</h2>
                    <span class="badge badge-primary">${Format.number(transactions.length)} مورد</span>
                </div>
                
                <div id="transactions-list">
                    ${transactions.length > 0 ? transactions.map(tx => this.renderTransactionItem(tx)).join('') : this.renderEmptyState()}
                </div>
            </div>
            
            <!-- اگر تایید شده داریم، کارت نقشه -->
            ${stats.approvedCount > 0 ? this.renderMapCard() : ''}
        `;
        
        this.attachEvents();
    },
    
    /**
     * رندر آیتم تراکنش
     */
    renderTransactionItem(tx) {
        const status = Format.status(tx.status);
        
        return `
            <div class="transaction-item" data-id="${tx.id}">
                <div class="transaction-status-bar ${tx.status}"></div>
                <div class="transaction-icon ${tx.status}">
                    <i class="${status.icon}"></i>
                </div>
                <div class="transaction-content">
                    <div class="transaction-header">
                        <div class="transaction-title">
                            <strong>${Format.coin(tx.coin_count)}</strong>
                            <span class="transaction-date">${Format.timeAgo(tx.created_at)}</span>
                        </div>
                        <span class="badge ${status.class}">
                            ${status.text}
                        </span>
                    </div>
                    <div class="transaction-details">
                        <div class="detail-item">
                            <i class="ri-money-dollar-circle-line"></i>
                            <span>${Format.price(tx.amount)}</span>
                        </div>
                        <div class="detail-item">
                            <i class="ri-calendar-line"></i>
                            <span>${Format.date(tx.created_at)}</span>
                        </div>
                        <div class="detail-item">
                            <i class="ri-hashtag"></i>
                            <span>${Format.transactionId(tx.id.substring(0, 6))}</span>
                        </div>
                    </div>
                    ${tx.admin_note ? `
                        <div class="transaction-note">
                            <i class="ri-message-line"></i>
                            <span>${Helpers.escapeHtml(tx.admin_note)}</span>
                        </div>
                    ` : ''}
                </div>
                <button class="transaction-view-btn" data-view="${tx.id}" title="مشاهده جزئیات">
                    <i class="ri-arrow-left-s-line"></i>
                </button>
            </div>
        `;
    },
    
    /**
     * رندر حالت خالی
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="ri-file-search-line"></i>
                </div>
                <h3 class="empty-state-title">هنوز تراکنشی ندارید</h3>
                <p class="empty-state-text">اولین مشارکت خود را شروع کنید و بخشی از این شادی باشید</p>
                <a href="#coins" class="btn btn-gold" data-nav>
                    <i class="ri-add-line"></i>
                    <span>شروع مشارکت</span>
                </a>
            </div>
        `;
    },
    
    /**
     * کارت نقشه
     */
    renderMapCard() {
        return `
            <div class="status-map-card">
                <div class="status-map-header">
                    <div class="status-map-icon">
                        <i class="ri-map-pin-2-fill"></i>
                    </div>
                    <div>
                        <h3>دعوت به صبحانه 🍳</h3>
                        <p>از شما دعوت می‌کنیم در مهمانی صبحانه ما شرکت کنید</p>
                    </div>
                </div>
                <div class="status-map-preview">
                    <img src="${APP_CONFIG.MAP_IMAGE}" alt="نقشه موقعیت" onerror="this.style.display='none'">
                    <div class="map-overlay">
                        <i class="ri-map-pin-2-fill"></i>
                        <span>موقعیت ما</span>
                    </div>
                </div>
                <div class="status-map-actions">
                    <a href="#location" class="btn btn-primary btn-block" data-nav>
                        <i class="ri-road-map-line"></i>
                        <span>مشاهده موقعیت</span>
                    </a>
                </div>
            </div>
        `;
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.view;
                this.showTransactionDetails(id);
            });
        });
    },
    
    /**
     * نمایش جزئیات تراکنش
     */
    async showTransactionDetails(id) {
        const tx = this.transactions.find(t => t.id === id);
        if (!tx) return;
        
        const status = Format.status(tx.status);
        
        let receiptHtml = '';
        if (tx.receipt_url) {
            const url = await PaymentService.getReceiptUrl(tx.receipt_url);
            if (url) {
                receiptHtml = `
                    <div class="detail-section">
                        <h4>فیش آپلود شده</h4>
                        <div class="receipt-preview">
                            <img src="${url}" alt="فیش" onclick="window.open('${url}', '_blank')">
                        </div>
                    </div>
                `;
            }
        } else if (tx.receipt_text) {
            receiptHtml = `
                <div class="detail-section">
                    <h4>متن فیش</h4>
                    <div class="receipt-text">${Helpers.escapeHtml(tx.receipt_text)}</div>
                </div>
            `;
        }
        
        const content = `
            <div class="transaction-detail-modal">
                <div class="detail-status-bar ${tx.status}">
                    <div class="detail-status-icon">
                        <i class="${status.icon}"></i>
                    </div>
                    <div>
                        <div class="detail-status-title">${status.text}</div>
                        <div class="detail-status-subtitle">${Format.dateTime(tx.created_at)}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>اطلاعات تراکنش</h4>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span>شناسه تراکنش</span>
                            <strong>${Format.transactionId(tx.id.substring(0, 8))}</strong>
                        </div>
                        <div class="detail-row">
                            <span>تعداد سکه</span>
                            <strong>${Format.coin(tx.coin_count)}</strong>
                        </div>
                        <div class="detail-row">
                            <span>مبلغ</span>
                            <strong>${Format.price(tx.amount)}</strong>
                        </div>
                        <div class="detail-row">
                            <span>تاریخ ثبت</span>
                            <strong>${Format.dateTime(tx.created_at)}</strong>
                        </div>
                        ${tx.reviewed_at ? `
                            <div class="detail-row">
                                <span>تاریخ بررسی</span>
                                <strong>${Format.dateTime(tx.reviewed_at)}</strong>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${tx.admin_note ? `
                    <div class="detail-section">
                        <h4>یادداشت ادمین</h4>
                        <div class="admin-note">
                            <i class="ri-message-line"></i>
                            <span>${Helpers.escapeHtml(tx.admin_note)}</span>
                        </div>
                    </div>
                ` : ''}
                
                ${receiptHtml}
            </div>
        `;
        
        Modal.show({
            title: 'جزئیات تراکنش',
            content,
            size: 'md'
        });
    }
};