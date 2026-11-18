// ---------------------------------------------------------------------------
// Files pane: browse, view, edit, create, delete, import/export, link a folder.
// ---------------------------------------------------------------------------

import { supportsDirectoryAccess, Vault } from '../core/vault.js';
import { readZipFile, buildZipBlob } from '../core/zip.js';
import { indexProject } from '../core/project.js';
import { uid, escapeHtml, formatBytes, timeAgo, downloadBlob, normalizePath, isLikelyText } from '../core/util.js';
import { icon, toast, openModal, confirmDialog, promptDialog, emptyState } from './dom.js';

export async function mountFilesPane(host, { project, fs, ctx, onChanged = () => {}, onOpenChat = () => {} }) {
  let filter = '';
  let openPath = null;
  let editing = false;
  let draft = '';
  let lastEdit = null;
  let files = [];

  host.innerHTML = '<div class="pane-scroll"><div class="skeleton" style="height:60px"></div></div>';

  async function reload() {
    files = await fs.list().catch(() => []);
    await paint();
  }

  function linkBanner() {
    if (fs.linkState === 'linked') {
      return `<div class="callout ok small" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        ${icon('link')}<span style="flex:1">Linked to a folder on this computer. Writes are verified against the real files.</span>
        <button class="btn small ghost" data-action="pull">Re-read folder</button>
      </div>`;
    }
    if (fs.linkState === 'needs-permission') {
      return `<div class="callout warn small" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        ${icon('shield')}<span style="flex:1">Folder permission expired (browsers clear it after a restart). Reconnect to resume writing to disk.</span>
        <button class="btn small" data-action="reconnect">Reconnect</button>
      </div>`;
    }
    return `<div class="callout small" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      ${icon('info')}<span style="flex:1">Files live in this browser's storage. ${supportsDirectoryAccess ? 'Link a folder to edit them in place on desktop.' : 'On phones, import or export a ZIP to move a project in and out.'}</span>
      ${supportsDirectoryAccess ? '<button class="btn small" data-action="link">Link folder</button>' : ''}
    </div>`;
  }

  function treeRows() {
    const dirs = new Set();
    for (const file of files) {
      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
    }
    let rows = [
      ...[...dirs].map((path) => ({ type: 'dir', path, size: 0 })),
      ...files.map((file) => ({ type: 'file', ...file })),
    ].sort((a, b) => a.path.localeCompare(b.path));

    if (filter.trim()) {
      const needle = filter.trim().toLowerCase();
      rows = rows.filter((row) => row.path.toLowerCase().includes(needle));
    }
    return rows;
  }

  async function paint() {
    if (openPath) { await paintViewer(); return; }

    const rows = treeRows();
    host.innerHTML = `
      <div class="pane-toolbar">
        <div class="searchbox">${icon('search')}<input id="file-filter" placeholder="Filter files" value="${escapeHtml(filter)}" /></div>
        <button class="btn ghost icon small" data-action="new" aria-label="New file" title="New file">${icon('plus')}</button>
        <button class="btn ghost icon small" data-action="import" aria-label="Import ZIP" title="Import ZIP">${icon('upload')}</button>
        <button class="btn ghost icon small" data-action="export" aria-label="Export ZIP" title="Export ZIP">${icon('download')}</button>
        <button class="btn ghost icon small" data-action="refresh" aria-label="Refresh" title="Refresh">${icon('refresh')}</button>
      </div>
      <div class="pane-scroll">
        ${linkBanner()}
        ${rows.length ? `<div id="file-rows">${rows.map(rowHTML).join('')}</div>
          ${rows.length >= 400 ? '<div class="tiny muted" style="margin-top:8px">Showing the first 400 entries. Use the filter to narrow down.</div>' : ''}
          <div class="tiny muted" style="margin-top:10px">${files.length} file(s) · ${formatBytes(files.reduce((sum, f) => sum + (f.size || 0), 0))}</div>`
        : emptyState({
          iconName: 'file',
          title: filter ? 'No matching files' : 'No files yet',
          body: filter ? 'Try a different filter.' : 'Ask the agent to create something, add a file here, or import a ZIP.',
        })}
      </div>`;

    const filterInput = host.querySelector('#file-filter');
    if (filterInput && document.activeElement !== filterInput) filterInput.value = filter;
  }

  function rowHTML(row) {
    const depth = row.path.split('/').length - 1;
    const name = row.path.split('/').pop();
    const isDir = row.type === 'dir';
    return `<div class="file-row ${isDir ? 'dir' : ''}" data-path="${escapeHtml(row.path)}" data-type="${row.type}" style="padding-left:${9 + depth * 12}px">
      ${icon(isDir ? 'folder' : 'file')}
      <span class="name">${escapeHtml(name)}</span>
      <span class="size">${isDir ? '' : formatBytes(row.size)}</span>
    </div>`;
  }

  async function paintViewer() {
    let record;
    try {
      record = await fs.read(openPath);
    } catch (err) {
      toast(err.message, { kind: 'bad' });
      openPath = null;
      await paint();
      return;
    }

    const binary = record.binary || !isLikelyText(record.path);
    host.innerHTML = `
      <div class="viewer-head">
        <button class="btn ghost icon small" data-close aria-label="Back to files">${icon('back')}</button>
        <span class="path">${escapeHtml(record.path)}</span>
        ${lastEdit && lastEdit.path === record.path ? '<button class="btn small ghost" data-action="undo">Undo</button>' : ''}
        ${binary ? '' : `<button class="btn ghost icon small" data-action="edit" aria-label="Edit">${icon('edit')}</button>`}
        <button class="btn ghost icon small" data-action="rename" aria-label="Rename">${icon('chevron')}</button>
        <button class="btn ghost icon small" data-action="delete" aria-label="Delete">${icon('trash')}</button>
      </div>
      ${editing
        ? `<textarea class="editor" id="editor" spellcheck="false">${escapeHtml(draft)}</textarea>
           <div class="pane-toolbar" style="border-top:1px solid var(--line-soft);border-bottom:0">
             <span class="tiny muted" style="flex:1">${formatBytes(draft.length)} · edited ${timeAgo(new Date().toISOString())}</span>
             <button class="btn small ghost" data-action="cancel">Cancel</button>
             <button class="btn small primary" data-action="save">Save</button>
           </div>`
        : `<div class="viewer-file"><code>${binary ? escapeHtml('[binary file — export the project to read it]') : escapeHtml(record.content)}</code></div>`}`;

  }

  async function saveFile() {
    const textarea = host.querySelector('#editor');
    if (!textarea) return;
    const content = textarea.value;
    try {
      const previous = await fs.read(openPath).catch(() => null);
      const result = await fs.write(openPath, content);
      if (!result.verified && result.target === 'folder') throw new Error('The write could not be verified on disk.');
      if (previous) {
        const checkpoint = {
          id: uid(),
          projectId: project.id,
          runId: null,
          kind: 'manual',
          label: `Edit ${openPath}`,
          createdAt: new Date().toISOString(),
          fileCount: 1,
          bytes: previous.size,
          entries: [{ path: previous.path, existed: true, content: previous.content, binary: previous.binary, size: previous.size }],
        };
        await fs.vault.saveCheckpoint(checkpoint).catch(() => {});
        lastEdit = { path: previous.path, checkpoint };
      }
      editing = false;
      draft = '';
      toast(`Saved ${openPath}`, { kind: 'ok' });
      await onChanged();
      await paintViewer();
    } catch (err) {
      toast(`Save failed: ${err.message}`, { kind: 'bad' });
    }
  }

  async function handleAction(action) {
    if (action === 'refresh' || action === 'pull') {
      if (action === 'pull' && fs.linkState === 'linked') {
        const ok = await confirmDialog({
          title: 'Re-read the folder?',
          message: 'The folder on disk becomes the source of truth again.',
          details: 'Any files that exist only in the browser copy will be removed.',
          confirmLabel: 'Re-read folder',
        });
        if (!ok) return;
        try {
          const result = await fs.importFromDisk({ replace: true });
          toast(`Imported ${result.files} files from the folder`, { kind: 'ok' });
          await onChanged();
          await reload();
        } catch (err) { toast(err.message, { kind: 'bad' }); }
        return;
      }
      await reload();
      return;
    }

    if (action === 'link') {
      if (!supportsDirectoryAccess) {
        toast('This browser cannot open folders. Export a ZIP instead.', { kind: 'warn' });
        return;
      }
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'forgebook-project' });
        const result = await fs.linkDirectory(handle);
        const label = result.mode === 'imported'
          ? `Imported ${result.files} files from the folder`
          : result.mode === 'pushed'
            ? `Copied ${result.files} local files into the folder`
            : 'Folder linked (it was empty)';
        toast(label, { kind: 'ok' });
        await onChanged();
        await reload();
      } catch (err) {
        if (err?.name !== 'AbortError') toast(`Could not link the folder: ${err.message}`, { kind: 'bad' });
      }
      return;
    }

    if (action === 'reconnect') {
      const ok = await fs.reconnect();
      toast(ok ? 'Folder reconnected' : 'Permission was not granted', { kind: ok ? 'ok' : 'warn' });
      await paint();
      return;
    }

    if (action === 'new') {
      const path = await promptDialog({
        title: 'New file',
        label: 'Path',
        placeholder: 'src/components/Button.js',
        hint: 'Folders are created automatically.',
        confirmLabel: 'Create',
      });
      if (!path) return;
      try {
        await fs.write(path, '\n');
        toast(`Created ${path}`, { kind: 'ok' });
        await onChanged();
        await reload();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }

    if (action === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const parsed = await readZipFile(file);
          const ok = await confirmDialog({
            title: 'Merge this archive?',
            message: `Add ${parsed.entries.length} files${parsed.strippedRoot ? ` (root folder ${parsed.rootName}/ removed)` : ''} to this project.`,
            details: 'Files with the same path are overwritten. Other files stay.',
            confirmLabel: 'Import',
          });
          if (!ok) return;
          let count = 0;
          for (const entry of parsed.entries) {
            await fs.write(entry.path, entry.content, { binary: entry.binary }).catch(() => {});
            count += 1;
          }
          await indexProject(project, fs).catch(() => {});
          toast(`Imported ${count} files`, { kind: 'ok' });
          await onChanged();
          await reload();
        } catch (err) { toast(`Import failed: ${err.message}`, { kind: 'bad' }); }
      });
      input.click();
      return;
    }

    if (action === 'export') {
      try {
        const entries = [];
        for (const file of files) {
          const record = await fs.read(file.path).catch(() => null);
          if (record) entries.push(record);
        }
        const blob = await buildZipBlob(entries, { folder: project.name.replace(/[^\w.-]+/g, '-') });
        downloadBlob(blob, `${project.name.replace(/[^\w.-]+/g, '-')}.zip`);
        toast(`Exported ${entries.length} files`, { kind: 'ok' });
      } catch (err) { toast(`Export failed: ${err.message}`, { kind: 'bad' }); }
      return;
    }

    if (action === 'edit') {
      try {
        const record = await fs.readText(openPath);
        draft = record.content;
        editing = true;
        await paintViewer();
        const textarea = host.querySelector('#editor');
        if (textarea) {
          textarea.addEventListener('input', () => { draft = textarea.value; });
          textarea.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
              event.preventDefault();
              saveFile();
            }
            if (event.key === 'Tab') {
              event.preventDefault();
              const start = textarea.selectionStart;
              textarea.value = `${textarea.value.slice(0, start)}  ${textarea.value.slice(textarea.selectionEnd)}`;
              textarea.selectionStart = textarea.selectionEnd = start + 2;
              draft = textarea.value;
            }
          });
        }
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }

    if (action === 'save') { await saveFile(); return; }

    if (action === 'cancel') {
      editing = false;
      draft = '';
      await paintViewer();
      return;
    }

    if (action === 'undo') {
      if (!lastEdit) return;
      try {
        const entry = lastEdit.checkpoint.entries[0];
        await fs.write(entry.path, entry.content, { binary: entry.binary });
        lastEdit = null;
        toast('Previous version restored', { kind: 'ok' });
        await onChanged();
        await paintViewer();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }

    if (action === 'rename') {
      const to = await promptDialog({
        title: 'Move or rename',
        label: 'New path',
        value: openPath,
        confirmLabel: 'Move',
      });
      if (!to || to === openPath) return;
      try {
        await fs.move(openPath, to);
        toast(`Moved to ${to}`, { kind: 'ok' });
        openPath = normalizePath(to);
        await onChanged();
        await reload();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }

    if (action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this file?',
        message: `${openPath} will be removed from the project.`,
        details: fs.linkState === 'linked' ? 'It is also deleted from the folder on your computer.' : '',
        confirmLabel: 'Delete file',
        danger: true,
      });
      if (!ok) return;
      try {
        const result = await fs.remove(openPath);
        if (!result.removed) throw new Error('The file could not be removed.');
        toast('File deleted', { kind: 'ok' });
        openPath = null;
        await onChanged();
        await reload();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
    }
  }

  // One delegated listener for the whole pane: re-rendering must never
  // stack duplicate handlers (a double "Save" writes twice).
  host.addEventListener('click', async (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl && host.contains(actionEl)) {
      event.preventDefault();
      await handleAction(actionEl.dataset.action);
      return;
    }
    if (event.target.closest('[data-close]')) {
      openPath = null;
      editing = false;
      draft = '';
      await paint();
      return;
    }
    const row = event.target.closest('[data-path]');
    if (!row) return;
    if (row.dataset.type === 'file') {
      openPath = row.dataset.path;
      editing = false;
      draft = '';
      await paintViewer();
    } else {
      filter = row.dataset.path;
      await paint();
    }
  });

  host.addEventListener('input', (event) => {
    if (event.target.id === 'file-filter') {
      filter = event.target.value;
      const rows = host.querySelector('#file-rows');
      if (rows) rows.innerHTML = treeRows().map(rowHTML).join('');
    } else if (event.target.id === 'editor') {
      draft = event.target.value;
    }
  });

  host.addEventListener('keydown', async (event) => {
    if (event.target.id === 'file-filter' && event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.target.id !== 'editor') return;
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      await saveFile();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.target;
      const start = textarea.selectionStart;
      textarea.value = `${textarea.value.slice(0, start)}  ${textarea.value.slice(textarea.selectionEnd)}`;
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      draft = textarea.value;
    }
  });

  await reload();
  return () => { /* host is replaced on navigation */ };
}
