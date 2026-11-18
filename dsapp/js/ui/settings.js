
---

## 7. Fixes applied during final assembly

- **`createCheckpointRow` added to `js/services/db.js`.** `js/services/checkpoints.js` imports it at
  module load time; without the export the module graph fails to link and the app never boots.
  `listCheckpointRows` and `deleteCheckpointRow` are included for completeness.
- **CDN dependencies.** `@supabase/supabase-js`, `marked`, `dompurify`, and `jszip` are resolved
  through the import map in `index.html`. There is no `package.json` and no bundler.
- **Settings import order.** `openSettings` reads the live `state.models` / `state.modelPrefs`
  objects, and `onSync` reloads the catalog before repainting, so a sync is reflected without a reload.

---

## 8. Security notes

- The Supabase anon key ships in `js/config.js` — that is expected. All access control is RLS;
  every policy checks `user_id = auth.uid()` and, for child tables, that the parent project is owned
  by the caller.
- The OpenRouter key lives in `localStorage` and is sent only to `openrouter.ai`. Anyone with access
  to the browser profile can read it. Use a scoped, revocable key.
- File contents are never uploaded. Checkpoints store text files in IndexedDB only.
- Agent writes are sandboxed by `normalizePath`, which rejects any path escaping the project root.

---

## 9. Known limitations

- Checkpoints skip binary files.
- The virtual FS has no directory entries; empty directories are not represented.
- Resuming an interrupted task starts a **new** task with the same description rather than replaying
  the exact message history — the workspace, not the transcript, is the source of truth.
- `ask_user` pauses the run; the answer starts a fresh task with the workspace as context.
