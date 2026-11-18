-- DevSpace schema. All tables are prefixed ds_ as requested.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.ds_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  fs_mode text not null default 'virtual' check (fs_mode in ('fsa','virtual')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Project memory (summaries, decisions, constraints, architecture notes)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_project_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'note' check (kind in ('summary','decision','constraint','architecture','note','task_log')),
  content text not null,
  importance int not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Roadmap
-- ---------------------------------------------------------------------------
create table if not exists public.ds_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null default 'General',
  title text not null,
  description text not null default '',
  status text not null default 'pending' check (status in ('pending','in_progress','completed','blocked','failed')),
  order_index int not null default 0,
  dependencies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tasks (one per agent run)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'pending' check (status in ('pending','running','completed','failed','blocked','interrupted')),
  model text,
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tool operations (immutable audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_tool_operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.ds_tasks(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'success' check (status in ('success','error','interrupted','pending')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chat messages
-- ---------------------------------------------------------------------------
create table if not exists public.ds_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null default '',
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Model registry (shared catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_models (
  id text primary key,
  name text not null,
  provider text,
  description text,
  context_length int,
  max_output int,
  pricing_prompt numeric,
  pricing_completion numeric,
  supports_tools boolean not null default false,
  supports_vision boolean not null default false,
  is_free boolean not null default false,
  is_available boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Per-user model preferences (never overwritten by sync)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_user_model_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null references public.ds_models(id) on delete cascade,
  enabled boolean not null default true,
  preferred_role text not null default 'any' check (preferred_role in ('any','planner','coder','reviewer')),
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

-- ---------------------------------------------------------------------------
-- Checkpoint metadata (contents live in local IndexedDB)
-- ---------------------------------------------------------------------------
create table if not exists public.ds_checkpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.ds_tasks(id) on delete set null,
  label text not null default 'Checkpoint',
  file_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Resumable application state per project
-- ---------------------------------------------------------------------------
create table if not exists public.ds_app_state (
  project_id uuid primary key references public.ds_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_task_id uuid references public.ds_tasks(id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.ds_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'ds_projects','ds_project_memory','ds_roadmap_items','ds_tasks',
    'ds_user_model_prefs','ds_app_state'
  ]
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.ds_set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists ds_projects_user_idx on public.ds_projects(user_id);
create index if not exists ds_memory_project_idx on public.ds_project_memory(project_id);
create index if not exists ds_roadmap_project_idx on public.ds_roadmap_items(project_id);
create index if not exists ds_tasks_project_idx on public.ds_tasks(project_id);
create index if not exists ds_ops_project_idx on public.ds_tool_operations(project_id);
create index if not exists ds_ops_task_idx on public.ds_tool_operations(task_id);
create index if not exists ds_messages_project_idx on public.ds_messages(project_id);
create index if not exists ds_checkpoints_project_idx on public.ds_checkpoints(project_id);
create index if not exists ds_models_available_idx on public.ds_models(is_available);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ds_projects enable row level security;
alter table public.ds_project_memory enable row level security;
alter table public.ds_roadmap_items enable row level security;
alter table public.ds_tasks enable row level security;
alter table public.ds_tool_operations enable row level security;
alter table public.ds_messages enable row level security;
alter table public.ds_models enable row level security;
alter table public.ds_user_model_prefs enable row level security;
alter table public.ds_checkpoints enable row level security;
alter table public.ds_app_state enable row level security;

-- Projects: owner only
drop policy if exists ds_projects_owner on public.ds_projects;
create policy ds_projects_owner on public.ds_projects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helper predicate for child tables: the project must belong to the caller.
drop policy if exists ds_memory_owner on public.ds_project_memory;
create policy ds_memory_owner on public.ds_project_memory
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_roadmap_owner on public.ds_roadmap_items;
create policy ds_roadmap_owner on public.ds_roadmap_items
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_tasks_owner on public.ds_tasks;
create policy ds_tasks_owner on public.ds_tasks
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_ops_owner on public.ds_tool_operations;
create policy ds_ops_owner on public.ds_tool_operations
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_messages_owner on public.ds_messages;
create policy ds_messages_owner on public.ds_messages
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_checkpoints_owner on public.ds_checkpoints;
create policy ds_checkpoints_owner on public.ds_checkpoints
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists ds_app_state_owner on public.ds_app_state;
create policy ds_app_state_owner on public.ds_app_state
  for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.ds_projects p where p.id = project_id and p.user_id = auth.uid()));

-- Models: shared catalog, authenticated read and upsert.
drop policy if exists ds_models_read on public.ds_models;
create policy ds_models_read on public.ds_models
  for select to authenticated using (true);

drop policy if exists ds_models_insert on public.ds_models;
create policy ds_models_insert on public.ds_models
  for insert to authenticated with check (true);

drop policy if exists ds_models_update on public.ds_models;
create policy ds_models_update on public.ds_models
  for update to authenticated using (true) with check (true);

-- User preferences: owner only
drop policy if exists ds_prefs_owner on public.ds_user_model_prefs;
create policy ds_prefs_owner on public.ds_user_model_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
