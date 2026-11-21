-- Safe to re-run. If the old unprefixed tables exist, they are renamed (data preserved).

create extension if not exists pgcrypto;

-- ========== MIGRATION: old unprefixed names → qwenai_ ==========
do $$
declare
  old_name text;
  new_name text;
begin
  foreach old_name in array array['profiles','projects','conversations','messages','models','prompts'] loop
    new_name := 'qwenai_' || old_name;
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=old_name)
       and not exists (select 1 from information_schema.tables where table_schema='public' and table_name=new_name) then
      execute format('alter table public.%I rename to %I', old_name, new_name);
    end if;
  end loop;
end $$;

-- ========== TABLES ==========
create table if not exists public.qwenai_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwenai_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text default '📁',
  instructions text not null default '',
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwenai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.qwenai_projects(id) on delete set null,
  title text not null default 'New chat',
  model_id text not null default 'openrouter/free',
  locked_model text,
  router_mode text not null default 'sticky' check (router_mode in ('sticky','router')),
  system_prompt text not null default '',
  params jsonb not null default '{}'::jsonb,
  branch_map jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qwenai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.qwenai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.qwenai_messages(id) on delete cascade,
  role text not null check (role in ('system','user','assistant')),
  content text not null default '',
  reasoning text not null default '',
  model text,
  status text not null default 'complete' check (status in ('complete','streaming','error','stopped')),
  error text,
  request_json jsonb,
  meta_json jsonb,
  attachments jsonb not null default '[]'::jsonb,
  feedback smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.qwenai_models (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  info jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  pinned boolean not null default false,
  stale boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.qwenai_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ========== INDEXES ==========
create index if not exists idx_conv_user_updated on public.qwenai_conversations (user_id, updated_at desc);
create index if not exists idx_msg_conv_created on public.qwenai_messages (conversation_id, created_at);
create index if not exists idx_msg_user on public.qwenai_messages (user_id);
create index if not exists idx_msg_parent on public.qwenai_messages (parent_id);
create index if not exists idx_projects_user on public.qwenai_projects (user_id);
create index if not exists idx_prompts_user on public.qwenai_prompts (user_id);
create index if not exists idx_models_user on public.qwenai_models (user_id);

-- ========== RLS ==========
alter table public.qwenai_profiles enable row level security;
alter table public.qwenai_projects enable row level security;
alter table public.qwenai_conversations enable row level security;
alter table public.qwenai_messages enable row level security;
alter table public.qwenai_models enable row level security;
alter table public.qwenai_prompts enable row level security;

drop policy if exists "own profile" on public.qwenai_profiles;
create policy "own profile" on public.qwenai_profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own projects" on public.qwenai_projects;
create policy "own projects" on public.qwenai_projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own conversations" on public.qwenai_conversations;
create policy "own conversations" on public.qwenai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own messages" on public.qwenai_messages;
create policy "own messages" on public.qwenai_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own models" on public.qwenai_models;
create policy "own models" on public.qwenai_models for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own prompts" on public.qwenai_prompts;
create policy "own prompts" on public.qwenai_prompts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ========== TRIGGERS ==========
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.qwenai_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.qwenai_profiles;
create trigger trg_profiles_touch before update on public.qwenai_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_projects_touch on public.qwenai_projects;
create trigger trg_projects_touch before update on public.qwenai_projects
for each row execute function public.touch_updated_at();

drop trigger if exists trg_conversations_touch on public.qwenai_conversations;
create trigger trg_conversations_touch before update on public.qwenai_conversations
for each row execute function public.touch_updated_at();
