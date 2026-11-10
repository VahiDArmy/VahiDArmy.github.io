-- ============================================================
--  شادی‌یار (Joyyar) — Karma Scale Update (-5 to +5)
--  Execute this file to migrate from the old scale (-2 to +2).
-- ============================================================

-- حذف محدودیت قبلی (اگر وجود داشته باشد)
alter table public.joy_entries
  drop constraint if exists joy_entries_karma_score_check;

-- افزودن محدودیت جدید برای مقیاس -5 تا +5
alter table public.joy_entries
  add constraint joy_entries_karma_score_check
  check (karma_score between -5 and 5);

comment on column public.joy_entries.karma_score is
  'کارما: -5=شیطانی, -4=خیلی منفی, -3=منفی, -2=کمی منفی, -1=کم, 0=خنثی, 1=خوب, 2=رضایت‌بخش, 3=شادی‌آور, 4=روحانی, 5=نورانی';
