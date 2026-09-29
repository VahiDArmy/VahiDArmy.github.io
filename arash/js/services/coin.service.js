/* ============================================
   سرویس سکه
   ============================================ */

const CoinService = {
    /**
     * دریافت آمار کلی (شامل فیک)
     */
    async getStats() {
        try {
            // دریافت تراکنش‌های تایید شده
            const { data: transactions, error } = await supabaseClient
                .from('coin_transactions')
                .select('coin_count')
                .eq('status', APP_CONFIG.STATUS.APPROVED);
            
            if (error) throw error;
            
            const realCoins = transactions?.map(t => t.coin_count) || [];
            const realCount = realCoins.length;
            const realSum = realCoins.reduce((a, b) => a + b, 0);
            
            // افزودن آمار فیک
            const fakeCount = APP_CONFIG.FAKE_PARTICIPANTS;
            const fakeSum = APP_CONFIG.FAKE_AVERAGE * fakeCount;
            
            const totalCount = realCount + fakeCount;
            const totalSum = realSum + fakeSum;
            const average = Math.max(
                Math.round(totalSum / totalCount),
                APP_CONFIG.FAKE_MIN_AVERAGE
            );
            
            return {
                participantsCount: totalCount,
                totalCoins: totalSum,
                averageCoins: average,
                averageAmount: average * APP_CONFIG.COIN_PRICE,
                realCount,
                realSum
            };
            
        } catch (error) {
            console.error('خطا در دریافت آمار:', error);
            // بازگشت به آمار فیک در صورت خطا
            return {
                participantsCount: APP_CONFIG.FAKE_PARTICIPANTS,
                totalCoins: APP_CONFIG.FAKE_AVERAGE * APP_CONFIG.FAKE_PARTICIPANTS,
                averageCoins: APP_CONFIG.FAKE_AVERAGE,
                averageAmount: APP_CONFIG.FAKE_AVERAGE * APP_CONFIG.COIN_PRICE,
                realCount: 0,
                realSum: 0
            };
        }
    },
    
    /**
     * دریافت لیست سکه‌ها (برای اسلایدر)
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
                features: ['ثبت نام در طرح', 'دعوت به صبحانه', 'یادگاری از ازدواج']
            },
            {
                id: 2,
                count: 3,
                title: 'هدیه صمیمانه',
                subtitle: 'سه گام به سوی شادی',
                description: 'سه سکه برای سه آرزوی خوب',
                price: APP_CONFIG.COIN_PRICE * 3,
                icon: 'ri-gift-line',
                color: '#8B5CF6',
                gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                features: ['همه ویژگی‌های قبلی', 'هدیه ویژه', 'پیام تبریک شخصی']
            },
            {
                id: 3,
                count: 5,
                title: 'هدیه طلایی',
                subtitle: 'پنج ستاره برای عروس و داماد',
                description: 'پنج سکه، پنج آرزوی طلایی',
                price: APP_CONFIG.COIN_PRICE * 5,
                icon: 'ri-vip-crown-line',
                color: '#F59E0B',
                gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                features: ['همه ویژگی‌های قبلی', 'کارت یادبود', 'دعوت ویژه']
            },
            {
                id: 4,
                count: 10,
                title: 'هدیه ویژه',
                subtitle: 'ده سکه برای ده سال خوشبختی',
                description: 'ده سکه، ده آرزوی درخشان',
                price: APP_CONFIG.COIN_PRICE * 10,
                icon: 'ri-medal-2-line',
                color: '#10B981',
                gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
                features: ['همه ویژگی‌های قبلی', 'پیام ویدیویی', 'یادگاری نفیس']
            },
            {
                id: 5,
                count: 20,
                title: 'هدیه استثنایی',
                subtitle: 'بیست سکه برای بیست سال عشق',
                description: 'یک هدیه به یادماندنی',
                price: APP_CONFIG.COIN_PRICE * 20,
                icon: 'ri-trophy-line',
                color: '#EF4444',
                gradient: 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
                features: ['همه ویژگی‌های قبلی', 'یادگاری ویژه', 'تقدیرنامه']
            },
            {
                id: 6,
                count: 50,
                title: 'هدیه افسانه‌ای',
                subtitle: 'پنجاه سکه، پنجاه آرزوی بزرگ',
                description: 'بزرگ‌ترین هدیه ممکن',
                price: APP_CONFIG.COIN_PRICE * 50,
                icon: 'ri-fire-line',
                color: '#6366F1',
                gradient: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
                features: ['همه ویژگی‌های قبلی', 'یادگاری افسانه‌ای', 'دعوت VIP']
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