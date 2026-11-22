-- MATRIX·3D schema extensions (prefix: mx3_ — 3 chars per spec)
create extension if not exists pgcrypto;

create table if not exists public.mx3_traits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  icon text default 'sparkles',
  color text default '#a78bfa',
  weight numeric default 1,
  sort_order int default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mx3_scores (
  id uuid primary key default gen_random_uuid(),
  ranker_id uuid not null references public.people(id) on delete cascade,
  target_id uuid not null references public.people(id) on delete cascade,
  trait_id  uuid not null references public.mx3_traits(id) on delete cascade,
  score numeric not null default 0 check (score >= -10 and score <= 10),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ranker_id, target_id, trait_id)
);

create index if not exists mx3_scores_trait_idx   on public.mx3_scores(trait_id);
create index if not exists mx3_scores_ranker_idx  on public.mx3_scores(ranker_id);
create index if not exists mx3_scores_target_idx  on public.mx3_scores(target_id);

alter table public.mx3_traits enable row level security;
alter table public.mx3_scores enable row level security;

drop policy if exists "mx3_traits read"  on public.mx3_traits;
create policy "mx3_traits read"  on public.mx3_traits for select using (true);
drop policy if exists "mx3_traits write" on public.mx3_traits;
create policy "mx3_traits write" on public.mx3_traits for all to authenticated using (true) with check (true);

drop policy if exists "mx3_scores read"  on public.mx3_scores;
create policy "mx3_scores read"  on public.mx3_scores for select using (true);
drop policy if exists "mx3_scores write" on public.mx3_scores;
create policy "mx3_scores write" on public.mx3_scores for all to authenticated using (true) with check (true);

create or replace function public.mx3_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists mx3_traits_touch on public.mx3_traits;
create trigger mx3_traits_touch before update on public.mx3_traits
for each row execute function public.mx3_touch_updated_at();

drop trigger if exists mx3_scores_touch on public.mx3_scores;
create trigger mx3_scores_touch before update on public.mx3_scores
for each row execute function public.mx3_touch_updated_at();

insert into public.mx3_traits (name, slug, icon, color, sort_order) values
  ('Kindness',    'kindness',    'heart',        '#ff6b9d', 1),
  ('Bravery',     'bravery',     'shield-halved','#ffb84d', 2),
  ('Wisdom',      'wisdom',      'brain',        '#6bc5ff', 3),
  ('Humor',       'humor',       'face-laugh',   '#a78bfa', 4),
  ('Reliability', 'reliability', 'handshake',    '#4ade80', 5)
on conflict (slug) do nothing;
