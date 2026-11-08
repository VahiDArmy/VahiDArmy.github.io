// Attach context menus to file rows and other elements.

import { attachContextMenu } from './context-menu.js';
import { State, deleteFile, toggleSelection, isSelected } from '../core/state.js';
import { copyToClipboard } from '../utils/dom.js';
import { basename } from '../utils/format.js';
import { toastOk } from './toast.js';
import { navigate } from './router.js';
import { toggle as toggleFav, has as hasFav } from '../core/favorites.js';
import { addTag, removeTag, tagsFor } from '../core/tags.js';
import { downloadBlob } from './download.js';
import { buildZip } from '../core/zip-build.js';

let wired = false;

export function initContextMenuWiring() {
  if (wired) return;
  wired = true;

  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.file-row');
    if (!row) return;
    e.preventDefault();
    const nameEl = row.querySelector('.file-name');
    const path = findPathFromRow(row);
    if (!path) return;
    const file = State.files.get(path);
    if (!file) return;

    attachContextMenu(row, () => buildFileMenu(file));
    // Fire the contextmenu we just registered (sync)
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    row.dispatchEvent(evt);
  }, true);
}

function findPathFromRow(row) {
  const pathEl = row.querySelector('.file-name');
  const dirEl = row.querySelector('.file-dir');
  const name = pathEl ? pathEl.textContent : '';
  const dir = dirEl ? dirEl.textContent : '';
  const guess = dir ? dir + '/' + name : name;
  if (State.files.has(guess)) return guess;
  // Fallback: search by basename
  for (const path of State.files.keys()) {
    if (basename(path) === name) return path;
  }
  return null;
}

function buildFileMenu(file) {
  const isFav = hasFav(file.path);
  const tags = tagsFor(file.path);
  const selCount = State.ui.selected.size;
  return [
    {
      label: 'Open in editor',
      icon: '✎',
      run: () => navigate('editor', { path: file.path }),
    },
    {
      label: 'Copy markers',
      icon: '⎘',
      run: async () => {
        const text = '{[[FILE: ' + file.path + ']]}\n' + file.content +
          '\n{[[END: ' + file.path + ']]}';
        const ok = await copyToClipboard(text);
        toastOk(ok ? 'Markers copied' : 'Copy failed');
      },
    },
    {
      label: 'Download this file',
      icon: '⤓',
      run: () => {
        downloadBlob(
          new Blob([file.bytes], { type: 'application/octet-stream' }),
          basename(file.path)
        );
        toastOk('Downloaded ' + basename(file.path));
      },
    },
    { type: 'separator' },
    {
      label: isFav ? 'Unfavorite' : 'Favorite',
      icon: isFav ? '★' : '☆',
      run: () => toggleFav(file.path),
    },
    {
      label: tags.length ? 'Remove all tags' : 'Tag as important',
      icon: tags.length ? '⚐' : '⚑',
      run: () => {
        if (tags.length) {
          for (const t of tags) removeTag(file.path, t);
          toastOk('Tags cleared');
        } else {
          addTag(file.path, 'green');
          toastOk('Tagged important');
        }
      },
    },
    { type: 'separator' },
    {
      label: isSelected(file.path) ? 'Deselect' : 'Select',
      icon: '◯',
      run: () => toggleSelection(file.path),
    },
    {
      label: 'Download selected (' + selCount + ')',
      icon: '⤓',
      disabled: selCount === 0,
      run: () => {
        const paths = Array.from(State.ui.selected);
        const bytes = buildZip({ paths });
        if (!bytes.length) return;
        downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'project-pack-selected.zip');
        toastOk('Downloaded selected');
      },
    },
    { type: 'separator' },
    {
      label: 'Delete',
      icon: '✕',
      danger: true,
      run: () => {
        deleteFile(file.path);
        toastOk('Deleted ' + basename(file.path));
      },
    },
  ];
}
