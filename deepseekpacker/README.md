# Project Packer

A single-page tool that turns conversations into repositories — and back again.

Paste any message containing `{[[FILE: path]]} … {[[END: path]]}` blocks, and get a
downloadable `.zip` of the files it describes. Drop a `.zip` (or click
"Load .zip") and get a single `.txt` that can be pasted back into any chat.

Everything runs in the browser. Nothing leaves your machine.

---

## Quick start

1. **Open** `index.html` in any modern browser — no build step, no server required.
   For the PWA and service worker to register you will want a local static server
   (e.g. `python -m http.server`, `npx serve`, `caddy file-server`).
2. **Paste** a message with `FILE`/`END` markers anywhere on the page.
3. **Download** the resulting `project-pack.zip` from the topbar or the palette.
4. **Drop** a ZIP back on the page any time to convert it into a pasteable text.

---

## Paste format

Each file is wrapped in a pair of marker lines. The marker lines must appear at the
start of a line, with the path in `FILE` and `END` matching exactly:

```
{[[FILE: src/app.js]]}
function main() {
  return 42;
}
