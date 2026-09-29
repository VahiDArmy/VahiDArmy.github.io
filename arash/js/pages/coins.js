/* ============================================
   صفحه انتخاب و خرید سکه
   نسخه ۶.۰ - با گزینه تحویل فیزیکی سکه
   ============================================ */

const CoinsPage = {
    selectedCoin: null,
    MAX_COINS: 20,
    
    render() {
        const user = Storage.getUser();
        const initialValue = 5;
        
        this.selectedCoin = {
            count: initialValue,
            price: initialValue * APP_CONFIG.COIN_PRICE
        };
        
        return `
            <div class="coins-page">
                <div class="page-header">
                    <div class="page-badge">
                        <i class="ri-sparkling-2-fill"></i>
                        <span>گام ۱ از ۳</span>
                    </div>
                    <h1 class="page-title">
                        <span>سلام</span>
                        <span class="text-gradient">${Helpers.escapeHtml(user?.name || 'کاربر عزیز')}</span>
                    </h1>
                    <p class="page-subtitle">
                        تعداد سکه‌های مشارکت خود را انتخاب کنید
                    </p>
                </div>
                
                <!-- محتوای اصلی -->
                <div class="coins-main-wrap">
                    
                    <!-- اسلایدر سکه -->
                    <div id="coin-slider-container"></div>
                    
                    <!-- خلاصه سفارش -->
                    <div class="order-summary-card" id="order-summary">
                        <div class="order-summary-header">
                            <i class="ri-shopping-bag-3-line"></i>
                            <span>خلاصه سفارش</span>
                        </div>
                        <div class="order-summary-body">
                            <div class="summary-row">
                                <span>تعداد سکه انتخابی:</span>
                                <strong id="summary-coins">${Format.number(initialValue)} سکه</strong>
                            </div>
                            <div class="summary-row">
                                <span>قیمت هر سکه:</span>
                                <strong>${Format.price(APP_CONFIG.COIN_PRICE)}</strong>
                            </div>
                            <div class="summary-row total">
                                <span>مبلغ قابل پرداخت:</span>
                                <strong id="summary-total">${Format.price(initialValue * APP_CONFIG.COIN_PRICE)}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <!-- گزینه تحویل فیزیکی -->
                    <button class="physical-coin-option" id="physical-coin-btn" type="button">
                        <div class="physical-coin-icon">
                            <i class="ri-hand-coin-line"></i>
                        </div>
                        <div class="physical-coin-content">
                            <div class="physical-coin-title">
                                <i class="ri-coins-fill"></i>
                                <span>تحویل فیزیکی سکه</span>
                            </div>
                        </div>
                        <i class="ri-arrow-left-s-line physical-coin-arrow"></i>
                    </button>
                    
                    <!-- نوار اقدام -->
                    <div class="action-bar" id="action-bar">
                        <a href="#welcome" class="btn btn-ghost" data-nav>
                            <i class="ri-arrow-right-line"></i>
                            <span>انصراف</span>
                        </a>
                        <button class="btn btn-gold btn-lg" id="continue-btn">
                            <span>ادامه و پرداخت</span>
                            <i class="ri-arrow-left-line"></i>
                        </button>
                    </div>
                    
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
                    </div>
                </div>
                
                <!-- کارت‌های اطلاعاتی -->
                <div class="coins-info-section">
                    <div class="info-cards-grid">
                        
                        <div class="info-card info-card-tips">
                            <div class="info-card-header">
                                <div class="info-card-icon info-icon-gold">
                                    <i class="ri-lightbulb-line"></i>
                                </div>
                                <h3>نکات مهم</h3>
                            </div>
                            <ul class="info-card-list">
                                <li>
                                    <i class="ri-checkbox-circle-fill"></i>
                                    <span>هر سکه معادل <strong>${Format.price(APP_CONFIG.COIN_PRICE)}</strong> است</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-fill"></i>
                                    <span>حداکثر <strong>${Format.number(this.MAX_COINS)} سکه</strong> (${Format.price(this.MAX_COINS * APP_CONFIG.COIN_PRICE)})</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-fill"></i>
                                    <span>بلافاصله پس از تایید فیش، سکه‌ها به حساب شما اضافه می‌شود</span>
                                </li>
                                <li>
                                    <i class="ri-checkbox-circle-fill"></i>
                                    <span>پشتیبانی ۲۴ ساعته آماده پاسخگویی است</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div class="info-card info-card-support">
                            <div class="info-card-header">
                                <div class="info-card-icon info-icon-primary">
                                    <i class="ri-customer-service-2-line"></i>
                                </div>
                                <h3>نیاز به کمک دارید؟</h3>
                            </div>
                            <p class="info-card-text">
                                در هر مرحله از فرایند، تیم پشتیبانی ما در کنار شماست
                            </p>
                            <button class="btn btn-outline btn-block" id="support-btn">
                                <i class="ri-phone-line"></i>
                                <span>تماس با پشتیبانی</span>
                            </button>
                        </div>
                        
                        <div class="info-card info-card-security">
                            <div class="info-card-header">
                                <div class="info-card-icon info-icon-success">
                                    <i class="ri-shield-check-line"></i>
                                </div>
                                <h3>پرداخت امن</h3>
                            </div>
                            <div class="security-list">
                                <div class="security-item">
                                    <i class="ri-shield-check-fill"></i>
                                    <span>پرداخت امن</span>
                                </div>
                                <div class="security-item">
                                    <i class="ri-lock-2-fill"></i>
                                    <span>رمزنگاری SSL</span>
                                </div>
                                <div class="security-item">
                                    <i class="ri-verified-badge-fill"></i>
                                    <span>تایید شده</span>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
        `;
    },
    
    init() {
        CoinSlider.render('coin-slider-container', {
            min: 1,
            max: this.MAX_COINS,
            defaultValue: 5,
            quickValues: [1, 2, 5, 10, 15, 20],
            pricePerCoin: APP_CONFIG.COIN_PRICE,
            onChange: (data) => {
                this.selectedCoin = data;
                this.updateSummary(data);
            }
        });
        
        document.getElementById('continue-btn')?.addEventListener('click', () => {
            this.handleContinue();
        });
        
        document.getElementById('physical-coin-btn')?.addEventListener('click', () => {
            this.showPhysicalCoinModal();
        });
        
        document.getElementById('support-btn')?.addEventListener('click', () => {
            Modal.alert({
                title: 'پشتیبانی',
                message: 'برای ارتباط با پشتیبانی می‌توانید با شماره ۰۲۱-۱۲۳۴۵۶۷۸ تماس بگیرید.',
                buttonText: 'متوجه شدم',
                type: 'info'
            });
        });
        
        this.updateSummary(this.selectedCoin);
    },
    
    updateSummary(data) {
        const summaryCoins = document.getElementById('summary-coins');
        const summaryTotal = document.getElementById('summary-total');
        
        if (summaryCoins) summaryCoins.textContent = Format.coin(data.count);
        if (summaryTotal) {
            summaryTotal.textContent = Format.price(data.price);
            summaryTotal.style.color = 'var(--color-gold-600)';
        }
    },
    
    /**
     * مودال تحویل فیزیکی - ساده و بدون توضیح اضافه
     */
    showPhysicalCoinModal() {
        const user = Storage.getUser();
        
        const content = `
            <div class="physical-modal-simple">
                <div class="physical-modal-icon-simple">
                    <i class="ri-hand-coin-line"></i>
                </div>
                
                <div class="physical-modal-info-simple">
                    <div class="pmi-row">
                        <i class="ri-user-line"></i>
                        <span>${Helpers.escapeHtml(user?.name || '')}</span>
                    </div>
                    <div class="pmi-row">
                        <i class="ri-smartphone-line"></i>
                        <span style="direction: ltr; display: inline-block;">${Format.phone(user?.phone || '')}</span>
                    </div>
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" data-cancel>
                <span>انصراف</span>
            </button>
            <button class="btn btn-gold" data-confirm>
                <i class="ri-check-line"></i>
                <span>تایید درخواست</span>
            </button>
        `;
        
        const modal = Modal.show({
            title: 'تحویل فیزیکی سکه',
            content,
            footer,
            size: 'sm'
        });
        
        modal.querySelector('[data-cancel]').addEventListener('click', () => Modal.close());
        
        modal.querySelector('[data-confirm]').addEventListener('click', async () => {
            await this.submitPhysicalCoinRequest(modal);
        });
    },
    
    /**
     * ثبت درخواست
     */
    async submitPhysicalCoinRequest(modal) {
        const user = Storage.getUser();
        if (!user?.id) {
            Toast.error('خطا', 'لطفاً مجدداً وارد شوید');
            return;
        }
        
        const confirmBtn = modal.querySelector('[data-confirm]');
        confirmBtn.classList.add('loading');
        confirmBtn.disabled = true;
        
        try {
            await supabaseClient
                .from('activity_logs')
                .insert({
                    user_id: user.id,
                    action: 'physical_coin_request',
                    details: {
                        phone: user.phone,
                        name: user.name,
                        requested_at: new Date().toISOString()
                    },
                    user_agent: navigator.userAgent
                });
            
            Modal.close();
            this.showPhysicalSuccess();
            
        } catch (error) {
            console.error('خطا در ثبت درخواست:', error);
            Toast.error('خطا', 'خطا در ثبت درخواست');
            confirmBtn.classList.remove('loading');
            confirmBtn.disabled = false;
        }
    },
    
    /**
     * پیام موفقیت - ساده
     */
    showPhysicalSuccess() {
        const user = Storage.getUser();
        
        Modal.show({
            title: '',
            content: `
                <div class="physical-success-simple">
                    <div class="pss-icon">
                        <i class="ri-check-line"></i>
                    </div>
                    <div class="pss-phone">
                        <i class="ri-smartphone-line"></i>
                        <span style="direction: ltr; display: inline-block;">${Format.phone(user?.phone || '')}</span>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-primary btn-block" id="pss-ok">
                    <span>متوجه شدم</span>
                </button>
            `,
            size: 'sm',
            closable: false
        });
        
        document.getElementById('pss-ok')?.addEventListener('click', () => Modal.close());
    },
    
    async handleContinue() {
        if (!this.selectedCoin || !this.selectedCoin.count) {
            Toast.warning('خطا', 'لطفاً تعداد سکه‌های خود را انتخاب کنید');
            return;
        }
        
        const coinData = {
            id: 'custom',
            count: this.selectedCoin.count,
            price: this.selectedCoin.price,
            title: this.getTitleForCount(this.selectedCoin.count),
            subtitle: 'پکیج سفارشی',
            icon: 'ri-coins-line',
            color: '#F59E0B',
            gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
            features: ['ثبت نام در طرح', 'دعوت به صبحانه', 'یادگاری از ازدواج']
        };
        
        Storage.setTemp('selected_coin', coinData);
        Router.navigate('payment');
    },
    
    getTitleForCount(count) {
        if (count === 1) return 'هدیه کوچک';
        if (count <= 3) return 'هدیه صمیمانه';
        if (count <= 7) return 'هدیه درخشان';
        if (count <= 12) return 'هدیه نفیس';
        if (count <= 18) return 'هدیه استثنایی';
        return 'هدیه افسانه‌ای';
    }
};