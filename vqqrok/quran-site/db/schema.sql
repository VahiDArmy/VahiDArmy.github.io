-- ============================================================
--  واقعه — ۵۶ | schema اختصاصی سایت
--  همهٔ اشیاء با پیشوند q56_ ساخته می‌شوند تا با جدول‌های موجود
--  پروژهٔ شما (tafsirs، comments، site_meta، mizan_*، cinema_*) تداخل نکنند.
--  این فایل را یک بار در Supabase → SQL Editor اجرا کنید. اجرای دوباره هم بی‌خطر است.
-- ============================================================

-- ---------- ۱. پروفایل اختصاصی (فقط دو جایگاه) ----------
create table if not exists public.q56_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  slot         smallint unique check (slot in (1, 2)),
  display_name text not null default 'همراه'
               check (char_length(display_name) between 1 and 24),
  theme        text not null default 'rose' check (theme in ('rose', 'night')),
  font_step    text not null default 'md'   check (font_step in ('sm', 'md', 'lg', 'xl')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.q56_profiles is 'پروفایل دو نفرِ سایت سورهٔ واقعه؛ جدا از هر جدول دیگری.';
comment on column public.q56_profiles.slot is '۱ یا ۲؛ هیچ‌وقت دو نفر یک جایگاه نمی‌گیرند.';

-- ---------- ۲. رویدادهای تلاوت (منبع شمارنده و تاریخچه) ----------
create table if not exists public.q56_read_events (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot    smallint not null check (slot in (1, 2)),
  ayah    smallint not null default 96 check (ayah between 1 and 96),
  read_at timestamptz not null default now(),
  note    text
);

create index if not exists q56_read_events_slot_time_idx
  on public.q56_read_events (slot, read_at desc);

comment on table public.q56_read_events is 'هر بار «ثبت تلاوت کامل» یک ردیف اینجا می‌سازد.';

-- ---------- ۳. امنیت سطح ردیف ----------
alter table public.q56_profiles    enable row level security;
alter table public.q56_read_events enable row level security;

drop policy if exists q56_profiles_select on public.q56_profiles;
create policy q56_profiles_select on public.q56_profiles
  for select to authenticated using (true);

drop policy if exists q56_profiles_insert_own on public.q56_profiles;
create policy q56_profiles_insert_own on public.q56_profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists q56_profiles_update_own on public.q56_profiles;
create policy q56_profiles_update_own on public.q56_profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- روی q56_read_events هیچ policy ای نیست:
-- خواندن و نوشتن فقط از راه توابع امن زیر انجام می‌شود.

-- ---------- ۴. به‌روزرسانی updated_at ----------
create or replace function public.q56_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists q56_profiles_touch on public.q56_profiles;
create trigger q56_profiles_touch
  before update on public.q56_profiles
  for each row execute function public.q56_touch_updated_at();

-- ---------- ۵. گرفتن جایگاه (۱ یا ۲) ----------
create or replace function public.q56_claim_slot()
returns table (slot smallint, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_slot smallint;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select p.slot into v_slot from public.q56_profiles p where p.id = v_uid;
  if v_slot is not null then
    return query select p.slot, p.display_name from public.q56_profiles p where p.id = v_uid;
    return;
  end if;

  select s.slot into v_slot
  from (values (1::smallint), (2::smallint)) as s (slot)
  where not exists (select 1 from public.q56_profiles p where p.slot = s.slot)
  order by s.slot
  limit 1;

  if v_slot is null then
    raise exception 'NO_SLOT' using errcode = 'P0001';
  end if;

  insert into public.q56_profiles (id, slot, display_name)
  values (v_uid, v_slot, case when v_slot = 1 then 'نفر اول' else 'نفر دوم' end)
  on conflict (id) do update set slot = excluded.slot, updated_at = now();

  return query select p.slot, p.display_name from public.q56_profiles p where p.id = v_uid;
end;
$$;

-- ---------- ۶. خلاصهٔ شمارنده‌ها (برای هدر، حتی بدون ورود) ----------
create or replace function public.q56_counter_summary()
returns table (slot smallint, total bigint, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.slot,
         count(e.id)::bigint as total,
         max(e.read_at)      as last_at
  from (values (1::smallint), (2::smallint)) as s (slot)
  left join public.q56_read_events e on e.slot = s.slot
  group by s.slot
  order by s.slot;
$$;

-- ---------- ۷. تاریخچهٔ تلاوت‌ها ----------
create or replace function public.q56_read_history(p_limit integer default 60)
returns table (slot smallint, read_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.slot, e.read_at
  from public.q56_read_events e
  order by e.read_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 500));
$$;

-- ---------- ۸. ثبت تلاوت ----------
create or replace function public.q56_increment_read(p_ayah smallint default 96)
returns table (slot smallint, total bigint, read_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_slot  smallint;
  v_at    timestamptz := now();
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select p.slot into v_slot from public.q56_profiles p where p.id = v_uid;
  if v_slot is null then
    raise exception 'NO_SLOT' using errcode = 'P0001';
  end if;

  insert into public.q56_read_events (user_id, slot, ayah, read_at)
  values (v_uid, v_slot, greatest(1, least(coalesce(p_ayah, 96), 96)), v_at);

  select count(*) into v_total from public.q56_read_events e where e.slot = v_slot;

  return query select v_slot, v_total, v_at;
end;
$$;

-- ---------- ۹. دسترسی‌ها ----------
revoke all on function public.q56_claim_slot() from public;
revoke all on function public.q56_increment_read(smallint) from public;
grant execute on function public.q56_claim_slot() to authenticated;
grant execute on function public.q56_increment_read(smallint) to authenticated;
grant execute on function public.q56_counter_summary() to anon, authenticated;
grant execute on function public.q56_read_history(integer) to anon, authenticated;

-- ---------- ۱۰. بررسی ----------
-- select * from public.q56_counter_summary();
-- select * from public.q56_read_history(20);
-- select id, slot, display_name, theme from public.q56_profiles order by slot;


