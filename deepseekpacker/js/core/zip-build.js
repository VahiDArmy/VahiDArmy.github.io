// Build a ZIP archive from the current file store.

import { State } from './state.js';
import { crc32 } from '../utils/crc.js';
import { bytesFromText } from '../utils/bytes.js';

const DOS_TIME = 0;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

export function buildZip(options = {}) {
  const filterPaths = options.paths && options.paths.length
    ? new Set(options.paths)
    : null;

  const allPaths = Array.from(State.files.keys()).sort();
  const paths = filterPaths
    ? allPaths.filter((p) => filterPaths.has(p))
    : allPaths;

  const chunks = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;

  for (const path of paths) {
    const file = State.files.get(path);
    if (!file) continue;
    const data = file.bytes || new Uint8Array(0);
    const name = bytesFromText(path);
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
  ev.setUint16(8, paths.length, true);
  ev.setUint16(10, paths.length, true);
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

export function buildZipBlob(options) {
  const bytes = buildZip(options);
  return new Blob([bytes], { type: 'application/zip' });
}
