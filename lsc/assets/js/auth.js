/* ============================================================
   THEORIES STUDIO — Auth & profile
   ============================================================ */
import { sb } from './supabase.js';
import { state, setUser, setProfile, setState, emit } from './state.js';
import { toastError, toastSuccess, toastInfo } from './ui.js';
import { escapeHtml } from './utils.js';

export const getSession = async () => {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) { console.warn(error); return null; }
  return data.session;
};

export const initAuth = async () => {
  const client = sb();
  if (!client) { setState({ authReady: true }); return; }
  const { data } = await client.auth.getSession();
  setUser(data.session?.user || null, data.session || null);
  setState({ authReady: true });
  if (data.session?.user) await loadProfile();
  client.auth.onAuthStateChange(async (event, session) => {
    setUser(session?.user || null, session || null);
    if (session?.user) {
      await loadProfile();
    } else {
      setProfile(null);
    }
    emit('auth:change', { event, session });
  });
};

export const loadProfile = async () => {
  const client = sb();
  const user = state.user;
  if (!client || !user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) { console.warn('profile load failed', error); }
  let profile = data;
  if (!profile) {
    const displayName = user.user_metadata?.display_name || (user.email || '').split('@')[0] || 'همراه';
    const { data: inserted, error: insErr } = await client
      .from('profiles')
      .insert({ id: user.id, display_name: displayName })
      .select()
      .maybeSingle();
    if (insErr) console.warn(insErr);
    profile = inserted;
  }
  setProfile(profile);
  return profile;
};

export const signIn = async (email, password) => {
  const client = sb();
  if (!client) throw new Error('Supabase not ready');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  toastSuccess('خوش آمدید', 'ورود موفقیت‌آمیز بود');
  return data;
};

export const signUp = async (email, password, displayName) => {
  const client = sb();
  if (!client) throw new Error('Supabase not ready');
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { display_name: displayName || email.split('@')[0] } }
  });
  if (error) throw error;
  if (data?.session) toastSuccess('خوش آمدید', 'حساب ساخته شد');
  else toastInfo('تأیید ایمیل', 'لینک تأیید به ایمیل شما ارسال شد');
  return data;
};

export const signOut = async () => {
  const client = sb();
  if (!client) return;
  await client.auth.signOut();
  setUser(null, null);
  setProfile(null);
  toastInfo('خارج شدید');
};

export const updateProfile = async (patch) => {
  const client = sb();
  const user = state.user;
  if (!client || !user) throw new Error('not-authenticated');
  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .maybeSingle();
  if (error) throw error;
  setProfile({ ...(state.profile || {}), ...data });
  return data;
};

export const changePassword = async (newPassword) => {
  const client = sb();
  if (!client) throw new Error('Supabase not ready');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  toastSuccess('رمز عبور تغییر کرد');
};

export const resetPassword = async (email) => {
  const client = sb();
  if (!client) throw new Error('Supabase not ready');
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw error;
  toastSuccess('ایمیل بازیابی ارسال شد', 'صندوق ایمیل خود را بررسی کنید');
};

export const displayName = () => {
  const p = state.profile;
  const u = state.user;
  return p?.display_name || u?.user_metadata?.display_name || u?.email?.split('@')[0] || 'مهمان';
};

export const isAuthed = () => !!state.user;

export const requireAuth = (redirect = '/auth') => {
  if (isAuthed()) return true;
  window.location.hash = `#${redirect}`;
  return false;
};

/* ---------- Auth UI ---------- */
export const renderAuthSlot = (container) => {
  if (!container) return;
  container.innerHTML = '';
  if (state.user) {
    const p = state.profile || {};
    const name = displayName();
    const initials = name.trim().charAt(0) || 'ن';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'auth-chip';
    chip.setAttribute('aria-haspopup', 'true');
    chip.innerHTML = `
      <span class="auth-chip__avatar">${p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="" />` : escapeHtml(initials)}</span>
      <span class="auth-chip__name">${escapeHtml(name)}</span>
      <i class="ri-arrow-down-s-line"></i>
    `;
    chip.addEventListener('click', () => openUserMenu(chip));
    container.appendChild(chip);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primary btn--sm';
    btn.innerHTML = '<i class="ri-user-line"></i>ورود';
    btn.addEventListener('click', () => { window.location.hash = '#/auth'; });
    container.appendChild(btn);
  }
};

const openUserMenu = (anchor) => {
  const menu = document.createElement('div');
  menu.className = 'dropdown__menu';
  menu.style.position = 'fixed';
  const rect = anchor.getBoundingClientRect();
  menu.style.top = rect.bottom + 8 + 'px';
  menu.style.left = Math.max(8, rect.right - 220) + 'px';
  menu.innerHTML = `
    <a href="#/settings" data-link class="dropdown__item"><i class="ri-settings-5-line"></i>تنظیمات حساب</a>
    <a href="#/bookmarks" data-link class="dropdown__item"><i class="ri-bookmark-3-line"></i>نشان‌شده‌ها</a>
    <a href="#/theories" data-link class="dropdown__item"><i class="ri-lightbulb-line"></i>نظریه‌های من</a>
    <div class="dropdown__divider"></div>
    <button type="button" class="dropdown__item dropdown__item--danger" data-act="logout"><i class="ri-logout-box-line"></i>خروج از حساب</button>
  `;
  document.body.appendChild(menu);
  menu.querySelector('[data-act="logout"]').addEventListener('click', async () => {
    menu.remove();
    await signOut();
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(() => menu.remove(), 50)));
  const close = (e) => {
    if (!menu.contains(e.target) && e.target !== anchor) {
      menu.remove();
      document.removeEventListener('click', close, true);
    }
  };
  setTimeout(() => document.addEventListener('click', close, true), 0);
};
