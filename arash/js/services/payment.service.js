/* ============================================
   سرویس پرداخت و فیش
   ============================================ */

const PaymentService = {
    /**
     * ایجاد تراکنش جدید
     */
    async createTransaction(userId, coinCount, receiptFile = null, receiptText = '') {
        try {
            const check = Validate.coins(coinCount);
            if (!check.valid) throw new Error(check.message);
            
            const amount = CoinService.calculatePrice(coinCount);
            let receiptUrl = null;
            let receiptType = null;
            
            // آپلود فایل اگر وجود دارد
            if (receiptFile) {
                const fileCheck = Validate.file(receiptFile);
                if (!fileCheck.valid) throw new Error(fileCheck.message);
                
                const uploadResult = await this.uploadReceipt(userId, receiptFile);
                if (!uploadResult.success) throw new Error(uploadResult.error);
                
                receiptUrl = uploadResult.url;
                receiptType = 'image';
            } else if (receiptText && receiptText.trim()) {
                receiptType = 'text';
            } else {
                throw new Error('لطفاً فیش پرداخت را آپلود کنید یا متن آن را وارد کنید');
            }
            
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .insert({
                    user_id: userId,
                    coin_count: coinCount,
                    amount,
                    status: APP_CONFIG.STATUS.PENDING,
                    receipt_url: receiptUrl,
                    receipt_type: receiptType,
                    receipt_text: receiptText || null
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // لاگ
            await AuthService.logActivity(userId, 'transaction_created', {
                transaction_id: data.id,
                coin_count: coinCount
            });
            
            return { success: true, transaction: data };
            
        } catch (error) {
            console.error('خطا در ایجاد تراکنش:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * آپلود فیش به Storage
     */
    async uploadReceipt(userId, file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${userId}/${fileName}`;
            
            const { data, error } = await supabaseClient.storage
                .from('receipts')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) throw error;
            
            // دریافت URL امضا شده (چون باکت خصوصی است)
            const { data: urlData } = await supabaseClient.storage
                .from('receipts')
                .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 سال
            
            return {
                success: true,
                url: filePath,
                signedUrl: urlData?.signedUrl,
                path: filePath
            };
            
        } catch (error) {
            console.error('خطا در آپلود:', error);
            return { success: false, error: 'خطا در آپلود فایل: ' + error.message };
        }
    },
    
    /**
     * دریافت URL امضا شده
     */
    async getReceiptUrl(path) {
        try {
            if (!path) return null;
            
            // اگر path شامل http باشد یعنی URL کامل است
            if (path.startsWith('http')) return path;
            
            const { data, error } = await supabaseClient.storage
                .from('receipts')
                .createSignedUrl(path, 60 * 60); // 1 ساعت
            
            if (error) throw error;
            return data?.signedUrl;
            
        } catch (error) {
            console.error('خطا در دریافت URL:', error);
            return null;
        }
    },
    
    /**
     * دریافت تراکنش‌های کاربر
     */
    async getUserTransactions(userId, options = {}) {
        try {
            let query = supabaseClient
                .from('coin_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (options.status) {
                query = query.eq('status', options.status);
            }
            
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            return { success: true, transactions: data || [] };
            
        } catch (error) {
            console.error('خطا:', error);
            return { success: false, error: error.message, transactions: [] };
        }
    },
    
    /**
     * دریافت آخرین تراکنش
     */
    async getLatestTransaction(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('خطا:', error);
            return null;
        }
    },
    
    /**
     * دریافت تراکنش با جزئیات
     */
    async getTransactionDetails(transactionId) {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .select(`
                    *,
                    profiles:user_id (
                        id, name, phone, role, total_coins
                    ),
                    reviewer:reviewed_by (
                        id, name
                    )
                `)
                .eq('id', transactionId)
                .single();
            
            if (error) throw error;
            return data;
            
        } catch (error) {
            console.error('خطا:', error);
            return null;
        }
    }
};