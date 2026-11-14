-- ============================================================================
--  FULL METAL CINEMA — schema
--  Run once in the Supabase SQL editor. Idempotent: safe to run again.
--
--  Contract followed by every table in this file:
--    id uuid primary key default gen_random_uuid()
--    user_id uuid default auth.uid() references auth.users(id) on delete cascade
--    created_at timestamptz not null default now()
--    updated_at timestamptz not null default now()
--    row level security: auth.uid() = user_id
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. shared trigger
-- ---------------------------------------------------------------------------
create or replace function public.cinema_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 1. EXISTING TABLES (created only if absent — your data is never touched)
-- ===========================================================================

create table if not exists public.cinema_titles (
  id uuid not null default gen_random_uuid(),
  legacy_id integer,
  title text not null,
  category text not null check (category = any (array['love','good','hate'])),
  type text not null default 'series',
  genre text default '',
  year integer,
  rating real default 0,
  favorite boolean not null default false,
  notes text default '',
  watched_date text,
  summary text default '',
  original_title text default '',
  seasons integer,
  episodes integer,
  episodes_per_season integer,
  country text default '',
  language text default '',
  status text default '',
  reason text default '',
  story_analysis text default '',
  ai_standardized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  source text default 'manual',
  tags text not null default '',
  constraint cinema_titles_pkey primary key (id)
);

-- columns the new interface uses (added in place, defaults are harmless)
alter table public.cinema_titles add column if not exists poster_url text default '';
alter table public.cinema_titles add column if not exists backdrop_url text default '';
alter table public.cinema_titles add column if not exists trailer_url text default '';
alter table public.cinema_titles add column if not exists runtime integer;

create table if not exists public.cinema_activity (
  id uuid not null default gen_random_uuid(),
  action text not null,
  entity text,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_activity_pkey primary key (id)
);

create table if not exists public.cinema_meta (
  k text not null,
  v text,
  user_id uuid default auth.uid(),
  constraint cinema_meta_pkey primary key (k)
);

create table if not exists public.cinema_conversations (
  id uuid not null default gen_random_uuid(),
  title_id uuid,
  title_context text default '',
  prompt text not null,
  response text default '',
  ai_model text default '',
  tags text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_conversations_pkey primary key (id),
  constraint cinema_conversations_title_id_fkey foreign key (title_id) references public.cinema_titles(id) on delete set null
);

create table if not exists public.cinema_ai_models (
  id text not null,
  label text not null,
  vendor text default '',
  size text default '',
  context text default '',
  speed text default '',
  note text default '',
  tags text default '',
  recommended boolean not null default false,
  best_for text default '',
  is_free boolean not null default true,
  source text default 'seed',
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'openrouter',
  active boolean not null default true,
  wins integer not null default 0,
  losses integer not null default 0,
  last_tried_at timestamptz,
  user_rating integer not null default 0,
  constraint cinema_ai_models_pkey primary key (id)
);

create table if not exists public.cinema_ai_models_deleted (
  id text not null,
  deleted_at timestamptz not null default now(),
  constraint cinema_ai_models_deleted_pkey primary key (id)
);

-- ===========================================================================
-- 2. NEW TABLES
-- ===========================================================================

-- 2.1 collections ------------------------------------------------------------
create table if not exists public.cinema_collections (
  id uuid not null default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text default '',
  color text default '#d8ff3e',
  icon text default '❏',
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_collections_pkey primary key (id)
);

create table if not exists public.cinema_collection_items (
  id uuid not null default gen_random_uuid(),
  collection_id uuid not null,
  title_id uuid not null,
  position integer not null default 0,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_collection_items_pkey primary key (id),
  constraint cinema_collection_items_collection_id_fkey
    foreign key (collection_id) references public.cinema_collections(id) on delete cascade,
  constraint cinema_collection_items_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade,
  constraint cinema_collection_items_unique unique (collection_id, title_id)
);

-- 2.2 criteria ratings -------------------------------------------------------
create table if not exists public.cinema_ratings (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  story smallint default 0 check (story between 0 and 10),
  acting smallint default 0 check (acting between 0 and 10),
  direction smallint default 0 check (direction between 0 and 10),
  visuals smallint default 0 check (visuals between 0 and 10),
  sound smallint default 0 check (sound between 0 and 10),
  rewatch smallint default 0 check (rewatch between 0 and 10),
  review text default '',
  spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_ratings_pkey primary key (id),
  constraint cinema_ratings_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade,
  constraint cinema_ratings_unique_title unique (title_id, user_id)
);

-- 2.3 watchlist --------------------------------------------------------------
create table if not exists public.cinema_watchlist (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  priority smallint not null default 1 check (priority between 0 and 5),
  note text default '',
  target_date date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_watchlist_pkey primary key (id),
  constraint cinema_watchlist_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.4 watch sessions --------------------------------------------------------
create table if not exists public.cinema_watch_sessions (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  season smallint,
  episode smallint,
  minutes integer not null default 0 check (minutes >= 0),
  mood text default '',
  device text default '',
  note text default '',
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_watch_sessions_pkey primary key (id),
  constraint cinema_watch_sessions_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.5 people + credits ------------------------------------------------------
create table if not exists public.cinema_people (
  id uuid not null default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  role text default 'director',
  country text default '',
  birth_year integer,
  notes text default '',
  following boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_people_pkey primary key (id)
);

create table if not exists public.cinema_credits (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  person_id uuid not null,
  role text not null default 'director',
  character text default '',
  billing smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_credits_pkey primary key (id),
  constraint cinema_credits_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade,
  constraint cinema_credits_person_id_fkey
    foreign key (person_id) references public.cinema_people(id) on delete cascade,
  constraint cinema_credits_unique unique (title_id, person_id, role)
);

-- 2.6 quotes + trivia -------------------------------------------------------
create table if not exists public.cinema_quotes (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  text text not null check (char_length(text) > 0),
  speaker text default '',
  at_minute integer,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_quotes_pkey primary key (id),
  constraint cinema_quotes_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

create table if not exists public.cinema_trivia (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  content text not null,
  source text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_trivia_pkey primary key (id),
  constraint cinema_trivia_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.7 explicit relationships ------------------------------------------------
create table if not exists public.cinema_relationships (
  id uuid not null default gen_random_uuid(),
  title_id uuid not null,
  related_title_id uuid not null,
  kind text not null default 'spiritual-twin',
  weight real not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_relationships_pkey primary key (id),
  constraint cinema_relationships_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade,
  constraint cinema_relationships_related_title_id_fkey
    foreign key (related_title_id) references public.cinema_titles(id) on delete cascade,
  constraint cinema_relationships_unique unique (title_id, related_title_id, kind)
);

-- 2.8 campaign goals --------------------------------------------------------
create table if not exists public.cinema_goals (
  id uuid not null default gen_random_uuid(),
  year integer not null default extract(year from now()),
  target_titles integer not null default 40 check (target_titles > 0),
  target_minutes integer not null default 0,
  target_rating_avg real,
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_goals_pkey primary key (id),
  constraint cinema_goals_unique unique (year, user_id)
);

-- 2.9 challenges ------------------------------------------------------------
create table if not exists public.cinema_challenges (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text default '',
  rule jsonb not null default '{}'::jsonb,
  progress integer not null default 0,
  target integer not null default 10,
  status text not null default 'active' check (status = any (array['active','done','abandoned'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_challenges_pkey primary key (id)
);

-- 2.10 screenings / watch parties -------------------------------------------
create table if not exists public.cinema_events (
  id uuid not null default gen_random_uuid(),
  title_id uuid,
  kind text not null default 'screening',
  starts_at timestamptz not null default now(),
  location text default '',
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_events_pkey primary key (id),
  constraint cinema_events_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete set null
);

-- 2.11 prompt rack ----------------------------------------------------------
create table if not exists public.cinema_prompts (
  id uuid not null default gen_random_uuid(),
  name text not null,
  body text not null,
  category text default 'review',
  variables text default '',
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_prompts_pkey primary key (id)
);

-- 2.12 AI usage ledger ------------------------------------------------------
create table if not exists public.cinema_ai_usage (
  id uuid not null default gen_random_uuid(),
  provider text not null default '',
  model text not null default '',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer not null default 0,
  ok boolean not null default true,
  reasoning boolean not null default false,
  error text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_ai_usage_pkey primary key (id)
);

-- 2.13 awards --------------------------------------------------------------
create table if not exists public.cinema_awards (
  id uuid not null default gen_random_uuid(),
  title_id uuid,
  body text default '',
  category text default '',
  year integer,
  won boolean not null default false,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_awards_pkey primary key (id),
  constraint cinema_awards_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.14 share links ---------------------------------------------------------
create table if not exists public.cinema_shares (
  id uuid not null default gen_random_uuid(),
  title_id uuid,
  slug text not null unique,
  expires_at timestamptz,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_shares_pkey primary key (id),
  constraint cinema_shares_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.15 import batches ------------------------------------------------------
create table if not exists public.cinema_import_batches (
  id uuid not null default gen_random_uuid(),
  source text not null default 'json',
  count integer not null default 0,
  status text not null default 'done',
  payload_summary text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_import_batches_pkey primary key (id)
);

-- 2.16 reading notes (anchored annotations) --------------------------------
create table if not exists public.cinema_mizan_notes (
  id uuid not null default gen_random_uuid(),
  content_id integer not null default 0,
  title_id uuid,
  anchor_before text not null default '',
  anchor_selected text not null,
  anchor_after text not null default '',
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  constraint cinema_mizan_notes_pkey primary key (id),
  constraint cinema_mizan_notes_title_id_fkey
    foreign key (title_id) references public.cinema_titles(id) on delete cascade
);

-- 2.17 saved views ---------------------------------------------------------
create table if not exists public.cinema_saved_views (
  id uuid not null default gen_random_uuid(),
  name text not null,
  route text not null,
  icon text default '⌖',
  pin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  constraint cinema_saved_views_pkey primary key (id)
);

-- ===========================================================================
-- 3. INDEXES
-- ===========================================================================
create index if not exists cinema_titles_user_idx on public.cinema_titles (user_id, created_at desc);
create index if not exists cinema_titles_cat_idx on public.cinema_titles (user_id, category);
create index if not exists cinema_titles_score_idx on public.cinema_titles (user_id, rating desc);
create index if not exists cinema_titles_year_idx on public.cinema_titles (year);
create index if not exists cinema_activity_user_idx on public.cinema_activity (user_id, created_at desc);
create index if not exists cinema_activity_entity_idx on public.cinema_activity (entity_id);
create index if not exists cinema_conv_user_idx on public.cinema_conversations (user_id, created_at desc);
create index if not exists cinema_collection_items_col_idx on public.cinema_collection_items (collection_id, position);
create index if not exists cinema_ratings_title_idx on public.cinema_ratings (title_id);
create index if not exists cinema_watchlist_user_idx on public.cinema_watchlist (user_id, done);
create index if not exists cinema_sessions_title_idx on public.cinema_watch_sessions (title_id, watched_at desc);
create index if not exists cinema_credits_person_idx on public.cinema_credits (person_id);
create index if not exists cinema_quotes_title_idx on public.cinema_quotes (title_id);
create index if not exists cinema_usage_user_idx on public.cinema_ai_usage (user_id, created_at desc);

-- ===========================================================================
-- 4. updated_at TRIGGERS
-- ===========================================================================
do $$
declare
  t text;
  tables text[] := array[
    'cinema_titles','cinema_activity','cinema_conversations','cinema_ai_models',
    'cinema_collections','cinema_collection_items','cinema_ratings','cinema_watchlist',
    'cinema_watch_sessions','cinema_people','cinema_credits','cinema_quotes','cinema_trivia',
    'cinema_relationships','cinema_goals','cinema_challenges','cinema_events','cinema_prompts',
    'cinema_ai_usage','cinema_awards','cinema_shares','cinema_import_batches',
    'cinema_mizan_notes','cinema_saved_views'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.cinema_touch()',
      t, t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- 5. ROW LEVEL SECURITY
--    Every per-operator table: owner-only. The model catalogue is shared.
-- ===========================================================================
do $$
declare
  t text;
  tables text[] := array[
    'cinema_titles','cinema_activity','cinema_conversations','cinema_collections',
    'cinema_collection_items','cinema_ratings','cinema_watchlist','cinema_watch_sessions',
    'cinema_people','cinema_credits','cinema_quotes','cinema_trivia','cinema_relationships',
    'cinema_goals','cinema_challenges','cinema_events','cinema_prompts','cinema_ai_usage',
    'cinema_awards','cinema_shares','cinema_import_batches','cinema_mizan_notes',
    'cinema_saved_views','cinema_meta'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end;
$$;

-- shared model catalogue: readable by any signed-in operator, writable too
-- (it is a personal ledger, not a global registry — owner-scoped writes are
--  impossible because the original table has no user_id column)
alter table public.cinema_ai_models enable row level security;
drop policy if exists cinema_ai_models_read on public.cinema_ai_models;
create policy cinema_ai_models_read on public.cinema_ai_models
  for select to authenticated using (true);
drop policy if exists cinema_ai_models_write on public.cinema_ai_models;
create policy cinema_ai_models_write on public.cinema_ai_models
  for all to authenticated using (true) with check (true);

alter table public.cinema_ai_models_deleted enable row level security;
drop policy if exists cinema_ai_models_deleted_all on public.cinema_ai_models_deleted;
create policy cinema_ai_models_deleted_all on public.cinema_ai_models_deleted
  for all to authenticated using (true) with check (true);

-- ===========================================================================
-- 6. VIEWS
-- ===========================================================================
create or replace view public.cinema_shelf_summary as
select
  t.user_id,
  count(*)                                                        as total,
  count(*) filter (where t.category = 'love')                     as loved,
  count(*) filter (where t.category = 'hate')                     as hated,
  count(*) filter (where t.favorite)                              as favorites,
  round(avg(nullif(t.rating, 0))::numeric, 2)                     as avg_rating,
  count(*) filter (where t.status = 'watched')                    as watched,
  min(t.year)                                                     as first_year,
  max(t.year)                                                     as last_year,
  sum(coalesce(t.episodes, 0))                                    as episodes
from public.cinema_titles t
group by t.user_id;

-- ===========================================================================
-- 7. HELPER: derive watched_date / status side effects
-- ===========================================================================
create or replace function public.cinema_stamp_watched()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'watched' and (new.watched_date is null or new.watched_date = '') then
    new.watched_date := to_char(now(), 'YYYY-MM-DD');
  end if;
  return new;
end;
$$;

drop trigger if exists cinema_titles_stamp on public.cinema_titles;
create trigger cinema_titles_stamp
  before insert or update of status on public.cinema_titles
  for each row execute function public.cinema_stamp_watched();

-- ===========================================================================
-- 8. SEED: a handful of free reasoning models so the arena is not empty
-- ===========================================================================
insert into public.cinema_ai_models (id, label, vendor, provider, is_free, active, recommended, tags, best_for)
values
  ('deepseek/deepseek-r1:free', 'DeepSeek R1 (free)', 'DeepSeek', 'openrouter', true, true, true, 'reasoning,free', 'analysis'),
  ('meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (free)', 'Meta', 'openrouter', true, true, false, 'fast,free', 'reviews'),
  ('google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash (free)', 'Google', 'openrouter', true, true, false, 'fast,free', 'standardising'),
  ('qwen/qwen-2.5-72b-instruct:free', 'Qwen 2.5 72B (free)', 'Alibaba', 'openrouter', true, true, false, 'multilingual,free', 'persian copy'),
  ('gpt-4o-mini', 'GPT-4o mini', 'OpenAI', 'openai', false, true, false, 'balanced', 'everything'),
  ('claude-sonnet-4-20250514', 'Claude Sonnet 4', 'Anthropic', 'anthropic', false, true, false, 'long-form', 'essays')
on conflict (id) do nothing;

-- done.
