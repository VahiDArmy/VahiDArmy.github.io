-- TRIAD 3D Rank — Supabase schema
-- Safe to re-run (idempotent). All app tables prefixed t3d_.
create extension if not exists pgcrypto;

-- ============================================================
-- TRAITS (dimensions of personality)
-- ============================================================
create table if not exists public.t3d_traits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default '',
  icon text default '✨',
  color text default '#FFACE4',
  position int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SCORES (rater rates ratee on trait)
-- ============================================================
create table if not exists public.t3d_scores (
  id uuid primary key default gen_random_uuid(),
  rater_person_id uuid not null references public.people(id) on delete cascade,
  ratee_person_id uuid not null references public.people(id) on delete cascade,
  trait_id uuid not null references public.t3d_traits(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_person_id, ratee_person_id, trait_id),
  check (rater_person_id <> ratee_person_id)
);
create index if not exists t3d_scores_rater_idx on public.t3d_scores (rater_person_id);
create index if not exists t3d_scores_ratee_idx on public.t3d_scores (ratee_person_id);
create index if not exists t3d_scores_trait_idx on public.t3d_scores (trait_id);

-- ============================================================
-- BOOKMARKS
-- ============================================================
create table if not exists public.t3d_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  trait_id uuid references public.t3d_traits(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, person_id, trait_id)
);

-- ============================================================
-- AI CHAT
-- ============================================================
create table if not exists public.t3d_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  model text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.t3d_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.t3d_ai_conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant')),
  content text not null default '',
  reasoning text,
  created_at timestamptz not null default now()
);
create index if not exists t3d_ai_msgs_conv_idx on public.t3d_ai_messages (conversation_id);

-- ============================================================
-- AUTO updated_at
-- ============================================================
create or replace function public.t3d_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists t3d_scores_touch on public.t3d_scores;
create trigger t3d_scores_touch before update on public.t3d_scores
for each row execute function public.t3d_touch_updated_at();

drop trigger if exists t3d_ai_conv_touch on public.t3d_ai_conversations;
create trigger t3d_ai_conv_touch before update on public.t3d_ai_conversations
for each row execute function public.t3d_touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.t3d_traits enable row level security;
alter table public.t3d_scores enable row level security;
alter table public.t3d_bookmarks enable row level security;
alter table public.t3d_ai_conversations enable row level security;
alter table public.t3d_ai_messages enable row level security;

drop policy if exists "t3d_traits_read" on public.t3d_traits;
create policy "t3d_traits_read" on public.t3d_traits for select using (true);

drop policy if exists "t3d_traits_insert" on public.t3d_traits;
create policy "t3d_traits_insert" on public.t3d_traits for insert with check (auth.uid() is not null);

drop policy if exists "t3d_scores_read" on public.t3d_scores;
create policy "t3d_scores_read" on public.t3d_scores for select using (true);

drop policy if exists "t3d_scores_insert" on public.t3d_scores;
create policy "t3d_scores_insert" on public.t3d_scores for insert with check (auth.uid() is not null);

drop policy if exists "t3d_scores_update" on public.t3d_scores;
create policy "t3d_scores_update" on public.t3d_scores for update using (created_by = auth.uid());

drop policy if exists "t3d_scores_delete" on public.t3d_scores;
create policy "t3d_scores_delete" on public.t3d_scores for delete using (created_by = auth.uid());

drop policy if exists "t3d_bm_all" on public.t3d_bookmarks;
create policy "t3d_bm_all" on public.t3d_bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "t3d_ai_conv_all" on public.t3d_ai_conversations;
create policy "t3d_ai_conv_all" on public.t3d_ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "t3d_ai_msg_all" on public.t3d_ai_messages;
create policy "t3d_ai_msg_all" on public.t3d_ai_messages for all using (
  exists (select 1 from public.t3d_ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.t3d_ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- ============================================================
-- Realtime
-- ============================================================
do $$ begin
  begin
    alter publication supabase_realtime add table public.t3d_scores;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.t3d_traits;
  exception when others then null;
  end;
end $$;
