-- ============================================================
--  شادی‌یار (Joyyar) — additional tables
--  Safe to run alongside existing project schema.
--  All tables are prefixed with joy_ to avoid conflicts.
--  Run once in Supabase SQL editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) joy_entries  — daily joy records
-- ------------------------------------------------------------
create table if not exists public.joy_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  emoji text not null default '✨',
  category text not null default 'other',
  joy_score int not null default 5 check (joy_score between 1 and 10),
  money_spent numeric(14,2) not null default 0 check (money_spent >= 0),
  time_spent_minutes int not null default 0 check (time_spent_minutes >= 0),
  tags text[] not null default '{}',
  entry_date date not null default current_date,
  entry_time time,
  is_favorite boolean not null default false,
  location text,
  with_people text,
  mood_before text,
  mood_after text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists joy_entries_user_date_idx
  on public.joy_entries (user_id, entry_date desc);
create index if not exists joy_entries_user_created_idx
  on public.joy_entries (user_id, created_at desc);
create index if not exists joy_entries_category_idx
  on public.joy_entries (user_id, category);
create index if not exists joy_entries_tags_idx
  on public.joy_entries using gin (tags);

alter table public.joy_entries enable row level security;

drop policy if exists "joy_entries_select_own" on public.joy_entries;
create policy "joy_entries_select_own" on public.joy_entries
  for select using (auth.uid() = user_id);

drop policy if exists "joy_entries_insert_own" on public.joy_entries;
create policy "joy_entries_insert_own" on public.joy_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_entries_update_own" on public.joy_entries;
create policy "joy_entries_update_own" on public.joy_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_entries_delete_own" on public.joy_entries;
create policy "joy_entries_delete_own" on public.joy_entries
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) joy_goals — self-care / joy goals
-- ------------------------------------------------------------
create table if not exists public.joy_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_type text not null default 'count'
    check (target_type in ('count','money','time','score')),
  target_value numeric(14,2) not null default 1 check (target_value >= 0),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  period text not null default 'week'
    check (period in ('week','month','year','all')),
  category text,
  deadline date,
  status text not null default 'active'
    check (status in ('active','done','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists joy_goals_user_idx
  on public.joy_goals (user_id, status);

alter table public.joy_goals enable row level security;

drop policy if exists "joy_goals_select_own" on public.joy_goals;
create policy "joy_goals_select_own" on public.joy_goals
  for select using (auth.uid() = user_id);

drop policy if exists "joy_goals_insert_own" on public.joy_goals;
create policy "joy_goals_insert_own" on public.joy_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_goals_update_own" on public.joy_goals;
create policy "joy_goals_update_own" on public.joy_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_goals_delete_own" on public.joy_goals;
create policy "joy_goals_delete_own" on public.joy_goals
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) joy_wishlist — things I want to gift myself
-- ------------------------------------------------------------
create table if not exists public.joy_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  estimated_cost numeric(14,2) not null default 0 check (estimated_cost >= 0),
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  url text,
  category text not null default 'other',
  is_done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists joy_wishlist_user_idx
  on public.joy_wishlist (user_id, is_done);

alter table public.joy_wishlist enable row level security;

drop policy if exists "joy_wishlist_select_own" on public.joy_wishlist;
create policy "joy_wishlist_select_own" on public.joy_wishlist
  for select using (auth.uid() = user_id);

drop policy if exists "joy_wishlist_insert_own" on public.joy_wishlist;
create policy "joy_wishlist_insert_own" on public.joy_wishlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_wishlist_update_own" on public.joy_wishlist;
create policy "joy_wishlist_update_own" on public.joy_wishlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_wishlist_delete_own" on public.joy_wishlist;
create policy "joy_wishlist_delete_own" on public.joy_wishlist
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4) joy_reflections — evening reflections / gratitude
-- ------------------------------------------------------------
create table if not exists public.joy_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  mood text not null default 'neutral',
  content text not null,
  gratitude text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists joy_reflections_user_idx
  on public.joy_reflections (user_id, entry_date desc);

alter table public.joy_reflections enable row level security;

drop policy if exists "joy_reflections_select_own" on public.joy_reflections;
create policy "joy_reflections_select_own" on public.joy_reflections
  for select using (auth.uid() = user_id);

drop policy if exists "joy_reflections_insert_own" on public.joy_reflections;
create policy "joy_reflections_insert_own" on public.joy_reflections
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_reflections_update_own" on public.joy_reflections;
create policy "joy_reflections_update_own" on public.joy_reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_reflections_delete_own" on public.joy_reflections;
create policy "joy_reflections_delete_own" on public.joy_reflections
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5) joy_settings — per-user preferences
-- ------------------------------------------------------------
create table if not exists public.joy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light','dark')),
  currency text not null default 'تومان',
  daily_goal int not null default 1 check (daily_goal >= 0),
  display_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.joy_settings enable row level security;

drop policy if exists "joy_settings_select_own" on public.joy_settings;
create policy "joy_settings_select_own" on public.joy_settings
  for select using (auth.uid() = user_id);

drop policy if exists "joy_settings_insert_own" on public.joy_settings;
create policy "joy_settings_insert_own" on public.joy_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_settings_update_own" on public.joy_settings;
create policy "joy_settings_update_own" on public.joy_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_settings_delete_own" on public.joy_settings;
create policy "joy_settings_delete_own" on public.joy_settings
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6) shared updated_at trigger
-- ------------------------------------------------------------
create or replace function public.joy_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists joy_entries_touch on public.joy_entries;
create trigger joy_entries_touch
  before update on public.joy_entries
  for each row execute function public.joy_touch_updated_at();

drop trigger if exists joy_goals_touch on public.joy_goals;
create trigger joy_goals_touch
  before update on public.joy_goals
  for each row execute function public.joy_touch_updated_at();

drop trigger if exists joy_wishlist_touch on public.joy_wishlist;
create trigger joy_wishlist_touch
  before update on public.joy_wishlist
  for each row execute function public.joy_touch_updated_at();

drop trigger if exists joy_reflections_touch on public.joy_reflections;
create trigger joy_reflections_touch
  before update on public.joy_reflections
  for each row execute function public.joy_touch_updated_at();

drop trigger if exists joy_settings_touch on public.joy_settings;
create trigger joy_settings_touch
  before update on public.joy_settings
  for each row execute function public.joy_touch_updated_at();
