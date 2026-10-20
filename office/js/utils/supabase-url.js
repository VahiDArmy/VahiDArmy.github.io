/**
 * Helpers for handling auth redirects that embed the PKCE `code` inside
 * the hash fragment (because we use hash-based routing).
 *
 *   URL after email click:  /index.html#/auth/callback?code=...
 *   The code lives inside the hash — Supabase's auto-detect only reads
 *   `window.location.search`, so we exchange it manually.
 */

import { supabase } from '../services/supabase.client.js';

export function hasCodeInHash() {
  const hash = window.location.hash || '';
  return /[?&]code=/.test(hash);
}

export function extractCodeFromHash() {
  const hash = window.location.hash || '';
  const idx = hash.indexOf('?');
  if (idx === -1) return null;
  const params = new URLSearchParams(hash.slice(idx + 1));
  return params.get('code');
}

export async function exchangeCodeFromHash() {
  const code = extractCodeFromHash();
  if (!code) return null;

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;

  // Clean the URL: strip query params inside the hash
  const hash = window.location.hash || '';
  const idx = hash.indexOf('?');
  const cleanHash = idx === -1 ? hash : hash.slice(0, idx);
  const cleanUrl = window.location.pathname + window.location.search + cleanHash;
  window.history.replaceState(null, '', cleanUrl);

  return data;
}