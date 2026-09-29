/* ============================================
   تنظیمات Supabase
   ============================================ */

const SUPABASE_URL = 'https://ijzmojnzcimqroatalhw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ah1I0208EMm9KNO0sAhw6w_sWJ682d5';

// بررسی وجود Supabase
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK بارگذاری نشده است. لطفاً CDN را بررسی کنید.');
}

// ایجاد کلاینت Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    },
    global: {
        headers: {
            'x-application-name': 'coin-participation-system'
        }
    }
});

// تنظیمات اپلیکیشن
const APP_CONFIG = {
    // قیمت هر سکه به تومان
    COIN_PRICE: 100000,
    
    // آمار فیک اولیه
    FAKE_PARTICIPANTS: 3,
    FAKE_AVERAGE: 12,
    FAKE_MIN_AVERAGE: 12,
    
    // محدودیت‌ها
    MIN_COINS: 1,
    MAX_COINS: 50,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    
    // شماره کارت
    CARD_NUMBER: '6037998243161691',
    CARD_IMAGE: 'assets/images/card.png',
    
    // نقشه
    MAP_IMAGE: 'assets/images/map.png',
    MAP_LINK: 'https://maps.google.com/?q=35.6892,51.3890',
    MAP_COORDINATES: '35.6892, 51.3890',
    
    // وضعیت‌ها
    STATUS: {
        PENDING: 'pending',
        APPROVED: 'approved',
        REJECTED: 'rejected'
    },
    
    // نقش‌ها
    ROLES: {
        USER: 'user',
        ADMIN: 'admin'
    },
    
    // مسیرها
    ROUTES: {
        WELCOME: 'welcome',
        AUTH: 'auth',
        COINS: 'coins',
        PAYMENT: 'payment',
        STATUS: 'status',
        LOCATION: 'location',
        PROFILE: 'profile',
        ADMIN_DASHBOARD: 'admin-dashboard',
        ADMIN_PARTICIPANTS: 'admin-participants',
        ADMIN_SETTINGS: 'admin-settings',
        ADMIN_REPORTS: 'admin-reports'
    }
};

// بررسی اتصال
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        console.log('✅ اتصال Supabase برقرار است');
        return true;
    } catch (error) {
        console.error('❌ خطا در اتصال Supabase:', error.message);
        return false;
    }
}