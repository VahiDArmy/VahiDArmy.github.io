-- Nūr · Istighfār — run this ONCE in Supabase → SQL Editor.
-- Until it is run, the app works fully as a guest / local reader;
-- cloud sync will report "setup needed" instead of failing silently.
-- If you already created the OLD unprefixed tables, rename instead:
--   alter table public.user_state     rename to istigfarqwen_user_state;
--   alter table public.daily_activity rename to istigfarqwen_daily_activity;

create table if not exists public.istigfarqwen_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.istigfarqwen_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  reads int not null default 0,
  tasbih int not null default 0,
  seconds int not null default 0,
  primary key (user_id, day)
);

alter table public.istigfarqwen_user_state enable row level security;
alter table public.istigfarqwen_daily_activity enable row level security;

drop policy if exists "state_select" on public.istigfarqwen_user_state;
drop policy if exists "state_insert" on public.istigfarqwen_user_state;
drop policy if exists "state_update" on public.istigfarqwen_user_state;
create policy "state_select" on public.istigfarqwen_user_state for select using (auth.uid() = user_id);
create policy "state_insert" on public.istigfarqwen_user_state for insert with check (auth.uid() = user_id);
create policy "state_update" on public.istigfarqwen_user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "act_select" on public.istigfarqwen_daily_activity;
drop policy if exists "act_insert" on public.istigfarqwen_daily_activity;
drop policy if exists "act_update" on public.istigfarqwen_daily_activity;
create policy "act_select" on public.istigfarqwen_daily_activity for select using (auth.uid() = user_id);
create policy "act_insert" on public.istigfarqwen_daily_activity for insert with check (auth.uid() = user_id);
create policy "act_update" on public.istigfarqwen_daily_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
