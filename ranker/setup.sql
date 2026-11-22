-- PEPPER multidimensional ranking app
-- Run this script in Supabase SQL Editor. All objects are isolated by pepper_ prefix.

create extension if not exists pgcrypto;

create table if not exists public.pepper_dimensions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text not null default '#8b7cff',
  weight numeric(6,3) not null default 1 check (weight > 0),
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pepper_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  bio text,
  avatar_url text,
  user_id uuid unique references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pepper_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluator_id uuid not null references public.pepper_people(id) on delete cascade,
  subject_id uuid not null references public.pepper_people(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  notes text,
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluator_id, subject_id),
  check (evaluator_id <> subject_id)
);

create table if not exists public.pepper_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.pepper_evaluations(id) on delete cascade,
  dimension_id uuid not null references public.pepper_dimensions(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, dimension_id)
);

create table if not exists public.pepper_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pepper_evaluations_subject_idx on public.pepper_evaluations(subject_id);
create index if not exists pepper_evaluations_evaluator_idx on public.pepper_evaluations(evaluator_id);
create index if not exists pepper_scores_evaluation_idx on public.pepper_scores(evaluation_id);

alter table public.pepper_dimensions enable row level security;
alter table public.pepper_people enable row level security;
alter table public.pepper_evaluations enable row level security;
alter table public.pepper_scores enable row level security;
alter table public.pepper_activity enable row level security;

-- Authenticated users share the same dimension library and people directory.
drop policy if exists "pepper_dimensions_read" on public.pepper_dimensions;
create policy "pepper_dimensions_read" on public.pepper_dimensions for select to authenticated using (true);
drop policy if exists "pepper_dimensions_insert" on public.pepper_dimensions;
create policy "pepper_dimensions_insert" on public.pepper_dimensions for insert to authenticated with check (true);
drop policy if exists "pepper_dimensions_update" on public.pepper_dimensions;
create policy "pepper_dimensions_update" on public.pepper_dimensions for update to authenticated using (true) with check (true);
drop policy if exists "pepper_dimensions_delete" on public.pepper_dimensions;
create policy "pepper_dimensions_delete" on public.pepper_dimensions for delete to authenticated using (true);

drop policy if exists "pepper_people_read" on public.pepper_people;
create policy "pepper_people_read" on public.pepper_people for select to authenticated using (true);
drop policy if exists "pepper_people_insert" on public.pepper_people;
create policy "pepper_people_insert" on public.pepper_people for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "pepper_people_update" on public.pepper_people;
create policy "pepper_people_update" on public.pepper_people for update to authenticated using (created_by = auth.uid() or user_id = auth.uid()) with check (created_by = auth.uid() or user_id = auth.uid());
drop policy if exists "pepper_people_delete" on public.pepper_people;
create policy "pepper_people_delete" on public.pepper_people for delete to authenticated using (created_by = auth.uid());

drop policy if exists "pepper_evaluations_read" on public.pepper_evaluations;
create policy "pepper_evaluations_read" on public.pepper_evaluations for select to authenticated using (visibility = 'shared' or author_id = auth.uid());
drop policy if exists "pepper_evaluations_insert" on public.pepper_evaluations;
create policy "pepper_evaluations_insert" on public.pepper_evaluations for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.pepper_people p where p.id = evaluator_id and p.user_id = auth.uid()));
drop policy if exists "pepper_evaluations_update" on public.pepper_evaluations;
create policy "pepper_evaluations_update" on public.pepper_evaluations for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "pepper_evaluations_delete" on public.pepper_evaluations;
create policy "pepper_evaluations_delete" on public.pepper_evaluations for delete to authenticated using (author_id = auth.uid());

drop policy if exists "pepper_scores_read" on public.pepper_scores;
create policy "pepper_scores_read" on public.pepper_scores for select to authenticated using (
  exists (select 1 from public.pepper_evaluations e where e.id = evaluation_id and (e.visibility = 'shared' or e.author_id = auth.uid()))
);
drop policy if exists "pepper_scores_insert" on public.pepper_scores;
create policy "pepper_scores_insert" on public.pepper_scores for insert to authenticated with check (
  exists (select 1 from public.pepper_evaluations e where e.id = evaluation_id and e.author_id = auth.uid())
);
drop policy if exists "pepper_scores_update" on public.pepper_scores;
create policy "pepper_scores_update" on public.pepper_scores for update to authenticated using (
  exists (select 1 from public.pepper_evaluations e where e.id = evaluation_id and e.author_id = auth.uid())
) with check (
  exists (select 1 from public.pepper_evaluations e where e.id = evaluation_id and e.author_id = auth.uid())
);
drop policy if exists "pepper_scores_delete" on public.pepper_scores;
create policy "pepper_scores_delete" on public.pepper_scores for delete to authenticated using (
  exists (select 1 from public.pepper_evaluations e where e.id = evaluation_id and e.author_id = auth.uid())
);

drop policy if exists "pepper_activity_read" on public.pepper_activity;
create policy "pepper_activity_read" on public.pepper_activity for select to authenticated using (true);
drop policy if exists "pepper_activity_insert" on public.pepper_activity;
create policy "pepper_activity_insert" on public.pepper_activity for insert to authenticated with check (actor_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.pepper_dimensions, public.pepper_people,
  public.pepper_evaluations, public.pepper_scores, public.pepper_activity to authenticated;

insert into public.pepper_dimensions(name, description, color, weight, position)
values
 ('Kindness','Consideration, empathy and care for others','#f08b9c',1,0),
 ('Bravery','Courage, resilience and willingness to act','#f5a94b',1,1)
on conflict (name) do nothing;
