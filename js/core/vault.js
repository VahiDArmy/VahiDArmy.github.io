// ---------------------------------------------------------------------------
// Project files.
//
// Two layers, on purpose:
//
//   Vault        -> IndexedDB. Always present. Holds a complete copy of the
//                   project so the workspace works on phones, offline, and
//                   after a reload. This is the portable, app-owned copy.
//   Directory    -> an optional real folder the user granted with the File
//                   System Access API (desktop Chromium only). When it is
//                   linked and permitted, the folder on disk is the source of
//                   truth and every write is verified by reading it back.
//
// Nothing here assumes a write succeeded: callers get { verified } and must
// treat false as a failure.
// ---------------------------------------------------------------------------

import { LIMITS } from '../config.js';
import {
  IGNORE_DIRS, IGNORE_FILES,
  normalizePath, dirOf, baseName, byteLength, contentHash,
  decodeBytes, arrayBufferToBase64, base64ToBytes, isLikelyText, extOf, langOf,
} from './util.js';

const DB_NAME = 'forgebook-vault';
const DB_VERSION = 1;

let dbPromise = null;

function idb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains('files')) {
        const store = database.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!database.objectStoreNames.contains('checkpoints')) {
        const store = database.createObjectStore('checkpoints', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!database.objectStoreNames.contains('links')) {
        database.createObjectStore('links', { keyPath: 'projectId' });
      }
      if (!database.objectStoreNames.contains('kv')) {
        database.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error || new Error('Could not open local storage'));
    open.onblocked = () => reject(new Error('Local storage is blocked by another tab'));
  });
  return dbPromise;
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, fn) {
  const database = await idb();
  const transaction = database.transaction(name, mode);

  // Attach the completion handlers *before* issuing any request: a transaction
  // can finish in the microtask gap and the promise would otherwise never settle.
  const completed = new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Storage transaction aborted'));
  });

  const store = transaction.objectStore(name);
  const result = await fn(store);
  await completed;
  return result;
}

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

const vaultCache = new Map();

export class Vault {
  constructor(projectId) {
    this.projectId = projectId;
    this._index = null;
  }

  static get(projectId) {
    if (!vaultCache.has(projectId)) vaultCache.set(projectId, new Vault(projectId));
    return vaultCache.get(projectId);
  }

  _id(path) { return `${this.projectId}::${path}`; }

  async _all() {
    if (this._index) return this._index;
    const rows = await withStore('files', 'readonly', (store) =>
      req(store.index('projectId').getAll(this.projectId)));
    this._index = new Map();
    for (const row of rows) this._index.set(row.path, row);
    return this._index;
  }

  async list() {
    const index = await this._all();
    return [...index.values()]
      .map((row) => ({
        path: row.path,
        size: row.size,
        binary: row.binary,
        hash: row.hash,
        updatedAt: row.updatedAt,
        lang: langOf(row.path),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async exists(path) {
    const index = await this._all();
    return index.has(normalizePath(path));
  }

  async read(path) {
    const p = normalizePath(path);
    const index = await this._all();
    const row = index.get(p);
    if (!row) {
      const err = new Error(`File not found: ${p}`);
      err.code = 'ENOENT';
      throw err;
    }
    return { path: p, content: row.content, binary: row.binary, size: row.size, hash: row.hash, updatedAt: row.updatedAt };
  }

  async write(path, content, { binary = false } = {}) {
    const p = normalizePath(path);
    if (p === '') throw new Error('A file path is required.');
    const text = String(content ?? '');
    const size = binary ? Math.floor(text.length * 3 / 4) : byteLength(text);
    const row = {
      id: this._id(p),
      projectId: this.projectId,
      path: p,
      content: text,
      binary,
      size,
      hash: contentHash(text),
      updatedAt: new Date().toISOString(),
    };
    await withStore('files', 'readwrite', (store) => req(store.put(row)));
    const index = await this._all();
    index.set(p, row);
    return row;
  }

  async remove(path) {
    const p = normalizePath(path);
    const index = await this._all();
    const removed = [];
    for (const key of [...index.keys()]) {
      if (key === p) {
        await withStore('files', 'readwrite', (store) => req(store.delete(this._id(key))));
        index.delete(key);
        removed.push(key);
      }
    }
    return removed;
  }

  async clear() {
    const index = await this._all();
    const ids = [...index.keys()].map((path) => this._id(path));
    await withStore('files', 'readwrite', (store) => {
      for (const id of ids) store.delete(id);
    });
    index.clear();
  }

  async stats() {
    const index = await this._all();
    let bytes = 0;
    for (const row of index.values()) bytes += row.size || 0;
    return { files: index.size, bytes };
  }

  // ---- directory link -----------------------------------------------------

  async getLink() {
    const row = await withStore('links', 'readonly', (store) => req(store.get(this.projectId)));
    return row || null;
  }

  async setLink(handle) {
    await withStore('links', 'readwrite', (store) =>
      req(store.put({ projectId: this.projectId, handle, linkedAt: new Date().toISOString() })));
  }

  async clearLink() {
    await withStore('links', 'readwrite', (store) => req(store.delete(this.projectId)));
  }

  // ---- checkpoints --------------------------------------------------------

  async saveCheckpoint(checkpoint) {
    await withStore('checkpoints', 'readwrite', (store) => req(store.put(checkpoint)));
    return checkpoint;
  }

  async getCheckpoint(id) {
    return withStore('checkpoints', 'readonly', (store) => req(store.get(id)));
  }

  async listCheckpoints() {
    const rows = await withStore('checkpoints', 'readonly', (store) =>
      req(store.index('projectId').getAll(this.projectId)));
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async deleteCheckpoint(id) {
    await withStore('checkpoints', 'readwrite', (store) => req(store.delete(id)));
  }

  async pruneCheckpoints(keep = 12) {
    const all = await this.listCheckpoints();
    for (const ckpt of all.slice(keep)) await this.deleteCheckpoint(ckpt.id);
  }

  // ---- misc kv ------------------------------------------------------------

  async getKv(key, fallback = null) {
    const row = await withStore('kv', 'readonly', (store) => req(store.get(`${this.projectId}:${key}`)));
    return row ? row.value : fallback;
  }

  async setKv(key, value) {
    await withStore('kv', 'readwrite', (store) =>
      req(store.put({ key: `${this.projectId}:${key}`, value })));
  }

  async wipe() {
    await this.clear();
    await this.clearLink();
    for (const ckpt of await this.listCheckpoints()) await this.deleteCheckpoint(ckpt.id);
  }
}

// ---------------------------------------------------------------------------
// Directory (File System Access API) helpers
// ---------------------------------------------------------------------------

export const supportsDirectoryAccess = typeof window !== 'undefined'
  && typeof window.showDirectoryPicker === 'function';

async function permissionOf(handle) {
  if (!handle) return 'unlinked';
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

function diskPathParts(path) {
  const parts = normalizePath(path).split('/');
  const name = parts.pop();
  return { parts, name };
}

async function diskWrite(root, path, content, binary) {
  const { parts, name } = diskPathParts(path);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    if (binary) await writable.write(base64ToBytes(content));
    else await writable.write(String(content));
  } finally {
    await writable.close();
  }
}

async function diskRead(root, path) {
  const { parts, name } = diskPathParts(path);
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  const fileHandle = await dir.getFileHandle(name);
  const file = await fileHandle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = decodeBytes(bytes);
  return {
    path: normalizePath(path),
    content: decoded.text,
    binary: decoded.binary,
    size: bytes.byteLength,
    hash: contentHash(decoded.text),
    mtime: file.lastModified,
  };
}

async function diskRemove(root, path) {
  const { parts, name } = diskPathParts(path);
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  await dir.removeEntry(name, { recursive: true });
}

async function diskExists(root, path) {
  try {
    await diskRead(root, path);
    return true;
  } catch { return false; }
}

async function diskWalk(root, onFile, limit = 3000) {
  let count = 0;
  const walk = async (dir, prefix, depth) => {
    if (depth > 14 || count >= limit) return;
    for await (const [name, handle] of dir.entries()) {
      if (count >= limit) return;
      if (handle.kind === 'directory') {
        if (IGNORE_DIRS.has(name)) continue;
        await walk(handle, `${prefix}${name}/`, depth + 1);
      } else {
        if (IGNORE_FILES.has(name)) continue;
        const path = `${prefix}${name}`;
        count += 1;
        await onFile(path, handle);
      }
    }
  };
  await walk(root, '', 0);
}

// ---------------------------------------------------------------------------
// ProjectFS — what the agent and the editor talk to
// ---------------------------------------------------------------------------

export class ProjectFS {
  constructor(projectId) {
    this.projectId = projectId;
    this.vault = Vault.get(projectId);
    this.handle = null;
    this.permission = 'unlinked';
    this.lastWarning = '';
  }

  async init() {
    const link = await this.vault.getLink();
    if (!link?.handle) {
      this.handle = null;
      this.permission = 'unlinked';
      return this;
    }
    this.handle = link.handle;
    this.permission = await permissionOf(this.handle);
    return this;
  }

  get diskReady() {
    return Boolean(this.handle) && this.permission === 'granted';
  }

  get linkState() {
    if (!this.handle) return 'unlinked';
    return this.permission === 'granted' ? 'linked' : 'needs-permission';
  }

  /** Must be called from a user gesture. */
  async reconnect() {
    if (!this.handle) return false;
    try {
      this.permission = await this.handle.requestPermission({ mode: 'readwrite' });
    } catch {
      this.permission = 'denied';
    }
    return this.diskReady;
  }

  async linkDirectory(handle) {
    this.handle = handle;
    this.permission = await handle.requestPermission({ mode: 'readwrite' });
    await this.vault.setLink(handle);

    const diskFiles = [];
    await diskWalk(handle, async (path, fileHandle) => {
      try {
        const file = await fileHandle.getFile();
        if (file.size > LIMITS.maxFileReadBytes * 2) return;
        diskFiles.push({ path, size: file.size });
      } catch { /* unreadable entry */ }
    });

    if (diskFiles.length > 0) {
      const imported = await this.importFromDisk({ replace: true });
      return { mode: 'imported', ...imported };
    }

    const existing = await this.vault.list();
    if (existing.length) {
      let pushed = 0;
      for (const file of existing) {
        try {
          const record = await this.vault.read(file.path);
          await diskWrite(handle, file.path, record.content, record.binary);
          pushed += 1;
        } catch { /* keep going */ }
      }
      return { mode: 'pushed', files: pushed };
    }
    return { mode: 'empty', files: 0 };
  }

  async unlinkDirectory() {
    this.handle = null;
    this.permission = 'unlinked';
    await this.vault.clearLink();
  }

  /** Disk is the source of truth. Mirror it into the vault. */
  async importFromDisk({ replace = false } = {}) {
    if (!this.diskReady) throw new Error('Folder access is not granted.');
    if (replace) await this.vault.clear();
    let count = 0;
    let bytes = 0;
    const failures = [];
    await diskWalk(this.handle, async (path) => {
      try {
        const record = await diskRead(this.handle, path);
        await this.vault.write(path, record.content, { binary: record.binary });
        count += 1;
        bytes += record.size;
      } catch (err) {
        failures.push({ path, error: err.message });
      }
    });
    return { files: count, bytes, failures };
  }

  // ---- reads --------------------------------------------------------------

  async list() {
    if (this.diskReady) {
      const out = [];
      await diskWalk(this.handle, async (path, fileHandle) => {
        try {
          const file = await fileHandle.getFile();
          out.push({ path, size: file.size, lang: langOf(path), binary: !isLikelyText(path) });
        } catch { /* skip */ }
      });
      if (out.length) return out.sort((a, b) => a.path.localeCompare(b.path));
    }
    return this.vault.list();
  }

  async exists(path) {
    if (this.diskReady) {
      try { return await diskExists(this.handle, path); } catch { /* fall through */ }
    }
    return this.vault.exists(path);
  }

  async read(path) {
    if (this.diskReady) {
      try {
        const record = await diskRead(this.handle, path);
        // keep the mirror honest
        this.vault.write(record.path, record.content, { binary: record.binary }).catch(() => {});
        return record;
      } catch (err) {
        if (err?.name === 'NotFoundError') {
          const inVault = await this.vault.read(path).catch(() => null);
          if (inVault) return inVault;
        }
        throw new Error(`Could not read ${path}: ${err.message}`);
      }
    }
    return this.vault.read(path);
  }

  async readText(path) {
    const record = await this.read(path);
    if (record.binary) throw new Error(`${path} is a binary file and cannot be edited as text.`);
    if (record.size > LIMITS.maxFileReadBytes) {
      throw new Error(`${path} is ${record.size} bytes, larger than the ${LIMITS.maxFileReadBytes} byte read limit.`);
    }
    return record;
  }

  // ---- writes -------------------------------------------------------------

  async write(path, content, { binary = false } = {}) {
    const p = normalizePath(path);
    if (!p) throw new Error('A file path is required.');
    const expectedHash = contentHash(String(content ?? ''));
    const size = binary ? Math.floor(String(content).length * 3 / 4) : byteLength(String(content));
    if (size > LIMITS.maxWriteBytes) {
      throw new Error(`Refusing to write ${size} bytes (limit ${LIMITS.maxWriteBytes}).`);
    }

    this.lastWarning = '';
    let target = 'vault';
    let verified = false;

    if (this.diskReady) {
      try {
        await diskWrite(this.handle, p, content, binary);
        const check = await diskRead(this.handle, p);
        verified = check.hash === expectedHash;
        target = 'folder';
        if (!verified) throw new Error('Read-back did not match what was written.');
      } catch (err) {
        this.permission = await permissionOf(this.handle);
        this.lastWarning = this.diskReady
          ? `Folder write failed (${err.message}); saved to the local copy instead.`
          : 'Folder permission was lost; saved to the local copy. Reconnect the folder to sync.';
        target = 'vault';
        verified = false;
      }
    }

    const record = await this.vault.write(p, content, { binary });
    if (target === 'vault') verified = record.hash === expectedHash;
    return { path: p, size, hash: record.hash, target, verified, warning: this.lastWarning };
  }

  async remove(path) {
    const p = normalizePath(path);
    let disk = false;
    if (this.diskReady) {
      try {
        await diskRemove(this.handle, p);
        disk = !(await diskExists(this.handle, p));
      } catch { disk = false; }
    }
    const removed = await this.vault.remove(p);
    return { path: p, removed: removed.length > 0 || disk, disk };
  }

  async move(from, to) {
    const source = normalizePath(from);
    const dest = normalizePath(to);
    const record = await this.read(source);
    const written = await this.write(dest, record.content, { binary: record.binary });
    const removal = await this.remove(source);
    return { from: source, to: dest, written, removed: removal.removed };
  }

  async search(query, { regex = false, path = '', maxResults = 60, caseSensitive = false } = {}) {
    const files = await this.list();
    const scope = path ? normalizePath(path) : '';
    const matcher = regex
      ? new RegExp(query, caseSensitive ? 'g' : 'gi')
      : null;
    const needle = caseSensitive ? query : query.toLowerCase();
    const results = [];

    for (const file of files) {
      if (results.length >= maxResults) break;
      if (scope && !(file.path === scope || file.path.startsWith(`${scope}/`))) continue;
      if (file.binary || file.size > 300_000) continue;
      let record;
      try { record = await this.read(file.path); } catch { continue; }
      if (record.binary) continue;
      const lines = record.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let hit = false;
        if (matcher) {
          matcher.lastIndex = 0;
          hit = matcher.test(line);
        } else {
          hit = (caseSensitive ? line : line.toLowerCase()).includes(needle);
        }
        if (hit) {
          results.push({ path: file.path, line: i + 1, text: line.slice(0, 300) });
          if (results.length >= maxResults) break;
        }
      }
    }
    return results;
  }

  async stats() {
    const vaultStats = await this.vault.stats();
    return { ...vaultStats, linkState: this.linkState, diskReady: this.diskReady };
  }

  async fingerprint() {
    const files = await this.list();
    return files.map((f) => `${f.path}:${f.hash || f.size}`).join('|');
  }
}

// ---------------------------------------------------------------------------
// Run journal / checkpoints
// ---------------------------------------------------------------------------

/**
 * Records the previous content of every file the agent touches, once per run,
 * so a bad run can be undone precisely. A full snapshot is used when the
 * project is small enough to make that cheap.
 */
export class RunJournal {
  constructor(fs, { runId, projectId, label = '' }) {
    this.fs = fs;
    this.runId = runId;
    this.projectId = projectId;
    this.label = label;
    this.entries = new Map();
    this.checkpointId = runId;
    this.fullSnapshot = false;
    this.bytes = 0;
  }

  async begin() {
    const stats = await this.fs.stats();
    if (stats.bytes > 0 && stats.bytes <= LIMITS.snapshotBytes && stats.files <= 800) {
      const files = await this.fs.list();
      for (const file of files) {
        try {
          const record = await this.fs.read(file.path);
          this._remember(file.path, record);
        } catch { /* unreadable */ }
      }
      this.fullSnapshot = true;
    }
    await this.persist();
  }

  _remember(path, record) {
    const key = normalizePath(path);
    if (this.entries.has(key)) return;
    this.entries.set(key, {
      path: key,
      existed: Boolean(record),
      content: record?.content ?? '',
      binary: Boolean(record?.binary),
      size: record?.size ?? 0,
    });
    this.bytes += record?.size ?? 0;
  }

  async before(path) {
    const key = normalizePath(path);
    if (this.entries.has(key)) return;
    let record = null;
    try { record = await this.fs.read(key); } catch { record = null; }
    this._remember(key, record);
    await this.persist();
  }

  async persist() {
    await this.fs.vault.saveCheckpoint({
      id: this.checkpointId,
      projectId: this.projectId,
      runId: this.runId,
      kind: 'run',
      label: this.label,
      createdAt: new Date().toISOString(),
      fullSnapshot: this.fullSnapshot,
      fileCount: this.entries.size,
      bytes: this.bytes,
      entries: [...this.entries.values()],
    });
  }

  async restore() {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.existed) {
        await this.fs.write(entry.path, entry.content, { binary: entry.binary });
      } else {
        await this.fs.remove(entry.path);
      }
      count += 1;
    }
    return count;
  }
}

export function inferLanguage(path) {
  return langOf(path);
}

export function summarizeEntry(path) {
  return { path, dir: dirOf(path), name: baseName(path), ext: extOf(path) };
}
