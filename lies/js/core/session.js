/* ============================================================
   js/core/session.js
   FIXED: Properly isolates the async hydration from the lock.
   ============================================================ */

import { getSupabase, getSession } from './supabase.client.js';
import { bus } from './event-bus.js';
import { sessionStore } from './store.js';
import { EVENTS } from '../config/constants.js';
import * as authService from '../services/auth.service.js';
import * as settingsService from '../services/settings.service.js';

function setStatus(status, error = null) { sessionStore.set({ status, error }); }

async function hydrateAuthenticated(user, session) {
  sessionStore.set({ user, status: 'authenticated', error: null });
  try {
    const [profile, settings] = await Promise.all([
      authService.getProfile().catch(() => null),
      settingsService.fetch().catch(() => settingsService.getLocal()),
    ]);
    sessionStore.set({ profile: profile || null, settings });
  } catch (err) { console.warn('[session] hydrate failed', err); }
  bus.emit(EVENTS.AUTH_READY, { user, session });
}

function setAnonymous() {
  sessionStore.set({ user: null, profile: null, status: 'anonymous', error: null });
  bus.emit(EVENTS.AUTH_READY, { user: null, session: null });
}

let _initialized = false;

export async function initSession() {
  if (_initialized) return { user: sessionStore.get('user') };
  _initialized = true;
  setStatus('booting');

  const supabase = getSupabase();
  supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(async () => {
      if (event === 'SIGNED_OUT') setAnonymous();
      if (event === 'SIGNED_IN' && session?.user) await hydrateAuthenticated(session.user, session);
    }, 0);
  });

  try {
    const session = await getSession();
    if (session?.user) {
      await hydrateAuthenticated(session.user, session);
      return { user: session.user, session };
    }
    setAnonymous();
    return { user: null, session: null };
  } catch (err) {
    setAnonymous();
    return { user: null, session: null };
  }
}

export function isAuthenticated() { return sessionStore.get('status') === 'authenticated'; }