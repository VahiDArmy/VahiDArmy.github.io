-- ============================================================
-- THEORIES STUDIO — Schema Migration
-- Adds theory-related tables without conflicting with existing ones.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'همراه' check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text default '',
  theme text not null default 'light' check (theme in ('light','dark','system')),
  accent text not null default 'violet' check (accent in ('violet','rose','emerald','amber','ocean')),
  font_step text not null default 'md' check (font_step in ('sm','md','lg','xl')),
  density text not null default 'comfortable' check (density in ('comfortable','compact')),
  radius text not null default 'normal' check (radius in ('sharp','normal','soft','round')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- theories ----------
create table if not exists public.theories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  slug text unique,
  summary text default '',
  content text default '',
  cover_image text,
  cover_path text,
  category text not null default 'other' check (category in ('philosophy','science','social','art','history','technology','psychology','other')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  shamsi_year int,
  shamsi_month int check (shamsi_month between 1 and 12),
  shamsi_day int check (shamsi_day between 1 and 31),
  tags text[] not null default '{}',
  color text default '#7c3aed',
  is_public boolean not null default true,
  view_count int not null default 0,
  favorite boolean not null default false,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theories_user_idx on public.theories(user_id);
create index if not exists theories_status_idx on public.theories(status);
create index if not exists theories_category_idx on public.theories(category);
create index if not exists theories_created_idx on public.theories(created_at desc);
create index if not exists theories_tags_idx on public.theories using gin(tags);

-- ---------- theory_objects ----------
create table if not exists public.theory_objects (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid not null references public.theories(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text default '',
  image_url text,
  image_path text,
  object_type text not null default 'image' check (object_type in ('image','document','audio','video','link','note','concept')),
  source_url text,
  position_x real,
  position_y real,
  sort_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theory_objects_theory_idx on public.theory_objects(theory_id, sort_order);
create index if not exists theory_objects_user_idx on public.theory_objects(user_id);

-- ---------- theory_images ----------
create table if not exists public.theory_images (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid not null references public.theories(id) on delete cascade,
  image_url text not null,
  image_path text,
  caption text default '',
  sort_order int not null default 0,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists theory_images_theory_idx on public.theory_images(theory_id, sort_order);

-- ---------- theory_links (the "line" connections) ----------
create table if not exists public.theory_links (
  id uuid primary key default gen_random_uuid(),
  source_theory_id uuid not null references public.theories(id) on delete cascade,
  target_theory_id uuid not null references public.theories(id) on delete cascade,
  label text default '',
  link_type text not null default 'related' check (link_type in ('related','inspired','contradicts','extends','references')),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (source_theory_id <> target_theory_id)
);

create index if not exists theory_links_source_idx on public.theory_links(source_theory_id);
create index if not exists theory_links_target_idx on public.theory_links(target_theory_id);

-- ---------- theory_events (timeline) ----------
create table if not exists public.theory_events (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid references public.theories(id) on delete cascade,
  event_type text not null default 'milestone' check (event_type in ('milestone','insight','revision','link','publish')),
  title text not null check (char_length(title) between 1 and 200),
  description text default '',
  shamsi_year int,
  shamsi_month int,
  shamsi_day int,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists theory_events_date_idx on public.theory_events(shamsi_year desc, shamsi_month desc, shamsi_day desc);
create index if not exists theory_events_theory_idx on public.theory_events(theory_id);

-- ---------- theory_bookmarks ----------
create table if not exists public.theory_bookmarks (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid not null references public.theories(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  note text default '',
  created_at timestamptz not null default now(),
  unique (theory_id, user_id)
);

create index if not exists theory_bookmarks_user_idx on public.theory_bookmarks(user_id);

-- ---------- theory_comments ----------
create table if not exists public.theory_comments (
  id uuid primary key default gen_random_uuid(),
  theory_id uuid not null references public.theories(id) on delete cascade,
  parent_id uuid references public.theory_comments(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theory_comments_theory_idx on public.theory_comments(theory_id, created_at desc);

-- ---------- updated_at triggers ----------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_theories_updated on public.theories;
create trigger trg_theories_updated before update on public.theories
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_theory_objects_updated on public.theory_objects;
create trigger trg_theory_objects_updated before update on public.theory_objects
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_theory_comments_updated on public.theory_comments;
create trigger trg_theory_comments_updated before update on public.theory_comments
  for each row execute function public.tg_set_updated_at();

-- ---------- auto profile creation ----------
create or replace function public.tg_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'همراه'))
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.tg_create_profile();

-- ---------- slug generator ----------
create or replace function public.tg_set_slug()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := coalesce(nullif(regexp_replace(lower(new.title), '[^a-z0-9\u0600-\u06FF]+', '-', 'g'), '-'), 'theory')
      || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  return new;
end$$;

drop trigger if exists trg_theories_slug on public.theories;
create trigger trg_theories_slug before insert on public.theories
  for each row execute function public.tg_set_slug();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.theories enable row level security;
alter table public.theory_objects enable row level security;
alter table public.theory_images enable row level security;
alter table public.theory_links enable row level security;
alter table public.theory_events enable row level security;
alter table public.theory_bookmarks enable row level security;
alter table public.theory_comments enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- theories
drop policy if exists theories_select on public.theories;
create policy theories_select on public.theories for select
  using (is_public = true or auth.uid() = user_id);
drop policy if exists theories_insert on public.theories;
create policy theories_insert on public.theories for insert with check (auth.uid() = user_id);
drop policy if exists theories_update on public.theories;
create policy theories_update on public.theories for update using (auth.uid() = user_id);
drop policy if exists theories_delete on public.theories;
create policy theories_delete on public.theories for delete using (auth.uid() = user_id);

-- theory_objects
drop policy if exists to_select on public.theory_objects;
create policy to_select on public.theory_objects for select using (
  exists (select 1 from public.theories t where t.id = theory_id and (t.is_public = true or t.user_id = auth.uid()))
);
drop policy if exists to_insert on public.theory_objects;
create policy to_insert on public.theory_objects for insert with check (auth.uid() = user_id);
drop policy if exists to_update on public.theory_objects;
create policy to_update on public.theory_objects for update using (auth.uid() = user_id);
drop policy if exists to_delete on public.theory_objects;
create policy to_delete on public.theory_objects for delete using (auth.uid() = user_id);

-- theory_images
drop policy if exists ti_select on public.theory_images;
create policy ti_select on public.theory_images for select using (
  exists (select 1 from public.theories t where t.id = theory_id and (t.is_public = true or t.user_id = auth.uid()))
);
drop policy if exists ti_insert on public.theory_images;
create policy ti_insert on public.theory_images for insert with check (auth.uid() = user_id);
drop policy if exists ti_delete on public.theory_images;
create policy ti_delete on public.theory_images for delete using (auth.uid() = user_id);

-- theory_links
drop policy if exists tl_select on public.theory_links;
create policy tl_select on public.theory_links for select using (
  exists (select 1 from public.theories t where t.id = source_theory_id and (t.is_public = true or t.user_id = auth.uid()))
);
drop policy if exists tl_insert on public.theory_links;
create policy tl_insert on public.theory_links for insert with check (auth.uid() = user_id);
drop policy if exists tl_delete on public.theory_links;
create policy tl_delete on public.theory_links for delete using (auth.uid() = user_id);

-- theory_events
drop policy if exists te_select on public.theory_events;
create policy te_select on public.theory_events for select using (
  exists (select 1 from public.theories t where t.id = theory_id and (t.is_public = true or t.user_id = auth.uid()))
);
drop policy if exists te_insert on public.theory_events;
create policy te_insert on public.theory_events for insert with check (auth.uid() = user_id);
drop policy if exists te_update on public.theory_events;
create policy te_update on public.theory_events for update using (auth.uid() = user_id);
drop policy if exists te_delete on public.theory_events;
create policy te_delete on public.theory_events for delete using (auth.uid() = user_id);

-- bookmarks
drop policy if exists tb_select on public.theory_bookmarks;
create policy tb_select on public.theory_bookmarks for select using (auth.uid() = user_id);
drop policy if exists tb_insert on public.theory_bookmarks;
create policy tb_insert on public.theory_bookmarks for insert with check (auth.uid() = user_id);
drop policy if exists tb_delete on public.theory_bookmarks;
create policy tb_delete on public.theory_bookmarks for delete using (auth.uid() = user_id);

-- comments
drop policy if exists tc_select on public.theory_comments;
create policy tc_select on public.theory_comments for select using (
  exists (select 1 from public.theories t where t.id = theory_id and (t.is_public = true or t.user_id = auth.uid()))
);
drop policy if exists tc_insert on public.theory_comments;
create policy tc_insert on public.theory_comments for insert with check (auth.uid() = user_id);
drop policy if exists tc_update on public.theory_comments;
create policy tc_update on public.theory_comments for update using (auth.uid() = user_id);
drop policy if exists tc_delete on public.theory_comments;
create policy tc_delete on public.theory_comments for delete using (auth.uid() = user_id);

-- ---------- Storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('theory-images', 'theory-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

drop policy if exists "theory images public read" on storage.objects;
create policy "theory images public read" on storage.objects
  for select using (bucket_id = 'theory-images');

drop policy if exists "theory images auth write" on storage.objects;
create policy "theory images auth write" on storage.objects
  for insert with check (bucket_id = 'theory-images' and auth.role() = 'authenticated');

drop policy if exists "theory images auth delete" on storage.objects;
create policy "theory images auth delete" on storage.objects
  for delete using (bucket_id = 'theory-images' and auth.role() = 'authenticated');

-- ---------- view counter RPC ----------
create or replace function public.increment_theory_view(p_theory_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.theories set view_count = view_count + 1 where id = p_theory_id;
end$$;
