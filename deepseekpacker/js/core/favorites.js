// Pinned/favorite files — a lightweight Set backed by localStorage.

import { Storage } from '../utils/storage.js';
import { emit, subscribe } from './state.js';

const KEY = 'favorites';
let cache = null;

function load() {
  if (cache) return cache;
  const raw = Storage.get(KEY, null);
  cache = Array.isArray(raw) ? raw.slice() : [];
  return cache;
}

function persist() {
  Storage.set(KEY, cache || []);
}

export function list() {
  return load().slice();
}

export function has(path) {
  return load().includes(path);
}

export function add(path) {
  if (!path) return false;
  const items = load();
  if (items.includes(path)) return false;
  items.push(path);
  persist();
  emit('favorites', { type: 'add', path });
  return true;
}

export function remove(path) {
  const items = load();
  const idx = items.indexOf(path);
  if (idx < 0) return false;
  items.splice(idx, 1);
  persist();
  emit('favorites', { type: 'remove', path });
  return true;
}

export function toggle(path) {
  return has(path) ? (remove(path), false) : (add(path), true);
}

export function count() {
  return load().length;
}

subscribe((type, payload) => {
  if (type === 'files' && payload) {
    if (payload.type === 'delete') remove(payload.path);
    if (payload.type === 'clear') {
      cache = [];
      persist();
    }
  }
});
