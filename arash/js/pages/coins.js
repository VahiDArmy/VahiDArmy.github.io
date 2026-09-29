/* ============================================
   صفحه انتخاب و خرید سکه
   نسخه ۵.۰ - با گزینه دریافت سکه فیزیکی
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
                    
                    <!-- گزینه دریافت سکه فیزیکی -->
                    <div class="physical-coin-option" id="physical-coin-option">
                        <div class="physical-coin-icon">
                            <i class="ri-hand-coin-line"></i>
                        </div>
                        <div class="physical-coin-content">
                            <div class="physical-coin-title">
                                <span>ترجیح می‌دهید سکه فیزیکی دریافت کنید؟</span>
                                <span class="physical-coin-badge">جدید</span>
                            </div>
                            <p class="physical-coin-desc">
                                اگر به هر دلیلی امکان مشارکت آنلاین را ندارید، می‌توانید سکه فیزیکی دریافت کنید.
                            </p>
                        </div>
                        <button class="physical-coin-btn" id="physical-coin-btn" type="button">
                            <i class="ri-arrow-left-s-line"></i>
                            <span>مشاهده</span>
                        </button>
                    </div>
                    
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
        // اسلایدر سکه
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
        
        // دکمه ادامه
        document.getElementById('continue-btn')?.addEventListener('click', () => {
            this.handleContinue();
        });
        
        // گزینه سکه فیزیکی
        document.getElementById('physical-coin-btn')?.addEventListener('click', () => {
            this.showPhysicalCoinModal();
        });
        
        // پشتیبانی
        document.getElementById('support-btn')?.addEventListener('click', () => {
            Modal.alert({
                title: 'پشتیبانی',
                message: 'برای ارتباط با پشتیبانی می‌توانید با شماره ۰۲۱-۱۲۳۴۵۶۷۸ تماس بگیرید یا از طریق چت آنلاین در خدمت شما هستیم.',
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
     * نمایش مودال سکه فیزیکی
     */
    showPhysicalCoinModal() {
        const user = Storage.getUser();
        
        const content = `
            <div class="physical-modal-content">
                <div class="physical-modal-hero">
                    <div class="physical-modal-icon">
                        <i class="ri-hand-coin-line"></i>
                    </div>
                    <h3>دریافت سکه فیزیکی</h3>
                    <p>اگر تمایل دارید به جای مشارکت آنلاین، سکه فیزیکی تهیه کنید، این گزینه را انتخاب نمایید</p>
                </div>
                
                <div class="physical-modal-info">
                    <div class="physical-info-item">
                        <div class="physical-info-icon physical-info-icon-pink">
                            <i class="ri-map-pin-2-line"></i>
                        </div>
                        <div class="physical-info-text">
                            <strong>تحویل حضوری</strong>
                            <span>سکه در محل مشخص شده به شما تحویل داده می‌شود</span>
                        </div>
                    </div>
                    
                    <div class="physical-info-item">
                        <div class="physical-info-icon physical-info-icon-gold">
                            <i class="ri-money-dollar-circle-line"></i>
                        </div>
                        <div class="physical-info-text">
                            <strong>پرداخت در محل</strong>
                            <span>مبلغ را هنگام تحویل، حضوری پرداخت می‌کنید</span>
                        </div>
                    </div>
                    
                    <div class="physical-info-item">
                        <div class="physical-info-icon physical-info-icon-green">
                            <i class="ri-phone-line"></i>
                        </div>
                        <div class="physical-info-text">
                            <strong>هماهنگی تلفنی</strong>
                            <span>برای هماهنگی زمان و مکان با شما تماس گرفته می‌شود</span>
                        </div>
                    </div>
                </div>
                
                <div class="physical-modal-warning">
                    <i class="ri-information-line"></i>
                    <div>
                        <strong>توجه:</strong>
                        <span>با کلیک روی «تایید درخواست»، درخواست شما ثبت می‌شود و کارشناسان ما در اسرع وقت با شماره <strong style="direction: ltr; display: inline-block;">${Format.phone(user?.phone || '')}</strong> تماس خواهند گرفت.</span>
                    </div>
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" data-cancel>
                <i class="ri-close-line"></i>
                <span>انصراف</span>
            </button>
            <button class="btn btn-gold" data-confirm>
                <i class="ri-check-line"></i>
                <span>تایید درخواست</span>
            </button>
        `;
        
        const modal = Modal.show({
            title: 'درخواست دریافت سکه فیزیکی',
            content,
            footer,
            size: 'md'
        });
        
        modal.querySelector('[data-cancel]').addEventListener('click', () => {
            Modal.close();
        });
        
        modal.querySelector('[data-confirm]').addEventListener('click', async () => {
            await this.submitPhysicalCoinRequest(modal);
        });
    },
    
    /**
     * ثبت درخواست سکه فیزیکی
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
            // ثبت در activity_logs
            await supabaseClient
                .from('activity_logs')
                .insert({
                    user_id: user.id,
                    action: 'physical_coin_request',
                    details: {
                        coin_count: this.selectedCoin?.count || 0,
                        amount: this.selectedCoin?.price || 0,
                        phone: user.phone,
                        name: user.name,
                        requested_at: new Date().toISOString()
                    },
                    user_agent: navigator.userAgent
                });
            
            Modal.close();
            
            // نمایش مودال موفقیت
            await this.showPhysicalSuccessModal();
            
        } catch (error) {
            console.error('خطا در ثبت درخواست:', error);
            Toast.error('خطا', 'خطا در ثبت درخواست. لطفاً مجدداً تلاش کنید.');
            confirmBtn.classList.remove('loading');
            confirmBtn.disabled = false;
        }
    },
    
    /**
     * مودال موفقیت درخواست سکه فیزیکی
     */
    showPhysicalSuccessModal() {
        return new Promise((resolve) => {
            const user = Storage.getUser();
            
            const content = `
                <div class="physical-success-content">
                    <div class="physical-success-icon">
                        <i class="ri-check-line"></i>
                    </div>
                    <h3 class="physical-success-title">درخواست شما ثبت شد!</h3>
                    <p class="physical-success-text">
                        کارشناسان ما به زودی با شماره زیر با شما تماس خواهند گرفت تا زمان و مکان تحویل سکه فیزیکی را هماهنگ کنند.
                    </p>
                    <div class="physical-success-phone">
                        <i class="ri-smartphone-line"></i>
                        <span style="direction: ltr; display: inline-block;">${Format.phone(user?.phone || '')}</span>
                    </div>
                    <div class="physical-success-info">
                        <i class="ri-time-line"></i>
                        <span>زمان تقریبی تماس: کمتر از ۲۴ ساعت</span>
                    </div>
                </div>
            `;
            
            const footer = `
                <button class="btn btn-primary btn-block" id="physical-ok">
                    <i class="ri-check-line"></i>
                    <span>متوجه شدم</span>
                </button>
            `;
            
            const modal = Modal.show({
                title: '',
                content,
                footer,
                size: 'sm',
                closable: false,
                onClose: () => resolve()
            });
            
            modal.querySelector('#physical-ok').addEventListener('click', () => {
                Modal.close();
            });
        });
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