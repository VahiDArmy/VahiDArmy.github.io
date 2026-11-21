# Simurgh (سیمرغ) — Free-model AI chat SPA

Pure vanilla JS. No framework, no build step. Supabase auth + cloud sync, OpenRouter free models,
Persian-first RTL, branching, streamed reasoning, and a full request inspector.

## Setup (5 minutes)

1. **Database** — Open your Supabase project → SQL Editor → paste `supabase/schema.sql` → Run.
   (Safe to re-run; creates tables, RLS policies, indexes, triggers.)
2. **Auth URLs** — Supabase → Authentication → URL Configuration:
   set **Site URL** to where you host the app (e.g. `http://localhost:8000` while developing).
   Email confirmation is ON in your project — the app shows a "confirm your email" screen with resend.
3. **Serve over HTTP** (ES modules don't run from `file://`):
   ```bash
   python -m http.server 8000
   # or: npx serve .
   ```
   Then open http://localhost:8000 — or deploy the folder to GitHub Pages / Netlify / Cloudflare Pages.
4. **OpenRouter key** — get a free key at https://openrouter.ai/settings/keys,
   then in Simurgh: Settings → Connection → paste → *Validate & save*.
   The key lives **only in your browser's localStorage** — it is never sent to Supabase.
5. **Models** — Settings → Models → *Fetch free models*. Re-fetch anytime:
   results are **upserted by model id** (no duplicates ever), your **deactivations & pins survive**,
   and models that disappeared are flagged **stale** instead of deleted.

## Free Router behavior
- New chats default to `openrouter/free`. The router picks a free model per request and the
  response's `model` field is displayed under every reply.
- **Sticky (default):** after the first reply the chat locks to that returned model.
- **Always re-route:** toggle the chip in the chat header (or Settings → Generation for the global
  default) to keep sending `openrouter/free` every time — actual model still shown per reply.
- Note: deactivating a model hides it from *your picker*; the server-side router may still route to
  any free model (client-side limitation you acknowledged).

## Feature map
Streaming + stop/continue/retry · live reasoning panel ("Thought for Xs") · edit→branch, regenerate→branch,
`‹ 2/3 ›` version switcher, fork-from-any-message · request inspector (payload / headers with key reveal /
cURL / usage meta) · markdown with streaming-safe code fences, ~25-language highlighting, KaTeX math,
HTML preview, code copy/wrap/download · per-block RTL/LTR auto direction + full Persian UI · 12 themes,
density/font/width/bubbles/background FX · Ctrl+K palette with in-message search · projects with
instructions · prompt library + `/` slash menu · vision images & text files (drag/drop/paste) ·
voice input + read-aloud · export MD/JSON/TXT + full backup/restore · drafts, pins, AI titles,
feedback, token/tps stats · generation continues while you browse other chats · mobile drawer layout.

## Shortcuts
Ctrl/⌘ K palette · Alt N new chat · Ctrl/⌘ B sidebar · Ctrl/⌘ Shift C copy last reply ·
Ctrl/⌘ Shift E export chat · Ctrl/⌘ / shortcuts · Enter send · Shift+Enter newline · / templates · Esc close.

## Notes & limits
- Free-tier rate limits apply (per OpenRouter: ~20 req/min, daily caps vary by model/account);
  429 errors show a retry hint. Some free models vanish weekly — that's what *stale* + the router are for.
- Data syncs per device on load (no realtime push); refresh to pull changes from another device.
- Branch state is stored per conversation (`branch_map`); importing a backup keeps all branches but
  resets the *selected* path to each node's latest child.
- Everything is client-side: anyone with access to your browser can use your stored key. That is the
  inherent SPA trade-off you acknowledged.
