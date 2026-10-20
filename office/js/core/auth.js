/**
 * Auth orchestrator — single source of truth for the signed-in user.
 * Subscribes to Supabase auth events, keeps appStore in sync, and
 * exposes a stable `auth` API for the rest of the app.
 */

import { supabase, isAuthenticated } from '../services/supabase.client.js';
import { appStore } from './store.js';
import { bus } from '../utils/events.js';
import { AUTH_REDIRECT_PATH } from '../config/supabase.config.js';

let initialized = false;

function callbackUrl() {
  const origin = window.location.origin + window.location.pathname;
  const hash = `#${AUTH_REDIRECT_PATH}`;
  return origin + hash;
}

async function loadProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[auth] loadProfile', error);
    return null;
  }
  return data;
}

async function syncSession(session) {
  const user = session?.user || null;
  let profile = null;
  if (user) {
    profile = await loadProfile(user.id);
  }
  appStore.update({
    session: session || null,
    user,
    profile,
    isAuthReady: true,
  });
  bus.emit('auth:changed', { user, profile, session });
  return { user, profile };
}

export async function initAuth() {
  if (initialized) return;
  initialized = true;

  // Initial snapshot
  const { data } = await supabase.auth.getSession();
  await syncSession(data?.session || null);

  // Subscribe to changes
  supabase.auth.onAuthStateChange((event, session) => {
    // eslint-disable-next-line no-console
    console.debug('[auth event]', event);
    // Fire and forget — state updates happen after fetch
    syncSession(session).then(({ user }) => {
      if (event === 'SIGNED_IN' && user) bus.emit('auth:signed-in', user);
      if (event === 'SIGNED_OUT') bus.emit('auth:signed-out');
      if (event === 'PASSWORD_RECOVERY') bus.emit('auth:password-recovery');
    });
  });
}

export const auth = {
  /** Sign in with email + password. */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    await syncSession(data.session);
    return data;
  },

  /** Create account; Supabase sends a confirmation email if enabled. */
  async signUp({ email, password, displayName, username }) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: {
          display_name: displayName || email.split('@')[0],
          username: username || null,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  /** Sign out and clear cached user. */
  async signOut() {
    await supabase.auth.signOut();
    appStore.update({ user: null, profile: null, session: null });
    bus.emit('auth:signed-out');
  },

  /** Send password reset email. */
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callbackUrl(),
    });
    if (error) throw error;
    return true;
  },

  /** Update password (requires an active recovery session). */
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  },

  /** Update display name / metadata. */
  async updateUserMeta(meta) {
    const { error } = await supabase.auth.updateUser({ data: meta });
    if (error) throw error;
    return true;
  },

  /** Resend a confirmation email. */
  async resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) throw error;
    return true;
  },

  /** The current user (sync). */
  currentUser() { return appStore.get('user'); },

  /** The current profile row (sync). */
  currentProfile() { return appStore.get('profile'); },

  /** True if signed in. */
  isSignedIn() { return !!appStore.get('user'); },

  /** Checks the DB, then caches result — safe way to gate pages. */
  async ensureAuthenticated() {
    if (appStore.get('user')) return true;
    return isAuthenticated();
  },

  /** Called by the /auth/callback route to finish the redirect. */
  async handleAuthCallback() {
    // detectSessionInUrl handles code exchange automatically, but
    // we still want to load the profile and give the caller a signal.
    const { data } = await supabase.auth.getSession();
    await syncSession(data?.session || null);
    return data?.session || null;
  },
};

export default auth;