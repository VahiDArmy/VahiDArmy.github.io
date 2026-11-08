// Read a ZIP archive and return parsed text entries.

import { shouldSkipPath, skipReason } from './skip.js';
import { isProbablyBinary, textFromBytes } from '../utils/bytes.js';

export function findEndOfCentralDirectory(view) {
  const len = view.byteLength;
  const maxScan = Math.min(len, 65557);
  const start = Math.max(0, len - maxScan);
  for (let i = len - 22; i >= start; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

export function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    return Promise.reject(new Error('Deflate not supported in this browser (need DecompressionStream)'));
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer().then((buf) => new Uint8Array(buf));
}

export function listZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) {
    throw new Error('Not a valid ZIP (end of central directory not found)');
  }

  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  const entries = [];
  let pos = centralOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) {
      throw new Error('Corrupt central directory');
    }
    const method = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const uncompSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);

    const nameBytes = new Uint8Array(arrayBuffer, pos + 46, nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);

    entries.push({
      name,
      method,
      compSize,
      uncompSize,
      localOffset,
    });

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

export function readZip(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const entries = listZipEntries(arrayBuffer);
  const results = [];
  let chain = Promise.resolve();

  for (const entry of entries) {
    chain = chain.then(() => {
      if (shouldSkipPath(entry.name)) {
        results.push({
          path: entry.name,
          skipped: true,
          reason: skipReason(entry.name) || 'noise',
          category: 'noise',
        });
        return undefined;
      }

      const lo = entry.localOffset;
      if (view.getUint32(lo, true) !== 0x04034b50) {
        results.push({ path: entry.name, skipped: true, reason: 'bad local header', category: 'other' });
        return undefined;
      }
      const localNameLen = view.getUint16(lo + 26, true);
      const localExtraLen = view.getUint16(lo + 28, true);
      const dataStart = lo + 30 + localNameLen + localExtraLen;
      const raw = new Uint8Array(arrayBuffer, dataStart, entry.compSize);

      let dataPromise;
      if (entry.method === 0) {
        dataPromise = Promise.resolve(raw);
      } else if (entry.method === 8) {
        dataPromise = inflateRaw(raw);
      } else {
        results.push({
          path: entry.name,
          skipped: true,
          reason: 'unsupported compression ' + entry.method,
          category: 'other',
        });
        return undefined;
      }

      return dataPromise
        .then((bytes) => {
          if (isProbablyBinary(bytes)) {
            results.push({ path: entry.name, skipped: true, reason: 'binary', category: 'binary' });
            return;
          }
          let text;
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          } catch (err) {
            results.push({ path: entry.name, skipped: true, reason: 'not utf-8', category: 'binary' });
            return;
          }
          results.push({
            path: entry.name.replace(/\\/g, '/'),
            content: text,
            bytes,
            skipped: false,
          });
        })
        .catch((err) => {
          results.push({
            path: entry.name,
            skipped: true,
            reason: 'decompress failed',
            category: 'other',
          });
        });
    });
  }

  return chain.then(() => results);
}

export function summarizeRead(results) {
  let included = 0;
  let skippedNoise = 0;
  let skippedBinary = 0;
  let skippedOther = 0;
  for (const r of results) {
    if (!r.skipped) {
      included++;
    } else if (r.category === 'noise') {
      skippedNoise++;
    } else if (r.category === 'binary') {
      skippedBinary++;
    } else {
      skippedOther++;
    }
  }
  return {
    total: results.length,
    included,
    skippedNoise,
    skippedBinary,
    skippedOther,
  };
}
