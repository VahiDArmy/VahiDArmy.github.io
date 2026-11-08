// File tagging system — tags stored per path in localStorage.

import { Storage } from '../utils/storage.js';
import { State, subscribe, emit } from './state.js';

const KEY = 'tags';
const PALETTE = [
  { id: 'red', color: 'var(--bad)' },
  { id: 'amber', color: 'var(--warn)' },
  { id: 'green', color: 'var(--ok)' },
  { id: 'blue', color: 'var(--info)' },
  { id: 'purple', color: 'var(--accent-3)' },
  { id: 'gray', color: 'var(--muted)' },
];

function readAll() {
  const raw = Storage.get(KEY, null);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

function writeAll(data) {
  Storage.set(KEY, data);
}

export function listTags() {
  return PALETTE.slice();
}

export function tagColor(id) {
  const found = PALETTE.find((p) => p.id === id);
  return found ? found.color : 'var(--muted)';
}

export function tagsFor(path) {
  const data = readAll();
  return Array.isArray(data[path]) ? data[path].slice() : [];
}

export function addTag(path, tagId) {
  if (!path || !tagId) return false;
  if (!PALETTE.some((p) => p.id === tagId)) return false;
  const data = readAll();
  const list = Array.isArray(data[path]) ? data[path] : [];
  if (list.includes(tagId)) return false;
  list.push(tagId);
  data[path] = list;
  writeAll(data);
  emit('tags', { type: 'add', path, tag: tagId });
  return true;
}

export function removeTag(path, tagId) {
  const data = readAll();
  if (!Array.isArray(data[path])) return false;
  const before = data[path].length;
  data[path] = data[path].filter((t) => t !== tagId);
  if (data[path].length === before) return false;
  if (!data[path].length) delete data[path];
  writeAll(data);
  emit('tags', { type: 'remove', path, tag: tagId });
  return true;
}

export function setTags(path, tagIds) {
  const data = readAll();
  const filtered = (tagIds || []).filter((id) => PALETTE.some((p) => p.id === id));
  if (!filtered.length) delete data[path];
  else data[path] = filtered;
  writeAll(data);
  emit('tags', { type: 'set', path });
}

export function clearTags(path) {
  const data = readAll();
  delete data[path];
  writeAll(data);
  emit('tags', { type: 'clear', path });
}

export function allTags() {
  const data = readAll();
  const set = new Set();
  for (const list of Object.values(data)) {
    if (Array.isArray(list)) for (const id of list) set.add(id);
  }
  return Array.from(set);
}

export function pathsWithTag(tagId) {
  const data = readAll();
  const out = [];
  for (const [path, list] of Object.entries(data)) {
    if (Array.isArray(list) && list.includes(tagId)) out.push(path);
  }
  return out;
}

// Prune tags for files that no longer exist.
subscribe((type, payload) => {
  if (type !== 'files') return;
  if (payload && payload.type === 'delete') {
    clearTags(payload.path);
  } else if (payload && payload.type === 'clear') {
    writeAll({});
  }
});
