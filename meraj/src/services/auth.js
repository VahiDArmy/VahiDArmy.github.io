/** Authentication via the project's existing Supabase Auth (email/password + magic link). */
import { supabase, normalizeError } from './supabase.js';

export function authRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data?.subscription?.unsubscribe?.();
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function signUp(email, password, displayName = '') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: displayName ? { display_name: displayName, avatar_seed: displayName } : undefined,
      },
    });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function sendMagicLink(email) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authRedirectUrl(),
        shouldCreateUser: true,
      },
    });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function sendPasswordReset(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl(),
    });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function updatePassword(password) {
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function updateUserMetadata(metadata) {
  try {
    const { data, error } = await supabase.auth.updateUser({ data: metadata });
    return { data, error: normalizeError(error) };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export async function signOut() {
  try {
    // Local scope signs out this browser only; other devices stay signed in.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return { error: normalizeError(error) };
  } catch (error) {
    return { error: normalizeError(error) };
  }
}

/**
 * Supabase can return an error in the URL hash or query string (expired magic
 * link, denied redirect). Read it before the client consumes the hash so the
 * exact provider message can be shown.
 */
export function readAuthCallbackError() {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const error = hash.get('error') || query.get('error');
  const description =
    hash.get('error_description') || query.get('error_description') || hash.get('error_code') || query.get('error_code');
  if (!error && !description) return null;
  return {
    error,
    description: (description || '').replace(/\+/g, ' '),
    code: hash.get('error_code') || query.get('error_code'),
  };
}

export function clearAuthCallbackParams() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['error', 'error_description', 'error_code', 'code', 'state']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (/error|access_token|refresh_token|type=recovery/.test(url.hash)) {
    url.hash = '';
    changed = true;
  }
  if (changed) window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

export function userDisplayName(user, profile) {
  return (
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'Traveller')
  );
}
