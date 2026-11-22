# Matrix³ — 3D Ranking & Scoring Matrix SPA

Vanilla JS + Supabase SPA for multi-dimensional personality / trait ranking.

## Setup

1. Open Supabase SQL Editor and run `setup.sql` (creates `mx_*` tables + seeds traits).
2. Ensure RLS / grants allow authenticated users to read/write `people`, `mx_traits`, `mx_scores`.
3. Serve the folder (any static server or open `index.html` via local server).
4. Sign up / log in.
5. In Settings, paste your OpenRouter API key (free models supported).

## Views (3D Matrix)

- **Trait stacks**: each stack = one trait. Cards show people scored on that trait (by all rankers).
- **Ranker stacks**: each stack = one person ranking. Cards show other people + their trait scores from that ranker.
- **Scored stacks**: each stack = one person receiving scores. Cards show who scored them and on which traits.

Swipe cards (Hammer.js) or use buttons. Stack navigation with dots.

## Features

- Auth (Supabase)
- People & Traits CRUD (uses existing `people` + `mx_traits`)
- Score entry with AI suggestion
- OpenRouter free models (key localStorage)
- AI chat with matrix context
- Insights overview + AI analysis trigger
- Sounds (glass / swipe / success) + vibration
- Particle FX
- Glass UI, stack cards inspired by Tinder demo
- Local fallbacks when tables missing permissions

## Prefix

All new tables use `mx_` prefix.

## Keys

- Supabase URL & publishable key are hardcoded as provided.
- OpenRouter key stored only in `localStorage`.
