-- ============================================================
--  شادی‌یار (Joyyar) — People Integration Update
--  Run this in Supabase SQL Editor.
-- ============================================================

-- افزودن ستون آرایه‌ای برای نگهداری شناسه افراد همراه
alter table public.joy_entries
  add column if not exists related_people uuid[] default '{}';

comment on column public.joy_entries.related_people is
  'آرایه‌ای از شناسه افراد جدول people که در این شادی همراه کاربر بودند';
