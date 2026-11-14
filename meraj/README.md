# معراج · MI'RAJ

A buildless, mobile-first AI chat workspace made with **HTML, CSS and vanilla JavaScript only**.  
It uses **Supabase** for authentication and storage, and **OpenRouter's free models** for completions.

The app is a static SPA: there is no bundler, no framework, no runtime dependency except the vendored Supabase client. All icons, charts, Markdown rendering and UI primitives are hand-written.

---

## Quick start

```bash
npm start
# or: python3 -m http.server 3007 --bind 0.0.0.0
```

Open `http://localhost:3007`.

The server must serve the repository root. Opening `index.html` as a `file://` URL will not work because native ES modules require HTTP.

---

## 1. Database setup (one manual step)

The app uses six tables, all prefixed with `meraj_` so they cannot collide with an existing schema:

`meraj_profiles`, `meraj_models`, `meraj_conversations`, `meraj_messages`, `meraj_prompts`, `meraj_events`.

Run [`supabase/schema.sql`](supabase/schema.sql) once in:

**Supabase Dashboard → SQL Editor → New query → Run**

The script is idempotent. It does not modify `public.profiles` or any existing table. It creates the app tables, indexes, `updated_at` triggers, a sign-up profile bootstrap, and owner-only Row Level Security policies. Authentication continues to use the existing Supabase Auth users.

If the SQL has not been run, signed-in users see a setup screen with the full SQL, a copy button, and a download button. The app never pretends the schema exists.

The publishable key and project URL are in [`src/config.js`](src/config.js). This key is public by design and protected by RLS. Never put a Supabase secret/service-role key in this project.

---

## 2. OpenRouter key

1. Create a free key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Sign in to معراج.
3. Open **Settings → OpenRouter key**, paste the key, test it, and save.

The key is stored only in this browser (`localStorage`, or `sessionStorage` when "remember" is off). It is **never** sent to Supabase. It is not part of an archived request body, and the archived header list shows only `Bearer [REDACTED]`.

Free models are fetched from OpenRouter's public `/models` endpoint and stored per user in `meraj_models`. Models are filtered to zero prompt/completion price, text output, and non-audio/non-image output. Re-syncing the catalogue deliberately preserves your `is_active` and `is_favorite` choices.

---

## 3. What is implemented

### Chat and branching
- Streaming responses with a stop control and persisted partial output.
- **Automatic output budget**: leave max reply tokens blank and the request asks for the selected model's published maximum completion size, capped to the remaining context; if a provider publishes no maximum, the field is omitted so the provider chooses. A numeric value is still honoured as an explicit cap.
- **Resume**: failed, stopped, interrupted and length-truncated replies expose a Resume action. It creates a continuation branch that includes the partial assistant text and asks the model to finish from that exact point. Retry remains available separately.
- **Edit a sent prompt** by creating a sibling branch: the original branch is preserved, the edited prompt becomes a new branch, and arrow controls move between siblings.
- Branch paths are stored as a message tree (`parent_id`), so switching branches never destroys earlier prompts.
- Regenerate, delete a branch, fork, pin, archive, rename, and delete conversations.
- Per-conversation model, system prompt and sampling parameters.
- Mid-conversation model changes; every assistant message records the model that actually answered.
- When `openrouter/free` is selected, the concrete model returned by OpenRouter becomes the chat model and is labelled on the answer.

### Exact request inspection
- **Exact request** button in the chat header opens the last archived body.
- **Request** button on every assistant answer opens that turn's archived body.
- Composer **{ }** button previews the exact body that the next send will use.
- The Body tab renders the archived `bodyText` that was passed to `fetch()`, character for character. HTML escaping is display-only; **Copy** and **Download** return the unescaped complete string.
- Tabs for the exact messages, headers (Authorization redacted), curl, metadata, timing and raw JSON.
- The body is serialized once in [`src/services/requestBuilder.js`](src/services/requestBuilder.js), archived before the call, and sent verbatim.
- The inspector also exposes byte count, character count, message count, estimated input tokens, SHA-256 fingerprint, and the model actually requested.

### Errors
- OpenRouter HTTP status, status text, raw response body, parsed JSON, provider name, request ID and relevant response headers are preserved.
- SSE error events and malformed stream frames are shown with their raw payload.
- Empty completions are explicit, not silently presented as success.
- Network, configuration, database and schema errors have their own states.
- The raw error dialog and error card never replace provider text with a generic message.

### Models
- Free-model catalogue sync and manual re-sync.
- Search, capability filters, active/inactive filters, favourites, sorting.
- Activate or deactivate any model, bulk activate/deactivate, favourite toggle, per-model detail sheet.
- Context window, supported parameters, architecture and pricing metadata.
- Per-model request count, error count, success rate, token usage, average latency and last used.
- Test a model with a real minimal completion from the model detail sheet, including the exact request body and raw provider response.

### Analytics
- KPIs for requests, success rate, tokens, latency and active models.
- Daily request/token/error charts drawn with hand-written SVG.
- Router provenance: requested model vs. actual answering model.
- Error breakdown and a filterable recent-call table.
- CSV/JSON export of analytics data.

### Context
- Live context-window report for the current branch: system prompt, conversation, draft, estimated tokens, remaining window, usage gauge.
- Per-message token estimates and a detailed usage table from provider accounting when available.
- A warning before sending when the estimated request approaches the selected model's context window.

### Prompts and productivity
- Saved prompts with categories, favourites and usage counts.
- Built-in personas and starter prompts.
- Command palette (`Ctrl/Cmd + K`) for navigation and actions.
- Keyboard shortcuts, focus composer, mobile drawer, collapsible desktop sidebar.
- Export a conversation as Markdown or JSON; export the whole workspace as JSON.
- Four themes, accent colours, density, font scale and reduced-motion support.
- Mobile settings tabs wrap into a complete grid instead of being clipped, and the closed drawer no longer casts a shadow over the page.
- PWA manifest, responsive layout and touch-friendly controls.

### Data and privacy
- Owner-only RLS on every `meraj_` table.
- OpenRouter key stays on the device.
- Authorization never enters an archived request body.
- Account deletion flow for app data, plus sign-out and password reset.
- Local drafts and settings are namespaced under `meraj.v1`.

---

## Project layout

```text
index.html                  boot screen, stylesheet order, vendored Supabase, module entry
manifest.webmanifest        install metadata
assets/css/                 tokens, base, layout, components, chat, views, settings, motion, responsive
assets/icon.svg             app icon
src/config.js               public Supabase/OpenRouter config, table names, defaults
src/main.js                 boot, auth lifecycle, schema gate, hash router, command palette
src/services/               Supabase, auth, DB, request builder, OpenRouter, chat controller,
                            models, tokens/context, analytics, prompts, export, settings
src/views/                  auth, setup, chat, models, analytics, prompts, settings
src/components/             message, sidebar, model picker, context report, request inspector, error card
src/ui/                     icons, theme, toast, modal, menu, command palette, Markdown, SVG charts
src/tree.js                 message-tree and branch navigation
supabase/schema.sql         idempotent schema, RLS, triggers, indexes
src/vendor/supabase.js      vendored Supabase JS 2.119.0 (MIT; license alongside)
```

---

## Verification performed

- All 39 application modules pass `node --check` syntax validation.
- A static import/export audit resolves every relative import and named export.
- Core checks passed for exact request serialization, archived-body equality, Authorization redaction, error-turn exclusion, token estimation and branch creation/navigation.
- The app was served over HTTP and the auth screen rendered in a clean cloud-browser context with no page errors and all CSS/modules returning 200.
- The schema was validated by inspection but **not executed** against the live project, because the publishable key cannot run DDL.
- A real authenticated chat completion was **not** run, because that requires a user account and an OpenRouter key. The setup screen, schema check and OpenRouter error paths are designed for those states.

---

## Known limitations

- The SQL must be run manually once. The client-side publishable key cannot create tables.
- The OpenRouter key lives in browser storage because this is a static app with no server proxy. Do not use a shared/public device if that is unacceptable.
- Free-model availability, rate limits and provider policies are controlled by OpenRouter and can change without notice.
- The Free Models Router (`openrouter/free`) chooses a model at request time; the app records the returned model, but cannot force a particular routed model beyond sending a direct slug.
- OAuth providers are not shown because they are disabled on the existing Supabase project. Email/password, magic link and password recovery are implemented.
- This is ~24k hand-written lines, not 57,097. The line target was not met by padding; the app is the complete functional system above.
