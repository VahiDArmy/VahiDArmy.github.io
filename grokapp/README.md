# DevSpace — AI-Powered Local Development Workspace

Browser-based SPA that lets you develop real software projects through natural language.  
The AI acts as an agent: it inspects files, plans work, applies changes, verifies them, and continues across sessions.

## Design principles (from the product vision)

- **Files are the source of truth.** Project memory is a cache, not a replacement.
- **Models are replaceable workers.** The app owns the workflow, checkpoints, and verification.
- **Mobile-first, browser-only.** No local Node/Python server. Deploy as static files + Supabase.
- **Reliability over trust.** Tool results are verified. Interrupted work is recoverable.

## Architecture (v1)

| Layer | Implementation |
|-------|----------------|
| UI | Vanilla JS SPA, mobile-first dark theme |
| Auth & DB | Supabase (Auth + Postgres + RLS) |
| AI gateway | OpenRouter (chat completions + tool calling) |
| Files | Unified adapter: File System Access API **or** ZIP import/export + virtual tree (IndexedDB-backed per project) |
| Agent | App-owned loop: plan → tool calls → verified execution → checkpoint |

### File access strategy

| Environment | Primary path | Fallback |
|-------------|--------------|----------|
| Desktop Chromium | `showDirectoryPicker` (read/write) | ZIP |
| Mobile / Safari / Firefox | ZIP import + virtual tree | — |

The AI always operates on the virtual tree. When a native directory is connected, writes are mirrored and verified on disk.

Virtual-tree files are auto-saved to IndexedDB per project so they survive page reloads even without a connected folder or re-importing a ZIP.

### Agent reliability

- Explicit tool execution with post-write verification (`write_file` re-reads the file).
- Checkpoints after tool batches (stored on the project row).
- Max step limit; abortable via `AbortController`.
- Graceful fallback when a model rejects the `tools` parameter.
- Activity log for transparency without flooding the chat.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `sql/schema.sql`.
3. Under **Authentication → Providers**, enable Email.
4. Copy **Project URL** and **anon public** key.

### 2. OpenRouter

1. Create an account at [openrouter.ai](https://openrouter.ai).
2. Create an API key.
3. (Optional) Add credits or use free models (`:free` suffix).

### 3. Run the app

Serve the folder over HTTPS (required for File System Access API and secure cookies):

```bash
# Example with any static server
npx serve .
# or
python -m http.server 8080
```

Open the app → **Settings** → paste Supabase URL, anon key, and OpenRouter key → Save → Sign up / Sign in.

### 4. First project

1. **Projects → + New**
2. **Files → Import ZIP** (or Connect Folder on desktop Chromium)
3. Chat: *“Examine this project and summarize the architecture”*

## Project layout

```
index.html
css/main.css
js/
  app.js              # entry + UI wiring
  config.js           # localStorage config
  supabase-client.js
  auth/auth.js
  projects/store.js
  files/fs-adapter.js # native + virtual + ZIP
  models/registry.js  # OpenRouter catalog cache
  agent/
    tools.js          # tool defs + verified execution
    loop.js           # multi-step agent loop
  ui/chat.js
  utils/dom.js
sql/schema.sql
```

## Security notes

- Only the **Supabase anon key** and **user-provided OpenRouter key** live in the browser.
- RLS policies ensure users only see their own projects and messages.
- Never put the Supabase **service_role** key in client code.
- OpenRouter key is stored in `localStorage`; treat the device as trusted.

## Roadmap for later iterations

- Origin Private File System (OPFS) persistence for the virtual tree across reloads
- Per-user model preference table (cleaner multi-tenant)
- Structured roadmap editing tools for the agent
- Diff view and undo/checkpoint restore UI
- Better context packing (embeddings / file index) for large repos
- PWA service worker for offline shell

## License

Use freely for personal or commercial projects. No warranty.
