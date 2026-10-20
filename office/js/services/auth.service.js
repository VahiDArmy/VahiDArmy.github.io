/**
 * Thin wrapper around the auth core with Persian error mapping.
 * Pages should prefer this over importing supabase.auth directly.
 */

import { auth } from '../core/auth.js';
import { friendlyError } from '../utils/format.js';

async function wrap(fn) {
  try {
    return await fn();
  } catch (err) {
    const message = friendlyError(err, 'خطا در عملیات احراز هویت.');
    throw Object.assign(new Error(message), { cause: err, code: err?.code });
  }
}

export const authService = {
  signIn: (email, password) => wrap(() => auth.signIn(email, password)),
  signUp: (payload) => wrap(() => auth.signUp(payload)),
  signOut: () => wrap(() => auth.signOut()),
  requestPasswordReset: (email) => wrap(() => auth.requestPasswordReset(email)),
  updatePassword: (pwd) => wrap(() => auth.updatePassword(pwd)),
  resendConfirmation: (email) => wrap(() => auth.resendConfirmation(email)),
  updateMeta: (meta) => wrap(() => auth.updateUserMeta(meta)),
  currentUser: auth.currentUser,
  currentProfile: auth.currentProfile,
  isSignedIn: auth.isSignedIn,
  ensureAuthenticated: auth.ensureAuthenticated,
  handleCallback: () => wrap(() => auth.handleAuthCallback()),
};

export default authService;