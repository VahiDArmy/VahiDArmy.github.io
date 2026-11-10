-- ============================================================
--  شادی‌یار (Joyyar) — Karma Update
--  Run this in Supabase SQL Editor to add Karma support.
-- ============================================================

alter table public.joy_entries
  add column if not exists karma_score integer not null default 1
  check (karma_score between -2 and 2);

comment on column public.joy_entries.karma_score is
  'کارما: -2=آسیب‌زننده, -1=کمی منفی, 0=خنثی, 1=آگاهانه, 2=مهربانانه';
