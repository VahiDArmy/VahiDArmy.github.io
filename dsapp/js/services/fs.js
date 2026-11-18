import { idbGet, idbSet, idbDelete, idbGetAll } from '../lib/idb.js';
import { FS_SKIP_DIRS } from '../config.js';

export function normalizePath(p) {
  if (!p) return '';
  let s = String(p).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  const parts = [];
  for (const seg of s.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) throw new Error('Path escapes project root');
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

export function dirname(p) {
  const n = normalizePath(p);
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
}

export function basename(p) {
  const n = normalizePath(p);
  return n.slice(n.lastIndexOf('/') + 1);
}

function u8ToBase64(u8) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

function base64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// ---------------------------------------------------------------------------
// Virtual FS (IndexedDB) — works on every browser including iOS Safari.
// ---------------------------------------------------------------------------
export class VirtualProjectFS {
  constructor(projectId) {
    this.projectId = projectId;
    this.mode = 'virtual';
    this.needsPermission = false;
  }

  async init() { return this; }

  async _all() {
    return idbGetAll('virtual_files', 'projectId', this.projectId);
  }

  async list(path = '') {
    const prefix = normalizePath(path);
    const all = await this._all();
    const children = new Map();
    for (const rec of all) {
      if (prefix && !rec.path.startsWith(prefix + '/')) continue;
      const rest = prefix ? rec.path.slice(prefix.length + 1) : rec.path;
      if (!rest) continue;
      const slash = rest.indexOf('/');
      if (slash === -1) {
        children.set(rest, { name: rest, path: rec.path, kind: 'file', size: rec.size ?? 0 });
      } else {
        const dirName = rest.slice(0, slash);
        const dirPath = prefix ? `${prefix}/${dirName}` : dirName;
        if (!children.has(dirName)) children.set(dirName, { name: dirName, path: dirPath, kind: 'directory' });
      }
    }
    return [...children.values()].sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
    );
  }

  async read(path) {
    const p = normalizePath(path);
    const rec = await idbGet('virtual_files', [this.projectId, p]);
    if (!rec) throw new Error(`File not found: ${p}`);
    return rec.content;
  }

  async readBinary(path) {
    const p = normalizePath(path);
    const rec = await idbGet('virtual_files', [this.projectId, p]);
    if (!rec) throw new Error(`File not found: ${p}`);
    return rec.binary ? base64ToU8(rec.content) : new TextEncoder().encode(rec.content);
  }

  async write(path, content, { binary = false } = {}) {
    const p = normalizePath(path);
    if (!p) throw new Error('Cannot write to project root');
    const existing = await idbGet('virtual_files', [this.projectId, p]);
    let stored = content;
    if (binary) stored = content instanceof Uint8Array ? u8ToBase64(content) : content;
    const rec = {
      projectId: this.projectId,
      path: p,
      content: stored,
      binary: !!binary,
      size: binary
        ? (content instanceof Uint8Array ? content.length : atob(content).length)
        : new TextEncoder().encode(String(content)).length,
      updatedAt: Date.now(),
    };
    await idbSet('virtual_files', rec);
    return { path: p, bytes: rec.size, existed: !!existing };
  }

  async delete(path) {
    const p = normalizePath(path);
    const rec = await idbGet('virtual_files', [this.projectId, p]);
    if (rec) {
      await idbDelete('virtual_files', [this.projectId, p]);
      return { path: p, kind: 'file' };
    }
    const all = await this._all();
    const children = all.filter((r) => r.path === p || r.path.startsWith(p + '/'));
    for (const c of children) await idbDelete('virtual_files', [this.projectId, c.path]);
    return { path: p, kind: 'directory', removed: children.length };
  }

  async mkdir() { return { ok: true }; }

  async exists(path) {
    const p = normalizePath(path);
    if (!p) return true;
    const rec = await idbGet('virtual_files', [this.projectId, p]);
    if (rec) return true;
    const all = await this._all();
    return all.some((r) => r.path.startsWith(p + '/'));
  }

  async stat(path) {
    const p = normalizePath(path);
    const rec = await idbGet('virtual_files', [this.projectId, p]);
    if (rec) return { kind: 'file', size: rec.size, mtime: rec.updatedAt, binary: rec.binary };
    if (await this.exists(p)) return { kind: 'directory' };
    throw new Error(`Not found: ${p}`);
  }

  async tree() {
    const all = await this._all();
    return all.map((r) => ({ path: r.path, size: r.size ?? 0, kind: 'file', binary: !!r.binary }));
  }

  async search(query, { path = '', regex = false } = {}) {
    const q = regex ? new RegExp(query, 'i') : query.toLowerCase();
    const prefix = normalizePath(path);
    const all = await this._all();
    const results = [];
    for (const rec of all) {
      if (rec.binary) continue;
      if (prefix && !rec.path.startsWith(prefix + '/') && rec.path !== prefix) continue;
      const lines = String(rec.content).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const hit = regex ? q.test(lines[i]) : lines[i].toLowerCase().includes(q);
        if (hit) {
          results.push({ path: rec.path, line: i + 1, text: lines[i].slice(0, 300) });
          if (results.length >= 200) return results;
        }
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// File System Access API FS
// ---------------------------------------------------------------------------
export class FSAProjectFS {
  constructor(projectId, handle) {
    this.projectId = projectId;
    this.handle = handle;
    this.mode = 'fsa';
    this.needsPermission = false;
  }

  static async open(projectId) {
    const rec = await idbGet('dir_handles', projectId);
    if (!rec?.handle) return null;
    const fs = new FSAProjectFS(projectId, rec.handle);
    const perm = await rec.handle.queryPermission({ mode: 'readwrite' });
    fs.needsPermission = perm !== 'granted';
    return fs;
  }

  async init() { return this; }

  async requestPermission() {
    const perm = await this.handle.requestPermission({ mode: 'readwrite' });
    this.needsPermission = perm !== 'granted';
    return !this.needsPermission;
  }

  async _dir(path, create = false) {
    const p = normalizePath(path);
    let dir = this.handle;
    if (!p) return dir;
    for (const seg of p.split('/')) {
      dir = await dir.getDirectoryHandle(seg, { create });
    }
    return dir;
  }

  async _file(path, create = false) {
    const p = normalizePath(path);
    if (!p) throw new Error('Invalid file path');
    const d = await this._dir(dirname(p), create);
    return d.getFileHandle(basename(p), { create });
  }

  async list(path = '') {
    const dir = await this._dir(path);
    const out = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'directory') {
        out.push({ name, path: normalizePath(`${path}/${name}`), kind: 'directory' });
      } else {
        const f = await handle.getFile();
        out.push({ name, path: normalizePath(`${path}/${name}`), kind: 'file', size: f.size });
      }
    }
    return out.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
    );
  }

  async read(path) {
    const fh = await this._file(path);
    const file = await fh.getFile();
    return file.text();
  }

  async readBinary(path) {
    const fh = await this._file(path);
    return new Uint8Array(await (await fh.getFile()).arrayBuffer());
  }

  async write(path, content, { binary = false } = {}) {
    const p = normalizePath(path);
    const existed = await this.exists(p);
    const fh = await this._file(p, true);
    const w = await fh.createWritable();
    const data = binary
      ? (content instanceof Uint8Array ? content : base64ToU8(content))
      : String(content);
    await w.write(data);
    await w.close();
    const size = binary ? data.length : new TextEncoder().encode(String(content)).length;
    return { path: p, bytes: size, existed };
  }

  async delete(path) {
    const p = normalizePath(path);
    const d = await this._dir(dirname(p));
    await d.removeEntry(basename(p), { recursive: true });
    return { path: p };
  }

  async mkdir(path) {
    await this._dir(path, true);
    return { ok: true };
  }

  async exists(path) {
    const p = normalizePath(path);
    if (!p) return true;
    try {
      await this._file(p);
      return true;
    } catch { /* not a file */ }
    try {
      await this._dir(p);
      return true;
    } catch { return false; }
  }

  async stat(path) {
    const p = normalizePath(path);
    try {
      const f = await (await this._file(p)).getFile();
      return { kind: 'file', size: f.size, mtime: f.lastModified };
    } catch { /* not a file */ }
    await this._dir(p);
    return { kind: 'directory' };
  }

  async tree() {
    const out = [];
    const walk = async (dir, prefix) => {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'directory') {
          if (FS_SKIP_DIRS.has(name)) continue;
          await walk(handle, prefix ? `${prefix}/${name}` : name);
        } else {
          const f = await handle.getFile();
          out.push({ path: prefix ? `${prefix}/${name}` : name, size: f.size, kind: 'file' });
        }
      }
    };
    await walk(this.handle, '');
    return out;
  }

  async search(query, { path = '', regex = false } = {}) {
    const q = regex ? new RegExp(query, 'i') : query.toLowerCase();
    const results = [];
    const walk = async (dir, prefix) => {
      for await (const [name, handle] of dir.entries()) {
        const p = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === 'directory') {
          if (FS_SKIP_DIRS.has(name)) continue;
          await walk(handle, p);
        } else {
          if (results.length >= 200) return;
          try {
            const text = await (await handle.getFile()).text();
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const hit = regex ? q.test(lines[i]) : lines[i].toLowerCase().includes(q);
              if (hit) results.push({ path: p, line: i + 1, text: lines[i].slice(0, 300) });
              if (results.length >= 200) return;
            }
          } catch { /* skip unreadable */ }
        }
      }
    };
    await walk(this.handle, normalizePath(path));
    return results;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export async function openProjectFS(project) {
  if (project.fs_mode === 'fsa' && 'showDirectoryPicker' in window) {
    const fs = await FSAProjectFS.open(project.id);
    if (fs) return fs;
  }
  const v = new VirtualProjectFS(project.id);
  await v.init();
  return v;
}

export async function pickDirectory(projectId) {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('This browser does not support direct folder access. Use the virtual workspace and import a ZIP.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new Error('Permission not granted');
  await idbSet('dir_handles', { projectId, handle });
  return new FSAProjectFS(projectId, handle);
}
