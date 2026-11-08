// Bounded undo/redo stack for file operations.

import { State, setFile, deleteFile, emit, persist } from './state.js';

const MAX = 80;
const stack = [];
let pointer = -1;
const listeners = new Set();

function snapshot(path, kind) {
  if (kind === 'delete') {
    return { type: 'delete', path, before: State.files.has(path) ? State.files.get(path) : null };
  }
  return { type: kind, path, before: State.files.has(path) ? State.files.get(path) : null };
}

export function begin(path) {
  return snapshot(path, 'update');
}

export function commit(snap) {
  if (!snap) return;
  const after = State.files.has(snap.path) ? State.files.get(snap.path) : null;
  if (snap.type === 'delete') return; // handled by commitDelete
  if (!after && !snap.before) return;
  if (after && snap.before &&
      after.content === snap.before.content &&
      after.path === snap.before.path) return;

  truncateRedo();
  stack.push({
    type: snap.type || 'update',
    path: snap.path,
    before: snap.before ? cloneFile(snap.before) : null,
    after: after ? cloneFile(after) : null,
    at: Date.now(),
  });
  if (stack.length > MAX) stack.shift();
  pointer = stack.length - 1;
  notify();
  emit('undo', { type: 'push' });
}

export function commitDelete(path, before) {
  if (!before) return;
  truncateRedo();
  stack.push({
    type: 'delete',
    path,
    before: cloneFile(before),
    after: null,
    at: Date.now(),
  });
  if (stack.length > MAX) stack.shift();
  pointer = stack.length - 1;
  notify();
  emit('undo', { type: 'push' });
}

export function commitCreate(path) {
  if (!State.files.has(path)) return;
  truncateRedo();
  stack.push({
    type: 'create',
    path,
    before: null,
    after: cloneFile(State.files.get(path)),
    at: Date.now(),
  });
  if (stack.length > MAX) stack.shift();
  pointer = stack.length - 1;
  notify();
  emit('undo', { type: 'push' });
}

export function undo() {
  if (pointer < 0) return false;
  const entry = stack[pointer];
  applyEntry(entry, 'undo');
  pointer--;
  notify();
  persist();
  emit('undo', { type: 'undo', entry });
  return true;
}

export function redo() {
  if (pointer >= stack.length - 1) return false;
  pointer++;
  const entry = stack[pointer];
  applyEntry(entry, 'redo');
  notify();
  persist();
  emit('undo', { type: 'redo', entry });
  return true;
}

function applyEntry(entry, direction) {
  const target = direction === 'undo' ? entry.before : entry.after;
  if (!target) {
    // Revert to absence
    if (State.files.has(entry.path)) deleteFile(entry.path);
    return;
  }
  setFile(target.path, cloneFile(target));
}

export function canUndo() { return pointer >= 0; }
export function canRedo() { return pointer < stack.length - 1; }

export function undoLabel() {
  if (pointer < 0) return '';
  return labelFor(stack[pointer]);
}

export function redoLabel() {
  if (pointer >= stack.length - 1) return '';
  return labelFor(stack[pointer + 1]);
}

function labelFor(entry) {
  switch (entry.type) {
    case 'create': return 'Create ' + entry.path;
    case 'delete': return 'Delete ' + entry.path;
    case 'update': return 'Edit ' + entry.path;
    default: return entry.path;
  }
}

export function clearHistory() {
  stack.length = 0;
  pointer = -1;
  notify();
}

export function historySize() {
  return { total: stack.length, position: pointer + 1 };
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try { fn(historySize()); } catch (err) { /* ignore */ }
  }
}

function truncateRedo() {
  if (pointer < stack.length - 1) {
    stack.splice(pointer + 1);
  }
}

function cloneFile(file) {
  if (!file) return null;
  return {
    ...file,
    bytes: file.bytes ? file.bytes.slice() : new Uint8Array(0),
  };
}
