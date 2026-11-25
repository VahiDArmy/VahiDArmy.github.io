-- Nūr · progress tables (prefixed, as requested earlier)
create table if not exists public.istigfarqwen_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.istigfarqwen_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  reads int default 0, tasbih int default 0, seconds int default 0,
  primary key (user_id, day)
);
alter table public.istigfarqwen_user_state enable row level security;
alter table public.istigfarqwen_daily_activity enable row level security;

drop policy if exists s_sel on public.istigfarqwen_user_state;
drop policy if exists s_ins on public.istigfarqwen_user_state;
drop policy if exists s_upd on public.istigfarqwen_user_state;
create policy s_sel on public.istigfarqwen_user_state for select using (auth.uid()=user_id);
create policy s_ins on public.istigfarqwen_user_state for insert with check (auth.uid()=user_id);
create policy s_upd on public.istigfarqwen_user_state for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists a_sel on public.istigfarqwen_daily_activity;
drop policy if exists a_ins on public.istigfarqwen_daily_activity;
drop policy if exists a_upd on public.istigfarqwen_daily_activity;
create policy a_sel on public.istigfarqwen_daily_activity for select using (auth.uid()=user_id);
create policy a_ins on public.istigfarqwen_daily_activity for insert with check (auth.uid()=user_id);
create policy a_upd on public.istigfarqwen_daily_activity for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
