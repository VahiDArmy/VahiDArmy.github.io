// ---------------------------------------------------------------------------
// Small shared helpers. No framework, no build step.
// ---------------------------------------------------------------------------

export const IGNORE_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', 'bower_components', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit', '.output', 'coverage', '__pycache__', '.venv',
  'venv', 'env', '.idea', '.vscode', '.cache', '.turbo', '.gradle', '.mypy_cache',
  '.pytest_cache', 'target', 'Pods', 'DerivedData', '.parcel-cache', '.angular',
  '.terraform', '.dart_tool', '.expo', '.fonts', 'vendor/bundle',
]);

export const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export const LOCKFILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'poetry.lock', 'Pipfile.lock', 'composer.lock', 'Gemfile.lock', 'Cargo.lock',
]);

export const TEXT_EXT = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'sass', 'less',
  'html', 'htm', 'xml', 'svg', 'md', 'markdown', 'txt', 'yml', 'yaml', 'toml',
  'ini', 'cfg', 'conf', 'env', 'sh', 'bash', 'zsh', 'py', 'rb', 'php', 'go',
  'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'sql',
  'graphql', 'gql', 'vue', 'svelte', 'astro', 'liquid', 'twig', 'ejs', 'hbs',
  'prisma', 'dockerfile', 'gitignore', 'npmrc', 'editorconfig', 'lock', 'csv',
  'tsv', 'log', 'patch', 'diff', 'wasm', 'wat', 'proto', 'tf', 'hcl', 'ex',
  'exs', 'erl', 'clj', 'lua', 'r', 'jl', 'pl', 'vue', 'razor', 'aspx', 'ipynb',
]);

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build a DOM element from an HTML string (first element child). */
export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

/** Fast non-cryptographic hash, good enough to detect file drift. */
export function contentHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(c, 0x85ebca6b)) >>> 0;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}:${str.length}`;
}

export function approxTokens(text = '') {
  return Math.ceil(String(text).length / 3.7);
}

export function truncate(text, max = 200, tail = '…') {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - tail.length)) + tail;
}

export function truncateMiddle(text, max = 4000) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const half = Math.floor(max / 2) - 40;
  return `${s.slice(0, half)}\n\n… [${s.length - max} characters omitted] …\n\n${s.slice(-half)}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(ms) {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m}m ${rest}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 45_000) return 'just now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

export function normalizePath(input) {
  let p = String(input ?? '').trim().replace(/\\/g, '/');
  p = p.replace(/^\.\//, '').replace(/^\/+/, '');
  const parts = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      throw new Error(`Path may not leave the project root: ${input}`);
    }
    parts.push(part.replace(/[\u0000-\u001f]/g, ''));
  }
  return parts.join('/');
}

export function dirOf(path) {
  const p = normalizePath(path);
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

export function baseName(path) {
  const p = normalizePath(path);
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

export function extOf(path) {
  const name = baseName(path).toLowerCase();
  if (name.startsWith('.')) return name.slice(1);
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1);
}

export function langOf(path) {
  const map = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
    ts: 'typescript', tsx: 'tsx', json: 'json', css: 'css', scss: 'scss',
    html: 'html', htm: 'html', svg: 'svg', md: 'markdown', py: 'python',
    rb: 'ruby', go: 'go', rs: 'rust', java: 'java', php: 'php', sql: 'sql',
    sh: 'shell', yml: 'yaml', yaml: 'yaml', toml: 'toml', vue: 'vue',
    svelte: 'svelte', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', swift: 'swift',
    kt: 'kotlin', dart: 'dart', xml: 'xml', lock: 'text', txt: 'text',
  };
  return map[extOf(path)] || 'text';
}

export function isLikelyText(path) {
  const ext = extOf(path);
  if (!ext) return true;
  return TEXT_EXT.has(ext);
}

export function isIgnoredPath(path) {
  const parts = String(path).split('/');
  if (parts.some((p) => IGNORE_DIRS.has(p))) return true;
  return IGNORE_FILES.has(parts[parts.length - 1]);
}

// ---------------------------------------------------------------------------
// binary <-> text
// ---------------------------------------------------------------------------

export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeBytes(bytes) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let hasNul = false;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) { hasNul = true; break; }
  }
  if (!hasNul) {
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), binary: false };
    } catch { /* fall through */ }
  }
  return { text: arrayBufferToBase64(bytes), binary: true };
}

// ---------------------------------------------------------------------------
// misc
// ---------------------------------------------------------------------------

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function groupBy(list, keyFn) {
  const out = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}

export function sortBy(list, fn) {
  return [...list].sort((a, b) => {
    const av = fn(a);
    const bv = fn(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function isMobile() {
  return window.matchMedia('(max-width: 860px)').matches;
}
