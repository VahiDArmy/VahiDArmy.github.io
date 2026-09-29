/* ============================================
   صفحه ورود / ثبت‌نام - شادباش ازدواج
   نسخه ۴.۰ - بدون توضیحات اضافه
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
        
        if (!form || !nameInput || !phoneInput || !submitBtn) return;
        
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
        const termsLink = document.getElementById('terms-link');
        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                Modal.alert({
                    title: 'شرایط و قوانین',
                    message: 'با استفاده از این سامانه، شما با شرایط و قوانین زیر موافقت می‌کنید: اطلاعات شما محفوظ بوده و صرفاً برای بررسی مشارکت استفاده می‌شود. مسئولیت صحت اطلاعات وارد شده با شماست.',
                    buttonText: 'متوجه شدم',
                    type: 'info'
                });
            });
        }
        
        nameInput.focus();
    },
    
    async handleSubmit(nameInput, phoneInput, submitBtn, termsCheckbox) {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
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
            const form = document.getElementById('auth-form');
            form.classList.add('animate-shake');
            setTimeout(() => form.classList.remove('animate-shake'), 500);
            return;
        }
        
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        const loadingToast = Toast.loading('در حال ورود...', 'لطفاً کمی صبر کنید');
        
        try {
            const result = await AuthService.loginOrSignup(name, phone);
            
            Toast.dismiss(loadingToast);
            
            if (!result.success) {
                Toast.error('خطا در ورود', result.error);
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                return;
            }
            
            if (!result.profile) {
                Toast.error('خطا', 'پروفایل کاربر یافت نشد. لطفاً مجدداً تلاش کنید.');
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                return;
            }
            
            const userName = result.profile.name || name;
            const userRole = result.profile.role || 'user';
            const userId = result.profile.id;
            
            if (result.isNewUser) {
                Toast.success('خوش آمدید!', `حساب شما ساخته شد. سلام ${userName} جان 🌹`);
            } else {
                Toast.success('خوش آمدید!', `سلام ${userName} جان، خوش برگشتی 🌹`);
            }
            
            await Helpers.delay(600);
            
            if (userRole === 'admin') {
                Router.navigate('admin-dashboard');
            } else {
                try {
                    const latestTx = await PaymentService.getLatestTransaction(userId);
                    if (!latestTx) {
                        Router.navigate('coins');
                    } else {
                        Router.navigate('status');
                    }
                } catch (e) {
                    Router.navigate('coins');
                }
            }
            
        } catch (error) {
            Toast.dismiss(loadingToast);
            console.error('خطا:', error);
            Toast.error('خطای غیرمنتظره', error.message || 'لطفاً مجدداً تلاش کنید');
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }
};