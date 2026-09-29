/* ============================================
   صفحه پرداخت و آپلود فیش
   ============================================ */

const PaymentPage = {
    selectedCoin: null,
    currentStep: 1,
    
    render() {
        this.selectedCoin = Storage.getTemp('selected_coin');
        
        if (!this.selectedCoin) {
            setTimeout(() => Router.navigate('coins'), 100);
            return '<div style="padding: 4rem; text-align: center;">در حال انتقال...</div>';
        }
        
        return `
            <div class="payment-page">
                <div class="payment-header">
                    <div class="page-badge">
                        <i class="ri-sparkling-2-fill"></i>
                        <span>گام ۲ از ۳</span>
                    </div>
                    <h1 class="page-title">پرداخت و ارسال فیش</h1>
                    <p class="page-subtitle">
                        لطفاً مبلغ را به شماره کارت زیر واریز کرده و فیش خود را آپلود کنید
                    </p>
                </div>
                
                <!-- استپر -->
                <div class="steps-indicator">
                    <div class="step-indicator active" data-step="1">
                        <div class="step-circle"><i class="ri-bank-card-line"></i></div>
                        <span>واریز مبلغ</span>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-indicator" data-step="2">
                        <div class="step-circle"><i class="ri-upload-cloud-line"></i></div>
                        <span>آپلود فیش</span>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-indicator" data-step="3">
                        <div class="step-circle"><i class="ri-shield-check-line"></i></div>
                        <span>تایید ادمین</span>
                    </div>
                </div>
                
                <div class="payment-layout">
                    <div class="payment-main">
                        <!-- مرحله ۱: اطلاعات پرداخت -->
                        <div class="payment-step" id="step-1">
                            <div class="payment-card">
                                <div class="payment-card-header">
                                    <div class="payment-card-icon">
                                        <i class="ri-bank-card-fill"></i>
                                    </div>
                                    <div>
                                        <h3>اطلاعات کارت مقصد</h3>
                                        <p>مبلغ را به کارت زیر واریز کنید</p>
                                    </div>
                                </div>
                                
                                <div class="card-visual">
                                    <div class="card-chip">
                                        <i class="ri-bank-card-2-fill"></i>
                                    </div>
                                    <div class="card-number" id="card-number-display">
                                        ${Format.cardNumber(APP_CONFIG.CARD_NUMBER)}
                                    </div>
                                    <div class="card-info-row">
                                        <div>
                                            <span>بانک</span>
                                            <strong>ملی</strong>
                                        </div>
                                        <div>
                                            <span>به نام</span>
                                            <strong>سامانه شادباش</strong>
                                        </div>
                                    </div>
                                    <div class="card-logo">شتاب</div>
                                </div>
                                
                                <div class="card-actions">
                                    <button class="btn btn-primary btn-block" id="copy-card-btn">
                                        <i class="ri-file-copy-line"></i>
                                        <span>کپی شماره کارت</span>
                                    </button>
                                </div>
                                
                                <div class="amount-box">
                                    <div class="amount-label">مبلغ قابل واریز</div>
                                    <div class="amount-value">${Format.price(this.selectedCoin.price)}</div>
                                    <div class="amount-hint">
                                        معادل ${Format.coin(this.selectedCoin.count)}
                                    </div>
                                </div>
                                
                                <div class="payment-notice">
                                    <i class="ri-alert-line"></i>
                                    <div>
                                        <strong>توجه مهم:</strong>
                                        <span>لطفاً دقیقاً مبلغ ذکر شده را واریز کرده و سپس در مرحله بعد فیش خود را آپلود کنید.</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="step-actions">
                                <a href="#coins" class="btn btn-ghost" data-nav>
                                    <i class="ri-arrow-right-line"></i>
                                    <span>بازگشت</span>
                                </a>
                                <button class="btn btn-primary btn-lg" id="next-step-btn">
                                    <span>مبلغ را واریز کردم</span>
                                    <i class="ri-arrow-left-line"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- مرحله ۲: آپلود فیش -->
                        <div class="payment-step" id="step-2" style="display: none;">
                            <div class="payment-card">
                                <div class="payment-card-header">
                                    <div class="payment-card-icon">
                                        <i class="ri-upload-cloud-2-line"></i>
                                    </div>
                                    <div>
                                        <h3>ارسال فیش واریزی</h3>
                                        <p>فیش خود را آپلود کنید یا متن آن را وارد نمایید</p>
                                    </div>
                                </div>
                                
                                <div id="uploader-container"></div>
                            </div>
                            
                            <div class="step-actions">
                                <button class="btn btn-ghost" id="back-step-btn">
                                    <i class="ri-arrow-right-line"></i>
                                    <span>بازگشت</span>
                                </button>
                                <button class="btn btn-success btn-lg" id="submit-receipt-btn">
                                    <i class="ri-send-plane-fill"></i>
                                    <span>ارسال فیش</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <aside class="payment-sidebar">
                        <div class="sidebar-card">
                            <div class="sidebar-card-header">
                                <i class="ri-list-check-2"></i>
                                <span>خلاصه سفارش</span>
                            </div>
                            <div class="order-details">
                                <div class="order-detail-item">
                                    <span>پکیج انتخابی:</span>
                                    <strong>${this.selectedCoin.title}</strong>
                                </div>
                                <div class="order-detail-item">
                                    <span>تعداد سکه:</span>
                                    <strong>${Format.coin(this.selectedCoin.count)}</strong>
                                </div>
                                <div class="order-detail-item">
                                    <span>قیمت هر سکه:</span>
                                    <strong>${Format.price(APP_CONFIG.COIN_PRICE)}</strong>
                                </div>
                                <div class="order-detail-item total">
                                    <span>مبلغ کل:</span>
                                    <strong>${Format.price(this.selectedCoin.price)}</strong>
                                </div>
                            </div>
                        </div>
                        
                        <div class="sidebar-card warning-card">
                            <div class="warning-icon">
                                <i class="ri-alert-fill"></i>
                            </div>
                            <h4>نکات ضروری</h4>
                            <ul class="warning-list">
                                <li>مبلغ را دقیقاً برابر با مبلغ ذکر شده واریز کنید</li>
                                <li>فیش واریزی باید واضح و خوانا باشد</li>
                                <li>بررسی فیش‌ها معمولاً کمتر از ۲۴ ساعت طول می‌کشد</li>
                                <li>در صورت رد شدن فیش، می‌توانید مجدداً آپلود کنید</li>
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>
        `;
    },
    
    init() {
        // کپی شماره کارت
        document.getElementById('copy-card-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const success = await Helpers.copyToClipboard(APP_CONFIG.CARD_NUMBER);
            
            if (success) {
                Toast.success('کپی شد', 'شماره کارت با موفقیت کپی شد');
                btn.innerHTML = '<i class="ri-check-line"></i><span>کپی شد</span>';
                btn.classList.add('btn-success');
                btn.classList.remove('btn-primary');
                
                setTimeout(() => {
                    btn.innerHTML = '<i class="ri-file-copy-line"></i><span>کپی شماره کارت</span>';
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-primary');
                }, 2000);
            } else {
                Toast.error('خطا', 'کپی انجام نشد. لطفاً دستی کپی کنید');
            }
        });
        
        // رفتن به مرحله ۲
        document.getElementById('next-step-btn')?.addEventListener('click', () => {
            this.goToStep(2);
        });
        
        // بازگشت به مرحله ۱
        document.getElementById('back-step-btn')?.addEventListener('click', () => {
            this.goToStep(1);
        });
        
        // ارسال فیش
        document.getElementById('submit-receipt-btn')?.addEventListener('click', () => {
            this.handleSubmit();
        });
    },
    
    /**
     * رفتن به مرحله
     */
    goToStep(step) {
        this.currentStep = step;
        
        document.querySelectorAll('.payment-step').forEach((el) => {
            el.style.display = el.id === `step-${step}` ? 'block' : 'none';
        });
        
        document.querySelectorAll('.step-indicator').forEach((el) => {
            const elStep = parseInt(el.dataset.step);
            el.classList.toggle('active', elStep === step);
            el.classList.toggle('completed', elStep < step);
        });
        
        if (step === 2 && !document.getElementById('uploader-container').innerHTML.trim()) {
            Uploader.render('uploader-container');
        }
        
        Helpers.scrollToTop();
    },
    
    /**
     * ارسال فیش
     */
    async handleSubmit() {
        const user = Storage.getUser();
        if (!user) {
            Toast.error('خطا', 'لطفاً مجدداً وارد شوید');
            Router.navigate('auth');
            return;
        }
        
        if (!Uploader.validate()) return;
        
        const value = Uploader.getValue();
        const submitBtn = document.getElementById('submit-receipt-btn');
        
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        // پیام لودینگ
        const loadingToast = Toast.loading('در حال ارسال فیش...', 'لطفاً کمی صبر کنید');
        
        try {
            let result;
            
            if (value.type === 'image') {
                // شبیه‌سازی آپلود
                Uploader.showProgress(30);
                await Helpers.delay(300);
                Uploader.showProgress(60);
                await Helpers.delay(300);
                Uploader.showProgress(90);
                await Helpers.delay(300);
                
                result = await PaymentService.createTransaction(
                    user.id,
                    this.selectedCoin.count,
                    value.file,
                    ''
                );
                
                Uploader.showProgress(100);
            } else {
                result = await PaymentService.createTransaction(
                    user.id,
                    this.selectedCoin.count,
                    null,
                    value.text
                );
            }
            
            Toast.dismiss(loadingToast);
            Uploader.hideProgress();
            
            if (result.success) {
                // ذخیره شناسه تراکنش
                Storage.setTemp('last_transaction_id', result.transaction.id);
                
                // پاک کردن انتخاب سکه
                Storage.remove('selected_coin', true);
                
                Toast.success('موفق!', 'فیش شما با موفقیت ارسال شد و در انتظار تایید است');
                
                // انیمیشن موفقیت
                await this.showSuccessModal();
                
                // رفتن به صفحه وضعیت
                Router.navigate('status');
            } else {
                Toast.error('خطا', result.error);
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            
        } catch (error) {
            Toast.dismiss(loadingToast);
            Uploader.hideProgress();
            Toast.error('خطای غیرمنتظره', error.message);
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    },
    
    /**
     * نمایش مودال موفقیت
     */
    async showSuccessModal() {
        return new Promise((resolve) => {
            const modal = Modal.show({
                title: '',
                content: `
                    <div class="success-modal-content">
                        <div class="success-checkmark">
                            <i class="ri-check-line"></i>
                        </div>
                        <h2 class="success-title">فیش شما ارسال شد!</h2>
                        <p class="success-message">
                            فیش واریزی شما با موفقیت دریافت شد. تیم پشتیبانی در اسرع وقت آن را بررسی خواهد کرد.
                        </p>
                        <div class="success-info">
                            <div class="info-row">
                                <i class="ri-time-line"></i>
                                <span>زمان تقریبی بررسی: کمتر از ۲۴ ساعت</span>
                            </div>
                            <div class="info-row">
                                <i class="ri-notification-3-line"></i>
                                <span>پس از تایید، سکه‌ها به حساب شما اضافه می‌شود</span>
                            </div>
                        </div>
                    </div>
                `,
                footer: `
                    <button class="btn btn-primary btn-block" id="success-ok">
                        <span>مشاهده وضعیت</span>
                        <i class="ri-arrow-left-line"></i>
                    </button>
                `,
                size: 'sm',
                closable: false,
                onClose: () => resolve()
            });
            
            modal.querySelector('#success-ok').addEventListener('click', () => {
                Modal.close();
            });
        });
    }
};