-- ============================================================================
-- بازاربان (BazaarBan) — Supabase schema
-- ----------------------------------------------------------------------------
-- هدف: ساخت جدول‌های اختصاصی اپ «بررسی سوپرمارکت‌های آنلاین» با پیشوند smr_
-- تا هیچ جدول موجود دیگری (tafsirs, comments, cinema_titles, …) دست نخورد.
--
-- نحوهٔ اجرا:
--   1) Supabase Dashboard → SQL Editor
--   2) کل این فایل را یک‌بار اجرا کن.
--   3) (اختیاری) در Authentication → Providers سیاست ایمیل را تنظیم کن.
--
-- نکته: این فایل idempotent است؛ اجرای دوباره چیزی را خراب نمی‌کند.
-- کلید استفاده‌شده در فرانت‌اند باید publishable/anon باشد، نه service_role.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
-- ۱) نمایهٔ کاربری
-- ============================================================================
create table if not exists public.smr_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'کاربر بازاربان'
               check (char_length(display_name) between 1 and 40),
  city         text not null default '' check (char_length(city) <= 40),
  bio          text not null default '' check (char_length(bio) <= 280),
  avatar_hue   smallint not null default 152 check (avatar_hue between 0 and 359),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- ۲) فروشنده‌ها (برند / پلتفرم / زنجیره)
-- ============================================================================
create table if not exists public.smr_vendors (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name          text not null check (char_length(name) between 2 and 80),
  name_fa       text not null check (char_length(name_fa) between 2 and 80),
  kind          text not null default 'platform'
                check (kind in ('platform', 'marketplace', 'chain', 'local', 'online')),
  tagline       text not null default '' check (char_length(tagline) <= 120),
  description   text not null default '' check (char_length(description) <= 1000),
  website       text not null default '' check (char_length(website) <= 200),
  city          text not null default '' check (char_length(city) <= 40),
  support_phone text not null default '' check (char_length(support_phone) <= 30),
  brand_hue     smallint not null default 152 check (brand_hue between 0 and 359),
  is_verified   boolean not null default false,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- ۳) فروشگاه‌ها / شعبه‌ها
-- ============================================================================
create table if not exists public.smr_shops (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.smr_vendors (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 90),
  city       text not null default '' check (char_length(city) <= 40),
  district   text not null default '' check (char_length(district) <= 60),
  address    text not null default '' check (char_length(address) <= 220),
  phone      text not null default '' check (char_length(phone) <= 30),
  pickup     boolean not null default true,
  delivery   boolean not null default true,
  hours      text not null default '' check (char_length(hours) <= 60),
  lat        double precision check (lat is null or (lat between -90 and 90)),
  lng        double precision check (lng is null or (lng between -180 and 180)),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ۴) محصولات
-- ============================================================================
create table if not exists public.smr_products (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.smr_vendors (id) on delete cascade,
  shop_id      uuid references public.smr_shops (id) on delete set null,
  name         text not null check (char_length(name) between 2 and 120),
  brand        text not null default '' check (char_length(brand) <= 60),
  category     text not null default 'other'
               check (category in (
                 'produce', 'dairy', 'bakery', 'protein', 'pantry',
                 'drinks', 'snacks', 'household', 'personal', 'frozen', 'other'
               )),
  unit         text not null default 'عدد' check (char_length(unit) <= 40),
  price        integer check (price is null or price >= 0),
  barcode      text not null default '' check (char_length(barcode) <= 20),
  tags         text[] not null default '{}'::text[],
  is_available boolean not null default true,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- اطمینان از این‌که شعبهٔ انتخاب‌شده متعلق به همان فروشنده است
create or replace function public.smr_check_product_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_vendor uuid;
begin
  if new.shop_id is null then
    return new;
  end if;
  select vendor_id into shop_vendor from public.smr_shops where id = new.shop_id;
  if shop_vendor is null then
    raise exception 'شعبهٔ انتخاب‌شده وجود ندارد.';
  end if;
  if shop_vendor <> new.vendor_id then
    raise exception 'شعبهٔ انتخاب‌شده متعلق به این فروشنده نیست.';
  end if;
  return new;
end;
$$;

drop trigger if exists smr_products_check_shop on public.smr_products;
create trigger smr_products_check_shop
  before insert or update on public.smr_products
  for each row execute function public.smr_check_product_shop();

-- ============================================================================
-- ۵) نقدها
-- ============================================================================
create table if not exists public.smr_comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor', 'shop', 'product')),
  entity_id   uuid not null,
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  guest_name  text not null default 'مهمان'
              check (char_length(guest_name) between 1 and 60),
  body        text not null check (char_length(body) between 6 and 1200),
  level       text check (level is null or level in ('good', 'meh', 'bad')),
  tags        text[] not null default '{}'::text[],
  status      text not null default 'published'
              check (status in ('published', 'hidden', 'flagged')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- ۶) امتیاز سه‌سطحی (یک رأی برای هر کاربر در هر موجودیت)
-- ============================================================================
create table if not exists public.smr_ratings (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor', 'shop', 'product')),
  entity_id   uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value       text not null check (value in ('good', 'meh', 'bad')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint smr_ratings_one_per_user unique (entity_type, entity_id, user_id)
);

-- ============================================================================
-- ۷) رأی «مفید بود» روی نقدها
-- ============================================================================
create table if not exists public.smr_comment_votes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.smr_comments (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  value      smallint not null default 1 check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  constraint smr_comment_votes_once unique (comment_id, user_id)
);

-- ============================================================================
-- ۸) لیست‌های خرید («خرید بعدی»)
-- ============================================================================
create table if not exists public.smr_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  emoji      text not null default '🛒' check (char_length(emoji) <= 8),
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smr_list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.smr_lists (id) on delete cascade,
  entity_type text not null check (entity_type in ('vendor', 'shop', 'product')),
  entity_id   uuid not null,
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  constraint smr_list_items_once unique (list_id, entity_type, entity_id)
);

-- ============================================================================
-- ۹) گزارش تخلف / اطلاعات نادرست
-- ============================================================================
create table if not exists public.smr_reports (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor', 'shop', 'product', 'comment')),
  entity_id   uuid not null,
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  reason      text not null check (char_length(reason) between 2 and 40),
  details     text not null default '' check (char_length(details) <= 400),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- ۱۰) فعالیت کاربر
-- ============================================================================
create table if not exists public.smr_activity (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action      text not null check (char_length(action) <= 30),
  entity_type text not null check (entity_type in ('vendor', 'shop', 'product')),
  entity_id   uuid not null,
  detail      text not null default '' check (char_length(detail) <= 300),
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- ۱۱) شاخص‌ها
-- ============================================================================
create index if not exists smr_shops_vendor_idx on public.smr_shops (vendor_id);
create index if not exists smr_shops_city_idx on public.smr_shops (city);
create index if not exists smr_products_vendor_idx on public.smr_products (vendor_id);
create index if not exists smr_products_shop_idx on public.smr_products (shop_id);
create index if not exists smr_products_category_idx on public.smr_products (category);
create index if not exists smr_comments_entity_idx on public.smr_comments (entity_type, entity_id);
create index if not exists smr_comments_created_idx on public.smr_comments (created_at desc);
create index if not exists smr_comments_user_idx on public.smr_comments (user_id);
create index if not exists smr_ratings_entity_idx on public.smr_ratings (entity_type, entity_id);
create index if not exists smr_ratings_user_idx on public.smr_ratings (user_id);
create index if not exists smr_votes_comment_idx on public.smr_comment_votes (comment_id);
create index if not exists smr_lists_user_idx on public.smr_lists (user_id);
create index if not exists smr_list_items_list_idx on public.smr_list_items (list_id);
create index if not exists smr_activity_user_idx on public.smr_activity (user_id, created_at desc);
create index if not exists smr_reports_status_idx on public.smr_reports (status, created_at desc);

-- جست‌وجوی سریع نام‌ها در سمت سرور (اختیاری، برای آینده)
create index if not exists smr_vendors_name_trgm_idx
  on public.smr_vendors using gin (name_fa gin_trgm_ops);
create index if not exists smr_products_name_trgm_idx
  on public.smr_products using gin (name gin_trgm_ops);

-- ============================================================================
-- ۱۲) به‌روزرسانی updated_at
-- ============================================================================
create or replace function public.smr_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'smr_profiles', 'smr_vendors', 'smr_shops', 'smr_products',
    'smr_comments', 'smr_ratings', 'smr_lists'
  ]
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.smr_touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================================
-- ۱۳) نمای شاخص رضایت
--     score = ((good - bad) / total) * 100   →  بین -100 و +100
-- ============================================================================
create or replace view public.smr_entity_scores
with (security_invoker = true) as
select
  entity_type,
  entity_id,
  count(*)::int as total,
  count(*) filter (where value = 'good')::int as good,
  count(*) filter (where value = 'meh')::int as meh,
  count(*) filter (where value = 'bad')::int as bad,
  round(
    ((count(*) filter (where value = 'good')) - (count(*) filter (where value = 'bad')))::numeric
    * 100 / greatest(count(*), 1)
  , 1) as score,
  round(avg(case value when 'good' then 5 when 'meh' then 3 else 1 end), 2) as stars,
  max(created_at) as last_at
from public.smr_ratings
group by entity_type, entity_id;

-- ============================================================================
-- ۱۴) امنیت — RLS
-- ============================================================================
alter table public.smr_profiles       enable row level security;
alter table public.smr_vendors        enable row level security;
alter table public.smr_shops          enable row level security;
alter table public.smr_products       enable row level security;
alter table public.smr_comments       enable row level security;
alter table public.smr_ratings        enable row level security;
alter table public.smr_comment_votes  enable row level security;
alter table public.smr_lists          enable row level security;
alter table public.smr_list_items     enable row level security;
alter table public.smr_reports        enable row level security;
alter table public.smr_activity       enable row level security;

-- --- نمایه‌ها ---------------------------------------------------------------
drop policy if exists smr_profiles_read on public.smr_profiles;
create policy smr_profiles_read on public.smr_profiles
  for select using (true);

drop policy if exists smr_profiles_insert on public.smr_profiles;
create policy smr_profiles_insert on public.smr_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists smr_profiles_update on public.smr_profiles;
create policy smr_profiles_update on public.smr_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- فروشنده‌ها -------------------------------------------------------------
drop policy if exists smr_vendors_read on public.smr_vendors;
create policy smr_vendors_read on public.smr_vendors
  for select using (true);

drop policy if exists smr_vendors_insert on public.smr_vendors;
create policy smr_vendors_insert on public.smr_vendors
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists smr_vendors_update on public.smr_vendors;
create policy smr_vendors_update on public.smr_vendors
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists smr_vendors_delete on public.smr_vendors;
create policy smr_vendors_delete on public.smr_vendors
  for delete to authenticated using (created_by = auth.uid());

-- --- فروشگاه‌ها -------------------------------------------------------------
drop policy if exists smr_shops_read on public.smr_shops;
create policy smr_shops_read on public.smr_shops
  for select using (true);

drop policy if exists smr_shops_insert on public.smr_shops;
create policy smr_shops_insert on public.smr_shops
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists smr_shops_update on public.smr_shops;
create policy smr_shops_update on public.smr_shops
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists smr_shops_delete on public.smr_shops;
create policy smr_shops_delete on public.smr_shops
  for delete to authenticated using (created_by = auth.uid());

-- --- محصولات ---------------------------------------------------------------
drop policy if exists smr_products_read on public.smr_products;
create policy smr_products_read on public.smr_products
  for select using (true);

drop policy if exists smr_products_insert on public.smr_products;
create policy smr_products_insert on public.smr_products
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists smr_products_update on public.smr_products;
create policy smr_products_update on public.smr_products
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists smr_products_delete on public.smr_products;
create policy smr_products_delete on public.smr_products
  for delete to authenticated using (created_by = auth.uid());

-- --- نقدها: خواندن عمومی، نوشتن با نام کاربر یا مهمان، ویرایش/حذف فقط نویسنده
drop policy if exists smr_comments_read on public.smr_comments;
create policy smr_comments_read on public.smr_comments
  for select using (status = 'published' or user_id = auth.uid());

drop policy if exists smr_comments_insert on public.smr_comments;
create policy smr_comments_insert on public.smr_comments
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists smr_comments_update on public.smr_comments;
create policy smr_comments_update on public.smr_comments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists smr_comments_delete on public.smr_comments;
create policy smr_comments_delete on public.smr_comments
  for delete to authenticated using (user_id = auth.uid());

-- --- امتیازها ---------------------------------------------------------------
drop policy if exists smr_ratings_read on public.smr_ratings;
create policy smr_ratings_read on public.smr_ratings
  for select using (true);

drop policy if exists smr_ratings_insert on public.smr_ratings;
create policy smr_ratings_insert on public.smr_ratings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists smr_ratings_update on public.smr_ratings;
create policy smr_ratings_update on public.smr_ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists smr_ratings_delete on public.smr_ratings;
create policy smr_ratings_delete on public.smr_ratings
  for delete to authenticated using (user_id = auth.uid());

-- --- رأی‌های مفید ------------------------------------------------------------
drop policy if exists smr_votes_read on public.smr_comment_votes;
create policy smr_votes_read on public.smr_comment_votes
  for select using (true);

drop policy if exists smr_votes_insert on public.smr_comment_votes;
create policy smr_votes_insert on public.smr_comment_votes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists smr_votes_delete on public.smr_comment_votes;
create policy smr_votes_delete on public.smr_comment_votes
  for delete to authenticated using (user_id = auth.uid());

-- --- لیست‌ها ---------------------------------------------------------------
drop policy if exists smr_lists_all on public.smr_lists;
create policy smr_lists_all on public.smr_lists
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists smr_list_items_all on public.smr_list_items;
create policy smr_list_items_all on public.smr_list_items
  for all to authenticated
  using (exists (select 1 from public.smr_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.smr_lists l where l.id = list_id and l.user_id = auth.uid()));

-- --- گزارش‌ها ---------------------------------------------------------------
drop policy if exists smr_reports_insert on public.smr_reports;
create policy smr_reports_insert on public.smr_reports
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists smr_reports_read_own on public.smr_reports;
create policy smr_reports_read_own on public.smr_reports
  for select to authenticated using (user_id = auth.uid());

-- --- فعالیت -----------------------------------------------------------------
drop policy if exists smr_activity_read_own on public.smr_activity;
create policy smr_activity_read_own on public.smr_activity
  for select to authenticated using (user_id = auth.uid());

drop policy if exists smr_activity_insert_own on public.smr_activity;
create policy smr_activity_insert_own on public.smr_activity
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- ۱۵) دسترسی‌ها (RLS همچنان حاکم است)
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.smr_entity_scores to anon, authenticated;
grant select, insert, update, delete on
  public.smr_profiles,
  public.smr_vendors,
  public.smr_shops,
  public.smr_products,
  public.smr_comments,
  public.smr_ratings,
  public.smr_comment_votes,
  public.smr_lists,
  public.smr_list_items,
  public.smr_reports,
  public.smr_activity
to anon, authenticated;

-- دنبالهٔ identity برای درج‌های مجاز (RLS) لازم نیست به‌صورت دستی باز شود.

-- ============================================================================
-- ۱۶) دادهٔ شروع — فقط فروشنده‌های شناخته‌شده (قابل حذف/ویرایش)
-- اجرای دوباره، رکورد تکراری نمی‌سازد (بر اساس slug).
-- ============================================================================
insert into public.smr_vendors (slug, name, name_fa, kind, tagline, description, website, city, brand_hue, is_verified)
values
  ('snappfood',      'Snappfood',      'اسنپ‌فود',      'platform',    'سوپراپ سفارش غذا و خرید روزانه', 'پلتفرم سفارش آنلاین با سرویس سوپرمارکت.', 'snappfood.ir', 'تهران', 42, true),
  ('snapp-market',   'Snapp Market',   'اسنپ مارکت',    'platform',    'خرید آنلاین سوپرمارکت',          'سرویس خرید کالاهای سوپرمارکتی اسنپ.', 'snapp.market', 'تهران', 129, true),
  ('digikala',       'Digikala',       'دیجی‌کالا',     'marketplace', 'بزرگ‌ترین مارکت‌پلیس آنلاین',   'مارکت‌پلیس با فروشندگان متعدد.', 'digikala.com', 'تهران', 348, true),
  ('digikala-jet',   'Digikala Jet',   'دیجی‌کالا جت',  'platform',    'تحویل سریع کالاهای روزمره',     'سرویس تحویل سریع دیجی‌کالا.', 'jet.digikala.com', 'تهران', 344, true),
  ('ofoq-koroush',   'Ofoq Koroush',   'افق کوروش',     'chain',       'زنجیرهٔ سوپرمارکت',              'فروشگاه زنجیره‌ای با شعبه‌های متعدد.', 'ofoghkoroush.com', 'تهران', 205, true),
  ('hyperstar',      'Hyperstar',      'هایپراستار',    'chain',       'هایپرمارکت با تنوع بالا',        'هایپرمارکت با بخش تازه و وارداتی.', 'hyperstar.ir', 'تهران', 15, true),
  ('shahrvand',      'Shahrvand',      'شهروند',        'chain',       'فروشگاه زنجیره‌ای شهروند',       'زنجیرهٔ فروشگاهی با شعبه‌های متعدد.', 'shahrvand.ir', 'تهران', 197, true),
  ('refah',          'Refah',          'رفاه',          'chain',       'فروشگاه زنجیره‌ای رفاه',         'زنجیرهٔ فروشگاهی با قیمت رقابتی.', 'refah.ir', 'تهران', 158, true),
  ('badkubeh',       'Badkubeh',       'بادکوبه',       'online',      'خرید آنلاین میوه و مواد غذایی',  'فروشگاه اینترنتی با تمرکز بر محصولات تازه.', 'badkubeh.com', 'تهران', 96, false),
  ('janbo',          'Janbo',          'جانبو',         'chain',       'سوپرمارکت محله‌ای',              'زنجیرهٔ سوپرمارکت‌های کوچک محله‌ای.', 'janbo.ir', 'تهران', 320, false),
  ('mahalle-ma',     'Mahalle Ma',     'سوپرمارکت محله‌ی ما', 'local', 'خرید محلی، تحویل همان روز',      'فروشگاه محلی با سفارش تلفنی.', '', 'کرج', 262, false),
  ('bahar-produce',  'Bahar Produce',  'میوه‌سرای بهار', 'local',      'میوه و سبزی تازهٔ روز',           'میوه‌سرای محلی با سبد میوه.', '', 'اصفهان', 84, false),
  ('shahr-market',   'Shahr Market',   'فروشگاه شهر',    'local',      'فروشگاه محلی با ارسال رایگان',    'فروشگاه مستقل محلی.', '', 'مشهد', 30, false),
  ('tehran-kala',    'Tehran Kala',    'تهران‌کالا',     'online',     'فروشگاه اینترنتی کالاهای روزمره', 'فروشگاه اینترنتی کوچک.', '', 'تهران', 240, false)
on conflict (slug) do nothing;

-- ============================================================================
-- پایان. پس از اجرا، صفحه را تازه کن؛ نشانگر «حالت نمایشی» باید به
-- «متصل» تغییر کند.
--
-- اگر با خطای «relation does not exist» مواجه شدی، این فایل را دوباره
-- کامل اجرا کن. اگر خطای RLS دیدی، سیاست‌های همین فایل را بررسی کن.
--
-- یادآوری امنیتی:
--   • هرگز کلید service_role را در فرانت‌اند نگذار.
--   • برای مخفی‌کردن نقدها از پنل، status را به hidden تغییر بده.
--   • برای حذف کامل داده‌های بازاربان: drop table ... cascade
--     (با احتیاط؛ روی جدول‌های smr_ و فقط آن‌ها)
-- ============================================================================
