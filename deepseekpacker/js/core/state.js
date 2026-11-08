// Central application state with a tiny pub/sub.

import { Storage } from '../utils/storage.js';

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(type, payload) {
  for (const fn of listeners) {
    try {
      fn(type, payload);
    } catch (err) {
      console.error('[state] listener error', err);
    }
  }
}

const DEFAULT_SETTINGS = {
  theme: 'obsidian',
  viewMode: 'list',
  compact: false,
  persistFiles: true,
  autoSelectFirst: true,
  confirmClear: true,
  lineNumbers: true,
  showHidden: false,
};

export const State = {
  files: new Map(),
  log: [],
  failures: new Map(),
  pastes: 0,
  settings: { ...DEFAULT_SETTINGS },
  ui: {
    search: '',
    filter: 'all',
    sort: 'path',
    sortDir: 'asc',
    selected: new Set(),
    editingPath: null,
    activeView: 'dashboard',
    activeViewParams: {},
  },
};

export function loadSettings() {
  const saved = Storage.get('settings', null);
  if (saved && typeof saved === 'object') {
    State.settings = { ...DEFAULT_SETTINGS, ...saved };
  }
  applyTheme(State.settings.theme);
}

export function applyTheme(theme) {
  const allowed = ['obsidian', 'graphite', 'aurora', 'paper'];
  const chosen = allowed.includes(theme) ? theme : 'obsidian';
  document.documentElement.dataset.theme = chosen;
}

export function setSettings(patch) {
  const before = { ...State.settings };
  Object.assign(State.settings, patch);
  Storage.set('settings', State.settings);
  if ('theme' in patch) applyTheme(State.settings.theme);
  emit('settings', { before, after: State.settings, patch });
}

export function resetSettings() {
  State.settings = { ...DEFAULT_SETTINGS };
  Storage.set('settings', State.settings);
  applyTheme(State.settings.theme);
  emit('settings', { before: null, after: State.settings, patch: DEFAULT_SETTINGS });
}

export function setUI(patch) {
  const prev = { ...State.ui };
  Object.assign(State.ui, patch);
  emit('ui', { before: prev, after: State.ui, patch });
}

export function setFile(path, file) {
  State.files.set(path, file);
  emit('files', { type: 'set', path, file });
}

export function deleteFile(path) {
  if (!State.files.has(path)) return;
  State.files.delete(path);
  State.failures.delete(path);
  State.ui.selected.delete(path);
  emit('files', { type: 'delete', path });
}

export function clearSelection() {
  if (State.ui.selected.size === 0) return;
  State.ui.selected.clear();
  emit('selection', { type: 'clear' });
}

export function setSelection(paths) {
  State.ui.selected = new Set(paths);
  emit('selection', { type: 'set', paths: Array.from(State.ui.selected) });
}

export function toggleSelection(path) {
  if (State.ui.selected.has(path)) State.ui.selected.delete(path);
  else State.ui.selected.add(path);
  emit('selection', { type: 'toggle', path });
}

export function isSelected(path) {
  return State.ui.selected.has(path);
}

export function addLog(entry) {
  State.log.unshift(entry);
  emit('log', { type: 'add', entry });
}

export function clearAll() {
  State.files.clear();
  State.failures.clear();
  State.log.length = 0;
  State.pastes = 0;
  State.ui.selected.clear();
  Storage.remove('files');
  Storage.remove('log');
  Storage.remove('pastes');
  emit('files', { type: 'clear' });
  emit('log', { type: 'clear' });
}

export function getFileList() {
  return Array.from(State.files.values());
}

export function getFilePaths() {
  return Array.from(State.files.keys());
}

export function getStats() {
  const files = getFileList();
  let totalBytes = 0;
  let totalLines = 0;
  let failed = 0;
  const byStatus = { new: 0, changed: 0, identical: 0, edited: 0, truncated: 0, corrupt: 0 };
  const byKind = {};
  const byExt = {};
  let largest = null;

  for (const f of files) {
    const size = f.bytes ? f.bytes.length : 0;
    totalBytes += size;
    totalLines += f.lineCount || 0;
    if (f.failure) failed++;
    if (f.status && f.status in byStatus) byStatus[f.status]++;
    else byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    const kind = f.kind || 'other';
    byKind[kind] = (byKind[kind] || 0) + 1;
    const ext = f.ext || 'none';
    byExt[ext] = (byExt[ext] || 0) + 1;
    if (!largest || size > largest.size) largest = { path: f.path, size };
  }

  return {
    fileCount: files.length,
    totalBytes,
    totalLines,
    failed,
    pastes: State.pastes,
    logEntries: State.log.length,
    byStatus,
    byKind,
    byExt,
    largest,
  };
}

export function persist() {
  if (!State.settings.persistFiles) return;
  try {
    const files = [];
    for (const [path, file] of State.files) {
      files.push({
        path,
        content: file.content,
        status: file.status,
        failure: file.failure,
        edited: !!file.edited,
      });
    }
    Storage.set('files', files);
    Storage.set('pastes', State.pastes);
    Storage.set('log', State.log.slice(0, 50).map((e) => ({
      n: e.n,
      time: e.time instanceof Date ? e.time.getTime() : e.time,
      fresh: e.fresh,
      changed: e.changed,
      identical: e.identical,
      errors: e.errors,
      notes: e.notes,
    })));
  } catch (err) {
    console.warn('[state] persist failed', err);
  }
}

export function restore() {
  if (!State.settings.persistFiles) return false;
  const files = Storage.get('files', null);
  if (!Array.isArray(files) || !files.length) return false;
  const { encoder } = { encoder: new TextEncoder() };
  for (const f of files) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    const bytes = encoder.encode(f.content);
    State.files.set(f.path, {
      path: f.path,
      content: f.content,
      bytes,
      status: f.status || 'new',
      failure: f.failure || null,
      edited: !!f.edited,
      lineCount: f.content.split('\n').length,
    });
    if (f.failure) State.failures.set(f.path, f.failure);
  }
  const pastes = Storage.get('pastes', 0);
  State.pastes = typeof pastes === 'number' ? pastes : 0;
  const log = Storage.get('log', []);
  if (Array.isArray(log)) {
    State.log = log.map((e) => ({
      ...e,
      time: new Date(e.time),
      notes: Array.isArray(e.notes) ? e.notes : [],
    }));
  }
  if (State.files.size) emit('files', { type: 'restore' });
  if (State.log.length) emit('log', { type: 'restore' });
  return true;
}

export function sortFiles(list) {
  const { sort, sortDir } = State.ui;
  const dir = sortDir === 'desc' ? -1 : 1;
  const sorted = list.slice();
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'size':
        cmp = (a.bytes ? a.bytes.length : 0) - (b.bytes ? b.bytes.length : 0);
        break;
      case 'status':
        cmp = String(a.status).localeCompare(String(b.status));
        break;
      case 'lines':
        cmp = (a.lineCount || 0) - (b.lineCount || 0);
        break;
      case 'path':
      default:
        cmp = a.path.localeCompare(b.path);
    }
    if (cmp === 0) cmp = a.path.localeCompare(b.path);
    return cmp * dir;
  });
  return sorted;
}

export function filterFiles(list) {
  const query = State.ui.search.trim().toLowerCase();
  const filter = State.ui.filter;
  return list.filter((f) => {
    if (filter !== 'all') {
      if (filter === 'failed') {
        if (!f.failure) return false;
      } else if (filter === 'edited') {
        if (!f.edited) return false;
      } else if (f.status !== filter) {
        return false;
      }
    }
    if (query && !f.path.toLowerCase().includes(query)) return false;
    return true;
  });
}
