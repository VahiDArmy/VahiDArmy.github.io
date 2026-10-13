/**
 * Auth service — wraps Supabase Auth.
 *
 * All methods return plain data or throw AppError. The UI subscribes to
 * `auth:changed` on the bus to react to sign-in / sign-out / token refresh.
 *
 * SECURITY
 * --------
 * - Only email + password auth is enabled. Public signup must require
 *   email confirmation in the Supabase dashboard.
 * - Sessions persist in localStorage via the supabase client; the token is
 *   automatically attached to every request and validated server-side.
 * - We never trust client-side `user` data for authorization; RLS on the
 *   server is the source of truth.
 */

import { supabase, isConfigured } from "../config/supabase.js";
import { bus } from "../core/event-bus.js";
import { store } from "../core/state.js";
import { appError, normalize, ERROR_CODES } from "../utils/errors.js";

let bound = false;

function bindAuthListener() {
  if (bound) return;
  bound = true;
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    store.setUser(user, session);
    bus.emit("auth:changed", { event, user, session });
  });
}

export const auth = {
  /**
   * Must be called once at startup. Resolves with the current session (or
   * null) and guarantees the auth listener is attached.
   */
  async init() {
    if (!isConfigured) {
      bus.emit("auth:unconfigured");
      return null;
    }
    bindAuthListener();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw normalize(error);
    const session = data.session ?? null;
    store.setUser(session?.user ?? null, session);
    return session;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password,
    });
    if (error) throw normalize(error);
    store.setUser(data.user, data.session);
    return { user: data.user, session: data.session };
  },

  async signUp(email, password, meta = {}) {
    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password,
      options: {
        data: meta,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw normalize(error);

    // Supabase returns user:null + identities:[] on duplicate email when
    // confirmation is on — we translate that into a clear error.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw appError(ERROR_CODES.AUTH_EMAIL_EXISTS);
    }

    // Sign-up may or may not return a session depending on email confirm.
    if (data.session) {
      store.setUser(data.session.user, data.session);
    }
    return { user: data.user, session: data.session, needsConfirmation: !data.session };
  },

  async signOut({ global = false } = {}) {
    const { error } = await supabase.auth.signOut({ scope: global ? "global" : "local" });
    if (error) throw normalize(error);
    store.setUser(null, null);
    return true;
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(email).trim().toLowerCase(),
      { redirectTo: window.location.origin + window.location.pathname + "#reset" }
    );
    if (error) throw normalize(error);
    return true;
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw normalize(error);
    return data.user;
  },

  async updateEmail(newEmail) {
    const { data, error } = await supabase.auth.updateUser({
      email: String(newEmail).trim().toLowerCase(),
    });
    if (error) throw normalize(error);
    return data.user;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw normalize(error);
    return data.session;
  },

  async refresh() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw normalize(error);
    return data.session;
  },

  isSignedIn() {
    return !!store.get("session");
  },

  requireSignedIn() {
    const user = store.get("user");
    if (!user) throw appError(ERROR_CODES.AUTH_REQUIRED);
    return user;
  },
};