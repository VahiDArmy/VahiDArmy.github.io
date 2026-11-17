-- ============================================================================
--  فروشگاه‌یار  ·  Freebuff / Codebuff
--  اسکیمای اختصاصی این اپ با پیشوند smrv_  (۴ حرف، بدون تداخل با sm_* موجود)
--
--  ⚠️ این فایل هیچ جدول موجودی را تغییر نمی‌دهد و فقط جدول‌های خودش را می‌سازد.
--  اجرا: Supabase Dashboard → SQL Editor → این فایل را کامل Paste و Run کنید.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ۰) تابع به‌روزرسانی updated_at
-- ---------------------------------------------------------------------------
create or replace function public.smrv_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ۱) پروفایل کاربر (تنظیمات شخصی)
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  city         text not null default '' check (char_length(city) <= 60),
  bio          text not null default '' check (char_length(bio) <= 280),
  avatar_hue   smallint not null default 158 check (avatar_hue between 0 and 360),
  currency     text not null default 'IRT' check (currency in ('IRT', 'IRR')),
  density      text not null default 'cozy' check (density in ('cozy', 'compact')),
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ۲) پلتفرم / وندور  (دیجی‌کالا، اسنپ‌فود، اکالا، خرید حضوری ...)
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_vendors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  color      text not null default '#35e0a1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji      text not null default '🛒' check (char_length(emoji) <= 16),
  website    text not null default '' check (char_length(website) <= 200),
  note       text not null default '' check (char_length(note) <= 500),
  is_active  boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists smrv_vendors_name_uniq
  on public.smrv_vendors (user_id, lower(btrim(name)));

create index if not exists smrv_vendors_user_idx
  on public.smrv_vendors (user_id, sort_order, created_at desc);

-- ---------------------------------------------------------------------------
-- ۳) فروشگاه  (ساندویچی، سوپرمارکت، هایپرمارکت ...)
--     فروشگاه مستقل از پلتفرم است؛ اتصالشان در جدول تجربه‌ها ساخته می‌شود.
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_shops (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  category   text not null default '' check (char_length(category) <= 60),
  city       text not null default '' check (char_length(city) <= 60),
  address    text not null default '' check (char_length(address) <= 200),
  emoji      text not null default '🏪' check (char_length(emoji) <= 16),
  note       text not null default '' check (char_length(note) <= 1000),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists smrv_shops_name_uniq
  on public.smrv_shops (user_id, lower(btrim(name)));

create index if not exists smrv_shops_user_idx
  on public.smrv_shops (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ۴) محصول
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_products (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  category   text not null default '' check (char_length(category) <= 60),
  brand      text not null default '' check (char_length(brand) <= 60),
  unit       text not null default '' check (char_length(unit) <= 30),
  emoji      text not null default '📦' check (char_length(emoji) <= 16),
  note       text not null default '' check (char_length(note) <= 1000),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists smrv_products_name_uniq
  on public.smrv_products (user_id, lower(btrim(name)));

create index if not exists smrv_products_user_idx
  on public.smrv_products (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ۵) تجربه / امتیاز  ← قلب سیستم
--     هر ترکیب «محصول × فروشگاه × پلتفرم» برای هر کاربر فقط یک بار ثبت می‌شود
--     و بعد از آن فقط قابل ویرایش است.
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id     uuid not null references public.smrv_products(id) on delete cascade,
  shop_id        uuid not null references public.smrv_shops(id) on delete cascade,
  vendor_id      uuid not null references public.smrv_vendors(id) on delete cascade,
  rating         text not null check (rating in ('good', 'not_good', 'shit')),
  price          numeric(14, 0) check (price is null or price >= 0),
  quantity       numeric(10, 2) not null default 1 check (quantity > 0),
  purchased_at   date not null default current_date,
  note           text not null default '' check (char_length(note) <= 2000),
  tags           text[] not null default '{}'::text[],
  would_buy_again boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint smrv_reviews_combo_uniq unique (user_id, product_id, shop_id, vendor_id)
);

create index if not exists smrv_reviews_user_date_idx
  on public.smrv_reviews (user_id, purchased_at desc, created_at desc);

create index if not exists smrv_reviews_product_idx on public.smrv_reviews (product_id);
create index if not exists smrv_reviews_shop_idx    on public.smrv_reviews (shop_id);
create index if not exists smrv_reviews_vendor_idx  on public.smrv_reviews (vendor_id);
create index if not exists smrv_reviews_rating_idx  on public.smrv_reviews (user_id, rating);
create index if not exists smrv_reviews_tags_idx    on public.smrv_reviews using gin (tags);

-- ---------------------------------------------------------------------------
-- ۶) کامنت  (روی محصول، فروشگاه، پلتفرم یا خود تجربه) + پاسخ تودرتو
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('product', 'shop', 'vendor', 'review')),
  target_id   uuid not null,
  parent_id   uuid references public.smrv_comments(id) on delete cascade,
  rating      text check (rating is null or rating in ('good', 'not_good', 'shit')),
  content     text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists smrv_comments_target_idx
  on public.smrv_comments (user_id, target_type, target_id, created_at desc);

create index if not exists smrv_comments_parent_idx
  on public.smrv_comments (parent_id);

-- ---------------------------------------------------------------------------
-- ۷) لیست‌ها  (بخر دوباره / نخر / سفارشی) و آیتم‌های لیست
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  emoji      text not null default '📝' check (char_length(emoji) <= 16),
  tone       text not null default 'custom' check (tone in ('buy', 'avoid', 'custom')),
  note       text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists smrv_lists_name_uniq
  on public.smrv_lists (user_id, lower(btrim(name)));

create table if not exists public.smrv_list_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id     uuid not null references public.smrv_lists(id) on delete cascade,
  target_type text not null check (target_type in ('product', 'shop', 'vendor', 'review')),
  target_id   uuid not null,
  note        text not null default '' check (char_length(note) <= 300),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint smrv_list_items_uniq unique (list_id, target_type, target_id)
);

create index if not exists smrv_list_items_list_idx
  on public.smrv_list_items (list_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ۸) فعالیت‌ها  (فید تغییرات)
-- ---------------------------------------------------------------------------
create table if not exists public.smrv_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action     text not null check (char_length(action) <= 40),
  entity     text not null check (char_length(entity) <= 40),
  entity_id  uuid,
  label      text not null default '' check (char_length(label) <= 160),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists smrv_activity_user_idx
  on public.smrv_activity (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ۹) تریگرها
-- ---------------------------------------------------------------------------
drop trigger if exists smrv_profiles_touch on public.smrv_profiles;
create trigger smrv_profiles_touch before update on public.smrv_profiles
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_vendors_touch on public.smrv_vendors;
create trigger smrv_vendors_touch before update on public.smrv_vendors
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_shops_touch on public.smrv_shops;
create trigger smrv_shops_touch before update on public.smrv_shops
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_products_touch on public.smrv_products;
create trigger smrv_products_touch before update on public.smrv_products
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_reviews_touch on public.smrv_reviews;
create trigger smrv_reviews_touch before update on public.smrv_reviews
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_comments_touch on public.smrv_comments;
create trigger smrv_comments_touch before update on public.smrv_comments
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_lists_touch on public.smrv_lists;
create trigger smrv_lists_touch before update on public.smrv_lists
  for each row execute function public.smrv_touch_updated_at();

drop trigger if exists smrv_list_items_touch on public.smrv_list_items;
create trigger smrv_list_items_touch before update on public.smrv_list_items
  for each row execute function public.smrv_touch_updated_at();

-- پاک‌سازی کامنت‌های یتیم وقتی موجودیت هدف حذف می‌شود
create or replace function public.smrv_prune_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := tg_argv[0];
begin
  delete from public.smrv_comments
   where target_type = v_type and target_id = old.id;
  delete from public.smrv_list_items
   where target_type = v_type and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists smrv_products_prune on public.smrv_products;
create trigger smrv_products_prune after delete on public.smrv_products
  for each row execute function public.smrv_prune_comments('product');

drop trigger if exists smrv_shops_prune on public.smrv_shops;
create trigger smrv_shops_prune after delete on public.smrv_shops
  for each row execute function public.smrv_prune_comments('shop');

drop trigger if exists smrv_vendors_prune on public.smrv_vendors;
create trigger smrv_vendors_prune after delete on public.smrv_vendors
  for each row execute function public.smrv_prune_comments('vendor');

drop trigger if exists smrv_reviews_prune on public.smrv_reviews;
create trigger smrv_reviews_prune after delete on public.smrv_reviews
  for each row execute function public.smrv_prune_comments('review');

-- ---------------------------------------------------------------------------
-- ۱۰) Row Level Security  →  هر کاربر فقط داده خودش را می‌بیند
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'smrv_profiles', 'smrv_vendors', 'smrv_shops', 'smrv_products',
    'smrv_reviews', 'smrv_comments', 'smrv_lists', 'smrv_list_items',
    'smrv_activity'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      t || '_sel', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
      t || '_ins', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_upd', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_del', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- ۱۱) ویوهای کمکی (فقط خواندن، با احترام به RLS)
-- ---------------------------------------------------------------------------
create or replace view public.smrv_v_review_feed
with (security_invoker = true)
as
select
  r.id,
  r.user_id,
  r.product_id,
  r.shop_id,
  r.vendor_id,
  r.rating,
  r.price,
  r.quantity,
  r.purchased_at,
  r.note,
  r.tags,
  r.would_buy_again,
  r.created_at,
  r.updated_at,
  p.name  as product_name,
  p.category as product_category,
  p.emoji as product_emoji,
  s.name  as shop_name,
  s.category as shop_category,
  s.emoji as shop_emoji,
  v.name  as vendor_name,
  v.color as vendor_color,
  v.emoji as vendor_emoji
from public.smrv_reviews r
join public.smrv_products p on p.id = r.product_id
join public.smrv_shops s on s.id = r.shop_id
join public.smrv_vendors v on v.id = r.vendor_id;

create or replace view public.smrv_v_entity_scores
with (security_invoker = true)
as
select
  r.user_id,
  'product'::text as entity_type,
  r.product_id as entity_id,
  count(*)::int as reviews,
  count(*) filter (where r.rating = 'good')::int as good,
  count(*) filter (where r.rating = 'not_good')::int as not_good,
  count(*) filter (where r.rating = 'shit')::int as shit,
  round(avg(case r.rating when 'good' then 3 when 'not_good' then 2 else 1 end), 2) as avg_score,
  sum(r.price * r.quantity) as spend,
  max(r.purchased_at) as last_purchased_at
from public.smrv_reviews r
group by r.user_id, r.product_id
union all
select
  r.user_id,
  'shop'::text,
  r.shop_id,
  count(*)::int,
  count(*) filter (where r.rating = 'good')::int,
  count(*) filter (where r.rating = 'not_good')::int,
  count(*) filter (where r.rating = 'shit')::int,
  round(avg(case r.rating when 'good' then 3 when 'not_good' then 2 else 1 end), 2),
  sum(r.price * r.quantity),
  max(r.purchased_at)
from public.smrv_reviews r
group by r.user_id, r.shop_id
union all
select
  r.user_id,
  'vendor'::text,
  r.vendor_id,
  count(*)::int,
  count(*) filter (where r.rating = 'good')::int,
  count(*) filter (where r.rating = 'not_good')::int,
  count(*) filter (where r.rating = 'shit')::int,
  round(avg(case r.rating when 'good' then 3 when 'not_good' then 2 else 1 end), 2),
  sum(r.price * r.quantity),
  max(r.purchased_at)
from public.smrv_reviews r
group by r.user_id, r.vendor_id;

revoke all on public.smrv_v_review_feed from anon;
revoke all on public.smrv_v_entity_scores from anon;
grant select on public.smrv_v_review_feed to authenticated;
grant select on public.smrv_v_entity_scores to authenticated;

commit;

-- ============================================================================
--  تمام. حالا اپ می‌تواند بخواند/بنویسد.
--  بررسی سریع:
--    select * from public.smrv_v_review_feed order by purchased_at desc limit 5;
-- ============================================================================
