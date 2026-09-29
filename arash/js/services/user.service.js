/* ============================================
   سرویس کاربر
   ============================================ */

const UserService = {
    /**
     * دریافت پروفایل کامل
     */
    async getFullProfile(userId) {
        try {
            const [profileResult, statsResult, transactionsResult] = await Promise.all([
                supabaseClient.from('profiles').select('*').eq('id', userId).single(),
                CoinService.getUserStats(userId),
                PaymentService.getUserTransactions(userId, { limit: 20 })
            ]);
            
            if (profileResult.error) throw profileResult.error;
            
            return {
                success: true,
                profile: profileResult.data,
                stats: statsResult,
                transactions: transactionsResult.transactions || []
            };
            
        } catch (error) {
            console.error('خطا در دریافت پروفایل:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * به‌روزرسانی پروفایل
     */
    async updateProfile(userId, updates) {
        try {
            const allowed = ['name', 'metadata'];
            const cleanUpdates = {};
            
            for (const key of Object.keys(updates)) {
                if (allowed.includes(key)) {
                    cleanUpdates[key] = updates[key];
                }
            }
            
            const { data, error } = await supabaseClient
                .from('profiles')
                .update(cleanUpdates)
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            
            Storage.setUser(data);
            return { success: true, profile: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * دریافت لیست همه کاربران (ادمین)
     */
    async getAllUsers(filters = {}) {
        try {
            let query = supabaseClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (filters.role) {
                query = query.eq('role', filters.role);
            }
            
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return { success: true, users: data || [] };
            
        } catch (error) {
            console.error('خطا:', error);
            return { success: false, error: error.message, users: [] };
        }
    },
    
    /**
     * تغییر وضعیت کاربر (ادمین)
     */
    async updateUserStatus(userId, status) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .update({ status })
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            
            const admin = Storage.getUser();
            await AuthService.logActivity(admin?.id, 'user_status_changed', {
                user_id: userId,
                new_status: status
            });
            
            return { success: true, user: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * تبدیل به ادمین (ادمین)
     */
    async promoteToAdmin(userId) {
        return this.updateUserRole(userId, 'admin');
    },
    
    /**
     * حذف دسترسی ادمین
     */
    async demoteToUser(userId) {
        return this.updateUserRole(userId, 'user');
    },
    
    /**
     * تغییر نقش کاربر
     */
    async updateUserRole(userId, role) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .update({ role })
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            return { success: true, user: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};