/* ==========================================================================
   auth.js — لایه نازک روی Supabase Auth (ورود، ثبت‌نام، لینک جادویی، خروج)
   ========================================================================== */

import { getClient, toAppError } from './backend.js';

export async function getSession() {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw toAppError(error);
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = getClient().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data?.subscription?.unsubscribe?.();
}

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw toAppError(error);
  return data;
}

export async function signUp(email, password, displayName) {
  const { data, error } = await getClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || '' } },
  });
  if (error) throw toAppError(error);
  return data;
}

export async function magicLink(email) {
  const { data, error } = await getClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw toAppError(error);
  return data;
}

export async function resetPassword(email) {
  const { data, error } = await getClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function changePassword(password) {
  const { data, error } = await getClient().auth.updateUser({ password });
  if (error) throw toAppError(error);
  return data;
}

export async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw toAppError(error);
}

export async function getUser() {
  const { data, error } = await getClient().auth.getUser();
  if (error) return null;
  return data.user;
}
