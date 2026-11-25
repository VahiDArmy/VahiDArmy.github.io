# PromptForge

A single-page prompt refiner for GitHub Pages.

## Features
- RTL / LTR auto-detection with manual override (Auto / LTR / RTL)
- Level 1 — spelling & grammar correction
- Level 2 — deep sanity / paradox / consistency review (preserves intent)
- Inline diff with **green glow** for additions and **red glow** for removals
- AI model management backed by Supabase (`ai_models`)
- Fetch all OpenRouter **free** models, set default, activate/deactivate, delete
- Glassmorphism UI, keyboard shortcuts (Ctrl/⌘+Enter, Ctrl/⌘+Shift+Enter)

## Setup

1. **Deploy to GitHub Pages**
   - Push this repository to GitHub.
   - Settings → Pages → Deploy from branch → `main` / `root`.

2. **Supabase**
   - Open the SQL editor and run `supabase/policies.sql`.
   - The table `public.ai_models` already exists.

3. **OpenRouter**
   - Create a free key at https://openrouter.ai/keys
   - Open the app → **Settings** → paste the key → **Save key**
   - Open **Models** → **Fetch free models** → pick a default
   - Start writing prompts.

## Security

- The Supabase `sb_publishable_…` key is meant to be public. Access is
  governed by RLS — see `supabase/policies.sql`.
- The OpenRouter API key is stored **only** in `localStorage` on the user's
  browser and is sent directly to `openrouter.ai`.
- If this repository is public and you are worried, rotate the Supabase key
  in the dashboard and update `assets/js/config.js`.

## File layout
