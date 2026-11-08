// Ingest paste text into the file store.

import { parseBlocks } from './parser.js';
import { excerptOf, bytesEqual, bytesFromText, countLines } from '../utils/bytes.js';
import { extname, fileKind, basename } from '../utils/format.js';
import { State, addLog, setFile, emit, persist } from './state.js';
import { crc32 } from '../utils/crc.js';

const NOTE_ORDER = {
  truncated: 0,
  corrupt: 1,
  duplicate: 2,
  nomarkers: 3,
  outside: 4,
  empty: 5,
};

function nowTime() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

export function ingest(text, options = {}) {
  if (typeof text !== 'string' || text.length === 0) return null;

  const parsed = parseBlocks(text);
  const entry = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    n: State.pastes + 1,
    time: new Date(),
    fresh: 0,
    changed: 0,
    identical: 0,
    errors: 0,
    source: options.source || 'paste',
    notes: [],
  };
  State.pastes = entry.n;

  const occurrences = new Map();
  const lastByPath = new Map();
  for (const block of parsed.blocks) {
    occurrences.set(block.path, (occurrences.get(block.path) || 0) + 1);
    lastByPath.set(block.path, block);
  }

  const emptyPaths = [];

  for (const [path, block] of lastByPath) {
    const bytes = bytesFromText(block.content);
    const prior = State.files.get(path);
    const same = prior ? bytesEqual(prior.bytes, bytes) : false;

    if (!prior) entry.fresh++;
    else if (same) entry.identical++;
    else entry.changed++;

    const failure = block.truncated ? 'truncated' : (block.corrupt ? 'corrupt' : null);
    let status;
    if (failure) status = failure;
    else if (!prior) status = 'new';
    else status = same ? 'identical' : 'changed';

    const ext = extname(path);
    const kind = fileKind(path);

    const file = {
      path,
      content: block.content,
      bytes,
      failure,
      status,
      edited: false,
      ext,
      kind,
      name: basename(path),
      lineCount: countLines(block.content),
      crc: crc32(bytes),
      addedAt: prior ? prior.addedAt : Date.now(),
      updatedAt: Date.now(),
    };
    setFile(path, file);

    if (block.truncated) {
      entry.errors++;
      State.failures.set(path, 'truncated');
      entry.notes.push({
        kind: 'truncated',
        text: 'truncated: ' + path + ' — no END marker, content ran to end of paste',
        excerpt: excerptOf(block.content),
      });
    } else if (block.corrupt) {
      entry.errors++;
      State.failures.set(path, 'corrupt');
      entry.notes.push({
        kind: 'corrupt',
        text: 'corrupt: ' + path + ' — END marker named ' + block.corruptName,
      });
    } else {
      State.failures.delete(path);
    }

    if (block.content.length === 0) emptyPaths.push(path);
  }

  for (const [path, count] of occurrences) {
    if (count > 1) {
      entry.notes.push({
        kind: 'duplicate',
        text: 'duplicate within paste: ' + path + (count === 2
          ? ' appeared twice, second kept'
          : ' appeared ' + count + ' times, last kept'),
      });
    }
  }

  if (parsed.blocks.length === 0) {
    entry.errors++;
    entry.notes.push({
      kind: 'nomarkers',
      text: 'no markers found — this paste contained no FILE markers, check the format',
    });
  } else if (parsed.outsideChars > 0) {
    entry.notes.push({
      kind: 'outside',
      text: 'ignored outside markers: ' + parsed.outsideChars + ' characters of prose skipped',
    });
  }

  for (const path of emptyPaths) {
    entry.notes.push({ kind: 'empty', text: 'empty file: ' + path + ' has zero bytes' });
  }

  entry.notes.sort((a, b) => NOTE_ORDER[a.kind] - NOTE_ORDER[b.kind]);
  entry.duplicateCount = entry.notes.filter((n) => n.kind === 'duplicate').length;

  addLog(entry);
  persist();
  emit('ingest', { entry, blocks: parsed.blocks.length });

  return entry;
}

export function updateFileContent(path, newContent) {
  const file = State.files.get(path);
  if (!file) return null;
  const bytes = bytesFromText(newContent);
  const updated = {
    ...file,
    content: newContent,
    bytes,
    edited: true,
    status: file.failure ? file.failure : 'edited',
    lineCount: countLines(newContent),
    crc: crc32(bytes),
    updatedAt: Date.now(),
  };
  setFile(path, updated);
  persist();
  return updated;
}

export function renameFile(oldPath, newPath) {
  const file = State.files.get(oldPath);
  if (!file) return null;
  if (State.files.has(newPath)) return null;
  State.files.delete(oldPath);
  State.failures.delete(oldPath);
  State.ui.selected.delete(oldPath);
  const ext = extname(newPath);
  const renamed = {
    ...file,
    path: newPath,
    name: basename(newPath),
    ext,
    kind: fileKind(newPath),
    edited: true,
    status: file.failure ? file.failure : 'edited',
    updatedAt: Date.now(),
  };
  State.files.set(newPath, renamed);
  if (State.ui.editingPath === oldPath) State.ui.editingPath = newPath;
  emit('files', { type: 'set', path: newPath, file: renamed });
  emit('files', { type: 'delete', path: oldPath });
  persist();
  return renamed;
}
