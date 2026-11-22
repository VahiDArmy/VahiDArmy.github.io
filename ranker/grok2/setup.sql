-- Matrix Ranking App Schema (prefix: mx_)
-- Run this in Supabase SQL Editor as admin
-- Uses existing public.people and auth.users / profiles

-- Traits / Personality properties
CREATE TABLE IF NOT EXISTS public.mx_traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  color text DEFAULT '#6366f1',
  icon text DEFAULT 'sparkles',
  weight numeric DEFAULT 1.0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Scores: ranker scores a person on a trait
CREATE TABLE IF NOT EXISTS public.mx_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ranker_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  scored_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  trait_id uuid NOT NULL REFERENCES public.mx_traits(id) ON DELETE CASCADE,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 10),
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  note text,
  source text DEFAULT 'manual', -- manual, ai, import
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ranker_id, scored_id, trait_id)
);

-- Optional: sessions or views history
CREATE TABLE IF NOT EXISTS public.mx_view_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  view_mode text, -- 'trait' | 'ranker' | 'scored'
  stack_index integer DEFAULT 0,
  filters jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- AI insights cache
CREATE TABLE IF NOT EXISTS public.mx_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  context_type text, -- matrix, person, trait, global
  context_id uuid,
  prompt text,
  response text,
  model text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mx_scores_ranker ON public.mx_scores(ranker_id);
CREATE INDEX IF NOT EXISTS idx_mx_scores_scored ON public.mx_scores(scored_id);
CREATE INDEX IF NOT EXISTS idx_mx_scores_trait ON public.mx_scores(trait_id);
CREATE INDEX IF NOT EXISTS idx_mx_scores_composite ON public.mx_scores(ranker_id, scored_id, trait_id);

-- RLS (basic, adjust as needed)
ALTER TABLE public.mx_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_view_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read traits" ON public.mx_traits FOR SELECT USING (true);
CREATE POLICY "Auth insert traits" ON public.mx_traits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update own traits" ON public.mx_traits FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Auth all scores" ON public.mx_scores FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Own sessions" ON public.mx_view_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Own insights" ON public.mx_ai_insights FOR ALL USING (user_id = auth.uid());

-- Seed some traits
INSERT INTO public.mx_traits (name, slug, description, color, icon) VALUES
  ('Kindness', 'kindness', 'Compassion and empathy towards others', '#10b981', 'heart'),
  ('Bravery', 'bravery', 'Courage in face of fear or adversity', '#ef4444', 'shield'),
  ('Wisdom', 'wisdom', 'Deep understanding and good judgment', '#8b5cf6', 'brain'),
  ('Creativity', 'creativity', 'Originality and inventive thinking', '#f59e0b', 'palette'),
  ('Integrity', 'integrity', 'Honesty and strong moral principles', '#3b82f6', 'scale'),
  ('Humor', 'humor', 'Ability to amuse and find lightness', '#ec4899', 'laugh'),
  ('Ambition', 'ambition', 'Drive to achieve and grow', '#f97316', 'rocket'),
  ('Empathy', 'empathy', 'Understanding others emotions', '#14b8a6', 'users')
ON CONFLICT (slug) DO NOTHING;
