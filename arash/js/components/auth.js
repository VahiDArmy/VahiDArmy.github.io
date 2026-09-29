/* ============================================
   صفحه ورود / ثبت‌نام
   ============================================ */

const AuthPage = {
    render() {
        return `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-card animate-fade-in-scale">
                        <div class="auth-header">
                            <div class="auth-logo">
                                <i class="ri-heart-2-fill"></i>
                            </div>
                            <h1 class="auth-title">ورود / ثبت‌نام</h1>
                            <p class="auth-subtitle">
                                با وارد کردن نام و شماره موبایل، هم حساب ساخته می‌شود و هم وارد می‌شوید
                            </p>
                        </div>
                        
                        <div class="auth-notice">
                            <i class="ri-information-line"></i>
                            <div>
                                <strong>رمز عبور شما همان شماره موبایل است</strong>
                                <span>در صورت لزوم، رمزتان شماره موبایل شما می‌باشد</span>
                            </div>
                        </div>
                        
                        <form class="auth-form" id="auth-form" novalidate>
                            <div class="form-group">
                                <label class="form-label required" for="auth-name">نام و نام خانوادگی</label>
                                <div class="input-wrapper">
                                    <i class="ri-user-line input-icon"></i>
                                    <input 
                                        type="text" 
                                        id="auth-name" 
                                        class="form-input" 
                                        placeholder="مثلاً: علی رضایی"
                                        autocomplete="name"
                                        maxlength="50"
                                    >
                                </div>
                                <div class="form-error" id="error-name" style="display: none;"></div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label required" for="auth-phone">شماره موبایل</label>
                                <div class="input-wrapper">
                                    <i class="ri-smartphone-line input-icon"></i>
                                    <input 
                                        type="tel" 
                                        id="auth-phone" 
                                        class="form-input" 
                                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                                        autocomplete="tel"
                                        inputmode="numeric"
                                        maxlength="11"
                                        dir="ltr"
                                        style="text-align: right; padding-right: 3rem;"
                                    >
                                </div>
                                <div class="form-error" id="error-phone" style="display: none;"></div>
                                <div class="form-hint">شماره موبایل شما به‌عنوان رمز عبور نیز استفاده می‌شود</div>
                            </div>
                            
                            <div class="form-checkbox" style="margin-bottom: var(--space-6);">
                                <input type="checkbox" id="auth-terms" checked>
                                <label for="auth-terms">
                                    <span>با ورود یا ثبت‌نام، <a href="#" id="terms-link">شرایط و قوانین</a> را می‌پذیرم</span>
                                </label>
                            </div>
                            
                            <button type="submit" class="btn btn-gold btn-lg btn-block btn-pulse-gold" id="auth-submit">
                                <i class="ri-login-box-line"></i>
                                <span>ورود / ثبت‌نام</span>
                            </button>
                        </form>
                        
                        <div class="auth-footer">
                            <div class="auth-security">
                                <i class="ri-shield-check-line"></i>
                                <span>اطلاعات شما به صورت امن ذخیره می‌شود</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- دکوراسیون -->
                    <div class="auth-decoration auth-decoration-1"></div>
                    <div class="auth-decoration auth-decoration-2"></div>
                    <div class="auth-decoration auth-decoration-3"></div>
                </div>
            </div>
        `;
    },
    
    init() {
        const form = document.getElementById('auth-form');
        const nameInput = document.getElementById('auth-name');
        const phoneInput = document.getElementById('auth-phone');
        const submitBtn = document.getElementById('auth-submit');
        const termsCheckbox = document.getElementById('auth-terms');
        
        // فقط اعداد در فیلد موبایل
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            e.target.value = value;
            
            if (value.length >= 10) {
                const result = Validate.phone(value);
                if (result.valid) {
                    Validate.showSuccess(phoneInput);
                } else if (value.length === 11) {
                    Validate.showError(phoneInput, result.message);
                } else {
                    Validate.clear(phoneInput);
                }
            } else {
                Validate.clear(phoneInput);
            }
        });
        
        // اعتبارسنجی نام
        nameInput.addEventListener('blur', () => {
            const value = nameInput.value.trim();
            if (value) {
                const result = Validate.name(value);
                if (result.valid) {
                    Validate.showSuccess(nameInput);
                } else {
                    Validate.showError(nameInput, result.message);
                }
            }
        });
        
        nameInput.addEventListener('input', () => {
            if (nameInput.classList.contains('error')) {
                const value = nameInput.value.trim();
                const result = Validate.name(value);
                if (result.valid) Validate.showSuccess(nameInput);
            }
        });
        
        // ارسال فرم
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(nameInput, phoneInput, submitBtn, termsCheckbox);
        });
        
        // لینک شرایط
        document.getElementById('terms-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            Modal.alert({
                title: 'شرایط و قوانین',
                message: 'با استفاده از این سامانه، شما با شرایط و قوانین زیر موافقت می‌کنید: اطلاعات شما محفوظ بوده و صرفاً برای بررسی مشارکت استفاده می‌شود. مسئولیت صحت اطلاعات وارد شده با شماست. سکه‌های خریداری شده پس از تایید فیش، قابل استفاده در طرح هدیه می‌باشند.',
                buttonText: 'متوجه شدم',
                type: 'info'
            });
        });
        
        // اعتبارسنجی مجدد
        nameInput.focus();
    },
    
    /**
     * ارسال فرم
     */
    async handleSubmit(nameInput, phoneInput, submitBtn, termsCheckbox) {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        // اعتبارسنجی
        let hasError = false;
        
        const nameCheck = Validate.name(name);
        if (!nameCheck.valid) {
            Validate.showError(nameInput, nameCheck.message);
            hasError = true;
        }
        
        const phoneCheck = Validate.phone(phone);
        if (!phoneCheck.valid) {
            Validate.showError(phoneInput, phoneCheck.message);
            hasError = true;
        }
        
        if (!termsCheckbox.checked) {
            Toast.warning('شرایط و قوانین', 'لطفاً ابتدا شرایط و قوانین را بپذیرید');
            hasError = true;
        }
        
        if (hasError) {
            // لرزش فرم
            const form = document.getElementById('auth-form');
            form.classList.add('animate-shake');
            setTimeout(() => form.classList.remove('animate-shake'), 500);
            return;
        }
        
        // لودینگ
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        // ورود/ثبت‌نام
        const result = await AuthService.loginOrSignup(name, phone);
        
        if (result.success) {
            Toast.success('خوش آمدید!', `سلام ${result.profile.name} جان، خوش آمدید`);
            
            // بررسی ادمین بودن
            if (result.profile.role === 'admin') {
                await Helpers.delay(500);
                Router.navigate('admin-dashboard');
            } else {
                // بررسی اینکه آیا تراکنش دارد
                const latestTx = await PaymentService.getLatestTransaction(result.profile.id);
                await Helpers.delay(500);
                
                if (!latestTx) {
                    Router.navigate('coins');
                } else {
                    Router.navigate('status');
                }
            }
        } else {
            Toast.error('خطا در ورود', result.error);
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }
};