// Files view — list / grid / tree of packed files with filter, sort, bulk actions.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import {
  State, subscribe, getFileList, sortFiles, filterFiles, setUI,
  deleteFile, toggleSelection, isSelected, clearSelection, setSettings,
} from '../core/state.js';
import { fmtBytes, fmtNum, basename, dirname, extLabel, fileKind } from '../utils/format.js';
import { renameFile } from '../core/ingest.js';
import { navigate } from '../ui/router.js';
import { buildZip } from '../core/zip-build.js';
import { downloadBlob } from '../ui/download.js';
import { toastOk, toastWarn } from '../ui/toast.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { buildFileTree } from '../ui/file-tree.js';
import { has as hasFavorite, toggle as toggleFavorite } from '../core/favorites.js';
import { attachContextMenu } from '../ui/context-menu.js';
import { tagsFor, listTags, tagColor } from '../core/tags.js';
import { commitDelete } from '../core/undo.js';

export function mountFiles(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  const head = buildHead();
  const toolbar = buildToolbar(() => renderList());
  const bulkBar = buildBulkBar();
  const listHost = el('div', { class: 'card' });

  shell.appendChild(head);
  shell.appendChild(toolbar);
  shell.appendChild(bulkBar);
  shell.appendChild(listHost);

  function renderAll() {
    updateHead(head);
    updateBulkBar(bulkBar);
    renderList();
  }

  function renderList() {
    clear(listHost);
    const all = sortFiles(getFileList());
    const filtered = filterFiles(all);
    const mode = State.settings.viewMode === 'grid' ? 'grid'
      : State.settings.viewMode === 'tree' ? 'tree'
      : 'list';

    if (!State.files.size) {
      listHost.appendChild(buildEmptyState());
      return;
    }
    if (!filtered.length) {
      listHost.appendChild(buildNoMatches());
      return;
    }

    if (mode === 'grid') {
      const grid = el('div', { class: 'file-grid' });
      for (const file of filtered) grid.appendChild(buildFileCard(file));
      listHost.appendChild(grid);
      return;
    }

    if (mode === 'tree') {
      const favoritesSet = new Set();
      for (const f of filtered) if (hasFavorite(f.path)) favoritesSet.add(f.path);
      const tree = buildFileTree(filtered, {
        onSelect: (file) => navigate('editor', { path: file.path }),
        onToggleFavorite: (file) => { toggleFavorite(file.path); renderList(); },
        favorites: favoritesSet,
      });
      listHost.appendChild(el('div', { style: { padding: '6px' } }, [tree]));
      return;
    }

    const list = el('div', { class: 'file-list' });
    for (const file of filtered) list.appendChild(buildFileRow(file));
    listHost.appendChild(list);
  }

  renderAll();

  const unsub = subscribe((type) => {
    if (type === 'files' || type === 'selection' || type === 'tags' || type === 'favorites') {
      updateHead(head);
      updateBulkBar(bulkBar);
      renderList();
    }
    if (type === 'settings') {
      renderAll();
    }
  });

  return () => unsub();
}

function buildHead() {
  return el('div', { class: 'view-head' });
}

function updateHead(head) {
  clear(head);
  const stats = { count: State.files.size, bytes: 0, failed: 0 };
  for (const f of State.files.values()) {
    stats.bytes += f.bytes.length;
    if (f.failure) stats.failed++;
  }
  const title = el('div', { class: 'view-title' }, [
    el('h1', { text: 'Files' }),
    el('p', {
      text: stats.count
        ? stats.count + ' file' + (stats.count === 1 ? '' : 's') + ' · ' + fmtBytes(stats.bytes) +
          (stats.failed ? ' · ' + stats.failed + ' failed' : '')
        : 'Nothing packed yet',
    }),
  ]);
  head.appendChild(title);
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: () => {
        const bytes = buildZip();
        if (!bytes.length) return toastWarn('Nothing to download');
        downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'project-pack.zip');
        toastOk('Downloaded project-pack.zip');
      },
      disabled: !stats.count,
    }, ['⤓', ' Download all']),
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('templates'),
    }, ['⌗ Templates']),
  ]));
}

function buildToolbar(onRefresh) {
  const bar = el('div', { class: 'toolbar' });

  const searchWrap = el('div', { class: 'toolbar-search' });
  const mag = el('span', { class: 'mag', html: '⌕' });
  const input = el('input', {
    type: 'search',
    placeholder: 'Filter by path…',
    spellcheck: false,
    autocomplete: 'off',
    value: State.ui.search,
  });
  input.addEventListener('input', () => {
    setUI({ search: input.value });
    onRefresh();
  });
  searchWrap.appendChild(mag);
  searchWrap.appendChild(input);
  bar.appendChild(searchWrap);

  const filterGroup = el('div', { class: 'segmented' });
  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New' },
    { id: 'changed', label: 'Changed' },
    { id: 'edited', label: 'Edited' },
    { id: 'failed', label: 'Failed' },
  ];
  for (const f of FILTERS) {
    const btn = el('button', {
      type: 'button',
      class: State.ui.filter === f.id ? 'is-active' : '',
      text: f.label,
      dataset: { filter: f.id },
      onClick: () => {
        setUI({ filter: f.id });
        for (const child of filterGroup.children) {
          child.classList.toggle('is-active', child.dataset.filter === f.id);
        }
        onRefresh();
      },
    });
    filterGroup.appendChild(btn);
  }
  bar.appendChild(filterGroup);

  const sortSelect = el('select', { class: 'select', style: { maxWidth: '140px' } });
  for (const opt of [
    { value: 'path', label: 'Sort: Path' },
    { value: 'size', label: 'Sort: Size' },
    { value: 'lines', label: 'Sort: Lines' },
    { value: 'status', label: 'Sort: Status' },
  ]) {
    const o = el('option', { value: opt.value, text: opt.label });
    if (State.ui.sort === opt.value) o.selected = true;
    sortSelect.appendChild(o);
  }
  sortSelect.addEventListener('change', () => {
    setUI({ sort: sortSelect.value });
    onRefresh();
  });
  bar.appendChild(sortSelect);

  const dirBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    title: 'Toggle sort direction',
    html: State.ui.sortDir === 'asc' ? '↑' : '↓',
    onClick: () => {
      const next = State.ui.sortDir === 'asc' ? 'desc' : 'asc';
      setUI({ sortDir: next });
      dirBtn.innerHTML = next === 'asc' ? '↑' : '↓';
      onRefresh();
    },
  });
  bar.appendChild(dirBtn);

  const layoutGroup = el('div', { class: 'segmented', style: { marginLeft: 'auto' } });
  const LAYOUTS = [
    { id: 'list', icon: '▤', label: 'List view' },
    { id: 'grid', icon: '▥', label: 'Grid view' },
    { id: 'tree', icon: '⌗', label: 'Tree view' },
  ];
  for (const layout of LAYOUTS) {
    const btn = el('button', {
      type: 'button',
      class: State.settings.viewMode === layout.id ? 'is-active' : '',
      text: layout.icon,
      title: layout.label,
      dataset: { layout: layout.id },
      onClick: () => {
        setSettings({ viewMode: layout.id });
        for (const child of layoutGroup.children) {
          child.classList.toggle('is-active', child.dataset.layout === layout.id);
        }
        onRefresh();
      },
    });
    layoutGroup.appendChild(btn);
  }
  bar.appendChild(layoutGroup);

  return bar;
}

function buildBulkBar() {
  return el('div', {
    class: 'toolbar',
    style: { display: State.ui.selected.size ? 'flex' : 'none' },
  });
}

function updateBulkBar(bar) {
  clear(bar);
  const count = State.ui.selected.size;
  if (!count) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  bar.appendChild(el('span', {
    style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' },
    html: '<b>' + fmtNum(count) + '</b> selected',
  }));

  bar.appendChild(el('button', {
    class: 'btn btn-sm',
    type: 'button',
    onClick: async () => {
      const paths = Array.from(State.ui.selected);
      const all = paths.map((p) => State.files.get(p)).filter(Boolean);
      let text = '';
      for (const f of all) {
        text += '{[[FILE: ' + f.path + ']]}\n' + f.content + '\n{[[END: ' + f.path + ']]}\n\n';
      }
      const ok = await copyToClipboard(text);
      toastOk(ok ? 'Copied markers for ' + all.length + ' files' : 'Copy failed');
    },
  }, ['⎘ Copy markers']));

  bar.appendChild(el('button', {
    class: 'btn btn-sm',
    type: 'button',
    onClick: () => {
      const paths = Array.from(State.ui.selected);
      const bytes = buildZip({ paths });
      if (!bytes.length) return toastWarn('Nothing to download');
      downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'project-pack-selected.zip');
      toastOk('Downloaded selected zip');
    },
  }, ['⤓ Download selected']));

  bar.appendChild(el('button', {
    class: 'btn btn-sm btn-danger',
    type: 'button',
    onClick: async () => {
      const ok = await confirmDialog(
        'Delete ' + count + ' selected file' + (count === 1 ? '' : 's') + '?',
        { title: 'Delete selection', confirmLabel: 'Delete', variant: 'danger' }
      );
      if (!ok) return;
      for (const path of Array.from(State.ui.selected)) {
        const file = State.files.get(path);
        if (file) commitDelete(path, file);
        deleteFile(path);
      }
      clearSelection();
      toastOk('Deleted ' + count + ' file' + (count === 1 ? '' : 's'));
    },
  }, ['✕ Delete']));

  bar.appendChild(el('button', {
    class: 'btn btn-sm btn-ghost',
    type: 'button',
    onClick: () => clearSelection(),
  }, ['Clear selection']));
}

function buildFileRow(file) {
  const selected = isSelected(file.path);
  const row = el('div', {
    class: 'file-row' + (selected ? ' is-selected' : ''),
    tabIndex: 0,
    dataset: { path: file.path },
    onClick: (e) => {
      if (e.target.closest('.file-actions')) return;
      toggleSelection(file.path);
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigate('editor', { path: file.path });
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleSelection(file.path);
      }
    },
  });

  const main = el('div', { class: 'file-main' });
  main.appendChild(el('span', {
    class: 'file-ext',
    dataset: { kind: fileKind(file.path) },
    text: extLabel(file.path),
  }));
  const pathWrap = el('div', { class: 'file-path-wrap' });
  pathWrap.appendChild(el('div', { class: 'file-name', text: basename(file.path) }));
  const dir = dirname(file.path);
  if (dir) pathWrap.appendChild(el('div', { class: 'file-dir', text: dir }));
  main.appendChild(pathWrap);
  row.appendChild(main);

  const chip = el('span', { class: 'chip chip-' + file.status, text: file.status });
  row.appendChild(chip);

  row.appendChild(el('span', {
    class: 'file-size',
    text: fmtBytes(file.bytes.length),
  }));

  const actions = el('div', { class: 'file-actions' });
  actions.appendChild(actionBtn('⎘', 'Copy markers', (e) => {
    e.stopPropagation();
    copyMarkers(file);
  }));
  actions.appendChild(actionBtn('✎', 'Edit', (e) => {
    e.stopPropagation();
    navigate('editor', { path: file.path });
  }));
  actions.appendChild(actionBtn('↺', 'Rename', (e) => {
    e.stopPropagation();
    promptRename(file);
  }));
  actions.appendChild(actionBtn('✕', 'Delete', (e) => {
    e.stopPropagation();
    confirmDelete(file);
  }));
  row.appendChild(actions);

  attachContextMenu(row, () => buildRowMenu(file));

  return row;
}

function buildRowMenu(file) {
  const isFav = hasFavorite(file.path);
  return [
    { label: 'Open in editor', icon: '✎', run: () => navigate('editor', { path: file.path }) },
    { label: 'Copy markers', icon: '⎘', run: () => copyMarkers(file) },
    { label: isFav ? 'Unfavorite' : 'Favorite', icon: isFav ? '★' : '☆', run: () => toggleFavorite(file.path) },
    { type: 'separator' },
    { label: 'Rename', icon: '↺', run: () => promptRename(file) },
    { label: 'Delete', icon: '✕', danger: true, run: () => confirmDelete(file) },
  ];
}

function buildFileCard(file) {
  const selected = isSelected(file.path);
  const card = el('div', {
    class: 'file-card' + (selected ? ' is-selected' : ''),
    onClick: () => toggleSelection(file.path),
    onDblClick: () => navigate('editor', { path: file.path }),
  });
  card.appendChild(el('div', { class: 'fc-name', text: basename(file.path) }));
  const dir = dirname(file.path);
  if (dir) card.appendChild(el('div', { class: 'fc-dir', text: dir }));
  const tags = tagsFor(file.path);
  if (tags.length) {
    const tagRow = el('div', { style: { display: 'flex', gap: '3px', flexWrap: 'wrap' } });
    for (const t of tags) {
      tagRow.appendChild(el('span', {
        style: {
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: tagColor(t),
        },
        title: t,
      }));
    }
    card.appendChild(tagRow);
  }
  card.appendChild(el('div', { class: 'fc-foot' }, [
    el('span', { class: 'chip chip-' + file.status, text: file.status }),
    el('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }, text: fmtBytes(file.bytes.length) }),
  ]));
  return card;
}

function actionBtn(icon, title, onClick) {
  return el('button', {
    class: 'icon-btn',
    type: 'button',
    title,
    html: icon,
    onClick,
  });
}

async function copyMarkers(file) {
  const text = '{[[FILE: ' + file.path + ']]}\n' + file.content + '\n{[[END: ' + file.path + ']]}';
  const ok = await copyToClipboard(text);
  toastOk(ok ? 'Copied ' + basename(file.path) : 'Copy failed');
}

function promptRename(file) {
  const input = el('input', {
    class: 'input',
    type: 'text',
    value: file.path,
    spellcheck: false,
    autocomplete: 'off',
  });
  const body = el('div', { class: 'field' }, [
    el('label', { class: 'field-label', text: 'New path' }),
    input,
    el('span', { class: 'field-hint', text: 'Relative path. Forward slashes. Must not collide with an existing file.' }),
  ]);
  const m = openModal({
    title: 'Rename file',
    body,
    buttons: [
      { label: 'Cancel' },
      {
        label: 'Rename',
        variant: 'primary',
        keepOpen: true,
        onClick: () => {
          const next = input.value.trim();
          if (!next) { toastWarn('Path is required'); return; }
          if (next === file.path) { m.close(); return; }
          const result = renameFile(file.path, next);
          if (!result) { toastWarn('Rename failed — path may exist'); return; }
          m.close();
          toastOk('Renamed to ' + basename(next));
        },
      },
    ],
  });
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

async function confirmDelete(file) {
  const ok = await confirmDialog(
    'Delete ' + file.path + '?',
    { title: 'Delete file', confirmLabel: 'Delete', variant: 'danger' }
  );
  if (!ok) return;
  commitDelete(file.path, file);
  deleteFile(file.path);
  toastOk('Deleted ' + basename(file.path));
}

function buildEmptyState() {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty-icon', html: '▤' }),
    el('div', { class: 'empty-title', text: 'No files packed yet' }),
    el('div', { class: 'empty-sub', text: 'Copy a message with FILE/END blocks and press Ctrl+V anywhere on this page. Or drop a .zip file.' }),
    el('div', { class: 'empty-actions' }, [
      el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onClick: () => navigate('help'),
      }, ['View format']),
      el('button', {
        class: 'btn',
        type: 'button',
        onClick: () => document.getElementById('zip-input') && document.getElementById('zip-input').click(),
      }, ['Load .zip']),
      el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onClick: () => navigate('templates'),
      }, ['Templates']),
    ]),
  ]);
}

function buildNoMatches() {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty-icon', html: '⌕' }),
    el('div', { class: 'empty-title', text: 'No files match' }),
    el('div', { class: 'empty-sub', text: 'Adjust the filter or search query.' }),
  ]);
}
