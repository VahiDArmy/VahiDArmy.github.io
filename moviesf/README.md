# FULL METAL CINEMA

A private, local-first cinema archive. No bundler, no framework, no dependencies.
Plain ES modules that run from any static host — including a GitHub Pages subpath.

```
movies4/
├── index.html
├── manifest.webmanifest
├── sw.js                       offline shell
├── assets/
│   ├── css/  base.css · components.css · views.css
│   └── js/
│       ├── app.js              shell, router, auth gate, command deck
│       ├── config.js           ► the only file you must edit
│       ├── lib/                client · store · dom · ai · charts
│       └── views/              library · dossier · stats · studio ·
│                               arena · collections · ledger · settings
├── supabase/schema.sql         run once in the SQL editor
└── tools/check.mjs             dev-only syntax + import graph check
```

## 1. Put it online

Upload the **contents** of the folder to your host root (for
`vahidarmy.github.io/movies4/`, the folder *is* `movies4/`). No build step.
Everything is addressed relatively and routing is hash-based, so a subpath works
without any server rewrites.

## 2. Point it at your Supabase project

Open `assets/js/config.js`:

```js
export const SUPABASE = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-PUBLIC-KEY',   // the public anon key, never the service key
  edgeAiFunction: '',                // optional, leave empty
};
```

Then run `supabase/schema.sql` in the SQL editor. It is idempotent: it creates
any missing `cinema_*` table, adds the four columns the new UI needs to
`cinema_titles`, installs `updated_at` triggers, turns on row-level security and
adds the owner policy for every per-user table.

With no configuration the app runs in **demo mode**: same interface, backed by
`localStorage`, seeded with a small platoon so nothing is empty.

## 3. AI — bring your own key

Settings › AI Studio. Pick a provider, paste a key, choose a model.

* The key is stored **in this browser** (`localStorage`, prefix `fmc4.`) and sent
  **directly to the provider**. It is never written to Supabase, never included in
  exports, never routed through this app's host.
* Optional extra: seal it with a passphrase — AES-GCM with 210k PBKDF2 rounds.
  There is no recovery; a forgotten passphrase means re-entering the key.
* **Streaming** is a `fetch` + SSE reader; tokens render as they arrive.
* **Reasoning** is real, not cosmetic:
  * OpenRouter / custom: `reasoning: { effort }`, reads `delta.reasoning`
  * OpenAI o-series / GPT-5: `reasoning_effort`, drops `temperature`
  * Anthropic: `thinking: { type: 'enabled', budget_tokens }`, reads
    `thinking_delta` events; direct browser access header included
* The Supabase edge-function path is **separate and off by default**. It is only
  used if you set `edgeAiFunction` *and* enable the fallback in settings *and* no
  local key exists.

Providers with presets: OpenRouter, OpenAI, Anthropic, Groq, Ollama, custom
OpenAI-compatible (LM Studio, vLLM, a proxy).

## 4. Keyboard

`⌘K` command deck · `N` new dossier · `A` studio · `T` theme · `/` search ·
`?` field manual · `G` then `L`/`S`/`W`/`A` to jump · `Esc` close.

## 5. Data

Everything is a row you own. Settings › Data exports a full JSON snapshot, a
titles CSV, and imports both back. API keys are never in the snapshot.

## Notes

* `tools/check.mjs` is a dev utility (`node tools/check.mjs`) — it parses every
  module and validates the import graph. It is not needed at runtime.
* Posters are generated from the title (gradient + stencil initials) unless you
  provide `poster_url`.
* No analytics, no telemetry, no external requests except Google Fonts and the
  AI provider you configure.
