-- DevSpace schema for Supabase
-- Run this in the SQL editor of your Supabase project.
-- Enable RLS on every table; policies scope rows to auth.uid().

-- ── Projects ───────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  memory jsonb default '{}'::jsonb,
  roadmap jsonb default '{"phases":[]}'::jsonb,
  checkpoint jsonb,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "projects_update_own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ── Project messages (chat + agent history) ────────────────────────
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists project_messages_project_id_idx
  on public.project_messages(project_id, created_at);

alter table public.project_messages enable row level security;

-- Messages inherit access from parent project
create policy "messages_select_own" on public.project_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "messages_insert_own" on public.project_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "messages_delete_own" on public.project_messages
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- ── Model registry ─────────────────────────────────────────────────
-- Shared catalog; user_active is per-row preference.
-- For multi-user isolation of preferences, a separate user_model_prefs
-- table is cleaner long-term. For v1 we store preferences on the shared
-- row and accept that sync is global per deployment. Prefer a prefs table
-- if multiple users share one Supabase project.

create table if not exists public.model_registry (
  id text primary key,                    -- OpenRouter model id
  name text,
  provider text,
  description text,
  context_length integer,
  max_completion_tokens integer,
  is_free boolean default false,
  supports_tools boolean default false,
  pricing_prompt numeric,
  pricing_completion numeric,
  architecture jsonb,
  user_active boolean default true,       -- preference (do not overwrite on sync)
  last_synced_at timestamptz,
  raw jsonb,
  created_at timestamptz default now()
);

alter table public.model_registry enable row level security;

-- Any authenticated user can read the registry
create policy "models_select_auth" on public.model_registry
  for select to authenticated
  using (true);

-- Writes happen from the client with the user's key; restrict to authenticated
create policy "models_upsert_auth" on public.model_registry
  for insert to authenticated
  with check (true);

create policy "models_update_auth" on public.model_registry
  for update to authenticated
  using (true)
  with check (true);

-- Optional: tighter policy later via a service role edge function for sync.

-- ── Helpful grants ─────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_messages to authenticated;
grant select, insert, update on public.model_registry to authenticated;
