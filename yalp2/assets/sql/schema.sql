-- ============================================================
-- SUP ERMARKET REVIEWER — dedicated tables (prefix: sm_)
-- Do NOT touch existing tables. Run this whole file once.
-- ============================================================

-- 1) پلتفرم‌ها (اسنپ‌فود، دیجی‌کالا، اکالا، ...)
create table if not exists public.sm_platforms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  color       text default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon        text default '' check (char_length(icon) <= 40),
  note        text default '' check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists sm_platforms_user_name_uk on public.sm_platforms (user_id, lower(name));
create index        if not exists sm_platforms_user_idx    on public.sm_platforms (user_id);

-- 2) فروشگاه‌ها / فروشندگان (ساندویچی علی، ...)
create table if not exists public.sm_shops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  category    text default '' check (char_length(category) <= 60),
  note        text default '' check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists sm_shops_user_name_uk on public.sm_shops (user_id, lower(name));
create index        if not exists sm_shops_user_idx    on public.sm_shops (user_id);
create index        if not exists sm_shops_name_idx    on public.sm_shops (user_id, name);

-- 3) محصولات
create table if not exists public.sm_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  category    text default '' check (char_length(category) <= 60),
  unit        text default '' check (char_length(unit) <= 30),
  note        text default '' check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists sm_products_user_name_uk on public.sm_products (user_id, lower(name));
create index        if not exists sm_products_user_idx    on public.sm_products (user_id);
create index        if not exists sm_products_name_idx    on public.sm_products (user_id, name);

-- 4) خریدها / نظرات (هستهٔ اصلی)
create table if not exists public.sm_purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shop_id      uuid not null references public.sm_shops(id)     on delete cascade,
  product_id   uuid not null references public.sm_products(id)  on delete cascade,
  platform_id  uuid          references public.sm_platforms(id) on delete set null,
  rating       text not null check (rating in ('good','bad','shit')),
  price        numeric(12,0) check (price is null or price >= 0),
  quantity     numeric(10,2) default 1 check (quantity is null or quantity > 0),
  purchased_at date default current_date,
  note         text default '' check (char_length(note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists sm_purchases_user_idx    on public.sm_purchases (user_id);
create index if not exists sm_purchases_shop_idx    on public.sm_purchases (shop_id);
create index if not exists sm_purchases_product_idx on public.sm_purchases (product_id);
create index if not exists sm_purchases_plat_idx    on public.sm_purchases (platform_id);
create index if not exists sm_purchases_time_idx    on public.sm_purchases (user_id, created_at desc);

-- 5) کامنت‌ها (چندشکلی: روی فروشگاه/محصول/پلتفرم/خرید)
create table if not exists public.sm_comments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('shop','product','platform','purchase')),
  target_id    uuid not null,
  content      text not null check (char_length(content) between 1 and 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists sm_comments_user_idx   on public.sm_comments (user_id);
create index if not exists sm_comments_target_idx on public.sm_comments (target_type, target_id, created_at desc);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.sm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists sm_platforms_touch on public.sm_platforms;
create trigger sm_platforms_touch before update on public.sm_platforms
  for each row execute procedure public.sm_touch_updated_at();

drop trigger if exists sm_shops_touch on public.sm_shops;
create trigger sm_shops_touch before update on public.sm_shops
  for each row execute procedure public.sm_touch_updated_at();

drop trigger if exists sm_products_touch on public.sm_products;
create trigger sm_products_touch before update on public.sm_products
  for each row execute procedure public.sm_touch_updated_at();

drop trigger if exists sm_purchases_touch on public.sm_purchases;
create trigger sm_purchases_touch before update on public.sm_purchases
  for each row execute procedure public.sm_touch_updated_at();

drop trigger if exists sm_comments_touch on public.sm_comments;
create trigger sm_comments_touch before update on public.sm_comments
  for each row execute procedure public.sm_touch_updated_at();

-- ============================================================
-- RLS — هر کاربر فقط داده خودش
-- ============================================================
alter table public.sm_platforms enable row level security;
alter table public.sm_shops     enable row level security;
alter table public.sm_products  enable row level security;
alter table public.sm_purchases enable row level security;
alter table public.sm_comments  enable row level security;

-- sm_platforms
drop policy if exists sm_platforms_sel on public.sm_platforms;
create policy sm_platforms_sel on public.sm_platforms for select using (user_id = auth.uid());
drop policy if exists sm_platforms_ins on public.sm_platforms;
create policy sm_platforms_ins on public.sm_platforms for insert with check (user_id = auth.uid());
drop policy if exists sm_platforms_upd on public.sm_platforms;
create policy sm_platforms_upd on public.sm_platforms for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sm_platforms_del on public.sm_platforms;
create policy sm_platforms_del on public.sm_platforms for delete using (user_id = auth.uid());

-- sm_shops
drop policy if exists sm_shops_sel on public.sm_shops;
create policy sm_shops_sel on public.sm_shops for select using (user_id = auth.uid());
drop policy if exists sm_shops_ins on public.sm_shops;
create policy sm_shops_ins on public.sm_shops for insert with check (user_id = auth.uid());
drop policy if exists sm_shops_upd on public.sm_shops;
create policy sm_shops_upd on public.sm_shops for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sm_shops_del on public.sm_shops;
create policy sm_shops_del on public.sm_shops for delete using (user_id = auth.uid());

-- sm_products
drop policy if exists sm_products_sel on public.sm_products;
create policy sm_products_sel on public.sm_products for select using (user_id = auth.uid());
drop policy if exists sm_products_ins on public.sm_products;
create policy sm_products_ins on public.sm_products for insert with check (user_id = auth.uid());
drop policy if exists sm_products_upd on public.sm_products;
create policy sm_products_upd on public.sm_products for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sm_products_del on public.sm_products;
create policy sm_products_del on public.sm_products for delete using (user_id = auth.uid());

-- sm_purchases
drop policy if exists sm_purchases_sel on public.sm_purchases;
create policy sm_purchases_sel on public.sm_purchases for select using (user_id = auth.uid());
drop policy if exists sm_purchases_ins on public.sm_purchases;
create policy sm_purchases_ins on public.sm_purchases for insert with check (user_id = auth.uid());
drop policy if exists sm_purchases_upd on public.sm_purchases;
create policy sm_purchases_upd on public.sm_purchases for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sm_purchases_del on public.sm_purchases;
create policy sm_purchases_del on public.sm_purchases for delete using (user_id = auth.uid());

-- sm_comments
drop policy if exists sm_comments_sel on public.sm_comments;
create policy sm_comments_sel on public.sm_comments for select using (user_id = auth.uid());
drop policy if exists sm_comments_ins on public.sm_comments;
create policy sm_comments_ins on public.sm_comments for insert with check (user_id = auth.uid());
drop policy if exists sm_comments_upd on public.sm_comments;
create policy sm_comments_upd on public.sm_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sm_comments_del on public.sm_comments;
create policy sm_comments_del on public.sm_comments for delete using (user_id = auth.uid());
