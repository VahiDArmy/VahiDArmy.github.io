// Build a paste-ready text archive from the file store (for ZIP → text flow).

import { normalizeNewlines } from '../utils/bytes.js';

export function buildPackText(files) {
  const included = files
    .filter((f) => f && !f.skipped)
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const lines = [];
  lines.push('This is a Project Packer text archive.');
  lines.push('It contains the source files of a project so they can be pasted into a chat (e.g. DeepSeek) and later re-assembled into a ZIP.');
  lines.push('');
  lines.push('FORMAT');
  lines.push('Each file is wrapped in markers:');
  lines.push('  {[[FILE: relative/path/to/file.ext]]}');
  lines.push('  <file content, preserved exactly>');
  lines.push('  {[[END: relative/path/to/file.ext]]}');
  lines.push('');
  lines.push('Rules:');
  lines.push('- Markers must appear on their own lines.');
  lines.push('- Path in FILE and END must match exactly.');
  lines.push('- Prose or commentary outside the markers is ignored when packing.');
  lines.push('- Binary files and common noise (node_modules, .git, etc.) are omitted.');
  lines.push('');
  lines.push('--- BEGIN PACK ---');
  lines.push('');

  for (const entry of included) {
    lines.push('{[[FILE: ' + entry.path + ']]}');
    lines.push(normalizeNewlines(entry.content));
    lines.push('{[[END: ' + entry.path + ']]}');
    lines.push('');
  }

  lines.push('--- END PACK ---');
  lines.push('');
  lines.push('Files included: ' + included.length);

  return lines.join('\n');
}

export function buildZipFromEntries(entries) {
  // Reuse zip-build with an in-memory map, but without touching State.
  const chunks = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;
  const DOS_TIME = 0;
  const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;
  const encoder = new TextEncoder();

  function crcTableForZip() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  }
  const TABLE = crcTableForZip();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const valid = entries
    .filter((e) => e && typeof e.path === 'string' && typeof e.content === 'string')
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const entry of valid) {
    const data = encoder.encode(entry.content);
    const name = encoder.encode(entry.path);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, data);

    const centralOffset = offset;
    offset += local.length + data.length;

    const record = new Uint8Array(46 + name.length);
    const cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, centralOffset, true);
    record.set(name, 46);
    central.push(record);
    centralSize += record.length;
  }

  const centralStart = offset;
  for (const record of central) chunks.push(record);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, valid.length, true);
  ev.setUint16(10, valid.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);
  chunks.push(end);

  const total = centralStart + centralSize + end.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
