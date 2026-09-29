/* ============================================
   سرویس احراز هویت - شادباش ازدواج
   استفاده از Email/Password
   موبایل = یوزرنیم (تبدیل به ایمیل مصنوعی)
   نسخه ۴.۰ - با رفع مشکل خروج خودکار
   ============================================ */

const AuthService = {
    /**
     * دامنه ایمیل مصنوعی
     */
    EMAIL_DOMAIN: '@shadbash.local',
    
    /**
     * تبدیل موبایل به ایمیل مصنوعی
     */
    phoneToEmail(phone) {
        const normalized = Helpers.normalizePhone(phone);
        return `${normalized}${this.EMAIL_DOMAIN}`;
    },
    
    /**
     * استخراج موبایل از ایمیل
     */
    emailToPhone(email) {
        if (!email) return '';
        return email.replace(this.EMAIL_DOMAIN, '');
    },
    
    /**
     * ورود یا ثبت‌نام
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
            
            let authData = null;
            let isNewUser = false;
            
            // ۱. تلاش برای ورود
            const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: normalizedPhone
            });
            
            if (signInError) {
                // تشخیص نبود کاربر
                const isNotFound = 
                    signInError.message.includes('Invalid login credentials') ||
                    signInError.message.includes('User not found') ||
                    signInError.status === 400;
                
                if (!isNotFound) {
                    throw signInError;
                }
                
                // ۲. ثبت‌نام جدید
                isNewUser = true;
                
                const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
                    email: email,
                    password: normalizedPhone,
                    options: {
                        data: {
                            name: name.trim(),
                            phone: normalizedPhone
                        }
                    }
                });
                
                if (signupError) throw signupError;
                
                // اگر session نداریم (یعنی ایمیل نیاز به تایید دارد)
                if (!signupData.session) {
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
            } else {
                authData = signInData;
            }
            
            // بررسی وجود کاربر
            if (!authData?.user?.id) {
                throw new Error('خطا در دریافت اطلاعات کاربر');
            }
            
            const userId = authData.user.id;
            
            // ۳. اطمینان از وجود پروفایل
            let profile = await this.ensureProfileWithRetry(
                userId, 
                name.trim(), 
                normalizedPhone
            );
            
            if (!profile) {
                throw new Error('خطا در ساخت پروفایل کاربر. لطفاً مجدداً تلاش کنید.');
            }
            
            // ۴. ذخیره اطلاعات در LocalStorage
            if (authData.session) {
                Storage.setToken(authData.session.access_token);
            }
            Storage.setUser(profile);
            
            // ۵. بروزرسانی آخرین ورود (بی‌صدا)
            this.updateLastLogin(userId).catch(() => {});
            
            // ۶. لاگ فعالیت (بی‌صدا)
            this.logActivity(userId, 'login', {
                phone: normalizedPhone,
                is_new_user: isNewUser
            }).catch(() => {});
            
            return {
                success: true,
                user: authData.user,
                profile,
                session: authData.session,
                isNewUser
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
     * اطمینان از وجود پروفایل با تلاش‌های مکرر
     */
    async ensureProfileWithRetry(userId, name, phone) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            const profile = await this.getProfile(userId);
            if (profile) return profile;
            await Helpers.delay(attempt * 500);
        }
        
        console.log('Trigger کار نکرد، ساخت دستی پروفایل...');
        return await this.createProfileManually(userId, name, phone);
    },
    
    /**
     * ساخت دستی پروفایل
     */
    async createProfileManually(userId, name, phone) {
        try {
            const existing = await this.getProfile(userId);
            if (existing) return existing;
            
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
            
            if (error) {
                if (error.code === '23505') {
                    return await this.getProfile(userId);
                }
                throw error;
            }
            
            return data;
            
        } catch (error) {
            console.error('خطا در ساخت دستی پروفایل:', error);
            await Helpers.delay(500);
            return await this.getProfile(userId);
        }
    },
    
    /**
     * دریافت پروفایل
     */
    async getProfile(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            
            if (error) {
                console.error('خطا در getProfile:', error);
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('خطا در getProfile:', error);
            return null;
        }
    },
    
    /**
     * بروزرسانی آخرین ورود
     */
    async updateLastLogin(userId) {
        try {
            await supabaseClient
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userId);
        } catch (error) {
            // بی‌صدا
        }
    },
    
    /**
     * خروج
     */
    async logout() {
        try {
            const user = Storage.getUser();
            if (user?.id) {
                this.logActivity(user.id, 'logout', {}).catch(() => {});
            }
            
            await supabaseClient.auth.signOut();
            Storage.removeToken();
            Storage.removeUser();
            Storage.clear(true);
            
            return { success: true };
        } catch (error) {
            Storage.removeToken();
            Storage.removeUser();
            return { success: false, error: error.message };
        }
    },
    
    /**
     * دریافت کاربر جاری - با تایید Session
     */
    async getCurrentUser() {
        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            
            if (sessionError) {
                console.warn('خطا در getSession:', sessionError.message);
            }
            
            if (!session?.user) {
                return null;
            }
            
            // بررسی cache
            const cachedUser = Storage.getUser();
            if (cachedUser && cachedUser.id === session.user.id) {
                return cachedUser;
            }
            
            // دریافت از دیتابیس
            let profile = await this.getProfile(session.user.id);
            
            if (!profile) {
                const name = session.user.user_metadata?.name || 'کاربر';
                const phone = session.user.user_metadata?.phone || this.emailToPhone(session.user.email);
                profile = await this.createProfileManually(session.user.id, name, phone);
            }
            
            if (profile) {
                Storage.setUser(profile);
                Storage.setToken(session.access_token);
            }
            return profile;
            
        } catch (error) {
            console.error('خطا در getCurrentUser:', error);
            return Storage.getUser();
        }
    },
    
    /**
     * بررسی ورود
     */
    async isAuthenticated() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return !!session;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * بررسی ادمین
     */
    async isAdmin() {
        const user = Storage.getUser();
        if (!user) return false;
        return user.role === 'admin';
    },
    
    /**
     * گوش دادن به تغییرات احراز هویت
     * نسخه اصلاح‌شده - بدون logout تصادفی
     */
    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 Auth event:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await this.getProfile(session.user.id);
                if (profile) {
                    Storage.setUser(profile);
                    Storage.setToken(session.access_token);
                    callback('signed_in', profile);
                }
            } else if (event === 'SIGNED_OUT') {
                Storage.removeUser();
                Storage.removeToken();
                callback('signed_out', null);
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                // فقط توکن را ذخیره کن، کاربر را دوباره از دیتابیس نگیر
                Storage.setToken(session.access_token);
                callback('token_refreshed', Storage.getUser());
            } else if (event === 'USER_UPDATED' && session?.user) {
                const profile = await this.getProfile(session.user.id);
                if (profile) {
                    Storage.setUser(profile);
                    callback('user_updated', profile);
                }
            } else if (event === 'INITIAL_SESSION') {
                // رویداد مهم: Session اولیه
                if (session?.user) {
                    const cachedProfile = Storage.getUser();
                    if (cachedProfile && cachedProfile.id === session.user.id) {
                        callback('initial_session', cachedProfile);
                    } else {
                        const profile = await this.getProfile(session.user.id);
                        if (profile) {
                            Storage.setUser(profile);
                            callback('initial_session', profile);
                        }
                    }
                } else {
                    callback('initial_session', null);
                }
            }
        });
    },
    
    /**
     * لاگ فعالیت (بی‌صدا)
     */
    async logActivity(userId, action, details = {}) {
        try {
            const profile = await this.getProfile(userId);
            if (!profile) {
                return { success: false };
            }
            
            const { error } = await supabaseClient
                .from('activity_logs')
                .insert({
                    user_id: userId,
                    action,
                    details,
                    user_agent: navigator.userAgent
                });
            
            if (error) {
                console.warn('خطا در لاگ:', error.message);
                return { success: false };
            }
            
            return { success: true };
        } catch (error) {
            console.warn('خطا در logActivity:', error.message);
            return { success: false };
        }
    },
    
    /**
     * ترجمه خطاها
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
            'For security purposes': 'به دلایل امنیتی، لطفاً کمی صبر کنید',
            'خطا در ساخت پروفایل': 'خطا در ساخت پروفایل. لطفاً مجدداً تلاش کنید'
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
            
            await supabaseClient.auth.updateUser({
                data: { name: newName.trim() }
            }).catch(() => {});
            
            Storage.setUser(data);
            return { success: true, profile: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};