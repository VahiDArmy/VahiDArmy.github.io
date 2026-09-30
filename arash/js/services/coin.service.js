/* ============================================
   سرویس سکه - شادباش ازدواج
   نسخه ۳.۰ - منطق صحیح آمار ساختگی
   ============================================ */

const CoinService = {
    /**
     * دریافت آمار کلی (شامل آمار ساختگی)
     * ─────────────────────────────────────
     * فرمول:
     *   مجموع کل = (مجموع فیک) + (مجموع واقعی تایید شده)
     *   تعداد کل = (تعداد فیک) + (تعداد واقعی تایید شده)
     *   میانگین = مجموع کل ÷ تعداد کل
     */
    async getStats() {
        try {
            // ۱. دریافت داده‌های واقعی از دیتابیس
            const { data: transactions, error } = await supabaseClient
                .from('coin_transactions')
                .select('coin_count')
                .eq('status', 'approved');
            
            if (error) throw error;
            
            const realCoins = transactions?.map(t => t.coin_count) || [];
            const realCount = realCoins.length;
            const realSum = realCoins.reduce((a, b) => a + b, 0);
            
            // ۲. داده‌های فیک اولیه
            const fakeCount = APP_CONFIG.FAKE_PARTICIPANTS;      // 3
            const fakeAverage = APP_CONFIG.FAKE_AVERAGE;         // 12
            const fakeSum = fakeCount * fakeAverage;             // 36
            
            // ۳. ترکیب داده‌ها
            const totalCount = realCount + fakeCount;
            const totalSum = realSum + fakeSum;
            
            // ۴. محاسبه میانگین (بدون حداقل کاذب)
            const averageCoins = totalCount > 0
                ? totalSum / totalCount
                : 0;
            
            // ۵. گرد کردن به یک رقم اعشار برای نمایش بهتر
            const roundedAverage = Math.round(averageCoins * 10) / 10;
            
            return {
                // آمار نمایشی
                participantsCount: totalCount,
                totalCoins: totalSum,
                averageCoins: roundedAverage,
                averageAmount: Math.round(roundedAverage * APP_CONFIG.COIN_PRICE),
                
                // آمار واقعی (برای ادمین)
                realCount,
                realSum,
                realAverage: realCount > 0 ? realSum / realCount : 0,
                
                // آمار فیک (برای شفافیت)
                fakeCount,
                fakeSum
            };
            
        } catch (error) {
            console.error('خطا در دریافت آمار:', error);
            
            // در صورت خطا، فقط آمار فیک را برگردان
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
        }
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