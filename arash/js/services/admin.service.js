/* ============================================
   سرویس ادمین - شادباش ازدواج
   نسخه ۲.۰ - حذف در هر وضعیتی + به‌روزرسانی سکه‌ها
   ============================================ */

const AdminService = {
    /**
     * دریافت آمار کلی داشبورد
     */
    async getDashboardStats() {
        try {
            const { count: totalUsers } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'user');
            
            const { count: totalTransactions } = await supabaseClient
                .from('coin_transactions')
                .select('*', { count: 'exact', head: true });
            
            const { count: pendingTransactions } = await supabaseClient
                .from('coin_transactions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            
            const { data: approvedData } = await supabaseClient
                .from('coin_transactions')
                .select('coin_count, amount')
                .eq('status', 'approved');
            
            const approvedTransactions = approvedData?.length || 0;
            const totalCoins = approvedData?.reduce((sum, t) => sum + t.coin_count, 0) || 0;
            const totalAmount = approvedData?.reduce((sum, t) => sum + t.amount, 0) || 0;
            const averageCoins = approvedTransactions > 0 
                ? Math.round(totalCoins / approvedTransactions) 
                : 0;
            
            return {
                success: true,
                stats: {
                    totalUsers: totalUsers || 0,
                    totalTransactions: totalTransactions || 0,
                    pendingTransactions: pendingTransactions || 0,
                    approvedTransactions,
                    totalCoins,
                    totalAmount,
                    averageCoins
                }
            };
            
        } catch (error) {
            console.error('خطا در آمار داشبورد:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * دریافت لیست مشارکت‌کنندگان
     */
    async getParticipants(filters = {}) {
        try {
            let query = supabaseClient
                .from('coin_transactions')
                .select(`
                    *,
                    user:user_id (id, name, phone, role, status)
                `)
                .order('created_at', { ascending: false });
            
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            let results = data || [];
            if (filters.search) {
                const s = filters.search.toLowerCase().trim();
                results = results.filter(t => 
                    t.user?.name?.toLowerCase().includes(s) ||
                    t.user?.phone?.includes(s)
                );
            }
            
            return { success: true, participants: results };
            
        } catch (error) {
            console.error('خطا:', error);
            return { success: false, error: error.message, participants: [] };
        }
    },
    
    /**
     * تایید تراکنش
     */
    async approveTransaction(transactionId, adminId, note = '') {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .update({
                    status: 'approved',
                    reviewed_by: adminId,
                    reviewed_at: new Date().toISOString(),
                    admin_note: note
                })
                .eq('id', transactionId)
                .select()
                .single();
            
            if (error) throw error;
            
            // به‌روزرسانی تعداد سکه کاربر
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('total_coins')
                .eq('id', data.user_id)
                .single();
            
            await supabaseClient
                .from('profiles')
                .update({ total_coins: (profile?.total_coins || 0) + data.coin_count })
                .eq('id', data.user_id);
            
            await AuthService.logActivity(adminId, 'transaction_approved', {
                transaction_id: transactionId,
                user_id: data.user_id,
                coin_count: data.coin_count
            });
            
            return { success: true, transaction: data };
            
        } catch (error) {
            console.error('خطا در تایید:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * رد تراکنش
     */
    async rejectTransaction(transactionId, adminId, reason = '') {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .update({
                    status: 'rejected',
                    reviewed_by: adminId,
                    reviewed_at: new Date().toISOString(),
                    admin_note: reason
                })
                .eq('id', transactionId)
                .select()
                .single();
            
            if (error) throw error;
            
            await AuthService.logActivity(adminId, 'transaction_rejected', {
                transaction_id: transactionId,
                reason
            });
            
            return { success: true, transaction: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * ویرایش تراکنش
     */
    async updateTransaction(transactionId, updates, adminId) {
        try {
            const allowed = ['coin_count', 'amount', 'admin_note'];
            const cleanUpdates = {};
            
            for (const key of Object.keys(updates)) {
                if (allowed.includes(key)) cleanUpdates[key] = updates[key];
            }
            
            if (cleanUpdates.coin_count) {
                cleanUpdates.amount = cleanUpdates.coin_count * APP_CONFIG.COIN_PRICE;
            }
            
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .update(cleanUpdates)
                .eq('id', transactionId)
                .select()
                .single();
            
            if (error) throw error;
            
            await AuthService.logActivity(adminId, 'transaction_updated', {
                transaction_id: transactionId,
                updates: cleanUpdates
            });
            
            return { success: true, transaction: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * ✅ حذف تراکنش در هر وضعیتی
     * اگر تایید شده بود، سکه‌های کاربر کم می‌شود
     */
    async deleteTransaction(transactionId, adminId) {
        try {
            // ۱. دریافت اطلاعات تراکنش قبل از حذف
            const { data: transaction, error: fetchError } = await supabaseClient
                .from('coin_transactions')
                .select('*')
                .eq('id', transactionId)
                .single();
            
            if (fetchError) throw fetchError;
            
            if (!transaction) {
                throw new Error('تراکنش یافت نشد');
            }
            
            // ۲. اگر تایید شده بود، سکه‌ها را از کاربر کم کن
            if (transaction.status === 'approved') {
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('total_coins')
                    .eq('id', transaction.user_id)
                    .single();
                
                if (profile) {
                    const newTotal = Math.max(0, (profile.total_coins || 0) - transaction.coin_count);
                    
                    await supabaseClient
                        .from('profiles')
                        .update({ total_coins: newTotal })
                        .eq('id', transaction.user_id);
                }
            }
            
            // ۳. حذف تراکنش (RLS اجازه می‌دهد چون ادمین هستیم)
            const { error: deleteError } = await supabaseClient
                .from('coin_transactions')
                .delete()
                .eq('id', transactionId);
            
            if (deleteError) throw deleteError;
            
            // ۴. لاگ فعالیت
            await AuthService.logActivity(adminId, 'transaction_deleted', {
                transaction_id: transactionId,
                user_id: transaction.user_id,
                coin_count: transaction.coin_count,
                previous_status: transaction.status
            });
            
            return { 
                success: true,
                deleted: {
                    id: transactionId,
                    status: transaction.status,
                    coin_count: transaction.coin_count
                }
            };
            
        } catch (error) {
            console.error('خطا در حذف:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * دریافت لاگ فعالیت‌ها
     */
    async getActivityLogs(filters = {}) {
        try {
            let query = supabaseClient
                .from('activity_logs')
                .select(`
                    *,
                    user:user_id (id, name, phone)
                `)
                .order('created_at', { ascending: false })
                .limit(filters.limit || 100);
            
            if (filters.action) {
                query = query.eq('action', filters.action);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return { success: true, logs: data || [] };
            
        } catch (error) {
            return { success: false, error: error.message, logs: [] };
        }
    },
    
    /**
     * دریافت تنظیمات
     */
    async getSettings() {
        try {
            const { data, error } = await supabaseClient
                .from('settings')
                .select('*');
            
            if (error) throw error;
            
            const settings = {};
            data?.forEach(item => {
                settings[item.key] = item.value;
            });
            
            return { success: true, settings };
            
        } catch (error) {
            return { success: false, error: error.message, settings: {} };
        }
    },
    
    /**
     * به‌روزرسانی تنظیمات
     */
    async updateSetting(key, value, adminId) {
        try {
            const { data, error } = await supabaseClient
                .from('settings')
                .upsert({
                    key,
                    value,
                    updated_by: adminId,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            await AuthService.logActivity(adminId, 'setting_updated', { key, value });
            
            return { success: true, setting: data };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    /**
     * گزارش‌گیری
     */
    async getReport(startDate, endDate) {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .select(`
                    *,
                    user:user_id (name, phone)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            const total = data?.length || 0;
            const approved = data?.filter(t => t.status === 'approved') || [];
            const pending = data?.filter(t => t.status === 'pending') || [];
            const rejected = data?.filter(t => t.status === 'rejected') || [];
            
            return {
                success: true,
                report: {
                    transactions: data || [],
                    summary: {
                        total,
                        approved: approved.length,
                        pending: pending.length,
                        rejected: rejected.length,
                        totalCoins: approved.reduce((s, t) => s + t.coin_count, 0),
                        totalAmount: approved.reduce((s, t) => s + t.amount, 0)
                    }
                }
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};