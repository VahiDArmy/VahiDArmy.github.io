# R3D · Rank

3-dimensional ranking SPA (people × people × traits). Vanilla JS + Supabase + OpenRouter free models.

## Setup

1. Open Supabase SQL editor for project `nvmevqkaovazhmoznusf` and run:

```sql
create table if not exists public.r3d_traits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  color text default '#7c5cff',
  icon text default 'gem',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.r3d_scores (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references public.people(id) on delete cascade,
  ratee_id uuid not null references public.people(id) on delete cascade,
  trait_id uuid not null references public.r3d_traits(id) on delete cascade,
  score numeric not null check (score >= -5 and score <= 5),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(rater_id, ratee_id, trait_id)
);

alter table public.r3d_traits enable row level security;
alter table public.r3d_scores enable row level security;

create policy "r3d_traits_read" on public.r3d_traits for select using (true);
create policy "r3d_traits_write" on public.r3d_traits for all using (auth.role() = 'authenticated');
create policy "r3d_scores_read" on public.r3d_scores for select using (true);
create policy "r3d_scores_write" on public.r3d_scores for all using (auth.role() = 'authenticated');
```

2. Serve the `r3d-app` folder (any static server).

3. Sign up / sign in.

4. Settings → paste OpenRouter API key (free models). Model defaults to `openrouter/free`.

5. Add people (or Seed demo), add traits, then Rank.

## Views

- **Rank** — PEOPLE mode: stacks per person (cards = traits). TRAITS mode: stacks per trait (cards = people). Swipe or select → score panel (−5…+5) → Commit. Glass-clink SFX + vibration.
- **People / Traits** — CRUD grids.
- **Matrix** — full rater × ratee grid for selected trait.
- **Viz** — radar / bars of received vs given scores.
- **Insights** — OpenRouter chat with live score context + quick chips (asymmetry, auto-score, 3D space…).
- **Settings** — key, model, volume, vibrate, theme, seed.

## Notes

- Uses existing `people` table.
- Tables prefixed `r3d_` to avoid collisions.
- API key stored only in `localStorage`.
- Procedural Web Audio for clinks / whooshes / chimes (no external audio files required).
