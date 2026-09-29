/* ============================================
   سرویس احراز هویت - شادباش ازدواج
   استفاده از Email/Password به جای Phone
   موبایل = یوزرنیم (تبدیل به ایمیل مصنوعی)
   ============================================ */

const AuthService = {
    /**
     * دامنه ایمیل مصنوعی برای تبدیل موبایل
     */
    EMAIL_DOMAIN: '@shadbash.local',
    
    /**
     * تبدیل شماره موبایل به ایمیل مصنوعی
     * @param {string} phone - شماره موبایل (مثل 09123456789)
     * @returns {string} ایمیل مصنوعی
     */
    phoneToEmail(phone) {
        const normalized = Helpers.normalizePhone(phone);
        return `${normalized}${this.EMAIL_DOMAIN}`;
    },
    
    /**
     * استخراج موبایل از ایمیل مصنوعی
     */
    emailToPhone(email) {
        if (!email) return '';
        return email.replace(this.EMAIL_DOMAIN, '');
    },
    
    /**
     * ورود یا ثبت‌نام با نام و موبایل
     * (رمز = موبایل)
     */
    async loginOrSignup(name, phone) {
        try {
            const normalizedPhone = Helpers.normalizePhone(phone);
            const email = this.phoneToEmail(normalizedPhone);
            
            // اعتبارسنجی
            const nameCheck = Validate.name(name);
            if (!nameCheck.valid) throw new Error(nameCheck.message);
            
            const phoneCheck = Validate.phone(normalizedPhone);
            if (!phoneCheck.valid) throw new Error(phoneCheck.message);
            
            // ۱. تلاش برای ورود
            let { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: normalizedPhone
            });
            
            // ۲. اگر کاربر وجود نداشت، ثبت‌نام کن
            if (authError) {
                const isNotFoundError = 
                    authError.message.includes('Invalid login credentials') ||
                    authError.message.includes('User not found') ||
                    authError.status === 400;
                
                if (isNotFoundError) {
                    // ثبت‌نام جدید
                    const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
                        email: email,
                        password: normalizedPhone,
                        options: {
                            data: {
                                name: name.trim(),
                                phone: normalizedPhone
                            },
                            emailRedirectTo: undefined // بدون تایید ایمیل
                        }
                    });
                    
                    if (signupError) throw signupError;
                    
                    // اگر نیاز به تایید ایمیل باشد
                    if (!signupData.session) {
                        // تلاش مجدد برای ورود (در حالت auto-confirm)
                        const { data: retryData, error: retryError } = await supabaseClient.auth.signInWithPassword({
                            email: email,
                            password: normalizedPhone
                        });
                        
                        if (retryError) {
                            throw new Error('ثبت‌نام انجام شد اما ورود خودکار ممکن نیست. لطفاً با پشتیبانی تماس بگیرید.');
                        }
                        
                        authData = retryData;
                    } else {
                        authData = signupData;
                    }
                    
                    // انتظار کوتاه برای ایجاد پروفایل توسط trigger
                    await Helpers.delay(800);
                    
                    // اطمینان از وجود پروفایل
                    if (authData.user) {
                        await this.ensureProfile(
                            authData.user.id, 
                            name.trim(), 
                            normalizedPhone
                        );
                    }
                } else {
                    // خطای دیگر
                    throw authError;
                }
            }
            
            // ۳. دریافت پروفایل
            const userId = authData?.user?.id;
            if (!userId) {
                throw new Error('خطا در دریافت اطلاعات کاربر');
            }
            
            const profile = await this.getProfile(userId);
            
            // ۴. ذخیره اطلاعات
            if (authData.session) {
                Storage.setToken(authData.session.access_token);
            }
            if (profile) {
                Storage.setUser(profile);
            }
            
            // ۵. بروزرسانی آخرین ورود
            await this.updateLastLogin(userId);
            
            // ۶. لاگ فعالیت
            await this.logActivity(userId, 'login', {
                phone: normalizedPhone
            });
            
            return {
                success: true,
                user: authData.user,
                profile,
                session: authData.session
            };
            
        } catch (error) {
            console.error('خطا در ورود/ثبت‌نام:', error);
            return {
                success: false,
                error: this.translateError(error.message)
            };
        }
    },
    
    /**
     * اطمینان از وجود پروفایل
     */
    async ensureProfile(userId, name, phone) {
        try {
            // بررسی وجود
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            
            if (existing) return existing;
            
            // ایجاد پروفایل جدید
            const { data, error } = await supabaseClient
                .from('profiles')
                .insert({
                    id: userId,
                    name: name || 'کاربر',
                    phone: phone,
                    role: 'user',
                    total_coins: 0,
                    status: 'active'
                })
                .select()
                .single();
            
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('خطا در ایجاد پروفایل:', error);
            
            // تلاش مجدد پس از تاخیر
            await Helpers.delay(500);
            
            try {
                const { data } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
                
                return data;
            } catch (retryError) {
                throw error;
            }
        }
    },
    
    /**
     * دریافت پروفایل کاربر
     */
    async getProfile(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('خطا در دریافت پروفایل:', error);
            return null;
        }
    },
    
    /**
     * به‌روزرسانی آخرین ورود
     */
    async updateLastLogin(userId) {
        try {
            await supabaseClient
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userId);
        } catch (error) {
            console.error('خطا در به‌روزرسانی ورود:', error);
        }
    },
    
    /**
     * خروج
     */
    async logout() {
        try {
            // لاگ فعالیت
            const user = Storage.getUser();
            if (user) {
                await this.logActivity(user.id, 'logout', {});
            }
            
            await supabaseClient.auth.signOut();
            Storage.removeToken();
            Storage.removeUser();
            Storage.clear(true);
            
            return { success: true };
        } catch (error) {
            console.error('خطا در خروج:', error);
            Storage.removeToken();
            Storage.removeUser();
            return { success: false, error: error.message };
        }
    },
    
    /**
     * دریافت کاربر جاری
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error || !user) return null;
            
            const profile = await this.getProfile(user.id);
            if (profile) {
                Storage.setUser(profile);
            }
            return profile;
            
        } catch (error) {
            console.error('خطا در دریافت کاربر:', error);
            return null;
        }
    },
    
    /**
     * بررسی ورود
     */
    async isAuthenticated() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return !!session;
    },
    
    /**
     * بررسی ادمین بودن
     */
    async isAdmin() {
        const user = Storage.getUser();
        if (!user) return false;
        return user.role === APP_CONFIG.ROLES.ADMIN;
    },
    
    /**
     * گوش دادن به تغییرات احراز هویت
     */
    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await this.getProfile(session.user.id);
                Storage.setUser(profile);
                callback('signed_in', profile);
            } else if (event === 'SIGNED_OUT') {
                Storage.removeUser();
                Storage.removeToken();
                callback('signed_out', null);
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                const profile = await this.getProfile(session.user.id);
                Storage.setUser(profile);
                callback('token_refreshed', profile);
            } else if (event === 'USER_UPDATED' && session?.user) {
                const profile = await this.getProfile(session.user.id);
                Storage.setUser(profile);
                callback('user_updated', profile);
            }
        });
    },
    
    /**
     * لاگ فعالیت
     */
    async logActivity(userId, action, details = {}) {
        try {
            await supabaseClient
                .from('activity_logs')
                .insert({
                    user_id: userId,
                    action,
                    details,
                    user_agent: navigator.userAgent
                });
        } catch (error) {
            console.error('خطا در لاگ:', error);
        }
    },
    
    /**
     * ترجمه خطاها به فارسی
     */
    translateError(message) {
        const translations = {
            'Invalid login credentials': 'اطلاعات ورود نادرست است',
            'User already registered': 'این شماره قبلاً ثبت شده است',
            'Email not confirmed': 'حساب کاربری فعال نیست',
            'Invalid email': 'اطلاعات نامعتبر است',
            'Too many requests': 'تعداد درخواست‌ها زیاد است. لطفاً بعداً تلاش کنید',
            'Network request failed': 'خطا در اتصال به سرور',
            'Signup is disabled': 'ثبت‌نام غیرفعال است',
            'Password should be': 'رمز عبور نامعتبر است',
            'User not found': 'کاربر یافت نشد',
            'Token has expired': 'نشست شما منقضی شده است',
            'For security purposes': 'به دلایل امنیتی، لطفاً کمی صبر کنید'
        };
        
        for (const [key, value] of Object.entries(translations)) {
            if (message.includes(key)) return value;
        }
        
        return message || 'خطای نامشخص رخ داد';
    },
    
    /**
     * تغییر نام
     */
    async updateName(newName) {
        try {
            const user = Storage.getUser();
            if (!user) throw new Error('کاربر یافت نشد');
            
            const check = Validate.name(newName);
            if (!check.valid) throw new Error(check.message);
            
            const { data, error } = await supabaseClient
                .from('profiles')
                .update({ name: newName.trim() })
                .eq('id', user.id)
                .select()
                .single();
            
            if (error) throw error;
            
            // بروزرسانی metadata در Auth
            await supabaseClient.auth.updateUser({
                data: { name: newName.trim() }
            });
            
            Storage.setUser(data);
            return { success: true, profile: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * تغییر رمز عبور
     * (اختیاری - پیش‌فرض: همان موبایل)
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * بازنشانی رمز به موبایل
     */
    async resetPasswordToPhone() {
        try {
            const user = Storage.getUser();
            if (!user) throw new Error('کاربر یافت نشد');
            
            const { error } = await supabaseClient.auth.updateUser({
                password: user.phone
            });
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};