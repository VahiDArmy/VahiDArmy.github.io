/* ============================================
   صفحه انتخاب و خرید سکه
   ============================================ */

const CoinsPage = {
    selectedCoin: null,
    
    render() {
        const user = Storage.getUser();
        
        return `
            <div class="coins-page">
                <div class="page-header">
                    <div class="page-header-content">
                        <div class="page-badge">
                            <i class="ri-sparkling-2-fill"></i>
                            <span>گام ۱ از ۳</span>
                        </div>
                        <h1 class="page-title">
                            <span>سلام</span>
                            <span class="text-gradient">${Helpers.escapeHtml(user?.name || 'کاربر عزیز')}</span>
                        </h1>
                        <p class="page-subtitle">
                            تعداد سکه‌های مشارکت خود را انتخاب کنید و در این شادی سهیم شوید
                        </p>
                    </div>
                </div>
                
                <div class="coins-layout">
                    <div class="coins-main">
                        <!-- اسلایدر سکه -->
                        <div id="coin-slider-container"></div>
                        
                        <!-- اطلاعات کاربر -->
                        <div class="user-info-card">
                            <div class="user-info-header">
                                <i class="ri-user-line"></i>
                                <span>اطلاعات شما</span>
                                <span class="badge badge-success">
                                    <i class="ri-check-line"></i>
                                    تایید شده
                                </span>
                            </div>
                            <div class="user-info-body">
                                <div class="info-item">
                                    <div class="info-label">نام</div>
                                    <div class="info-value">${Helpers.escapeHtml(user?.name || '')}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">شماره موبایل</div>
                                    <div class="info-value" style="direction: ltr; text-align: right;">${Format.phone(user?.phone || '')}</div>
                                </div>
                            </div>
                            <div class="user-info-hint">
                                <i class="ri-information-line"></i>
                                <span>اطلاعات شما از قبل ثبت شده است</span>
                            </div>
                        </div>
                        
                        <!-- خلاصه سفارش -->
                        <div class="order-summary-card" id="order-summary">
                            <div class="order-summary-header">
                                <i class="ri-shopping-bag-3-line"></i>
                                <span>خلاصه سفارش</span>
                            </div>
                            <div class="order-summary-body">
                                <div class="summary-row">
                                    <span>تعداد سکه انتخابی:</span>
                                    <strong id="summary-coins">—</strong>
                                </div>
                                <div class="summary-row">
                                    <span>قیمت هر سکه:</span>
                                    <strong>${Format.price(APP_CONFIG.COIN_PRICE)}</strong>
                                </div>
                                <div class="summary-row total">
                                    <span>مبلغ قابل پرداخت:</span>
                                    <strong id="summary-total">—</strong>
                                </div>
                            </div>
                        </div>
                        
                        <!-- دکمه ادامه -->
                        <div class="action-bar">
                            <a href="#welcome" class="btn btn-ghost" data-nav>
                                <i class="ri-arrow-right-line"></i>
                                <span>انصراف</span>
                            </a>
                            <button class="btn btn-gold btn-lg" id="continue-btn" disabled>
                                <span>ادامه و پرداخت</span>
                                <i class="ri-arrow-left-line"></i>
                            </button>
                        </div>
                    </div>
                    
                    <aside class="coins-sidebar">
                        <div class="sidebar-card tips-card">
                            <div class="sidebar-card-header">
                                <i class="ri-lightbulb-line"></i>
                                <span>نکات مهم</span>
                            </div>
                            <ul class="tips-list">
                                <li>
                                    <i class="ri-checkbox-circle-line"></i>
                                    <span>هر سکه معادل ۱۰۰,۰۰۰ تومان است</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-line"></i>
                                    <span>بلافاصله پس از تایید فیش، سکه‌ها به حساب شما اضافه می‌شود</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-line"></i>
                                    <span>می‌توانید فیش واریزی خود را به دو صورت آپلود یا وارد کنید</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-line"></i>
                                    <span>پشتیبانی ۲۴ ساعته آماده پاسخگویی است</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div class="sidebar-card support-card">
                            <div class="sidebar-card-header">
                                <i class="ri-customer-service-2-line"></i>
                                <span>نیاز به کمک دارید؟</span>
                            </div>
                            <p>در هر مرحله از فرایند، تیم پشتیبانی ما در کنار شماست</p>
                            <button class="btn btn-outline btn-sm btn-block" id="support-btn">
                                <i class="ri-phone-line"></i>
                                <span>تماس با پشتیبانی</span>
                            </button>
                        </div>
                        
                        <div class="sidebar-card security-card">
                            <div class="security-badges">
                                <div class="security-badge">
                                    <i class="ri-shield-check-fill"></i>
                                    <span>پرداخت امن</span>
                                </div>
                                <div class="security-badge">
                                    <i class="ri-lock-2-fill"></i>
                                    <span>رمزنگاری SSL</span>
                                </div>
                                <div class="security-badge">
                                    <i class="ri-verified-badge-fill"></i>
                                    <span>تایید شده</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        `;
    },
    
    init() {
        // رندر اسلایدر
        CoinSlider.render('coin-slider-container', {
            defaultIndex: 2,
            onChange: (coin) => {
                this.selectedCoin = coin;
                this.updateSummary(coin);
            }
        });
        
        // دکمه ادامه
        document.getElementById('continue-btn').addEventListener('click', () => {
            this.handleContinue();
        });
        
        // پشتیبانی
        document.getElementById('support-btn')?.addEventListener('click', () => {
            Modal.alert({
                title: 'پشتیبانی',
                message: 'برای ارتباط با پشتیبانی می‌توانید با شماره ۰۲۱-۱۲۳۴۵۶۷۸ تماس بگیرید یا در ساعات کاری از طریق چت آنلاین در خدمت شما هستیم.',
                buttonText: 'متوجه شدم',
                type: 'info'
            });
        });
    },
    
    /**
     * به‌روزرسانی خلاصه سفارش
     */
    updateSummary(coin) {
        const summaryCoins = document.getElementById('summary-coins');
        const summaryTotal = document.getElementById('summary-total');
        const continueBtn = document.getElementById('continue-btn');
        
        if (coin) {
            summaryCoins.textContent = Format.coin(coin.count);
            summaryTotal.textContent = Format.price(coin.price);
            summaryTotal.style.color = 'var(--color-gold-600)';
            continueBtn.disabled = false;
        }
    },
    
    /**
     * ادامه
     */
    async handleContinue() {
        if (!this.selectedCoin) {
            Toast.warning('خطا', 'لطفاً تعداد سکه‌های خود را انتخاب کنید');
            return;
        }
        
        // ذخیره انتخاب در session
        Storage.setTemp('selected_coin', this.selectedCoin);
        
        // رفتن به صفحه پرداخت
        Router.navigate('payment');
    }
};