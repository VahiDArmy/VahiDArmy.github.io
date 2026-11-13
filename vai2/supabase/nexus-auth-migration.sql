-- ============================================================
-- NEXUS CHAT — PER-USER TABLES
-- Drops ONLY nexus_* tables (ours). Never touches existing tables.
-- Requires Supabase Auth enabled. Every row is scoped to auth.uid().
-- ============================================================

-- Drop our old nexus_* tables (safe — they're ours, no user_id, unusable)
drop table if exists public.nexus_feedback cascade;
drop table if exists public.nexus_generations cascade;
drop table if exists public.nexus_activity cascade;
drop table if exists public.nexus_chats cascade;
drop table if exists public.nexus_kv cascade;

-- ---------- nexus_chats: per-user chat backups ----------
create table public.nexus_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid not null,
  title text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, chat_id)
);
create index nexus_chats_user_updated_idx
  on public.nexus_chats (user_id, updated_at desc);

-- ---------- nexus_kv: per-user key/value store ----------
create table public.nexus_kv (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  k text not null,
  v text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

-- ---------- nexus_activity: per-user audit trail ----------
create table public.nexus_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null,
  entity text,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index nexus_activity_user_created_idx
  on public.nexus_activity (user_id, created_at desc);

-- ---------- nexus_generations: one per chat+message ----------
create table public.nexus_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid not null,
  message_index int not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, chat_id, message_index)
);

-- ---------- nexus_feedback: thumbs up/down ----------
create table public.nexus_feedback (
  generation_id uuid primary key references public.nexus_generations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  updated_at timestamptz not null default now()
);

-- ---------- RLS: strictly per-user, no anonymous access ----------
alter table public.nexus_chats       enable row level security;
alter table public.nexus_kv          enable row level security;
alter table public.nexus_activity    enable row level security;
alter table public.nexus_generations enable row level security;
alter table public.nexus_feedback    enable row level security;

create policy nexus_chats_own on public.nexus_chats
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy nexus_kv_own on public.nexus_kv
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy nexus_activity_own on public.nexus_activity
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy nexus_generations_own on public.nexus_generations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy nexus_feedback_own on public.nexus_feedback
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Confirm email settings ----------
-- In Supabase Dashboard → Authentication → Providers → Email:
--   • "Enable email confirmations" — your choice. If ON, users must
--     click a link before signing in. The auth UI handles both cases.
--   • "Disable signups" — leave OFF to allow self-service signup.
