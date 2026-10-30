-- Safe / idempotent schema for cinema tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.cinema_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id integer,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('love','good','hate')),
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
  story_analysis text DEFAULT '',
  ai_standardized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_cinema_titles_category ON public.cinema_titles(category);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_rating ON public.cinema_titles(rating);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_created ON public.cinema_titles(created_at);
CREATE INDEX IF NOT EXISTS idx_cinema_titles_user ON public.cinema_titles(user_id);

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

CREATE TABLE IF NOT EXISTS public.cinema_meta (
  k text PRIMARY KEY,
  v text,
  user_id uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.cinema_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES public.cinema_titles(id) ON DELETE SET NULL,
  title_context text DEFAULT '',
  prompt text NOT NULL,
  response text DEFAULT '',
  ai_model text DEFAULT '',
  tags text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_cinema_conv_title ON public.cinema_conversations(title_id);
CREATE INDEX IF NOT EXISTS idx_cinema_conv_created ON public.cinema_conversations(created_at);

CREATE TABLE IF NOT EXISTS public.cinema_ai_models (
  id text PRIMARY KEY,
  label text NOT NULL,
  vendor text DEFAULT '',
  size text DEFAULT '',
  context text DEFAULT '',
  speed text DEFAULT '',
  note text DEFAULT '',
  tags text DEFAULT '',
  recommended boolean NOT NULL DEFAULT false,
  best_for text DEFAULT '',
  is_free boolean NOT NULL DEFAULT true,
  source text DEFAULT 'seed',
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- وضعیت فعال/غیرفعال + آمار roulette + امتیاز کاربر
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'openrouter';
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS last_tried_at timestamptz;
ALTER TABLE public.cinema_ai_models
  ADD COLUMN IF NOT EXISTS user_rating integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cinema_ai_models_rating
  ON public.cinema_ai_models(user_rating);

CREATE TABLE IF NOT EXISTS public.cinema_ai_models_deleted (
  id text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cinema_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_ai_models_deleted ENABLE ROW LEVEL SECURITY;

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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_ai_models' AND policyname = 'Anyone can read AI models') THEN
    CREATE POLICY "Anyone can read AI models" ON public.cinema_ai_models FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_ai_models' AND policyname = 'Authenticated can manage AI models') THEN
    CREATE POLICY "Authenticated can manage AI models" ON public.cinema_ai_models
      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_ai_models_deleted' AND policyname = 'Anyone can read deleted models') THEN
    CREATE POLICY "Anyone can read deleted models" ON public.cinema_ai_models_deleted FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cinema_ai_models_deleted' AND policyname = 'Authenticated can manage deleted models') THEN
    CREATE POLICY "Authenticated can manage deleted models" ON public.cinema_ai_models_deleted
      FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;