import { el, clear, formatBytes } from '../dom.js';
import { toast } from '../toast.js';
import { confirmDialog, promptDialog, openModal } from '../modal.js';
import { pickDirectory } from '../../services/fs.js';
import { importZipToFS, exportFSToZip, downloadBlob } from '../../services/zip.js';
import { createCheckpoint } from '../../services/checkpoints.js';
import { state } from '../../state.js';
import { updateProject } from '../../services/db.js';

let currentPath = '';
let selectedFile = null;
let viewerMode = 'view';
let draftContent = '';

export function resetFilesPanel() {
  currentPath = '';
  selectedFile = null;
  viewerMode = 'view';
  draftContent = '';
}

function panelRoot() {
  return document.querySelector('.shell-main');
}

export async function renderFiles(root, ctx) {
  clear(root);
  const project = state.currentProject;
  const fs = state.fs;
  if (!project || !fs) {
    root.appendChild(el('div', { class: 'empty' }, 'Open a project first.'));
    return;
  }

  // Sanity check currentPath against the active fs, so switching projects
  // doesn't leave us pointing at a directory that no longer exists.
  if (currentPath) {
    try {
      const st = await fs.stat(currentPath);
      if (st.kind !== 'directory') currentPath = '';
    } catch { currentPath = ''; }
  }
  if (selectedFile) {
    try {
      const st = await fs.stat(selectedFile);
      if (st.kind !== 'file') selectedFile = null;
    } catch { selectedFile = null; }
  }

  if (selectedFile) {
    await renderViewer(root, ctx);
    return;
  }

  // Header
  root.appendChild(el('div', { class: 'panel-header' },
    el('h2', {}, 'Files'),
    el('div', { class: 'spacer' }),
    el('button', {
      class: 'btn btn-sm btn-ghost',
      title: 'Actions',
      onclick: () => showActions(ctx),
    }, '⋯')
  ));

  // Permission banner
  if (fs.needsPermission) {
    root.appendChild(el('div', { class: 'card', style: 'margin: 16px;' },
      el('div', { class: 'card-title' }, 'Permission required'),
      el('div', { class: 'card-meta mt-8' }, 'Re-authorise access to your project folder.'),
      el('button', {
        class: 'btn btn-primary btn-sm mt-8',
        onclick: async () => {
          try {
            const ok = await fs.requestPermission();
            if (ok) renderFiles(root, ctx);
            else toast('Permission denied', 'error');
          } catch (err) { toast(err.message, 'error'); }
        },
      }, 'Grant access')
    ));
  }

  // Navigation bar
  const nav = el('div', {
    class: 'row gap-sm wrap',
    style: 'padding: 8px 14px; border-bottom: 1px solid var(--border); align-items: center;',
  });
  if (currentPath) {
    nav.appendChild(el('button', {
      class: 'btn btn-sm btn-ghost',
      title: 'Up',
      onclick: () => {
        const parts = currentPath.split('/');
        currentPath = parts.slice(0, -1).join('/');
        renderFiles(root, ctx);
      },
    }, '↑'));
    nav.appendChild(el('button', {
      class: 'btn btn-sm btn-ghost',
      title: 'Root',
      onclick: () => { currentPath = ''; renderFiles(root, ctx); },
    }, '⌂'));
    nav.appendChild(el('span', { class: 'mono small dim' }, currentPath));
  } else {
    nav.appendChild(el('span', { class: 'mono small dim' }, '/'));
  }
  root.appendChild(nav);

  // Tree
  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  const list = el('div', { class: 'file-tree' });
  scroll.appendChild(list);

  let entries;
  try {
    entries = await fs.list(currentPath);
  } catch (err) {
    list.appendChild(el('div', { class: 'empty' }, err.message));
    return;
  }

  if (!entries.length) {
    list.appendChild(el('div', { class: 'empty' }, 'Empty directory.'));
  } else {
    for (const entry of entries) {
      const isDir = entry.kind === 'directory';
      const row = el('div', {
        class: `tree-row ${isDir ? 'dir' : ''}`,
        onclick: () => {
          if (isDir) {
            currentPath = entry.path;
            renderFiles(root, ctx);
          } else {
            selectedFile = entry.path;
            viewerMode = 'view';
            draftContent = '';
            renderFiles(root, ctx);
          }
        },
      },
        el('span', { class: 'ico' }, isDir ? '📁' : '📄'),
        el('span', { class: 'name' }, entry.name),
        !isDir && el('span', { class: 'size' }, formatBytes(entry.size ?? 0))
      );
      list.appendChild(row);
    }
  }

  // Actions row
  const actions = el('div', { class: 'row gap-sm wrap', style: 'padding: 16px;' },
    el('button', { class: 'btn btn-sm', onclick: () => createFile(ctx) }, '+ File'),
    el('button', { class: 'btn btn-sm', onclick: () => importZip(ctx) }, 'Import ZIP'),
    el('button', { class: 'btn btn-sm', onclick: () => exportZip(ctx) }, 'Export ZIP'),
  );
  scroll.appendChild(actions);
}

async function renderViewer(root, ctx) {
  clear(root);
  const fs = state.fs;
  const path = selectedFile;

  const viewer = el('div', { class: 'file-viewer' });

  const head = el('div', { class: 'file-viewer-head' });
  head.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm',
    title: 'Back',
    onclick: () => { selectedFile = null; draftContent = ''; renderFiles(root, ctx); },
  }, '←'));
  head.appendChild(el('span', { class: 'path' }, path));

  if (viewerMode === 'edit') {
    head.appendChild(el('button', {
      class: 'btn btn-primary btn-sm',
      onclick: async () => {
        try {
          const content = draftContent;
          const res = await fs.write(path, content);
          const verify = await fs.read(path);
          if (verify !== content) {
            toast('Verification failed — file may have been changed by someone else', 'error');
            return;
          }
          toast(`Saved (${formatBytes(res.bytes)})`, 'success');
          viewerMode = 'view';
          draftContent = '';
          renderViewer(root, ctx);
        } catch (err) { toast(err.message, 'error'); }
      },
    }, 'Save'));
    head.appendChild(el('button', {
      class: 'btn btn-sm btn-ghost',
      onclick: () => { viewerMode = 'view'; draftContent = ''; renderViewer(root, ctx); },
    }, 'Cancel'));
  } else {
    head.appendChild(el('button', {
      class: 'btn btn-sm',
      onclick: async () => {
        try {
          draftContent = await fs.read(path);
          viewerMode = 'edit';
          renderViewer(root, ctx);
        } catch (err) { toast(err.message, 'error'); }
      },
    }, 'Edit'));
    head.appendChild(el('button', {
      class: 'btn btn-sm btn-ghost',
      title: 'Delete',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Delete file?',
          message: `Permanently delete "${path}"? A checkpoint will be created first.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        try {
          await createCheckpoint(fs, state.currentProject.id, `Before deleting ${path}`).catch(() => {});
          await fs.delete(path);
          toast('Deleted', 'success');
          selectedFile = null;
          renderFiles(root, ctx);
        } catch (err) { toast(err.message, 'error'); }
      },
    }, '✕'));
  }
  viewer.appendChild(head);

  const body = el('div', { class: 'file-viewer-body' });
  viewer.appendChild(body);

  try {
    if (viewerMode === 'edit') {
      const ta = el('textarea', {
        oninput: (e) => { draftContent = e.target.value; },
      });
      ta.value = draftContent;
      body.appendChild(ta);
      setTimeout(() => ta.focus(), 30);
    } else {
      const content = await fs.read(path);
      const pre = el('pre', {});
      pre.textContent = content;
      body.appendChild(pre);
    }
  } catch (err) {
    body.appendChild(el('div', { class: 'empty' }, err.message));
  }

  root.appendChild(viewer);
}

async function createFile(ctx) {
  const defaultPath = currentPath ? `${currentPath}/` : '';
  const name = await promptDialog({
    title: 'Create file',
    label: 'File path',
    defaultValue: defaultPath,
    placeholder: 'path/to/file.ext',
  });
  if (!name) return;
  try {
    const exists = await state.fs.exists(name);
    if (exists) { toast('File already exists', 'error'); return; }
    await state.fs.write(name, '');
    toast('Created', 'success');
    selectedFile = name;
    viewerMode = 'edit';
    draftContent = '';
    renderFiles(panelRoot(), ctx);
  } catch (err) { toast(err.message, 'error'); }
}

async function importZip(ctx) {
  const input = el('input', { type: 'file', accept: '.zip,application/zip' });
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const count = await importZipToFS(file, state.fs);
      toast(`Imported ${count} files`, 'success');
      currentPath = '';
      renderFiles(panelRoot(), ctx);
    } catch (err) { toast(err.message, 'error'); }
  };
  input.click();
}

async function exportZip(ctx) {
  try {
    const blob = await exportFSToZip(state.fs);
    const safe = state.currentProject.name.replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
    downloadBlob(blob, `${safe}.zip`);
    toast('ZIP exported', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

function showActions(ctx) {
  const fs = state.fs;
  const body = el('div', {},
    fs.mode === 'fsa'
      ? el('p', { class: 'dim' }, 'This project is connected to a local folder. Changes are written directly to disk.')
      : el('p', { class: 'dim' }, 'This project uses the virtual workspace. Use import/export to move files in and out.'),
    el('div', { class: 'row gap-sm wrap mt-16' },
      el('button', {
        class: 'btn btn-sm',
        onclick: async () => {
          try {
            const newFs = await pickDirectory(state.currentProject.id);
            state.fs = newFs;
            await updateProject(state.currentProject.id, { fs_mode: 'fsa' });
            toast('Local folder connected', 'success');
            resetFilesPanel();
            renderFiles(panelRoot(), ctx);
          } catch (err) {
            toast(err.message || 'Could not open folder', 'error');
          }
        },
      }, 'Connect local folder'),
      el('button', {
        class: 'btn btn-sm',
        onclick: async () => {
          try {
            const cp = await createCheckpoint(fs, state.currentProject.id, 'Manual checkpoint');
            toast(`Checkpoint created (${Object.keys(cp.files).length} files)`, 'success');
          } catch (err) { toast(err.message, 'error'); }
        },
      }, 'Create checkpoint'),
    )
  );
  openModal({ title: 'File actions', body, actions: [{ label: 'Close' }] });
}
