/* ============================================
   سرویس احراز هویت - شادباش ازدواج
   ============================================ */

const AuthService = {
    /**
     * ورود یا ثبت‌نام با نام و موبایل
     * (رمز = موبایل)
     */
    async loginOrSignup(name, phone) {
        try {
            const normalizedPhone = Helpers.normalizePhone(phone);
            const internationalPhone = Helpers.toInternationalPhone(normalizedPhone);
            
            // اعتبارسنجی
            const nameCheck = Validate.name(name);
            if (!nameCheck.valid) throw new Error(nameCheck.message);
            
            const phoneCheck = Validate.phone(normalizedPhone);
            if (!phoneCheck.valid) throw new Error(phoneCheck.message);
            
            // تلاش برای ورود
            let { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                phone: internationalPhone,
                password: normalizedPhone
            });
            
            // اگر کاربر وجود نداشت، ثبت‌نام کن
            if (authError && (
                authError.message.includes('Invalid login credentials') ||
                authError.message.includes('User not found') ||
                authError.status === 400
            )) {
                const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
                    phone: internationalPhone,
                    password: normalizedPhone,
                    options: {
                        data: {
                            name: name.trim(),
                            phone: normalizedPhone
                        }
                    }
                });
                
                if (signupError) throw signupError;
                authData = signupData;
                
                // انتظار برای ایجاد پروفایل
                await Helpers.delay(1500);
                
                // ایجاد/به‌روزرسانی پروفایل
                if (signupData.user) {
                    await this.ensureProfile(signupData.user.id, name.trim(), normalizedPhone);
                }
            } else if (authError) {
                throw authError;
            }
            
            // دریافت پروفایل
            const profile = await this.getProfile(authData.user.id);
            
            // ذخیره اطلاعات
            Storage.setToken(authData.session?.access_token);
            Storage.setUser(profile);
            
            // به‌روزرسانی آخرین ورود
            await this.updateLastLogin(authData.user.id);
            
            // لاگ فعالیت
            await this.logActivity(authData.user.id, 'login', {
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
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (existing) return existing;
            
            const { data, error } = await supabaseClient
                .from('profiles')
                .insert({
                    id: userId,
                    name,
                    phone,
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
            throw error;
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
                .single();
            
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
            'Phone number not confirmed': 'شماره موبایل تایید نشده است',
            'Invalid phone number': 'شماره موبایل نامعتبر است',
            'Too many requests': 'تعداد درخواست‌ها زیاد است. لطفاً بعداً تلاش کنید',
            'Network request failed': 'خطا در اتصال به سرور',
            'Signup is disabled': 'ثبت‌نام غیرفعال است'
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
            
            Storage.setUser(data);
            return { success: true, profile: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};