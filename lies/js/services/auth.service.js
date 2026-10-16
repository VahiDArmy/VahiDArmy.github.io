/* ============================================================
   js/services/auth.service.js
   Authentication: signup, login, logout, reset, change password,
   account deletion (with cascading data wipe).
   Updated: verbose error extraction + 422 handling + Persian
   messages for all common Supabase auth errors.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, ERROR_CODES, ERROR_MESSAGES, TABLES } from '../config/constants.js';
import { get, set, remove } from '../utils/storage.js';
import { LS_KEYS } from '../config/app.config.js';
import { cleanText } from '../utils/sanitize.js';

/* ── Error extraction ────────────────────────────────────── */

/**
 * Try to extract the raw JSON body that Supabase returned.
 * supabase-js sometimes hides it inside `err.context` (a fetch Response)
 * or embeds it in `err.message` as a stringified JSON.
 * @param {any} err
 * @returns {Promise<any|null>}
 */
async function extractRawBody(err) {
  if (!err) return null;

  // Case 1: fetch Response object in `context`
  if (err.context && typeof err.context.clone === 'function') {
    try {
      const cloned = err.context.clone();
      const text = await cloned.text();
      try { return JSON.parse(text); }
      catch { return { raw: text }; }
    } catch { /* fallthrough */ }
  }

  // Case 2: `err.message` is a JSON string
  if (typeof err.message === 'string' && err.message.trim().startsWith('{')) {
    try { return JSON.parse(err.message); }
    catch { /* fallthrough */ }
  }

  // Case 3: plain properties
  if (err.code || err.status || err.error) {
    return {
      code: err.code,
      status: err.status,
      error: err.error,
      message: err.message,
    };
  }

  return null;
}

/**
 * Full diagnostic log to the console (never shows sensitive data).
 * @param {string} tag
 * @param {any} err
 * @param {any} [extra]
 */
function logAuthError(tag, err, extra) {
  // eslint-disable-next-line no-console
  console.groupCollapsed(`%c[Auth] ${tag}`, 'color:#f0619a;font-weight:bold');
  // eslint-disable-next-line no-console
  console.error('error object:', err);
  if (extra) {
    // eslint-disable-next-line no-console
    console.info('extra:', extra);
  }
  if (err && typeof err === 'object') {
    // eslint-disable-next-line no-console
    console.info('error.message:', err.message);
    // eslint-disable-next-line no-console
    console.info('error.code:', err.code);
    // eslint-disable-next-line no-console
    console.info('error.status:', err.status);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/* ── Error normalizer ────────────────────────────────────── */

const EXTRA_MESSAGES = Object.freeze({
  user_already_exists: 'این ایمیل قبلاً ثبت شده است. می‌توانید وارد شوید.',
  email_exists: 'این ایمیل قبلاً ثبت شده است. می‌توانید وارد شوید.',
  weak_password: 'رمز عبور بسیار ضعیف است. حداقل ۸ کاراکتر با ترکیب حروف و اعداد.',
  password_too_short: 'رمز عبور بسیار کوتاه است.',
  password_compromised: 'این رمز عبور در نشتی داده‌های گذشته دیده شده. رمز دیگری انتخاب کنید.',
  pwned: 'این رمز عبور در نشتی داده‌های گذشته دیده شده. رمز دیگری انتخاب کنید.',
  validation_failed: 'اطلاعات ورودی نامعتبر است.',
  signup_disabled: 'ثبت‌نام در این پروژه غیرفعال شده است. با مدیر تماس بگیرید.',
  email_address_invalid: 'قالب ایمیل نامعتبر است.',
  over_request_rate_limit: 'تعداد تلاش‌ها زیاد است. چند دقیقه صبر کنید.',
  over_email_send_rate_limit: 'ایمیل‌های ارسالی زیاد است. کمی بعد تلاش کنید.',
  invalid_credentials: 'ایمیل یا رمز عبور اشتباه است.',
  email_not_confirmed: 'ایمیل شما تأیید نشده است. صندوق ورودی خود را بررسی کنید.',
  same_password: 'رمز جدید باید با رمز فعلی متفاوت باشد.',
  reauthentication_needed: 'برای این کار باید دوباره وارد شوید.',
  not_authorized: 'دسترسی غیرمجاز.',
});

/**
 * Map a raw Supabase error (plus its body) to our canonical shape.
 * @param {any} err
 * @param {any} [body]
 * @returns {{code:string, message:string, raw:any, status:number|null}}
 */
function normalizeError(err, body = null) {
  const status = Number(err?.status) || Number(body?.status) || null;

  // Code can come from either object
  const rawCode = String(
    err?.code ||
    body?.code ||
    body?.error_code ||
    body?.error ||
    ''
  ).toLowerCase().trim();

  const rawMessage = String(
    body?.msg ||
    body?.message ||
    body?.error_description ||
    err?.message ||
    ''
  ).trim();

  const lowerMsg = rawMessage.toLowerCase();

  // 1) explicit code
  if (rawCode && EXTRA_MESSAGES[rawCode]) {
    return { code: rawCode, message: EXTRA_MESSAGES[rawCode], raw: { err, body }, status };
  }

  // 2) heuristics on message
  if (lowerMsg.includes('already registered') || lowerMsg.includes('already exists') || lowerMsg.includes('user already')) {
    return { code: 'user_already_exists', message: EXTRA_MESSAGES.user_already_exists, raw: { err, body }, status };
  }
  if (lowerMsg.includes('signups not allowed') || lowerMsg.includes('signup is disabled')) {
    return { code: 'signup_disabled', message: EXTRA_MESSAGES.signup_disabled, raw: { err, body }, status };
  }
  if (lowerMsg.includes('password') && lowerMsg.includes('pwned')) {
    return { code: 'password_compromised', message: EXTRA_MESSAGES.password_compromised, raw: { err, body }, status };
  }
  if (lowerMsg.includes('password') && (lowerMsg.includes('weak') || lowerMsg.includes('short') || lowerMsg.includes('least') || lowerMsg.includes('characters'))) {
    return { code: 'weak_password', message: EXTRA_MESSAGES.weak_password, raw: { err, body }, status };
  }
  if (lowerMsg.includes('invalid email') || lowerMsg.includes('email address') && lowerMsg.includes('invalid')) {
    return { code: 'email_address_invalid', message: EXTRA_MESSAGES.email_address_invalid, raw: { err, body }, status };
  }
  if (lowerMsg.includes('invalid login') || lowerMsg.includes('invalid credentials')) {
    return { code: ERROR_CODES.INVALID_CREDENTIALS, message: ERROR_MESSAGES[ERROR_CODES.INVALID_CREDENTIALS], raw: { err, body }, status };
  }
  if (lowerMsg.includes('email not confirmed')) {
    return { code: ERROR_CODES.EMAIL_NOT_CONFIRMED, message: ERROR_MESSAGES[ERROR_CODES.EMAIL_NOT_CONFIRMED], raw: { err, body }, status };
  }
  if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
    return { code: ERROR_CODES.RATE_LIMITED, message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED], raw: { err, body }, status };
  }
  if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('failed to fetch')) {
    return { code: ERROR_CODES.NETWORK, message: ERROR_MESSAGES[ERROR_CODES.NETWORK], raw: { err, body }, status };
  }

  // 3) 422 without a recognizable message
  if (status === 422) {
    return {
      code: 'validation_failed',
      message: rawMessage || 'اطلاعات ورودی نامعتبر است. لطفاً مقادیر را بررسی کنید.',
      raw: { err, body },
      status,
    };
  }

  // 4) fallback
  return {
    code: ERROR_CODES.UNKNOWN,
    message: rawMessage || ERROR_MESSAGES[ERROR_CODES.UNKNOWN],
    raw: { err, body },
    status,
  };
}

/**
 * Throw a normalized error (after logging diagnostics).
 * @param {string} tag
 * @param {any} err
 */
async function fail(tag, err) {
  const body = await extractRawBody(err);
  logAuthError(tag, err, body);
  const norm = normalizeError(err, body);
  bus.emit(EVENTS.AUTH_ERROR, norm);
  const e = new Error(norm.message);
  /** @type {any} */ (e).code = norm.code;
  /** @type {any} */ (e).status = norm.status;
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
    if (error) { await fail('signIn', error); }

    if (remember) set(LS_KEYS.REMEMBER_EMAIL, String(email).trim());
    else remove(LS_KEYS.REMEMBER_EMAIL);

    bus.emit(EVENTS.AUTH_SIGNED_IN, data.session);
    return { user: data.user, session: data.session };
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('signIn/unexpected', err);
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
  const cleanEmail = String(email).trim().toLowerCase();

  // Pre-flight sanity checks (avoid an unnecessary 422 round-trip)
  if (!cleanEmail.includes('@')) {
    const e = new Error('قالب ایمیل نامعتبر است.');
    /** @type {any} */ (e).code = 'email_address_invalid';
    throw e;
  }
  if (String(password).length < 8) {
    const e = new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
    /** @type {any} */ (e).code = 'weak_password';
    throw e;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: String(password),
      options: {
        data: { display_name: cleanName },
        // Email confirmation is disabled — no emailRedirectTo needed.
      },
    });
    if (error) { await fail('signUp', error); }

    // Diagnostic log — helpful while debugging 422s
    // eslint-disable-next-line no-console
    console.info('[Auth] signUp success', {
      userId: data?.user?.id,
      email: data?.user?.email,
      hasSession: !!data?.session,
      emailConfirmedAt: data?.user?.email_confirmed_at || null,
    });

    // Create the profile row immediately (idempotent thanks to unique(user_id)).
    if (data?.user) {
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

    // If email confirmation is unexpectedly ON, session will be null.
    // We still emit AUTH_SIGNED_IN to keep the app happy — the user
    // can then sign in manually after confirming.
    if (data.session) {
      bus.emit(EVENTS.AUTH_SIGNED_IN, data.session);
    } else {
      // Email confirmation is likely ON — inform the caller.
      // eslint-disable-next-line no-console
      console.warn('[Auth] signUp returned no session. Email confirmation may be enabled in your Supabase project.');
    }

    return { user: data.user, session: data.session };
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('signUp/unexpected', err);
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
    if (error && error.message && !/session/i.test(error.message)) {
      await fail('signOut', error);
    }
    bus.emit(EVENTS.AUTH_SIGNED_OUT);
  } catch (err) {
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
    if (error) { await fail('sendPasswordReset', error); }
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('sendPasswordReset/unexpected', err);
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
    if (error) { await fail('updatePassword', error); }
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('updatePassword/unexpected', err);
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
    if (!user) await fail('updateDisplayName', { message: 'not authorized', status: 401 });

    const { error } = await supabase.auth.updateUser({
      data: { display_name: cleanName },
    });
    if (error) { await fail('updateDisplayName/auth', error); }

    const { error: pe } = await supabase
      .from(TABLES.PROFILES)
      .update({ display_name: cleanName, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (pe) console.warn('[auth] profile display_name update failed', pe);
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('updateDisplayName/unexpected', err);
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
    if (error) { await fail('updateEmail', error); }
  } catch (err) {
    if (err && /** @type {any} */ (err).code) throw err;
    await fail('updateEmail/unexpected', err);
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
  if (!user) await fail('updateProfile', { message: 'not authorized', status: 401 });

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
  if (error) { await fail('updateProfile/db', error); }
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
  if (!user || !user.email) await fail('deleteAccount', { message: 'not authorized', status: 401 });

  // Re-authenticate to confirm intent
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: String(password),
  });
  if (reauthErr) { await fail('deleteAccount/reauth', reauthErr); }

  // RPC that runs with SECURITY DEFINER to delete the auth user + cascade.
  const { error } = await supabase.rpc('delete_my_account');
  if (error) { await fail('deleteAccount/rpc', error); }

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