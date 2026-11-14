-- ═══════════════════════════════════════════════════════════════════════════
--  معراج · MI'RAJ  —  database schema
--  Safe to re-run. Every table is prefixed with meraj_ so it cannot collide
--  with an existing app schema (including public.profiles).
--  Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Housekeeping ──────────────────────────────────────────────────────────
create or replace function public.meraj_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profiles (extension of auth.users) ────────────────────────────────────
create table if not exists public.meraj_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_seed  text,
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Model catalogue (fetched from OpenRouter, stored per user) ────────────
create table if not exists public.meraj_models (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  slug                   text not null,
  canonical_slug         text,
  name                   text not null,
  provider               text,
  description            text,
  context_length         integer,
  max_completion_tokens  integer,
  architecture           jsonb not null default '{}'::jsonb,
  pricing                jsonb not null default '{}'::jsonb,
  supported_parameters   jsonb not null default '[]'::jsonb,
  is_free                boolean not null default true,
  is_active              boolean not null default true,
  is_favorite            boolean not null default false,
  sort_order             integer not null default 0,
  metadata               jsonb not null default '{}'::jsonb,
  first_seen_at          timestamptz not null default now(),
  last_synced_at         timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists meraj_models_user_active_idx
  on public.meraj_models (user_id, is_active, name);
create index if not exists meraj_models_user_favorite_idx
  on public.meraj_models (user_id, is_favorite) where is_favorite;

-- ─── Conversations ─────────────────────────────────────────────────────────
create table if not exists public.meraj_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'New conversation',
  model_slug      text not null default 'openrouter/free',
  system_prompt   text,
  params          jsonb not null default
    '{"temperature":0.7,"top_p":1,"max_tokens":2048,"reasoning":"off"}'::jsonb,
  pinned          boolean not null default false,
  archived        boolean not null default false,
  folder          text,
  active_leaf_id  uuid,
  message_count   integer not null default 0,
  total_tokens    bigint not null default 0,
  last_message_at timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists meraj_conversations_user_recent_idx
  on public.meraj_conversations (user_id, archived, pinned desc, last_message_at desc);
create index if not exists meraj_conversations_user_updated_idx
  on public.meraj_conversations (user_id, updated_at desc);

-- ─── Messages (a tree: branches are siblings sharing a parent) ─────────────
create table if not exists public.meraj_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.meraj_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  parent_id       uuid references public.meraj_messages(id) on delete cascade,
  role            text not null check (role in ('system', 'user', 'assistant')),
  content         text not null default '',
  reasoning       text,
  model_slug      text,
  requested_model text,
  status          text not null default 'complete'
    check (status in ('complete', 'streaming', 'stopped', 'error', 'interrupted')),
  error           jsonb,
  usage           jsonb,
  request         jsonb,
  response_meta   jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists meraj_messages_conversation_idx
  on public.meraj_messages (conversation_id, created_at);
create index if not exists meraj_messages_parent_idx
  on public.meraj_messages (parent_id);
create index if not exists meraj_messages_user_idx
  on public.meraj_messages (user_id);

-- ─── Saved prompts / personas ──────────────────────────────────────────────
create table if not exists public.meraj_prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text not null,
  category    text not null default 'general',
  icon        text not null default 'spark',
  is_favorite boolean not null default false,
  use_count   integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists meraj_prompts_user_idx
  on public.meraj_prompts (user_id, created_at desc);

-- ─── Analytics events (one row per outbound completion attempt) ────────────
create table if not exists public.meraj_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.meraj_conversations(id) on delete set null,
  message_id      uuid references public.meraj_messages(id) on delete set null,
  kind            text not null default 'completion',
  model_slug      text,
  requested_model text,
  status          text not null default 'ok',
  http_status     integer,
  error_code      text,
  error_message   text,
  prompt_tokens   integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens    integer not null default 0,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create index if not exists meraj_events_user_created_idx
  on public.meraj_events (user_id, created_at desc);
create index if not exists meraj_events_user_model_idx
  on public.meraj_events (user_id, model_slug);

-- ─── updated_at triggers ───────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'meraj_profiles', 'meraj_models', 'meraj_conversations',
    'meraj_messages', 'meraj_prompts'
  ]
  loop
    execute format('drop trigger if exists meraj_set_updated_at on public.%I', t);
    execute format(
      'create trigger meraj_set_updated_at before update on public.%I
       for each row execute function public.meraj_touch_updated_at()', t
    );
  end loop;
end $$;

-- ─── Profile bootstrap on sign-up ──────────────────────────────────────────
create or replace function public.meraj_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.meraj_profiles (user_id, display_name, avatar_seed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'traveller'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_seed', substr(md5(random()::text || clock_timestamp()::text), 1, 12))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists meraj_on_auth_user_created on auth.users;
create trigger meraj_on_auth_user_created
  after insert on auth.users
  for each row execute function public.meraj_handle_new_user();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.meraj_profiles      enable row level security;
alter table public.meraj_models        enable row level security;
alter table public.meraj_conversations enable row level security;
alter table public.meraj_messages      enable row level security;
alter table public.meraj_prompts       enable row level security;
alter table public.meraj_events        enable row level security;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'meraj_profiles', 'meraj_models', 'meraj_conversations',
    'meraj_messages', 'meraj_prompts', 'meraj_events'
  ]
  loop
    -- drop any prior version of our policy (idempotent re-run)
    execute format('drop policy if exists "meraj_owner_all" on public.%I', t);
    execute format(
      'create policy "meraj_owner_all" on public.%I
       for all to authenticated
       using (auth.uid() = user_id)
       with check (auth.uid() = user_id)', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- The profile table is keyed by user_id, not id — RLS above already uses user_id.
-- Anonymous visitors get no access to application data.
revoke all on public.meraj_profiles, public.meraj_models, public.meraj_conversations,
  public.meraj_messages, public.meraj_prompts, public.meraj_events from anon;

-- ─── Diagnostics helper (optional, safe) ───────────────────────────────────
-- Lists the meraj_ tables that exist and whether RLS is enabled.
create or replace view public.meraj_schema_status
with (security_invoker = true) as
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'meraj_profiles', 'meraj_models', 'meraj_conversations',
    'meraj_messages', 'meraj_prompts', 'meraj_events'
  )
order by c.relname;

grant select on public.meraj_schema_status to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Done. The app will now pass its schema check and store all data here.
--  Authentication continues to use your existing Supabase Auth users.
-- ═══════════════════════════════════════════════════════════════════════════
