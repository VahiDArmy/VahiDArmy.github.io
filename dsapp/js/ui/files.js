// js/ui/files.js
import { state } from '../state.js';
import { el, clear, qs, formatBytes } from './dom.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';

let treeEl, countEl, zipInput;

export function initFiles({ onImport, onExport, onPickFolder, onRefresh }) {
  treeEl = qs('#file-tree');
  countEl = qs('#files-count');
  zipInput = qs('#zip-input');

  qs('#btn-refresh-files').addEventListener('click', () => onRefresh?.());
  qs('#btn-export-zip').addEventListener('click', () => onExport?.());
  qs('#btn-pick-folder').addEventListener('click', () => onPickFolder?.());
  qs('#btn-import-zip').addEventListener('click', () => zipInput.click());

  zipInput.addEventListener('change', async () => {
    const file = zipInput.files?.[0];
    zipInput.value = '';
    if (!file) return;
    await onImport?.(file);
  });

  renderFiles([]);
}

export function renderFiles(tree) {
  if (!treeEl) return;
  clear(treeEl);

  const files = (tree || []).slice().sort((a, b) => a.path.localeCompare(b.path));

  if (countEl) {
    countEl.textContent = files.length ? `${files.length} file${files.length === 1 ? '' : 's'}` : '';
  }

  if (!files.length) {
    treeEl.appendChild(el('div', { class: 'empty', style: 'margin:16px' },
      el('h3', {}, 'Workspace is empty'),
      el('p', { class: 'muted small' }, 'Import a ZIP, open a local folder, or ask the agent to scaffold a project.')
    ));
    return;
  }

  for (const f of files.slice(0, 2000)) {
    treeEl.appendChild(el('div', {
      class: 'file-row',
      title: f.path,
      onclick: () => previewFile(f),
    },
      el('span', { class: 'icon' }, f.binary ? '◼' : '▤'),
      el('span', { class: 'path' }, f.path),
      el('span', { class: 'size' }, formatBytes(f.size || 0))
    ));
  }

  if (files.length > 2000) {
    treeEl.appendChild(el('div', { class: 'muted small pad' }, `Showing first 2000 of ${files.length} files.`));
  }
}

async function previewFile(file) {
  const fs = state.fs;
  if (!fs) return;

  if (file.binary) {
    openModal({
      title: file.path,
      body: el('p', { class: 'muted' }, `Binary file — ${formatBytes(file.size || 0)}.`),
      actions: [{ label: 'Close' }],
      wide: true,
    });
    return;
  }

  let content = '';
  try {
    content = await fs.read(file.path);
  } catch (e) {
    toast(`Could not read file: ${e.message}`, 'error');
    return;
  }

  const truncated = content.length > 200000;
  openModal({
    title: file.path,
    body: el('pre', { class: 'preview' }, truncated ? content.slice(0, 200000) + '\n… [truncated]' : content),
    actions: [{ label: 'Close' }],
    wide: true,
  });
}
