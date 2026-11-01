-- =====================================================================
-- سینما من v4 — اسکیمای Supabase (امن و idempotent؛ چندبار اجرا شود مشکلی نیست)
-- تغییرات نسبت به نسخهٔ قبل:
--   • cinema_ai_models: ستون جدید «fails» (خطای مدل) — کنار wins (پذیرفته) و losses (ردشده)
--   • حذف جدول cinema_ai_models_deleted (دیگر لازم نیست؛ مدل ناخواسته فقط غیرفعال می‌شود)
--   • حذف ستون user_rating و ایندکسش (در هیچ جای برنامه استفاده نمی‌شد)
--   • حذف extension «uuid-ossp» (gen_random_uuid() خودش در Postgres هست)
--   • پالیسی‌های تکراری مدل‌ها یکی شد
-- =====================================================================

-- ---------- عنوان‌ها ----------
CREATE TABLE IF NOT EXISTS public.cinema_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id integer,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'good' CHECK (category IN ('love','good','hate')),  -- قدیمی؛ فقط برای سازگاری، امتیاز واقعی = rating
  type text NOT NULL DEFAULT 'series',
  genre text DEFAULT '',
  year integer,
  rating real DEFAULT 0,
  favorite boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  watched_date text,
  summary text DEFAULT '',
  original_title text DEFAULT '',
  seasons integer,
  episodes integer,
  episodes_per_season integer,
  country text DEFAULT '',
  language text DEFAULT '',
  status text DEFAULT '',
  reason text DEFAULT '',
  story_analysis text DEFAULT '',          -- JSON به‌صورت متن
  ai_standardized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_rating ON public.cinema_titles(rating);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_created ON public.cinema_titles(created_at);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_user ON public.cinema_titles(user_id);
DROP INDEX IF EXISTS public.idx_cinema_titles_category;

-- ---------- فعالیت‌ها و متا ----------
CREATE TABLE IF NOT EXISTS public.cinema_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_cinema_activity_created ON public.cinema_activity(created_at);

CREATE TABLE IF NOT EXISTS public.cinema_meta (       -- k='ai_model' → مدل انتخاب‌شدهٔ سایت
  k text PRIMARY KEY,
  v text,
  user_id uuid DEFAULT auth.uid()
);

-- ---------- گفتگوهای ذخیره‌شده ----------
CREATE TABLE IF NOT EXISTS public.cinema_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES public.cinema_titles(id) ON DELETE SET NULL,
  title_context text DEFAULT '',
  prompt text NOT NULL,
  response text DEFAULT '',
  ai_model text DEFAULT '',                -- نام مدل (متن)
  tags text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_cinema_conv_title ON public.cinema_conversations(title_id);
CREATE INDEX IF NOT EXISTS idx_cinema_conv_created ON public.cinema_conversations(created_at);

-- ---------- استخر مدل‌ها + بازخورد ----------
CREATE TABLE IF NOT EXISTS public.cinema_ai_models (
  id text PRIMARY KEY,                     -- شناسهٔ مدل (مثلاً meta-llama/llama-3.3-70b-instruct:free)
  label text NOT NULL,
  vendor text DEFAULT '',
  provider text NOT NULL DEFAULT 'openrouter',   -- google | openrouter
  context text DEFAULT '',                 -- مثل 128K
  active boolean NOT NULL DEFAULT true,    -- در انتخاب تصادفی شرکت کند؟
  wins integer NOT NULL DEFAULT 0,         -- کاربر نتیجه را پذیرفت
  losses integer NOT NULL DEFAULT 0,       -- کاربر نتیجه را رد کرد
  fails integer NOT NULL DEFAULT 0,        -- خطا یا پاسخ نامعتبر
  last_tried_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- برای دیتابیس‌های موجود (نسخهٔ قبل):
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openrouter';
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS fails integer NOT NULL DEFAULT 0;
ALTER TABLE public.cinema_ai_models ADD COLUMN IF NOT EXISTS last_tried_at timestamptz;
UPDATE public.cinema_ai_models SET provider = 'google' WHERE id ILIKE 'gemini%' AND provider <> 'google';

-- ---------- امنیت (RLS) ----------
ALTER TABLE public.cinema_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_ai_models ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_titles' AND policyname = 'Users can manage own titles') THEN
    CREATE POLICY "Users can manage own titles" ON public.cinema_titles
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_activity' AND policyname = 'Users can manage own activity') THEN
    CREATE POLICY "Users can manage own activity" ON public.cinema_activity
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_meta' AND policyname = 'Users can manage own meta') THEN
    CREATE POLICY "Users can manage own meta" ON public.cinema_meta
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_conversations' AND policyname = 'Users can manage own conversations') THEN
    CREATE POLICY "Users can manage own conversations" ON public.cinema_conversations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  -- مدل‌ها مشترک‌اند (بدون user_id): فقط کاربر واردشده؛ پالیسی‌های تکراری قبلی حذف می‌شوند
  DROP POLICY IF EXISTS "Anyone can read AI models" ON public.cinema_ai_models;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_ai_models' AND policyname = 'Authenticated can manage AI models') THEN
    CREATE POLICY "Authenticated can manage AI models" ON public.cinema_ai_models
      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ---------- پاک‌سازی چیزهای بی‌استفاده (بعد از بررسی اجرا کن؛ برگشت‌پذیر نیست) ----------
-- DROP TABLE IF EXISTS public.cinema_ai_models_deleted;
-- DROP INDEX IF EXISTS public.idx_cinema_ai_models_rating;
-- ALTER TABLE public.cinema_ai_models
--   DROP COLUMN IF EXISTS user_rating, DROP COLUMN IF EXISTS is_free, DROP COLUMN IF EXISTS source,
--   DROP COLUMN IF EXISTS fetched_at, DROP COLUMN IF EXISTS recommended, DROP COLUMN IF EXISTS best_for,
--   DROP COLUMN IF EXISTS tags, DROP COLUMN IF EXISTS note, DROP COLUMN IF EXISTS size,
--   DROP COLUMN IF EXISTS speed;
