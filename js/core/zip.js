// ---------------------------------------------------------------------------
// ZIP import / export (JSZip is vendored in vendor/jszip.min.js).
// ---------------------------------------------------------------------------

import { normalizePath, decodeBytes } from './util.js';

function lib() {
  const zip = window.JSZip;
  if (!zip) throw new Error('The ZIP library did not load. Reload the page and try again.');
  return zip;
}

const MAX_TOTAL = 28 * 1024 * 1024;
const MAX_ENTRY = 6 * 1024 * 1024;

/**
 * Read a .zip File into vault-ready entries.
 * A single wrapping folder (as produced by GitHub "Download ZIP") is stripped.
 */
export async function readZipFile(file) {
  const zip = await lib().loadAsync(file);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  if (!names.length) throw new Error('That archive is empty.');

  const segments = names.map((name) => normalizePath(name).split('/'));
  const topLevel = new Set(segments.map((parts) => parts[0]));
  const hasRootFile = segments.some((parts) => parts.length === 1);
  const stripRoot = topLevel.size === 1 && !hasRootFile && segments.every((parts) => parts.length > 1);

  const entries = [];
  const skipped = [];
  let total = 0;

  for (const name of names) {
    const entry = zip.files[name];
    let path = normalizePath(name);
    if (stripRoot) path = path.split('/').slice(1).join('/');
    if (!path) continue;

    const size = entry._data?.uncompressedSize ?? 0;
    if (size > MAX_ENTRY) { skipped.push({ path, reason: 'too large' }); continue; }
    total += size;
    if (total > MAX_TOTAL) throw new Error('That archive is larger than 28 MB. Import a smaller project.');

    let bytes;
    try {
      bytes = await entry.async('uint8array');
    } catch {
      skipped.push({ path, reason: 'unreadable' });
      continue;
    }
    const decoded = decodeBytes(bytes);
    entries.push({ path, content: decoded.text, binary: decoded.binary, size: bytes.byteLength });
  }

  return { entries, skipped, strippedRoot: stripRoot, rootName: stripRoot ? [...topLevel][0] : '' };
}

export async function buildZipBlob(entries, { folder = '' } = {}) {
  const zip = new lib();
  const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';
  for (const entry of entries) {
    const path = `${prefix}${entry.path}`;
    if (entry.binary) zip.file(path, entry.content, { base64: true });
    else zip.file(path, entry.content);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
