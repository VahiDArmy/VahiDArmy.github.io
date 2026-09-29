/* ============================================
   تنظیمات Supabase - شادباش ازدواج
   نسخه ۲.۰ - رفع مشکل خروج خودکار
   ============================================ */

const SUPABASE_URL = 'https://ijzmojnzcimqroatalhw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ah1I0208EMm9KNO0sAhw6w_sWJ682d5';

// بررسی وجود Supabase
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK بارگذاری نشده است');
}

// ✅ ایجاد کلاینت با تنظیمات صحیح برای persistence
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // ✅ فعال‌سازی ذخیره‌سازی خودکار Session در localStorage
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,  // ← برای email/password نیازی نیست
        storageKey: 'shadbash-auth',  // ← کلید اختصاصی برای ذخیره
        storage: window.localStorage,  // ← صریحاً localStorage
        flowType: 'implicit'           // ← implicit نه pkce
    },
    global: {
        headers: {
            'x-application-name': 'shadbash-ezdevaj'
        }
    }
});

// ============================================
// تنظیمات اپلیکیشن
// ============================================
const APP_CONFIG = {
    COIN_PRICE: 100000,
    
    FAKE_PARTICIPANTS: 3,
    FAKE_AVERAGE: 12,
    FAKE_MIN_AVERAGE: 12,
    
    MIN_COINS: 1,
    MAX_COINS: 20,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    
    CARD_NUMBER: '6037998243161691',
    CARD_IMAGE: 'assets/images/card.png',
    
    MAP_IMAGE: 'assets/images/map.png',
    MAP_LINK: 'https://maps.google.com/?q=35.6892,51.3890',
    MAP_COORDINATES: '35.6892, 51.3890',
    
    STATUS: {
        PENDING: 'pending',
        APPROVED: 'approved',
        REJECTED: 'rejected'
    },
    
    ROLES: {
        USER: 'user',
        ADMIN: 'admin'
    },
    
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

// ============================================
// بررسی اتصال
// ============================================
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

// ============================================
// 🐛 دیباگ - نمایش وضعیت Session
// ============================================
async function debugSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const storedUser = Storage.getUser();
    
    console.log('🔍 وضعیت Session:');
    console.log('  - Session فعال:', !!session);
    console.log('  - کاربر ذخیره‌شده:', !!storedUser);
    if (session) {
        console.log('  - ایمیل:', session.user.email);
        console.log('  - انقضا در:', new Date(session.expires_at * 1000).toLocaleString('fa-IR'));
    }
    return { session, storedUser };
}

window.debugSession = debugSession;