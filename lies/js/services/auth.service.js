/* ============================================================
   js/services/auth.service.js
   Authentication: signup, login, logout, reset, change password,
   account deletion (with cascading data wipe).
   Email confirmation is DISABLED in this project.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, ERROR_CODES, ERROR_MESSAGES, TABLES } from '../config/constants.js';
import { get, set, remove } from '../utils/storage.js';
import { LS_KEYS } from '../config/app.config.js';
import { cleanText } from '../utils/sanitize.js';

/* ── Error normalizer ─────────────────────────────────────── */

/**
 * Map a raw Supabase error to our canonical error shape.
 * @param {any} err
 * @returns {{code:string, message:string, raw:any}}
 */
function normalizeError(err) {
  if (!err) return { code: ERROR_CODES.UNKNOWN, message: ERROR_MESSAGES[ERROR_CODES.UNKNOWN], raw: err };

  const raw = String(err.message || err.error_description || err.toString() || '');
  const lower = raw.toLowerCase();

  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return { code: ERROR_CODES.INVALID_CREDENTIALS, message: ERROR_MESSAGES[ERROR_CODES.INVALID_CREDENTIALS], raw: err };
  }
  if (lower.includes('email not confirmed')) {
    return { code: ERROR_CODES.EMAIL_NOT_CONFIRMED, message: ERROR_MESSAGES[ERROR_CODES.EMAIL_NOT_CONFIRMED], raw: err };
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return { code: ERROR_CODES.USER_ALREADY_EXISTS, message: ERROR_MESSAGES[ERROR_CODES.USER_ALREADY_EXISTS], raw: err };
  }
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('short') || lower.includes('least'))) {
    return { code: ERROR_CODES.WEAK_PASSWORD, message: ERROR_MESSAGES[ERROR_CODES.WEAK_PASSWORD], raw: err };
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return { code: ERROR_CODES.RATE_LIMITED, message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED], raw: err };
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('offline')) {
    return { code: ERROR_CODES.NETWORK, message: ERROR_MESSAGES[ERROR_CODES.NETWORK], raw: err };
  }
  if (lower.includes('not authorized') || lower.includes('jwt')) {
    return { code: ERROR_CODES.UNAUTHORIZED, message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED], raw: err };
  }
  return { code: ERROR_CODES.UNKNOWN, message: raw || ERROR_MESSAGES[ERROR_CODES.UNKNOWN], raw: err };
}

/**
 * Throw a normalized error.
 * @param {any} err
 */
function fail(err) {
  const norm = normalizeError(err);
  bus.emit(EVENTS.AUTH_ERROR, norm);
  const e = new Error(norm.message);
  /** @type {any} */ (e).code = norm.code;
  /** @type {any} */ (e).raw = norm.raw;
  throw e;
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @param {{remember?:boolean}} [opts]
 * @returns {Promise<{user:any, session:any}>}
 */
export async function signIn(email, password, opts = {}) {
  const { remember = true } = opts;
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    });
    if (error) fail(error);

    if (remember) set(LS_KEYS.REMEMBER_EMAIL, String(email).trim());
    else remove(LS_KEYS.REMEMBER_EMAIL);

    bus.emit(EVENTS.AUTH_SIGNED_IN, data.session);
    return { user: data.user, session: data.session };
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    fail(err);
  }
}

/**
 * Sign up with email, password and display name.
 * Email confirmation is OFF, so the user is immediately signed in.
 * @param {{email:string, password:string, displayName:string}} params
 * @returns {Promise<{user:any, session:any}>}
 */
export async function signUp({ email, password, displayName }) {
  const supabase = getSupabase();
  const cleanName = cleanText(displayName, { maxLen: 40, multiline: false });

  try {
    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim(),
      password: String(password),
      options: {
        data: { display_name: cleanName },
        // Email confirmation is disabled — no emailRedirectTo needed.
      },
    });
    if (error) fail(error);

    // Create the profile row immediately (idempotent thanks to unique(user_id)).
    if (data.user) {
      try {
        await supabase.from(TABLES.PROFILES).upsert(
          {
            user_id: data.user.id,
            display_name: cleanName,
          },
          { onConflict: 'user_id', ignoreDuplicates: false }
        );
      } catch (profileErr) {
        // Profile creation is best-effort; RLS still protects access.
        console.warn('[auth] profile upsert failed', profileErr);
      }
    }

    if (data.session) bus.emit(EVENTS.AUTH_SIGNED_IN, data.session);
    return { user: data.user, session: data.session };
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    fail(err);
  }
}

/**
 * Sign out the current user.
 * @param {{scope?: 'global'|'local'|'others'}} [opts]
 * @returns {Promise<void>}
 */
export async function signOut(opts = {}) {
  const { scope = 'global' } = opts;
  const supabase = getSupabase();
  try {
    const { error } = await supabase.auth.signOut({ scope });
    if (error && error.message && !/session/i.test(error.message)) fail(error);
    bus.emit(EVENTS.AUTH_SIGNED_OUT);
  } catch (err) {
    // Even if sign-out hits an error, ensure local is cleared
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* noop */ }
    bus.emit(EVENTS.AUTH_SIGNED_OUT);
    throw err;
  }
}

/**
 * Send a password reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendPasswordReset(email) {
  const supabase = getSupabase();
  const redirectTo = `${window.location.origin}${window.location.pathname}#reset-password`;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
    if (error) fail(error);
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    fail(err);
  }
}

/**
 * Update the current user's password.
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export async function updatePassword(newPassword) {
  const supabase = getSupabase();
  try {
    const { error } = await supabase.auth.updateUser({ password: String(newPassword) });
    if (error) fail(error);
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    fail(err);
  }
}

/**
 * Update the display name both in auth metadata and profiles table.
 * @param {string} displayName
 * @returns {Promise<void>}
 */
export async function updateDisplayName(displayName) {
  const supabase = getSupabase();
  const cleanName = cleanText(displayName, { maxLen: 40, multiline: false });
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) fail({ message: 'not authorized' });

    const { error } = await supabase.auth.updateUser({
      data: { display_name: cleanName },
    });
    if (error) fail(error);

    const { error: pe } = await supabase
      .from(TABLES.PROFILES)
      .update({ display_name: cleanName, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (pe) console.warn('[auth] profile display_name update failed', pe);
  } catch (err) {
    if (err && /** @type {any} */ err.code) throw err;
    fail(err);
  }
}

/**
 * Change the current user's email.
 * @param {string} newEmail
 * @returns {Promise<void>}
 */
export async function updateEmail(newEmail) {
  const supabase = getSupabase();
  try {
    const { error } = await supabase.auth.updateUser({ email: String(newEmail).trim() });
    if (error) fail(error);
  } catch (err) {
    if (err && /** @type {any} */ err.code) throw err;
    fail(err);
  }
}

/**
 * Get the current session (shortcut).
 * @returns {Promise<{user:any, session:any}|null>}
 */
export async function getCurrentSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ? { user: data.session.user, session: data.session } : null;
}

/**
 * Fetch the current user's profile row.
 * @returns {Promise<any|null>}
 */
export async function getProfile() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('[auth] getProfile failed', error);
    return null;
  }
  return data;
}

/**
 * Update the user's profile (partial).
 * @param {Partial<{display_name:string, bio:string, avatar_color:string}>} patch
 * @returns {Promise<any>}
 */
export async function updateProfile(patch) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) fail({ message: 'not authorized' });

  const clean = {};
  if (typeof patch.display_name === 'string') {
    clean.display_name = cleanText(patch.display_name, { maxLen: 40, multiline: false });
  }
  if (typeof patch.bio === 'string') {
    clean.bio = cleanText(patch.bio, { maxLen: 400 });
  }
  if (typeof patch.avatar_color === 'string' && /^#[0-9a-f]{3,8}$/i.test(patch.avatar_color)) {
    clean.avatar_color = patch.avatar_color;
  }

  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (error) fail(error);
  return data;
}

/**
 * Permanently delete the account & all related data.
 * Requires a fresh JWT — we re-verify with a password first.
 * @param {string} password - password re-entry confirmation
 * @returns {Promise<void>}
 */
export async function deleteAccount(password) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) fail({ message: 'not authorized' });

  // Re-authenticate to confirm intent
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: String(password),
  });
  if (reauthErr) fail({ message: 'invalid login credentials' });

  // RPC that runs with SECURITY DEFINER to delete the auth user + cascade.
  const { error } = await supabase.rpc('delete_my_account');
  if (error) fail(error);

  await supabase.auth.signOut({ scope: 'local' });
  bus.emit(EVENTS.AUTH_SIGNED_OUT);
}

export default {
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  updatePassword,
  updateDisplayName,
  updateEmail,
  getCurrentSession,
  getProfile,
  updateProfile,
  deleteAccount,
};