-- ============================================================
-- SHARES — public share links for shops & products
-- Dedicated table with sm_ prefix. Read-only snapshot.
-- Run this after schema.sql (once).
-- ============================================================

create table if not exists public.sm_shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type  text not null check (entity_type in ('shop','product')),
  entity_id    uuid not null,
  slug         text not null unique,
  snapshot     jsonb not null,
  views        int not null default 0 check (views >= 0),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

create index if not exists sm_shares_user_idx     on public.sm_shares (user_id);
create index if not exists sm_shares_entity_idx   on public.sm_shares (entity_type, entity_id);
create index if not exists sm_shares_slug_idx     on public.sm_shares (slug);
create index if not exists sm_shares_expires_idx  on public.sm_shares (expires_at);

-- updated_at trigger (uses existing helper from schema.sql)
drop trigger if exists sm_shares_touch on public.sm_shares;
create trigger sm_shares_touch before update on public.sm_shares
  for each row execute procedure public.sm_touch_updated_at();

-- RLS — owner full control
alter table public.sm_shares enable row level security;

drop policy if exists sm_shares_sel on public.sm_shares;
create policy sm_shares_sel on public.sm_shares for select using (user_id = auth.uid());

drop policy if exists sm_shares_ins on public.sm_shares;
create policy sm_shares_ins on public.sm_shares for insert with check (user_id = auth.uid());

drop policy if exists sm_shares_upd on public.sm_shares;
create policy sm_shares_upd on public.sm_shares for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sm_shares_del on public.sm_shares;
create policy sm_shares_del on public.sm_shares for delete using (user_id = auth.uid());

-- ============================================================
-- Public read RPC — security definer, grants to anon
-- ============================================================
create or replace function public.sm_share_get(p_slug text)
returns table (
  id uuid,
  entity_type text,
  entity_id uuid,
  slug text,
  snapshot jsonb,
  views int,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Atomic view increment (only if not expired)
  update public.sm_shares s
    set views = s.views + 1
    where s.slug = p_slug
      and (s.expires_at is null or s.expires_at > now());

  return query
    select s.id, s.entity_type, s.entity_id, s.slug, s.snapshot,
           s.views, s.created_at, s.expires_at
    from public.sm_shares s
    where s.slug = p_slug
      and (s.expires_at is null or s.expires_at > now())
    limit 1;
end;
$$;

grant execute on function public.sm_share_get(text) to anon, authenticated;
