/**
 * auth.service.js — لایه سرویس احراز هویت
 * تمام عملیات مربوط به کاربر را انتزاع می‌کند.
 */

import {
  getSupabase, getSession, getUser,
  signInWithPassword, signUpWithPassword, signOut as sbSignOut,
  resetPassword, onAuthChange, mapAuthError, isConfigured,
} from '../config/supabase.js';

import { bus, EVENTS } from '../utils/events.js';

let _currentUser = null;
let _currentProfile = null;
let _unsub = null;

/* ---------- راه‌اندازی اولیه ---------- */

export async function init() {
  if (!isConfigured()) {
    console.warn('[auth] Supabase تنظیم نشده است.');
  }
  try {
    const session = await getSession();
    if (session?.user) {
      _currentUser = session.user;
      await loadProfile();
    }
  } catch (e) {
    console.warn('[auth] init error:', e?.message);
  }

  // subscribed once
  if (!_unsub) {
    _unsub = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        _currentUser = session.user;
        await loadProfile();
        bus.emit(EVENTS.AUTH_SIGNED_IN, { user: _currentUser, profile: _currentProfile });
      } else if (event === 'SIGNED_OUT') {
        _currentUser = null;
        _currentProfile = null;
        bus.emit(EVENTS.AUTH_SIGNED_OUT);
      } else if (event === 'USER_UPDATED') {
        _currentUser = session?.user || _currentUser;
        bus.emit(EVENTS.AUTH_STATE_CHANGE, { user: _currentUser, profile: _currentProfile });
      }
    });
  }
  return { user: _currentUser, profile: _currentProfile };
}

/* ---------- دریافت کاربر جاری ---------- */

export function currentUser() { return _currentUser; }
export function currentProfile() { return _currentProfile; }
export function isAuthenticated() { return !!_currentUser; }

/* ---------- ورود / ثبت‌نام / خروج ---------- */

export async function login(email, password) {
  try {
    await signInWithPassword(email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function register({ displayName, email, password }) {
  try {
    const { user, session } = await signUpWithPassword(email, password, displayName);
    if (!session && user) {
      // نیاز به تأیید ایمیل
      return {
        ok: true,
        needsConfirmation: true,
        message: 'ایمیل تأیید برای شما ارسال شد. لطفاً صندوق ورودی را بررسی کنید.',
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function logout() {
  try {
    await sbSignOut();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function forgotPassword(email) {
  try {
    await resetPassword(email);
    return { ok: true, message: 'لینک بازنشانی رمز به ایمیل شما ارسال شد.' };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

/* ---------- پروفایل ---------- */

export async function loadProfile() {
  if (!_currentUser) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', _currentUser.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.warn('[auth] loadProfile error:', error.message);
    return null;
  }

  // اگر وجود نداشت، بسازیم
  if (!data) {
    const { data: created, error: insErr } = await sb
      .from('profiles')
      .insert({ id: _currentUser.id, display_name: displayNameFromUser() })
      .select()
      .single();
    if (insErr) {
      console.warn('[auth] insert profile error:', insErr.message);
      return null;
    }
    _currentProfile = created;
    return created;
  }

  _currentProfile = data;
  return data;
}

export async function updateProfile(patch) {
  if (!_currentUser) throw new Error('no user');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update(patch)
    .eq('id', _currentUser.id)
    .select()
    .single();
  if (error) throw error;
  _currentProfile = data;
  bus.emit(EVENTS.AUTH_STATE_CHANGE, { user: _currentUser, profile: _currentProfile });
  return data;
}

export async function ensurePreferences() {
  if (!_currentUser) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from('user_preferences')
    .select('*')
    .eq('user_id', _currentUser.id)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await sb
    .from('user_preferences')
    .insert({ user_id: _currentUser.id })
    .select()
    .single();
  if (error) { console.warn(error.message); return null; }
  return created;
}

export async function updatePreferences(patch) {
  if (!_currentUser) throw new Error('no user');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('user_preferences')
    .upsert({ user_id: _currentUser.id, ...patch }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------- کمکی ---------- */

function displayNameFromUser() {
  const meta = _currentUser?.user_metadata || {};
  return meta.display_name || (_currentUser?.email || '').split('@')[0] || 'کاربر';
}

export function displayName() {
  return _currentProfile?.display_name || displayNameFromUser();
}