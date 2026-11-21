# Nebula · AI Studio

A complete, single-page AI chat workspace built in **vanilla JavaScript** (ES modules + Vite).
Supabase handles auth and storage; OpenRouter supplies free models with live reasoning streams.
Every conversation is a branching tree, and you can inspect the exact JSON sent to the model.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3012
npm run build    # static output in dist/
```

### 1. Supabase (one time)

1. Open your project: `https://ummhohozmpwltbgeczsf.supabase.co`
2. Go to **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), press **Run**.
3. **Authentication → URL Configuration** → add this app's exact origin (for example `http://localhost:3012/`) as a Site URL / Redirect URL. The auth screen shows the precise URL to copy.
4. For instant testing, turn **off** “Confirm email” in **Authentication → Providers → Email**.
5. Optional: enable Google / GitHub providers to use the social buttons.

The app detects missing tables and shows the setup screen with a copy button for the same SQL.

The Supabase publishable key is embedded in [`src/lib/config.js`](src/lib/config.js). It is public by design; every table is protected by row-level security. Never put a service-role key here. You can override both values with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### 2. OpenRouter key

Sign in, open **Settings → API key**, and paste a key from [openrouter.ai/keys](https://openrouter.ai/keys).
It is stored in your own `fbai_profiles` row (RLS-protected) and is used directly from the browser — there is no server in between. Requests are constrained to **free models only**.

---

## What is inside

### Chat & models
- Streaming replies with **reasoning** shown in a live, collapsible pane.
- `openrouter/free` auto-router: the real model that answered is shown on every reply, and by default the first resolved model is **locked for that chat**. A switch keeps `openrouter/free` pinned instead, still reporting each reply's true model.
- Model catalog from `GET /api/v1/models`, filtered to zero-cost models. Sync **upserts on `(user_id, model_id)`**, so models are never duplicated. Missing models are marked *retired* rather than deleted; your active/favourite choices survive every sync.
- Per-model activate/deactivate switches and favourites, search and filters.
- Per-chat parameters: system prompt, temperature, top-p, max tokens, reasoning effort, model lock.

### Branching
- Messages form a tree (`parent_id`). Editing a user message creates a **new sibling branch**; the original stays intact.
- Sibling navigation (‹ 2/3 ›), regenerate into a new branch, fork any message or a whole chat into a new conversation, branch map, duplicate, and per-conversation export.

### Transparency
- **Request inspector** shows the exact JSON body, headers (key redacted), full context messages, and the raw SSE response with usage/finish reason.
- **Request preview** before sending, including your unsent draft.
- Token estimates, per-message timings and a usage panel with a top-models breakdown.

### Persian / RTL / LTR
- The UI can flip to Persian (RTL) from Settings → Appearance.
- Independently of the UI language, **every rendered block** (`p`, `li`, headings, quotes, table cells) gets `dir="auto"`, so Persian paragraphs sit right-aligned while English ones sit left-aligned — in the same message. Code blocks are pinned LTR.

### Workspace
- Search, pin, archive, rename, delete, duplicate and export chats.
- Prompt library, command palette (`Ctrl/⌘ K`), keyboard shortcuts, drag-and-drop text attachments, toasts, responsive layout, eight themes with glow accents, reduced-motion support.
- JSON backup / restore of conversations, branches, and prompts.

### Shortcuts
| Keys | Action |
| --- | --- |
| `Ctrl/⌘ K` | Command palette |
| `Shift + Ctrl/⌘ O` | New chat |
| `Ctrl/⌘ Shift L` | Focus composer |
| `Enter` / `Shift Enter` | Send / newline (configurable) |
| `Ctrl/⌘ Enter` | Always send |
| `Esc` | Close overlay / menu / sidebar |

---

## Project layout

```
index.html
src/
  main.js              bootstrap, auth listener, shortcuts
  lib/
    config.js          Supabase + OpenRouter constants, defaults
    supabase.js        browser client (session persistence)
    db.js              all Supabase reads/writes
    openrouter.js      catalog, request builder, SSE streaming
    markdown.js        marked + DOMPurify + highlight.js + per-block dir
    state.js           shared state and event bus
    prefs.js           settings persistence/application
    themes.js  i18n.js  icons.js  utils.js
  ui/
    auth.js  setup.js  shell.js  chat.js  composer.js
    models.js  inspector.js  settings.js  palette.js
    overlay.js  toast.js  actions.js
  styles/
    base.css  layout.css  chat.css  ui.css
supabase/schema.sql
```

## Notes & limits

- There is no server component: requests go from your browser to OpenRouter with your key. That is what makes the inspector exact — and it means the key lives in your RLS-protected profile row, not in a secret store.
- Free models vary in context size, tool support and reasoning quality; the app shows what each reply actually used.
- Attachments are text-only (read locally, pasted into the message) because there is no storage bucket in this project.
- Model response headers such as `X-RateLimit-*` are not persisted; usage totals come from OpenRouter's `usage` field.
