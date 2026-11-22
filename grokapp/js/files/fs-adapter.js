/**
 * Unified file-system adapter.
 *
 * Modes (in priority order when available):
 *  1. File System Access API directory handle (desktop Chromium)
 *  2. In-memory / IndexedDB virtual project tree (always available)
 *  3. ZIP import → virtual tree, ZIP export ← virtual tree
 *
 * The actual project files on disk are the source of truth when a directory
 * handle is connected. The virtual tree is always kept in sync for the
 * current session and is what the AI tools operate on.
 */

import { toast } from '../utils/dom.js';

// ── Virtual tree (always present) ──────────────────────────────────
/** @type {Map<string, { type: 'file'|'dir', content?: string, children?: Set<string> }>} */
let tree = new Map();
tree.set('', { type: 'dir', children: new Set() });

/** @type {FileSystemDirectoryHandle|null} */
let dirHandle = null;

/** @type {'virtual'|'native'} */
let mode = 'virtual';

const TEXT_EXT = new Set([
  'js','ts','jsx','tsx','mjs','cjs','json','html','css','scss','md','txt',
  'py','rb','go','rs','java','kt','swift','c','cpp','h','hpp','cs','php',
  'sql','yml','yaml','toml','ini','env','sh','bash','zsh','xml','svg',
  'vue','svelte','astro','graphql','gql','dockerfile','makefile','gitignore',
  'editorconfig','prettierrc','eslintrc','babelrc','lock'
]);

/** File size policy (bytes) — keep agent context and memory bounded */
export const FILE_POLICY = {
  maxImportBytes: 1_500_000,   // skip larger files on native/ZIP import
  maxReadChars: 80_000,        // truncate for agent read_file
  maxWriteWarnChars: 200_000,  // warn (still allow) very large writes
  maxSearchFileChars: 200_000, // skip huge files in search
};

export function isTextPathPublic(path) {
  return isTextPath(path);
}

function isTextPath(path) {
  const name = path.split('/').pop() || '';
  if (name.startsWith('.') && !name.includes('.', 1)) return true; // .gitignore etc
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return TEXT_EXT.has(ext) || name === 'Dockerfile' || name === 'Makefile';
}

function normalize(path) {
  return path.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
}

function parentPath(path) {
  const p = normalize(path);
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function ensureDir(path) {
  const p = normalize(path);
  if (tree.has(p) && tree.get(p).type === 'dir') return;
  const parent = parentPath(p);
  if (parent) ensureDir(parent);
  tree.set(p, { type: 'dir', children: new Set() });
  if (tree.has(parent)) tree.get(parent).children.add(p.split('/').pop());
}

function ensureParent(path) {
  ensureDir(parentPath(path));
}

// ── Public API ─────────────────────────────────────────────────────

export function getMode() {
  return mode;
}

export function hasNativeHandle() {
  return Boolean(dirHandle);
}

export function supportsDirectoryPicker() {
  return typeof window.showDirectoryPicker === 'function';
}

/** Clear virtual tree and optionally the native handle */
export function resetProjectFiles() {
  tree = new Map();
  tree.set('', { type: 'dir', children: new Set() });
  dirHandle = null;
  mode = 'virtual';
}

/**
 * Connect a real directory via File System Access API.
 * Falls back gracefully if unsupported.
 */
export async function connectDirectory() {
  if (!supportsDirectoryPicker()) {
    toast('Directory access not available on this browser. Use Import ZIP instead.');
    return false;
  }
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    mode = 'native';
    await syncFromNative();
    toast('Folder connected');
    return true;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      toast('Could not open folder: ' + err.message);
    }
    return false;
  }
}

/** Recursively read the native directory into the virtual tree */
async function syncFromNative() {
  if (!dirHandle) return;
  tree = new Map();
  tree.set('', { type: 'dir', children: new Set() });

  async function walk(handle, prefix) {
    for await (const [name, entry] of handle.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') {
        ensureDir(path);
        await walk(entry, path);
      } else {
        if (!isTextPath(path)) continue; // skip binaries for now
        try {
          const file = await entry.getFile();
          // Cap individual file size to keep memory reasonable
          if (file.size > FILE_POLICY.maxImportBytes) continue;
          const content = await file.text();
          writeFileVirtual(path, content);
        } catch (e) {
          console.warn('Skip file', path, e);
        }
      }
    }
  }
  await walk(dirHandle, '');
}

function writeFileVirtual(path, content) {
  const p = normalize(path);
  ensureParent(p);
  const name = p.split('/').pop();
  const parent = parentPath(p);
  tree.set(p, { type: 'file', content: String(content ?? '') });
  if (tree.has(parent)) tree.get(parent).children.add(name);
}

/** List directory entries (relative to project root) */
export function listDir(path = '') {
  const p = normalize(path);
  const node = tree.get(p);
  if (!node || node.type !== 'dir') return [];
  const names = [...node.children].sort((a, b) => a.localeCompare(b));
  return names.map(name => {
    const full = p ? `${p}/${name}` : name;
    const child = tree.get(full);
    return {
      name,
      path: full,
      type: child?.type || 'file',
    };
  });
}

/** Read a text file. Returns null if missing. */
export async function readFile(path) {
  const p = normalize(path);
  const node = tree.get(p);
  if (node?.type === 'file') return node.content;

  // Try native if connected and virtual miss
  if (dirHandle) {
    try {
      const handle = await resolveNativeFile(p);
      if (handle) {
        const file = await handle.getFile();
        const content = await file.text();
        writeFileVirtual(p, content); // cache
        return content;
      }
    } catch (_) { /* fall through */ }
  }
  return null;
}

/** Optional project id for auto-persist (set by app when a project is open) */
let activeProjectId = null;
export function setActiveProjectId(id) {
  activeProjectId = id || null;
}

/** Write / overwrite a text file. Verifies success. */
export async function writeFile(path, content) {
  const p = normalize(path);
  const text = String(content ?? '');

  // Always update virtual tree first
  writeFileVirtual(p, text);
  schedulePersist(activeProjectId);

  // Persist to native if connected
  if (dirHandle) {
    try {
      await writeNativeFile(p, text);
    } catch (err) {
      console.error('Native write failed', err);
      // Virtual still has the content; surface the error
      throw new Error(`Virtual write succeeded but disk write failed: ${err.message}`);
    }
  }
  return true;
}

/** Delete a file or empty directory */
export async function deletePath(path) {
  const p = normalize(path);
  if (!p) throw new Error('Cannot delete project root');
  const node = tree.get(p);
  if (!node) return false;

  if (node.type === 'dir' && node.children.size > 0) {
    throw new Error('Directory is not empty');
  }

  tree.delete(p);
  const parent = parentPath(p);
  const name = p.split('/').pop();
  tree.get(parent)?.children.delete(name);
  schedulePersist(activeProjectId);

  if (dirHandle) {
    try {
      const parentHandle = parent ? await resolveNativeDir(parent) : dirHandle;
      await parentHandle.removeEntry(name);
    } catch (err) {
      console.warn('Native delete failed', err);
    }
  }
  return true;
}

/** Create a directory (and parents) */
export async function mkdir(path) {
  const p = normalize(path);
  ensureDir(p);
  if (dirHandle) {
    const parts = p.split('/');
    let handle = dirHandle;
    for (const part of parts) {
      handle = await handle.getDirectoryHandle(part, { create: true });
    }
  }
  return true;
}

/** Flat list of all file paths */
export function listAllFiles() {
  const files = [];
  for (const [path, node] of tree) {
    if (node.type === 'file') files.push(path);
  }
  return files.sort();
}

/** Snapshot of the project tree for context building */
export function getTreeSummary(maxDepth = 4) {
  const lines = [];
  function walk(path, depth) {
    if (depth > maxDepth) return;
    const entries = listDir(path);
    for (const e of entries) {
      const indent = '  '.repeat(depth);
      lines.push(`${indent}${e.type === 'dir' ? '📁' : '📄'} ${e.name}`);
      if (e.type === 'dir') walk(e.path, depth + 1);
    }
  }
  walk('', 0);
  return lines.join('\n') || '(empty project)';
}

// ── Native helpers ─────────────────────────────────────────────────

async function resolveNativeDir(path) {
  const parts = normalize(path).split('/').filter(Boolean);
  let handle = dirHandle;
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part);
  }
  return handle;
}

async function resolveNativeFile(path) {
  const p = normalize(path);
  const parent = parentPath(p);
  const name = p.split('/').pop();
  const dir = parent ? await resolveNativeDir(parent) : dirHandle;
  return dir.getFileHandle(name);
}

async function writeNativeFile(path, content) {
  const p = normalize(path);
  const parts = p.split('/');
  const name = parts.pop();
  let handle = dirHandle;
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

// ── ZIP import / export ────────────────────────────────────────────

export async function importZip(file) {
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
  const zip = await JSZip.loadAsync(file);
  resetProjectFiles();

  const entries = Object.keys(zip.files);
  for (const name of entries) {
    const entry = zip.files[name];
    if (entry.dir) {
      ensureDir(name.replace(/\/$/, ''));
    } else if (isTextPath(name)) {
      // Prefer uint8array length check when available
      try {
        const u8 = await entry.async('uint8array');
        if (u8.byteLength > FILE_POLICY.maxImportBytes) continue;
        const content = new TextDecoder('utf-8', { fatal: false }).decode(u8);
        writeFileVirtual(name, content);
      } catch {
        const content = await entry.async('string');
        if (content.length > FILE_POLICY.maxImportBytes) continue;
        writeFileVirtual(name, content);
      }
    }
  }
  mode = 'virtual';
  toast(`Imported ${listAllFiles().length} files`);
  return listAllFiles().length;
}

export async function exportZip(projectName = 'project') {
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
  const zip = new JSZip();
  for (const path of listAllFiles()) {
    const content = await readFile(path);
    if (content != null) zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || 'project'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast('ZIP downloaded');
}


// ── IndexedDB persistence for virtual tree ─────────────────────────
const IDB_NAME = 'devspace_fs';
const IDB_STORE = 'files';
const IDB_VERSION = 1;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist current virtual tree to IndexedDB (keyed by projectId) */
export async function persistTree(projectId) {
  if (!projectId) return;
  const db = await openIdb();
  const files = [];
  for (const [path, node] of tree) {
    if (node.type === 'file') {
      files.push({ path: `${projectId}::${path}`, content: node.content, projectId });
    }
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    // Clear previous entries for this project
    const clearReq = store.openCursor();
    clearReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (String(cursor.value.projectId) === String(projectId)) cursor.delete();
        cursor.continue();
      } else {
        for (const f of files) store.put(f);
      }
    };
    tx.oncomplete = () => resolve(files.length);
    tx.onerror = () => reject(tx.error);
  });
}

/** Restore virtual tree from IndexedDB for a project */
export async function restoreTree(projectId) {
  if (!projectId) return 0;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).filter(r => String(r.projectId) === String(projectId));
      if (!rows.length) {
        resolve(0);
        return;
      }
      // Rebuild tree without wiping native handle
      const keepHandle = dirHandle;
      tree = new Map();
      tree.set('', { type: 'dir', children: new Set() });
      for (const row of rows) {
        const path = row.path.includes('::') ? row.path.split('::').slice(1).join('::') : row.path;
        writeFileVirtual(path, row.content);
      }
      dirHandle = keepHandle;
      mode = keepHandle ? 'native' : 'virtual';
      resolve(rows.length);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Debounced auto-persist helper */
let _persistTimer = null;
export function schedulePersist(projectId) {
  if (!projectId) return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    persistTree(projectId).catch(err => console.warn('persist failed', err));
  }, 800);
}
