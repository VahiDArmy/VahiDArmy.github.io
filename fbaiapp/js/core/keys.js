// ---------------------------------------------------------------------------
// OpenRouter key, kept on this device only.
//
// A browser-only app cannot hide a user-supplied provider key from its own
// user's browser, so the honest design is: keep it in localStorage on the
// device that typed it, never send it to Supabase, never log it. Anyone with
// access to this browser profile could read it, which the settings screen says
// plainly.
// ---------------------------------------------------------------------------

import { OPENROUTER } from '../config.js';

export function getApiKey() {
  try { return localStorage.getItem(OPENROUTER.keyStore) || ''; } catch { return ''; }
}

export function setApiKey(value) {
  const key = String(value || '').trim();
  try {
    if (key) localStorage.setItem(OPENROUTER.keyStore, key);
    else localStorage.removeItem(OPENROUTER.keyStore);
  } catch { /* storage disabled */ }
  return key;
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

export function maskKey(key) {
  const k = String(key || '');
  if (k.length < 12) return k ? '••••' : '';
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}
