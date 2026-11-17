import { getSupabase, resetSupabaseClient } from '../supabase-client.js';
import { isConfigured } from '../config.js';

let currentUser = null;
const listeners = new Set();

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(currentUser);
}

export async function initAuth() {
  if (!isConfigured()) {
    currentUser = null;
    emit();
    return null;
  }
  try {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user ?? null;
    sb.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ?? null;
      emit();
    });
    emit();
    return currentUser;
  } catch (err) {
    console.warn('Auth init failed', err);
    currentUser = null;
    emit();
    return null;
  }
}

export function getUser() {
  return currentUser;
}

export async function signIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  emit();
  return data.user;
}

export async function signUp(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  // Session may be null if email confirmation is required
  currentUser = data.user;
  emit();
  return data;
}

export async function signOut() {
  try {
    const sb = await getSupabase();
    await sb.auth.signOut();
  } catch (_) { /* ignore */ }
  currentUser = null;
  resetSupabaseClient();
  emit();
}
