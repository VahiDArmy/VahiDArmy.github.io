-- ============================================
-- اسکریپت دیتابیس Supabase
-- سامانه مشارکت سکه‌ای
-- ============================================

-- ============================================
-- جدول پروفایل‌ها
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    total_coins INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- ============================================
-- جدول تراکنش‌های سکه
-- ============================================
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coin_count INTEGER NOT NULL CHECK (coin_count > 0),
    amount INTEGER NOT NULL, -- مبلغ به تومان
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    receipt_url TEXT,
    receipt_type TEXT CHECK (receipt_type IN ('image', 'text')),
    receipt_text TEXT,
    admin_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.coin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.coin_transactions(created_at DESC);

-- ============================================
-- جدول تنظیمات
-- ============================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- درج تنظیمات پیش‌فرض
INSERT INTO public.settings (key, value, description) VALUES
    ('coin_price', '100000', 'قیمت هر سکه به تومان'),
    ('min_coins', '1', 'حداقل تعداد سکه'),
    ('max_coins', '50', 'حداکثر تعداد سکه'),
    ('fake_participants', '3', 'تعداد مشارکت‌کنندگان فیک'),
    ('fake_average', '12', 'میانگین اولیه فیک'),
    ('fake_min_average', '12', 'حداقل میانگین'),
    ('card_number', '"6037998243161691"', 'شماره کارت'),
    ('map_coordinates', '"35.6892,51.3890"', 'مختصات نقشه'),
    ('map_link', '"https://maps.google.com/?q=35.6892,51.3890"', 'لینک نقشه')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- جدول لاگ فعالیت‌ها
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.activity_logs(created_at DESC);

-- ============================================
-- جدول آمار روزانه
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    new_users INTEGER NOT NULL DEFAULT 0,
    new_transactions INTEGER NOT NULL DEFAULT 0,
    approved_transactions INTEGER NOT NULL DEFAULT 0,
    rejected_transactions INTEGER NOT NULL DEFAULT 0,
    total_coins INTEGER NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- توابع و تریگرها
-- ============================================

-- تریگر به‌روزرسانی updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- اعمال تریگر به جداول
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_transactions ON public.coin_transactions;
CREATE TRIGGER set_updated_at_transactions
    BEFORE UPDATE ON public.coin_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- تریگر ایجاد پروفایل پس از ثبت‌نام
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'کاربر جدید'),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- تابع به‌روزرسانی آمار روزانه
CREATE OR REPLACE FUNCTION public.update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.daily_stats (date, new_transactions, total_coins, total_amount)
    VALUES (
        CURRENT_DATE,
        1,
        NEW.coin_count,
        NEW.amount
    )
    ON CONFLICT (date) DO UPDATE SET
        new_transactions = daily_stats.new_transactions + 1,
        total_coins = daily_stats.total_coins + NEW.coin_count,
        total_amount = daily_stats.total_amount + NEW.amount,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_transaction_created ON public.coin_transactions;
CREATE TRIGGER on_transaction_created
    AFTER INSERT ON public.coin_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_daily_stats();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- فعال‌سازی RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- سیاست‌های پروفایل
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- سیاست‌های تراکنش
CREATE POLICY "transactions_select_own" ON public.coin_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own" ON public.coin_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_admin_all" ON public.coin_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- سیاست‌های تنظیمات
CREATE POLICY "settings_select_all" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "settings_admin_all" ON public.settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- سیاست‌های لاگ
CREATE POLICY "logs_admin_all" ON public.activity_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- سیاست‌های آمار
CREATE POLICY "stats_select_all" ON public.daily_stats
    FOR SELECT USING (true);

-- ============================================
-- Storage
-- ============================================

-- ایجاد باکت برای فیش‌ها
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- سیاست‌های Storage
CREATE POLICY "receipts_upload_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "receipts_select_own" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "receipts_admin_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'receipts' AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- Views
-- ============================================

-- نمای آمار کلی
CREATE OR REPLACE VIEW public.overview_stats AS
SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'user') AS total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'user' AND created_at >= CURRENT_DATE) AS new_users_today,
    (SELECT COUNT(*) FROM public.coin_transactions) AS total_transactions,
    (SELECT COUNT(*) FROM public.coin_transactions WHERE status = 'pending') AS pending_transactions,
    (SELECT COUNT(*) FROM public.coin_transactions WHERE status = 'approved') AS approved_transactions,
    (SELECT COUNT(*) FROM public.coin_transactions WHERE status = 'rejected') AS rejected_transactions,
    (SELECT COALESCE(SUM(coin_count), 0) FROM public.coin_transactions WHERE status = 'approved') AS total_coins,
    (SELECT COALESCE(SUM(amount), 0) FROM public.coin_transactions WHERE status = 'approved') AS total_amount,
    (SELECT COALESCE(AVG(coin_count), 0) FROM public.coin_transactions WHERE status = 'approved') AS average_coins;

-- نمای آمار کاربران
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
    p.id,
    p.name,
    p.phone,
    p.role,
    p.status,
    p.created_at,
    COUNT(t.id) AS transaction_count,
    COALESCE(SUM(CASE WHEN t.status = 'approved' THEN t.coin_count ELSE 0 END), 0) AS approved_coins,
    COALESCE(SUM(CASE WHEN t.status = 'pending' THEN t.coin_count ELSE 0 END), 0) AS pending_coins,
    MAX(t.created_at) AS last_transaction_at
FROM public.profiles p
LEFT JOIN public.coin_transactions t ON p.id = t.user_id
GROUP BY p.id;

-- ============================================
-- داده‌های اولیه
-- ============================================

-- ایجاد ادمین پیش‌فرض (اختیاری - پس از ایجاد کاربر در Auth)
-- UPDATE public.profiles SET role = 'admin' WHERE phone = '09XXXXXXXXX';