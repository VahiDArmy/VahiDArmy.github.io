// Byte/text helpers shared by ZIP and paste flows.

export const encoder = new TextEncoder();
export const decoder = new TextDecoder('utf-8', { fatal: true });
export const decoderLoose = new TextDecoder('utf-8');

export function bytesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isProbablyBinary(bytes) {
  if (!bytes || bytes.length === 0) return false;
  const sample = Math.min(bytes.length, 8192);
  let nulls = 0;
  for (let i = 0; i < sample; i++) {
    if (bytes[i] === 0) nulls++;
  }
  if (nulls > 0) return true;
  try {
    decoder.decode(bytes.subarray(0, sample));
    return false;
  } catch (err) {
    return true;
  }
}

const EXCERPT_LIMIT_DEFAULT = 120;

export function excerptOf(text, limit) {
  const max = limit || EXCERPT_LIMIT_DEFAULT;
  const chars = Array.from(String(text == null ? '' : text));
  const clipped = chars.length > max;
  let excerpt = chars.slice(0, max).join('');
  excerpt = excerpt
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  excerpt = excerpt.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (ch) => {
    return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
  });
  return excerpt + (clipped ? '…' : '');
}

export function countLines(text) {
  if (!text) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}

export function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function bytesFromText(text) {
  return encoder.encode(text == null ? '' : text);
}

export function textFromBytes(bytes) {
  try {
    return decoder.decode(bytes);
  } catch (err) {
    return decoderLoose.decode(bytes);
  }
}
