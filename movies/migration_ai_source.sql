-- AI source + will_watch status (idempotent)
ALTER TABLE public.cinema_titles
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN public.cinema_titles.source IS 'manual | ai';
COMMENT ON COLUMN public.cinema_titles.status IS 'empty | will_watch | ...';
