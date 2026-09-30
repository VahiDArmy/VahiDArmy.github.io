/* ============================================
   سرویس سکه - شادباش ازدواج
   نسخه ۴.۰ - استفاده از RPC برای آمار عمومی
   ============================================ */

const CoinService = {
    /**
     * دریافت آمار کلی (شامل آمار ساختگی)
     * ─────────────────────────────────────
     * از تابع RPC استفاده می‌کند چون RLS اجازه
     * خواندن تراکنش‌های دیگران را نمی‌دهد
     */
    async getStats() {
        try {
            // ۱. دریافت آمار واقعی از طریق RPC (SECURITY DEFINER)
            const { data: rpcData, error: rpcError } = await supabaseClient
                .rpc('get_public_stats');
            
            if (rpcError) {
                console.warn('خطا در RPC، استفاده از مقادیر پیش‌فرض:', rpcError.message);
                return this.getFakeStatsOnly();
            }
            
            const realCount = parseInt(rpcData?.real_count) || 0;
            const realSum = parseInt(rpcData?.real_sum) || 0;
            
            // ۲. داده‌های فیک اولیه
            const fakeCount = APP_CONFIG.FAKE_PARTICIPANTS;    // 3
            const fakeAverage = APP_CONFIG.FAKE_AVERAGE;       // 12
            const fakeSum = fakeCount * fakeAverage;           // 36
            
            // ۳. ترکیب داده‌ها
            const totalCount = realCount + fakeCount;
            const totalSum = realSum + fakeSum;
            
            // ۴. محاسبه میانگین
            const averageCoins = totalCount > 0
                ? totalSum / totalCount
                : 0;
            
            // ۵. گرد کردن به یک رقم اعشار
            const roundedAverage = Math.round(averageCoins * 10) / 10;
            
            return {
                // آمار نمایشی (فیک + واقعی)
                participantsCount: totalCount,
                totalCoins: totalSum,
                averageCoins: roundedAverage,
                averageAmount: Math.round(roundedAverage * APP_CONFIG.COIN_PRICE),
                
                // آمار واقعی
                realCount,
                realSum,
                realAverage: realCount > 0 ? Math.round((realSum / realCount) * 10) / 10 : 0,
                
                // آمار فیک
                fakeCount,
                fakeSum
            };
            
        } catch (error) {
            console.error('خطا در دریافت آمار:', error);
            return this.getFakeStatsOnly();
        }
    },
    
    /**
     * فقط آمار فیک (در صورت خطا)
     */
    getFakeStatsOnly() {
        const fakeCount = APP_CONFIG.FAKE_PARTICIPANTS;
        const fakeAverage = APP_CONFIG.FAKE_AVERAGE;
        const fakeSum = fakeCount * fakeAverage;
        
        return {
            participantsCount: fakeCount,
            totalCoins: fakeSum,
            averageCoins: fakeAverage,
            averageAmount: fakeAverage * APP_CONFIG.COIN_PRICE,
            realCount: 0,
            realSum: 0,
            realAverage: 0,
            fakeCount,
            fakeSum
        };
    },
    
    /**
     * دریافت پکیج‌های پیشنهادی
     */
    getCoinTiers() {
        return [
            {
                id: 1,
                count: 1,
                title: 'هدیه کوچک',
                subtitle: 'شروع یک آغاز زیبا',
                description: 'یک سکه برای شروع مسیر شادباش',
                price: APP_CONFIG.COIN_PRICE * 1,
                icon: 'ri-heart-line',
                color: '#EC4899',
                gradient: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
                features: ['ثبت‌نام در طرح', 'دعوت به صبحانه', 'یادگاری از ازدواج']
            },
            {
                id: 2,
                count: 5,
                title: 'هدیه صمیمانه',
                subtitle: 'پنج ستاره برای این جشن',
                description: 'پنج سکه برای پنج آرزوی خوب',
                price: APP_CONFIG.COIN_PRICE * 5,
                icon: 'ri-gift-line',
                color: '#8B5CF6',
                gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                features: ['همه ویژگی‌های قبلی', 'هدیه ویژه', 'پیام تبریک شخصی']
            },
            {
                id: 3,
                count: 10,
                title: 'هدیه درخشان',
                subtitle: 'ده سکه برای یادگاری ماندگار',
                description: 'ده سکه، یک هدیه باشکوه',
                price: APP_CONFIG.COIN_PRICE * 10,
                icon: 'ri-vip-crown-line',
                color: '#F59E0B',
                gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                features: ['همه ویژگی‌های قبلی', 'کارت یادبود', 'دعوت ویژه']
            },
            {
                id: 4,
                count: 15,
                title: 'هدیه نفیس',
                subtitle: 'پانزده سکه برای یک جشن بی‌نظیر',
                description: 'یک هدیه خاص و ارزشمند',
                price: APP_CONFIG.COIN_PRICE * 15,
                icon: 'ri-medal-2-line',
                color: '#10B981',
                gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
                features: ['همه ویژگی‌های قبلی', 'پیام ویدیویی', 'یادگاری نفیس']
            },
            {
                id: 5,
                count: 20,
                title: 'هدیه استثنایی',
                subtitle: 'بیست سکه برای شادی بزرگ',
                description: 'یک هدیه به یادماندنی',
                price: APP_CONFIG.COIN_PRICE * 20,
                icon: 'ri-trophy-line',
                color: '#EF4444',
                gradient: 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
                features: ['همه ویژگی‌های قبلی', 'یادگاری ویژه', 'تقدیرنامه']
            }
        ];
    },
    
    /**
     * محاسبه قیمت
     */
    calculatePrice(coinCount) {
        return coinCount * APP_CONFIG.COIN_PRICE;
    },
    
    /**
     * دریافت آمار کاربر
     */
    async getUserStats(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('coin_transactions')
                .select('coin_count, status, created_at')
                .eq('user_id', userId);
            
            if (error) throw error;
            
            const approved = data?.filter(t => t.status === 'approved') || [];
            const pending = data?.filter(t => t.status === 'pending') || [];
            const rejected = data?.filter(t => t.status === 'rejected') || [];
            
            return {
                totalCoins: approved.reduce((sum, t) => sum + t.coin_count, 0),
                approvedCount: approved.length,
                pendingCount: pending.length,
                rejectedCount: rejected.length,
                totalTransactions: data?.length || 0,
                totalAmount: approved.reduce((sum, t) => sum + (t.coin_count * APP_CONFIG.COIN_PRICE), 0)
            };
            
        } catch (error) {
            console.error('خطا در آمار کاربر:', error);
            return {
                totalCoins: 0,
                approvedCount: 0,
                pendingCount: 0,
                rejectedCount: 0,
                totalTransactions: 0,
                totalAmount: 0
            };
        }
    }
};