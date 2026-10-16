/* ============================================================
   js/utils/id.js
   ID generation, hashing, and random helpers
   ============================================================ */

/**
 * Generate a cryptographically random UUID v4.
 * Falls back to a Math.random version if crypto is unavailable.
 * @returns {string}
 */
export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Short, URL-safe random id (12 chars, base36).
 * @returns {string}
 */
export function shortId() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

/**
 * Random int in [min, max] inclusive.
 * @param {number} min @param {number} max @returns {number}
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array.
 * @template T @param {T[]} arr @returns {T|undefined}
 */
export function pick(arr) {
  if (!Array.isArray(arr) || !arr.length) return undefined;
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * Shuffle an array (Fisher-Yates, immutable).
 * @template T @param {T[]} arr @returns {T[]}
 */
export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Generate a deterministic color from a string (hue rotation).
 * @param {string} input
 * @returns {string} hsl color
 */
export function colorFromString(input) {
  let hash = 0;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 62% 58%)`;
}

/**
 * Async SHA-256 hex digest.
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function sha256(message) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Non-crypto fallback for dev environments only
    let h = 0;
    for (let i = 0; i < message.length; i++) h = (h * 31 + message.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16);
  }
  const buf = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministic string hash (fast, non-crypto).
 * @param {string} s @returns {number}
 */
export function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Create a unique incremental id scoped to the session.
 * @param {string} [prefix='id']
 * @returns {string}
 */
let _seq = 0;
export function seqId(prefix = 'id') {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

/**
 * Deep-clone a JSON-safe structure.
 * @template T @param {T} obj @returns {T}
 */
export function clone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(obj); } catch { /* fallthrough */ }
  }
  return JSON.parse(JSON.stringify(obj));
}