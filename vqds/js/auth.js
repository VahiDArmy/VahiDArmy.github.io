/* ==========================================================================
   auth.js — احراز هویت، ثبت‌نام، ورود و مدیریت پروفایل‌ها
   ========================================================================== */

import { supabase } from './supabase.js';
import { CONFIG } from './config.js';
import { store } from './store.js';
import { $, el, clear, show, hide } from './utils.js';
import { toast, successToast, errorToast } from './toast.js';

let isSignupMode = false;

export async function initAuth() {
  // گوش دادن به تغییرات وضعیت احراز هویت
  supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    
    if (user) {
      store.set({ user });
      document.body.dataset.auth = 'authenticated';
      await fetchUserProfile(user.id);
      await fetchAllProfiles();
      renderAuthView();
    } else {
      store.set({ user: null, profile: null });
      document.body.dataset.auth = 'guest';
      renderAuthView();
    }
  });

  // بررسی نشست فعلی
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    store.set({ user: data.session.user });
    document.body.dataset.auth = 'authenticated';
    await fetchUserProfile(data.session.user.id);
    await fetchAllProfiles();
  } else {
    document.body.dataset.auth = 'guest';
  }
}

async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from(CONFIG.tables.profiles)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!error && data) {
    store.set({ profile: data });
    // همگام‌سازی تم اگر در دیتابیس ذخیره شده بود
    if (data.theme && CONFIG.themes[data.theme]) {
      window.dispatchEvent(new CustomEvent('q56:apply-theme', { detail: { theme: data.theme } }));
    }
  }
}

async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from(CONFIG.tables.profiles)
    .select('*')
    .order('created_at', { ascending: true });

  if (!error && data && data.length > 0) {
    store.set({
      profile1Id: data[0]?.user_id || null,
      counter1: data[0]?.read_count || 0,
      profile2Id: data[1]?.user_id || null,
      counter2: data[1]?.read_count || 0,
    });
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        avatar_emoji: '🌸',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  store.set({ user: null, profile: null });
  toast('با موفقیت خارج شدید', 'info');
}

export function renderAuthView() {
  const container = $('#authContent');
  if (!container) return;

  const state = store.getState();
  clear(container);

  const wrapper = el('div', { class: 'auth-container' });

  if (state.user && state.profile) {
    // --- حالت پروفایل (لاگین شده) ---
    const card = el('div', { class: 'auth-card profile-card' });
    
    // هدر
    card.appendChild(
      el('div', { class: 'auth-header' }, [
        el('div', { class: 'profile-avatar-large', text: state.profile.avatar_emoji || '🌸' }),
        el('h2', { class: 'profile-name', text: state.profile.display_name || 'کاربر' }),
        el('p', { class: 'profile-email', text: state.user.email || '' }),
      ])
    );

    // آمار
    card.appendChild(
      el('div', { class: 'profile-stats' }, [
        el('div', { class: 'profile-stat-box' }, [
          el('b', { text: String(state.profile.read_count || 0) }),
          el('span', { text: 'بار قرائت' }),
        ]),
        el('div', { class: 'profile-stat-box' }, [
          el('b', { text: '۵۶' }),
          el('span', { text: 'سوره واقعه' }),
        ]),
      ])
    );

    // انتخاب تم
    const themePicker = el('div', { class: 'profile-theme-picker' });
    Object.values(CONFIG.themes).forEach((theme) => {
      const btn = el('button', {
        class: `theme-option ${state.theme === theme.id ? 'is-active' : ''}`,
        type: 'button',
        onclick: () => window.dispatchEvent(new CustomEvent('q56:toggle-theme', { detail: { theme: theme.id } })),
      }, [theme.emoji, ' ', theme.label]);
      themePicker.appendChild(btn);
    });
    card.appendChild(themePicker);

    // دکمه خروج
    const logoutBtn = el('button', {
      class: 'btn btn--ghost btn--block',
      type: 'button',
      onclick: async () => {
        logoutBtn.classList.add('btn--loading');
        await signOut();
        logoutBtn.classList.remove('btn--loading');
      },
    }, 'خروج از حساب');
    
    card.appendChild(logoutBtn);
    wrapper.appendChild(card);

  } else {
    // --- حالت ورود / ثبت‌نام ---
    const card = el('div', { class: 'auth-card' });
    
    card.appendChild(
      el('div', { class: 'auth-header' }, [
        el('div', { class: 'auth-header__icon' }, [
          el('svg', { viewBox: '0 0 24 24', html: '<path d="M12 21S3.5 15.5 3.5 9.4A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.6C20.5 15.5 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.6"/>' })
        ]),
        el('h2', { text: isSignupMode ? 'ثبت‌نام' : 'ورود' }),
        el('p', { text: isSignupMode ? 'یک حساب جدید برای خود بسازید' : 'به حساب خود وارد شوید' }),
      ])
    );

    const form = el('form', { class: 'auth-form' });

    if (isSignupMode) {
      form.appendChild(
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'auth-name', text: 'نام نمایشی' }),
          el('input', { class: 'form-input', id: 'auth-name', type: 'text', placeholder: 'مثلاً: سارا', required: 'true' }),
        ])
      );
    }

    form.appendChild(
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label', for: 'auth-email', text: 'ایمیل' }),
        el('input', { class: 'form-input', id: 'auth-email', type: 'email', placeholder: 'name@example.com', required: 'true' }),
      ])
    );

    form.appendChild(
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label', for: 'auth-password', text: 'رمز عبور' }),
        el('input', { class: 'form-input', id: 'auth-password', type: 'password', placeholder: '••••••••', required: 'true', minlength: '6' }),
      ])
    );

    const submitBtn = el('button', {
      class: 'btn btn--primary btn--block mt-4',
      type: 'submit',
      text: isSignupMode ? 'ثبت‌نام' : 'ورود',
    });

    form.appendChild(submitBtn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = $('#auth-email', form).value.trim();
      const password = $('#auth-password', form).value;
      const name = isSignupMode ? $('#auth-name', form).value.trim() : null;

      if (!email || !password) return;

      submitBtn.classList.add('btn--loading');

      try {
        if (isSignupMode) {
          await signUp(email, password, name);
          successToast('ثبت‌نام موفقیت‌آمیز بود. خوش آمدید!');
        } else {
          await signIn(email, password);
          successToast('خوش آمدید!');
        }
      } catch (error) {
        errorToast(error.message || 'خطایی رخ داد');
      } finally {
        submitBtn.classList.remove('btn--loading');
      }
    });

    card.appendChild(form);

    // دکمه تغییر حالت
    const switchDiv = el('div', { class: 'auth-switch' }, [
      el('span', { text: isSignupMode ? 'حساب دارید؟' : 'حساب ندارید؟' }),
      el('button', {
        type: 'button',
        text: isSignupMode ? 'وارد شوید' : 'ثبت‌نام کنید',
        onclick: () => {
          isSignupMode = !isSignupMode;
          renderAuthView();
        },
      }),
    ]);
    card.appendChild(switchDiv);

    wrapper.appendChild(card);
  }

  container.appendChild(wrapper);
}