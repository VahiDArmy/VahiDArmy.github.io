-- ============================================================================
-- Nebula AI Studio — Supabase schema
-- Run this once in Supabase → SQL Editor → New query.
-- It is idempotent: re-running keeps your data and simply refreshes policies.
--
-- Tables (all prefixed fbai_):
--   fbai_profiles       one row per auth user: settings + OpenRouter key
--   fbai_conversations  chats: model choice, params, pin/archive
--   fbai_messages       the message tree (parent_id → branches), raw requests
--   fbai_models         per-user cache of free OpenRouter models (no duplicates)
--   fbai_prompts        reusable prompt library
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- profiles
create table if not exists public.fbai_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  openrouter_key text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------- model catalog
-- Composite primary key (user_id, model_id) makes duplicates impossible:
-- syncing upserts metadata but keeps each model in exactly one row.
create table if not exists public.fbai_models (
  user_id uuid not null references auth.users (id) on delete cascade,
  model_id text not null,
  name text not null default '',
  description text default '',
  context_length integer default 0,
  pricing jsonb default '{}'::jsonb,
  architecture jsonb default '{}'::jsonb,
  supported_parameters jsonb default '[]'::jsonb,
  is_free boolean not null default true,
  active boolean not null default true,
  favorite boolean not null default false,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

-- ------------------------------------------------------------- conversations
create table if not exists public.fbai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  model_id text,
  lock_auto_model boolean not null default true,
  system_prompt text,
  params jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  archived boolean not null default false,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ messages
-- parent_id is the branch pointer. A reply can have several siblings, which is
-- exactly how edit/regenerate/branching works. Deleting a node cascades to its
-- whole subtree.
create table if not exists public.fbai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.fbai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.fbai_messages (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null default '',
  reasoning text,
  model text,
  requested_model text,
  status text not null default 'complete',
  error text,
  raw_request jsonb,
  raw_response jsonb,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- prompts
create table if not exists public.fbai_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- indexes
create index if not exists fbai_conversations_user_idx
  on public.fbai_conversations (user_id, pinned desc, last_message_at desc);
create index if not exists fbai_messages_conversation_idx
  on public.fbai_messages (conversation_id, created_at);
create index if not exists fbai_messages_parent_idx
  on public.fbai_messages (parent_id);
create index if not exists fbai_messages_user_idx
  on public.fbai_messages (user_id, created_at desc);
create index if not exists fbai_models_user_idx
  on public.fbai_models (user_id, active);
create index if not exists fbai_prompts_user_idx
  on public.fbai_prompts (user_id, created_at desc);

-- ----------------------------------------------------------------------- RLS
alter table public.fbai_profiles enable row level security;
alter table public.fbai_models enable row level security;
alter table public.fbai_conversations enable row level security;
alter table public.fbai_messages enable row level security;
alter table public.fbai_prompts enable row level security;

drop policy if exists "fbai_profiles_own" on public.fbai_profiles;
create policy "fbai_profiles_own" on public.fbai_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "fbai_models_own" on public.fbai_models;
create policy "fbai_models_own" on public.fbai_models
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fbai_conversations_own" on public.fbai_conversations;
create policy "fbai_conversations_own" on public.fbai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fbai_messages_own" on public.fbai_messages;
create policy "fbai_messages_own" on public.fbai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fbai_prompts_own" on public.fbai_prompts;
create policy "fbai_prompts_own" on public.fbai_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------- profile auto-creation
create or replace function public.fbai_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fbai_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists fbai_on_auth_user_created on auth.users;
create trigger fbai_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fbai_handle_new_user();

-- ------------------------------------------------------------------ finished
-- Optional: verify everything exists.
-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name like 'fbai_%' order by 1;
