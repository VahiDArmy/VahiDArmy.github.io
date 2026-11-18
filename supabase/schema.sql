-- ============================================================================
-- Forgebook — Supabase schema
--
-- Run this once:  Supabase dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to re-run: every statement is idempotent.
--
-- Every table is prefixed fb_. Every row belonging to a user is protected by
-- Row Level Security keyed on auth.uid(), so the public publishable key used by
-- the browser cannot read or write another account's data.
--
-- The fb_models table is a shared cache of the public OpenRouter catalog, so
-- authenticated users may write to it (that is how the registry syncs).
-- Personal preferences live in fb_model_prefs and are never touched by sync.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.fb_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.fb_projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  description    text not null default '',
  stack          text not null default '',
  status         text not null default 'active',
  storage_mode   text not null default 'vault',
  file_count     integer not null default 0,
  byte_count     bigint not null default 0,
  last_opened_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists fb_projects_user_idx on public.fb_projects (user_id, updated_at desc);

drop trigger if exists fb_projects_touch on public.fb_projects;
create trigger fb_projects_touch before update on public.fb_projects
  for each row execute function public.fb_touch_updated_at();

-- ---------------------------------------------------------------------------
-- conversation
-- ---------------------------------------------------------------------------
create table if not exists public.fb_messages (
  id         bigserial primary key,
  project_id uuid not null references public.fb_projects (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id     uuid,
  role       text not null check (role in ('user', 'assistant', 'system')),
  kind       text not null default 'chat',
  content    text not null default '',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fb_messages_project_idx on public.fb_messages (project_id, id);

-- ---------------------------------------------------------------------------
-- project memory (one row per section: overview / architecture / decisions ...)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_memory (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.fb_projects (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section    text not null,
  content    text not null default '',
  source     text not null default 'ai',
  updated_at timestamptz not null default now(),
  unique (project_id, section)
);
create index if not exists fb_memory_project_idx on public.fb_memory (project_id);

-- ---------------------------------------------------------------------------
-- roadmap
-- ---------------------------------------------------------------------------
create table if not exists public.fb_tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.fb_projects (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phase          text not null default 'General',
  title          text not null,
  detail         text not null default '',
  status         text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  priority       integer not null default 2,
  sort_index     integer not null default 0,
  blocked_reason text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists fb_tasks_project_idx on public.fb_tasks (project_id, phase, sort_index);

drop trigger if exists fb_tasks_touch on public.fb_tasks;
create trigger fb_tasks_touch before update on public.fb_tasks
  for each row execute function public.fb_touch_updated_at();

-- ---------------------------------------------------------------------------
-- agent runs (one per instruction the agent works on)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_runs (
  id          uuid primary key,
  project_id  uuid not null references public.fb_projects (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instruction text not null default '',
  status      text not null default 'running'
              check (status in ('running', 'completed', 'failed', 'interrupted', 'cancelled', 'blocked', 'unverified')),
  model       text not null default '',
  summary     text not null default '',
  error       text not null default '',
  step_count  integer not null default 0,
  tokens_in   bigint not null default 0,
  tokens_out  bigint not null default 0,
  started_at  timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists fb_runs_project_idx on public.fb_runs (project_id, started_at desc);
create index if not exists fb_runs_live_idx on public.fb_runs (status) where status = 'running';

-- ---------------------------------------------------------------------------
-- agent activity log
-- ---------------------------------------------------------------------------
create table if not exists public.fb_steps (
  id          bigserial primary key,
  run_id      uuid not null references public.fb_runs (id) on delete cascade,
  project_id  uuid not null references public.fb_projects (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seq         integer not null default 0,
  type        text not null default 'tool',
  name        text not null default '',
  ok          boolean,
  duration_ms integer not null default 0,
  input       jsonb,
  output      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists fb_steps_run_idx on public.fb_steps (run_id, seq);

-- ---------------------------------------------------------------------------
-- checkpoints (metadata only; file bodies stay on the device)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_checkpoints (
  id         uuid primary key,
  project_id uuid not null references public.fb_projects (id) on delete cascade,
  run_id     uuid references public.fb_runs (id) on delete set null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label      text not null default '',
  file_count integer not null default 0,
  byte_count bigint not null default 0,
  restored_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fb_checkpoints_project_idx on public.fb_checkpoints (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- file index (structure memory, so another device can see the shape of project)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_file_index (
  project_id uuid not null references public.fb_projects (id) on delete cascade,
  path       text not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  size       bigint not null default 0,
  hash       text not null default '',
  lang       text not null default '',
  summary    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (project_id, path)
);

-- ---------------------------------------------------------------------------
-- model registry (shared catalog cache, synced from openrouter.ai)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_models (
  id              text primary key,
  name            text not null default '',
  provider        text not null default '',
  description     text not null default '',
  context_length  bigint not null default 0,
  max_output      bigint not null default 0,
  price_in        numeric,
  price_out       numeric,
  is_free         boolean not null default false,
  supports_tools  boolean not null default false,
  supports_images boolean not null default false,
  modality        text not null default '',
  created_at_remote bigint,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  unavailable_since timestamptz,
  raw             jsonb
);
create index if not exists fb_models_free_idx on public.fb_models (is_free, supports_tools);

-- ---------------------------------------------------------------------------
-- user model preferences (never overwritten by catalog sync)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_model_prefs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  model_id   text not null,
  enabled    boolean not null default true,
  notes      text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

drop trigger if exists fb_model_prefs_touch on public.fb_model_prefs;
create trigger fb_model_prefs_touch before update on public.fb_model_prefs
  for each row execute function public.fb_touch_updated_at();

-- ---------------------------------------------------------------------------
-- per-user app settings
-- ---------------------------------------------------------------------------
create table if not exists public.fb_settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists fb_settings_touch on public.fb_settings;
create trigger fb_settings_touch before update on public.fb_settings
  for each row execute function public.fb_touch_updated_at();

-- ---------------------------------------------------------------------------
-- grants (Supabase's defaults already do most of this; explicit is safer)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.fb_projects, public.fb_messages, public.fb_memory, public.fb_tasks,
  public.fb_runs, public.fb_steps, public.fb_checkpoints, public.fb_file_index,
  public.fb_models, public.fb_model_prefs, public.fb_settings
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.fb_projects     enable row level security;
alter table public.fb_messages     enable row level security;
alter table public.fb_memory       enable row level security;
alter table public.fb_tasks        enable row level security;
alter table public.fb_runs         enable row level security;
alter table public.fb_steps        enable row level security;
alter table public.fb_checkpoints  enable row level security;
alter table public.fb_file_index   enable row level security;
alter table public.fb_models       enable row level security;
alter table public.fb_model_prefs  enable row level security;
alter table public.fb_settings     enable row level security;

-- owner-only tables
do $$
declare t text;
begin
  foreach t in array array[
    'fb_projects', 'fb_messages', 'fb_memory', 'fb_tasks',
    'fb_runs', 'fb_steps', 'fb_checkpoints', 'fb_file_index',
    'fb_model_prefs', 'fb_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_owner_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_owner_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_owner_delete', t);
  end loop;
end $$;

-- shared catalog: any signed-in user may read it, and sync may write to it
drop policy if exists fb_models_read on public.fb_models;
create policy fb_models_read on public.fb_models
  for select to authenticated using (true);

drop policy if exists fb_models_insert on public.fb_models;
create policy fb_models_insert on public.fb_models
  for insert to authenticated with check (true);

drop policy if exists fb_models_update on public.fb_models;
create policy fb_models_update on public.fb_models
  for update to authenticated using (true) with check (true);
