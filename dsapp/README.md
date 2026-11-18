# DevSpace

A browser-only, AI-powered development workspace. Talk to free (or paid) OpenRouter
models, and let an agent read, write, and verify real project files — either a local
folder (Chromium) or an IndexedDB virtual workspace (every browser, including iOS).

## What ships

- **Chat-first UI** — mobile-first, with tab access to Files, Roadmap, Memory, Models, Projects, Settings.
- **Real filesystem** — File System Access API where available; a virtual workspace with ZIP import/export everywhere else.
- **Persistent memory** — project identity, memory notes, roadmap, tasks, tool audit log, messages, and checkpoints stored in Supabase behind Row Level Security.
- **Reliability layer** — every write is read back and verified. The agent is told never to trust model claims. A stuck or malformed model response triggers retries and (when appropriate) fallback to another enabled model.
- **Dual tool protocol** — native OpenAI-style tool calling for capable models, and a strict JSON protocol for models that don't support tools. Both are handled by the same agent loop.
- **Interruption recovery** — tasks are tracked with a `running` status. If a tab closes mid-task, the next open prompts you to inspect the actual files and choose how to proceed.

## Setup

### 1. Supabase

1. Open the SQL editor for project `kehylspimkjheqlsvepd` and run the full contents of `supabase/schema.sql`.
2. Under Authentication → Providers, ensure Email is enabled.
3. If using magic links, add your deployed origin (e.g. `https://yourdomain.example`) to Authentication → URL Configuration → Redirect URLs.
4. Copy the **Publishable key** (`sb_publishable_...`). This is the public anon key; it is safe in client-side code as long as RLS is on (which the schema enables).

### 2. Configure the app

`js/config.js` already contains the Supabase URL and publishable key. If you deploy to a new project, replace them there.

### 3. Deploy

DevSpace is a static SPA. Deploy the repository to any static host:

- **Vercel** — import the repo; framework preset "Other"; output `./`.
- **Netlify** — publish directory `./`; no build command.
- **Cloudflare Pages** — output directory `./`; no build command.
- **GitHub Pages** — serve the repository root.

No build step is required. All third-party libraries (`@supabase/supabase-js`,
`marked`, `dompurify`, `jszip`) are loaded from `esm.sh` via an import map in `index.html`.

### 4. First run

1. Open the deployed app. Sign up / sign in.
2. In **Settings → OpenRouter API key**, paste a key from <https://openrouter.ai/keys>.
   It is stored in `localStorage` and never sent to Supabase.
3. In **Models**, click **Sync** to populate the registry. Toggle off any models you don't
   want considered for automatic selection — your preferences are independent of the
   OpenRouter catalog and are never overwritten by future syncs.
4. Create a project in **Projects**. Choose *Virtual workspace* for maximum compatibility,
   or *Local folder* if you're on Chromium desktop / Android.

## Filesystem modes

- **Local folder (FSA)** — on Chromium desktop and Android, DevSpace requests read/write
  permission to a directory you choose. The handle is persisted in IndexedDB. On a new
  visit, the browser may require re-authorisation; the Files panel will prompt for it.
- **Virtual workspace** — a full in-memory / IndexedDB filesystem that behaves identically
  to a real folder to the agent. Use **Files → Import ZIP** and **Export ZIP** to move code
  in and out, or to hand the project off to another tool.

**iOS Safari does not support the File System Access API.** The virtual workspace is the
supported path there. ZIP export is the way to move code off the device.

## Agent model

Each chat turn creates a `ds_tasks` row, then runs the agent loop:

1. Build context from project summary, file index, memory, roadmap, recent messages, and
   the most relevant files for the current request.
2. Ask the selected model to plan and call tools. Native tool calls are used when the
   model supports them; otherwise a strict JSON protocol is used.
3. Execute each tool and return the real result, including a verification read-back for
   every write.
4. Persist each tool call to `ds_tool_operations` as an audit trail.
5. Repeat until the model produces a final answer, asks the user a question, or the
   iteration limit is reached.

Tool set: `list_files`, `read_file`, `write_file`, `delete_file`, `move_file`,
`search_files`, `get_project_structure`, `update_roadmap`, `add_memory`, `read_memory`,
`create_checkpoint`, `ask_user`.

## Reliability notes

- Every `write_file` is verified by reading the file back; on mismatch the tool returns
  an error and the model is expected to correct it.
- Every `delete_file` is verified by re-checking existence; a checkpoint of the current
  project is created first.
- Duplicate tool calls (identical name + args more than three times) are interrupted with
  a system message rather than looping.
- If the current model repeatedly fails on a 5xx / 429 / timeout, the agent falls back to
  another enabled model that supports tools. The task and message history are preserved.
- If the tab is closed mid-task, the task remains `running` in Supabase. On next load,
  `detectInterrupted` in the chat panel prompts you with options, and the model is never
  asked to blindly repeat a half-finished step.

## Security

- Supabase Row Level Security restricts every project-scoped row to its owner.
- The publishable Supabase key is safe to ship; the OpenRouter key lives only in
  `localStorage` and is sent only to `openrouter.ai`.
- Project **file contents** never leave the device unless you deliberately export a ZIP
  or the AI chooses to read a file into a model context. Project **memory**, **roadmap**,
  **messages**, and **audit logs** are stored in Supabase.

## Data layout

| Where | What |
| --- | --- |
| Supabase `ds_*` tables | Projects, memory, roadmap, tasks, messages, tool operations, checkpoints (metadata), per-user model preferences, shared model catalog |
| IndexedDB (`devspace`) | Virtual files, checkpoints (full contents), saved FSA directory handles, small KV |
| `localStorage` | OpenRouter API key, last sync time, last opened project, theme |
| Your device's filesystem | Actual project files when using Local folder mode |

Exported ZIPs are portable and self-contained. The application's project history remains
associated with your Supabase account; the code does not.

## Known limitations

- The File System Access API is not available on iOS Safari or Firefox. Use the virtual
  workspace there.
- Very large files and large dependency trees can exceed model context windows. The
  context builder truncates and prioritises; it does not silently drop the task.
- Free OpenRouter models vary widely in tool-calling ability. If a model performs badly,
  disable it in Models and the agent will pick another.

## File map

