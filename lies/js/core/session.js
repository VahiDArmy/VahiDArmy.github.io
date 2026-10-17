/* ============================================================
   js/core/session.js
   FIXED: Removed the 3-second blocking wait. 
   Now it returns the session IMMEDIATELY from LocalStorage and 
   hydrates the profile/settings in the background.
   ============================================================ */

import { getSupabase, getSession } from './supabase.client.js';
import { bus } from './event-bus.js';
import { sessionStore } from './store.js';
import { EVENTS } from '../config/constants.js';
import * as authService from '../services/auth.service.js';
import * as settingsService from '../services/settings.service.js';

function setStatus(status, error = null) {
  sessionStore.set({ status, error });
}

// Background task: fetch profile and settings without blocking the UI
async function hydrateInBackground(user, session) {
  try {
    const [profile, settings] = await Promise.all([
      authService.getProfile().catch(() => null),
      settingsService.fetch().catch(() => settingsService.getLocal()),
    ]);
    sessionStore.set({ profile: profile || null, settings });
    bus.emit(EVENTS.AUTH_READY, { user, session });
  } catch (err) {
    console.warn('[session] background hydration failed', err);
  }
}

function setAnonymous() {
  sessionStore.set({ user: null, profile: null, status: 'anonymous', error: null });
  bus.emit(EVENTS.AUTH_READY, { user: null, session: null });
}

let _initialized = false;

export async function initSession() {
  if (_initialized) {
    const s = sessionStore.getState();
    return { user: s.user, session: null };
  }
  _initialized = true;
  setStatus('booting');

  const supabase = getSupabase();

  supabase.auth.onAuthStateChange((event, session) => {
    setTimeout(async () => {
      try {
        if (event === 'SIGNED_OUT') {
          setAnonymous();
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          sessionStore.set({ user: session.user, status: 'authenticated' });
          hydrateInBackground(session.user, session);
          return;
        }
        if (event === 'USER_UPDATED' && session?.user) {
          sessionStore.set({ user: session.user });
        }
      } catch (err) {
        console.warn('[session] auth state change failed', err);
      }
    }, 0);
  });

  try {
    // 🛡️ getSession() is instant (reads from LocalStorage)
    const session = await getSession();
    if (session?.user) {
      // Set state IMMEDIATELY
      sessionStore.set({ user: session.user, status: 'authenticated', error: null });
      
      // Hydrate in background, DO NOT await
      hydrateInBackground(session.user, session);
      
      return { user: session.user, session };
    }
    setAnonymous();
    return { user: null, session: null };
  } catch (err) {
    console.error('[session] init failed', err);
    setStatus('error', err);
    setAnonymous();
    return { user: null, session: null };
  }
}

export async function refreshSession() {
  const supabase = getSupabase();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      sessionStore.set({ user });
      hydrateInBackground(user, session);
    } else {
      setAnonymous();
    }
  } catch (err) {
    console.warn('[session] refresh failed', err);
  }
}

export function getUser() { return sessionStore.get('user'); }
export function getProfile() { return sessionStore.get('profile'); }
export function isAuthenticated() { return sessionStore.get('status') === 'authenticated'; }
export function isBooting() { return sessionStore.get('status') === 'booting'; }
export function isAnonymous() { return sessionStore.get('status') === 'anonymous'; }

export default { initSession, refreshSession, getUser, getProfile, isAuthenticated, isBooting, isAnonymous };