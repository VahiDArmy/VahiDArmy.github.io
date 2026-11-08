// Named workspace snapshots — save/load/delete bundles of files + settings.

import { Storage } from '../utils/storage.js';
import { State, persist, emit } from './state.js';

const KEY = 'snapshots';
const VERSION = 1;

function readAll() {
  const raw = Storage.get(KEY, null);
  if (!raw || raw.version !== VERSION || !Array.isArray(raw.items)) {
    return { version: VERSION, items: [] };
  }
  return raw;
}

function writeAll(data) {
  Storage.set(KEY, data);
}

export function listSnapshots() {
  return readAll().items.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function getSnapshot(id) {
  return readAll().items.find((s) => s.id === id) || null;
}

export function saveSnapshot(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'Name required' };

  const data = readAll();
  const files = [];
  for (const [path, file] of State.files) {
    files.push({
      path,
      content: file.content,
      edited: !!file.edited,
      failure: file.failure || null,
      status: file.status,
    });
  }
  if (!files.length) return { ok: false, error: 'Nothing to snapshot' };

  const snapshot = {
    id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: trimmed,
    at: Date.now(),
    fileCount: files.length,
    totalBytes: files.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0),
    files,
    settings: { ...State.settings },
    pastes: State.pastes,
  };

  data.items.push(snapshot);
  writeAll(data);
  emit('snapshots', { type: 'save', id: snapshot.id });
  return { ok: true, snapshot };
}

export function deleteSnapshot(id) {
  const data = readAll();
  const before = data.items.length;
  data.items = data.items.filter((s) => s.id !== id);
  if (data.items.length === before) return false;
  writeAll(data);
  emit('snapshots', { type: 'delete', id });
  return true;
}

export function renameSnapshot(id, newName) {
  const trimmed = String(newName || '').trim();
  if (!trimmed) return false;
  const data = readAll();
  const snap = data.items.find((s) => s.id === id);
  if (!snap) return false;
  snap.name = trimmed;
  writeAll(data);
  emit('snapshots', { type: 'rename', id });
  return true;
}

export function loadSnapshot(id, options = {}) {
  const snap = getSnapshot(id);
  if (!snap) return { ok: false, error: 'Snapshot not found' };

  const merge = !!options.merge;
  if (!merge) {
    State.files.clear();
    State.failures.clear();
  }

  const encoder = new TextEncoder();
  for (const f of snap.files || []) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    const bytes = encoder.encode(f.content);
    State.files.set(f.path, {
      path: f.path,
      content: f.content,
      bytes,
      failure: f.failure || null,
      status: f.status || 'new',
      edited: !!f.edited,
      ext: (f.path.split('.').pop() || '').toLowerCase(),
      kind: 'other',
      name: f.path.split('/').pop(),
      lineCount: f.content.split('\n').length,
      crc: 0,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (f.failure) State.failures.set(f.path, f.failure);
  }

  State.pastes = typeof snap.pastes === 'number' ? snap.pastes : State.pastes;

  if (!merge) {
    State.ui.selected.clear();
  }

  persist();
  emit('files', { type: 'restore' });
  emit('snapshots', { type: 'load', id });
  return { ok: true, fileCount: State.files.size };
}

export function exportSnapshotAsJson(id) {
  const snap = getSnapshot(id);
  if (!snap) return null;
  return JSON.stringify(snap, null, 2);
}

export function importSnapshotFromJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'Invalid JSON: ' + err.message };
  }
  if (!parsed || !Array.isArray(parsed.files)) {
    return { ok: false, error: 'Missing files array' };
  }
  const data = readAll();
  const snapshot = {
    id: 'snap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: String(parsed.name || 'Imported snapshot').slice(0, 80),
    at: Date.now(),
    fileCount: parsed.files.length,
    totalBytes: parsed.files.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0),
    files: parsed.files.filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string'),
    settings: parsed.settings || null,
    pastes: parsed.pastes || 0,
  };
  data.items.push(snapshot);
  writeAll(data);
  emit('snapshots', { type: 'save', id: snapshot.id });
  return { ok: true, snapshot };
}

export function clearAllSnapshots() {
  writeAll({ version: VERSION, items: [] });
  emit('snapshots', { type: 'clear' });
}
