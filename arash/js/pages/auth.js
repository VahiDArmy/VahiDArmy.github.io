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
        
        // ✅ بررسی امن profile
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
        
        // هدایت
        await Helpers.delay(600);
        
        if (userRole === 'admin') {
            Router.navigate('admin-dashboard');
        } else {
            // چک آخرین تراکنش
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