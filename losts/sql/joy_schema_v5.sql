-- ============================================================
--  شادی‌یار (Joyyar) — Karma Separation Update
--  Run this in Supabase SQL Editor to create the Karma table.
-- ============================================================

create table if not exists public.joy_karma_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  karma_score int not null check (karma_score between -5 and 5),
  action_date date not null default current_date,
  action_time time,
  related_people uuid[] default '{}',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists joy_karma_user_date_idx
  on public.joy_karma_actions (user_id, action_date desc);

alter table public.joy_karma_actions enable row level security;

drop policy if exists "joy_karma_select_own" on public.joy_karma_actions;
create policy "joy_karma_select_own" on public.joy_karma_actions
  for select using (auth.uid() = user_id);

drop policy if exists "joy_karma_insert_own" on public.joy_karma_actions;
create policy "joy_karma_insert_own" on public.joy_karma_actions
  for insert with check (auth.uid() = user_id);

drop policy if exists "joy_karma_update_own" on public.joy_karma_actions;
create policy "joy_karma_update_own" on public.joy_karma_actions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "joy_karma_delete_own" on public.joy_karma_actions;
create policy "joy_karma_delete_own" on public.joy_karma_actions
  for delete using (auth.uid() = user_id);
