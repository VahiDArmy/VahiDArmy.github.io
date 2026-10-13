/**
 * app.js — نقطه ورود برنامه
 * - راه‌اندازی تم
 * - راه‌اندازی Supabase و احراز هویت
 * - مسیریابی صفحات
 * - ناوبری روز (با swipe)
 * - FAB، منوی موضوع، منوی پروفایل
 */

import { $, el, clear, hide, show, on, addClass, removeClass, setVisible } from './utils/dom.js';
import { toast } from './components/toast.js';
import { attachDropdown } from './components/dropdown.js';
import { openDatePicker } from './components/datepicker.js';
import { openSettings } from './pages/settings.js';
import { renderDashboard, renderSubjectPage, routeToSubjectKey } from './pages/dashboard.js';
import { renderReport } from './pages/report.js';
import * as authSvc from './services/auth.service.js';
import { isConfigured, getSupabase } from './config/supabase.js';
import { bus, EVENTS } from './utils/events.js';
import { storage } from './utils/storage.js';
import { LS_KEYS, APP, MEALS } from './config/constants.js';
import { todayISO, addDays, isToday, weekdayName, formatJalali, toISO } from './utils/date.js';
import { validateLogin, validateSignup, applyErrors } from './utils/validators.js';
import { initials } from './utils/format.js';

/* =========================================================================
   State
   ========================================================================= */

const state = {
  page: 'dashboard',
  date: todayISO(),
  user: null,
  profile: null,
};

/* =========================================================================
   Boot
   ========================================================================= */

async function boot() {
  initTheme();
  initAuthScreen();
  initHeaderUI();
  initDateBar();
  initFab();
  initSwipe();

  // شروع راه‌اندازی احراز هویت
  try {
    await authSvc.init();
  } catch (e) {
    console.warn('[app] auth init:', e?.message);
  }

  // پیوند وضعیت
  bus.on(EVENTS.AUTH_SIGNED_IN, ({ user, profile }) => {
    state.user = user;
    state.profile = profile;
    enterApp();
  });

  bus.on(EVENTS.AUTH_SIGNED_OUT, () => {
    state.user = null;
    state.profile = null;
    showAuthScreen();
  });

  bus.on(EVENTS.RECORD_CREATED, () => refreshCurrentPage());
  bus.on(EVENTS.RECORD_UPDATED, () => refreshCurrentPage());
  bus.on(EVENTS.RECORD_DELETED, () => refreshCurrentPage());

  // بررسی وضعیت اولیه
  if (!isConfigured()) {
    await waitBoot();
    hideBoot();
    showAuthScreen();
    showConfigWarning();
    return;
  }

  await waitBoot();

  if (authSvc.isAuthenticated()) {
    state.user = authSvc.currentUser();
    state.profile = authSvc.currentProfile();
    enterApp();
  } else {
    hideBoot();
    showAuthScreen();
  }
}

function waitBoot() {
  return new Promise((r) => setTimeout(r, 500));
}

function hideBoot() {
  const bootEl = $('#boot-screen');
  if (!bootEl) return;
  bootEl.style.transition = 'opacity 300ms';
  bootEl.style.opacity = '0';
  setTimeout(() => bootEl.remove(), 320);
}

/* =========================================================================
   Theme
   ========================================================================= */

function initTheme() {
  const saved = storage.get(LS_KEYS.theme);
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const btn = $('#theme-toggle');
  btn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    storage.set(LS_KEYS.theme, next);
    bus.emit(EVENTS.THEME_CHANGE, next);
  });
}

/* =========================================================================
   Auth Screen
   ========================================================================= */

function showAuthScreen() {
  hide($('#app-shell'));
  show($('#auth-screen'));
  $('#auth-screen')?.setAttribute('aria-hidden', 'false');
}

function enterApp() {
  hide($('#auth-screen'));
  show($('#app-shell'));
  $('#app-shell')?.setAttribute('aria-hidden', 'false');

  updateProfileUI();
  navigate('dashboard');
}

function initAuthScreen() {
  // Tabs
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const tabsContainer = document.querySelector('.auth-tabs');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('is-active'));
      t.classList.add('is-active');
      const which = t.dataset.authTab;
      tabsContainer?.setAttribute('data-active', which);
      setVisible($('#login-form'), which === 'login');
      setVisible($('#signup-form'), which === 'signup');
    });
  });

  // Password visibility
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.togglePassword;
      const input = document.getElementById(id);
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      btn.textContent = visible ? '👁' : '🙈';
    });
  });

  // Login
  const loginForm = $('#login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('[name="email"]').value.trim();
    const password = loginForm.querySelector('[name="password"]').value;
    const result = validateLogin({ email, password });
    applyErrors(loginForm, result.errors);
    if (!result.ok) return;

    const submitBtn = $('#login-submit');
    setLoading(submitBtn, true);
    const res = await authSvc.login(email, password);
    setLoading(submitBtn, false);

    if (!res.ok) {
      toast.error('ورود ناموفق', res.error);
      return;
    }
    toast.success('خوش آمدید!');
  });

  // Signup
  const signupForm = $('#signup-form');
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = signupForm.querySelector('[name="displayName"]').value.trim();
    const email = signupForm.querySelector('[name="email"]').value.trim();
    const password = signupForm.querySelector('[name="password"]').value;
    const password2 = signupForm.querySelector('[name="password2"]').value;

    const result = validateSignup({ displayName, email, password, password2 });
    applyErrors(signupForm, result.errors);
    if (!result.ok) return;

    const submitBtn = $('#signup-submit');
    setLoading(submitBtn, true);
    const res = await authSvc.register({ displayName, email, password });
    setLoading(submitBtn, false);

    if (!res.ok) {
      toast.error('ثبت‌نام ناموفق', res.error);
      return;
    }
    if (res.needsConfirmation) {
      toast.info('تأیید ایمیل', res.message);
      return;
    }
    toast.success('حساب ایجاد شد!');
  });

  // Signup password strength
  const pwInput = signupForm?.querySelector('[name="password"]');
  const meter = $('#pw-meter');
  pwInput?.addEventListener('input', async () => {
    const { passwordStrength } = await import('./utils/validators.js');
    const { score } = passwordStrength(pwInput.value);
    meter?.setAttribute('data-score', String(score));
  });

  // Forgot password
  $('#forgot-password-btn')?.addEventListener('click', async () => {
    const email = loginForm.querySelector('[name="email"]').value.trim();
    if (!email) {
      toast.warning('ابتدا ایمیل خود را وارد کنید');
      return;
    }
    const res = await authSvc.forgotPassword(email);
    if (res.ok) toast.success('ارسال شد', res.message);
    else toast.error('خطا', res.error);
  });
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('is-loading');
    btn.disabled = true;
    const spinner = btn.querySelector('.btn__spinner');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    btn.classList.remove('is-loading');
    btn.disabled = false;
    const spinner = btn.querySelector('.btn__spinner');
    if (spinner) spinner.classList.add('hidden');
  }
}

/* =========================================================================
   Profile UI
   ========================================================================= */

function updateProfileUI() {
  const name = state.profile?.display_name || state.user?.email?.split('@')[0] || 'کاربر';
  const av = $('#profile-avatar');
  const nm = $('#profile-name');
  if (av) av.textContent = initials(name);
  if (nm) nm.textContent = name;
}

/* =========================================================================
   Header
   ========================================================================= */

function initHeaderUI() {
  // Page subject dropdown
  const pageBtn = $('#page-subject-btn');
  if (pageBtn) {
    attachDropdown(pageBtn, {
      className: 'subject-menu',
      align: 'start',
      items: () => [
        { type: 'section', label: 'اصلی' },
        { label: 'داشبورد', icon: '🏠', active: state.page === 'dashboard', onClick: () => navigate('dashboard') },
        { label: 'گزارش جامع', icon: '📊', active: state.page === 'report', onClick: () => navigate('report') },
        { type: 'divider' },
        { type: 'section', label: 'ثبت فعالیت' },
        { label: 'انسولین', icon: '💉', active: state.page === 'insulin', onClick: () => navigate('insulin') },
        { label: 'قند خون', icon: '🩸', active: state.page === 'glucose', onClick: () => navigate('glucose') },
        { label: 'فشار خون', icon: '❤️', active: state.page === 'blood-pressure', onClick: () => navigate('blood-pressure') },
        { label: 'وزن', icon: '⚖️', active: state.page === 'weight', onClick: () => navigate('weight') },
        { label: 'خواب', icon: '🌙', active: state.page === 'sleep', onClick: () => navigate('sleep') },
        { label: 'ورزش', icon: '🏃', active: state.page === 'exercise', onClick: () => navigate('exercise') },
        { label: 'موارد دیگر', icon: '📝', active: state.page === 'other', onClick: () => navigate('other') },
      ],
    });
  }

  // Profile dropdown
  const profileBtn = $('#profile-btn');
  if (profileBtn) {
    attachDropdown(profileBtn, {
      align: 'end',
      items: () => [
        { type: 'header', label: state.user?.email || '' },
        { label: 'تنظیمات', icon: '⚙️', onClick: () => openSettings({ onChange: () => refreshCurrentPage() }) },
        { type: 'divider' },
        { label: 'خروج از حساب', icon: '🚪', danger: true, onClick: async () => {
          const { openConfirm } = await import('./components/modal.js');
          const ok = await openConfirm({ title: 'خروج از حساب', text: 'از حساب خود خارج می‌شوید؟', type: 'danger', confirmText: 'خروج' });
          if (ok) await authSvc.logout();
        } },
      ],
    });
  }

  // Settings button
  $('#settings-btn')?.addEventListener('click', () => {
    openSettings({ onChange: () => refreshCurrentPage() });
  });

  // Header scrolled
  window.addEventListener('scroll', () => {
    const header = $('#app-header');
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 6);
  }, { passive: true });
}

/* =========================================================================
   Date bar
   ========================================================================= */

function initDateBar() {
  $('#date-prev')?.addEventListener('click', () => shiftDate(-1));
  $('#date-next')?.addEventListener('click', () => shiftDate(1));
  $('#date-today')?.addEventListener('click', () => {
    state.date = todayISO();
    updateDateBar();
    refreshCurrentPage();
  });

  $('#date-current')?.addEventListener('click', (e) => {
    const anchor = e.currentTarget;
    openDatePicker({
      anchor,
      value: state.date,
      max: todayISO(),
      onSelect: (iso) => {
        state.date = iso;
        updateDateBar();
        refreshCurrentPage();
      },
    });
  });

  updateDateBar();
}

function shiftDate(delta) {
  const next = toISO(addDays(new Date(state.date), delta));
  if (next > todayISO()) return;
  state.date = next;
  updateDateBar();
  refreshCurrentPage();
}

function updateDateBar() {
  const wdEl = $('#date-weekday');
  const txtEl = $('#date-text');
  const badge = $('#date-today-badge');
  const nextBtn = $('#date-next');

  if (wdEl) wdEl.textContent = weekdayName(state.date);
  if (txtEl) txtEl.textContent = formatJalali(state.date);

  const today = isToday(state.date);
  badge?.classList.toggle('hidden', !today);
  if (nextBtn) nextBtn.disabled = today;
}

/* =========================================================================
   Navigation
   ========================================================================= */

export async function navigate(page) {
  state.page = page;
  document.title = `${pageTitle(page)} | ${APP.NAME}`;

  const iconEl = $('#page-subject-icon');
  const textEl = $('#page-subject-text');
  if (iconEl) iconEl.textContent = pageIcon(page);
  if (textEl) textEl.textContent = pageTitle(page);

  // ذخیره در URL (اختیاری)
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('p', page);
    url.searchParams.set('d', state.date);
    history.replaceState(null, '', url);
  } catch {}

  await renderPage();
}

async function renderPage() {
  const container = $('#page-container');
  if (!container) return;

  const ctx = {
    date: state.date,
    navigate,
    refresh: refreshCurrentPage,
  };

  container.innerHTML = '';

  try {
    if (state.page === 'dashboard') {
      await renderDashboard(container, ctx);
    } else if (state.page === 'report') {
      await renderReport(container, ctx);
    } else {
      const key = routeToSubjectKey(state.page);
      if (key) await renderSubjectPage(key, container, ctx);
      else await renderDashboard(container, ctx);
    }
  } catch (e) {
    console.error('[app] render error:', e);
    container.innerHTML = '';
    container.appendChild(buildError(e));
  }
}

function refreshCurrentPage() {
  renderPage();
}

function buildError(err) {
  const wrap = el('div', { class: 'empty-state' });
  wrap.appendChild(el('div', { class: 'empty-state__icon' }, ['⚠️']));
  wrap.appendChild(el('div', { class: 'empty-state__title' }, ['خطا در بارگذاری']));
  wrap.appendChild(el('div', { class: 'empty-state__text' }, [err?.message || '']));
  return wrap;
}

function pageTitle(page) {
  return {
    dashboard: 'داشبورد',
    report: 'گزارش جامع',
    insulin: 'انسولین',
    glucose: 'قند خون',
    'blood-pressure': 'فشار خون',
    weight: 'وزن',
    sleep: 'خواب',
    exercise: 'ورزش',
    other: 'موارد دیگر',
  }[page] || 'داشبورد';
}

function pageIcon(page) {
  return {
    dashboard: '📊',
    report: '📈',
    insulin: '💉',
    glucose: '🩸',
    'blood-pressure': '❤️',
    weight: '⚖️',
    sleep: '🌙',
    exercise: '🏃',
    other: '📝',
  }[page] || '📊';
}

/* =========================================================================
   FAB
   ========================================================================= */

function initFab() {
  const fab = $('#fab-quick-add');
  if (!fab) return;

  let open = false;
  let menuEl = null;

  function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    fab.classList.remove('is-open');
    open = false;
  }

  function buildMenu() {
    const menu = el('div', { class: 'fab-menu' });
    const items = [
      { icon: '💉', label: 'ثبت انسولین', page: 'insulin' },
      { icon: '🩸', label: 'ثبت قند خون', page: 'glucose' },
      { icon: '❤️', label: 'ثبت فشار خون', page: 'blood-pressure' },
      { icon: '⚖️', label: 'ثبت وزن', page: 'weight' },
      { icon: '🌙', label: 'ثبت خواب', page: 'sleep' },
      { icon: '🏃', label: 'ثبت ورزش', page: 'exercise' },
    ];
    for (const it of items) {
      const btn = el('button', { class: 'fab-menu__item', type: 'button' });
      btn.appendChild(el('span', { class: 'fab-menu__icon' }, [it.icon]));
      btn.appendChild(el('span', {}, [it.label]));
      btn.addEventListener('click', () => {
        navigate(it.page);
        closeMenu();
      });
      menu.appendChild(btn);
    }
    return menu;
  }

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) closeMenu();
    else {
      menuEl = buildMenu();
      document.body.appendChild(menuEl);
      fab.classList.add('is-open');
      open = true;
    }
  });

  document.addEventListener('click', (e) => {
    if (!open) return;
    if (menuEl && !menuEl.contains(e.target) && e.target !== fab) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

/* =========================================================================
   Swipe (ناوبری روز)
   ========================================================================= */

function initSwipe() {
  const target = $('#app-shell');
  if (!target) return;

  let startX = 0, startY = 0, startT = 0;
  let active = false;

  target.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    startT = Date.now();
    active = true;
  }, { passive: true });

  target.addEventListener('touchend', (e) => {
    if (!active) return;
    active = false;
    const dt = Date.now() - startT;
    if (dt > 600) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < 80) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    // RTL: کشیدن به راست = روز قبل، به چپ = روز بعد
    if (dx > 0) shiftDate(-1);
    else shiftDate(1);
  }, { passive: true });
}

/* =========================================================================
   Config warning
   ========================================================================= */

function showConfigWarning() {
  const screen = $('#auth-screen');
  if (!screen) return;
  const warn = el('div', {
    style: {
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--warning-bg)', color: 'var(--warning-fg)',
      padding: '10px 16px', borderRadius: '10px', fontSize: '13px',
      zIndex: '9999', border: '1px solid currentColor', maxWidth: '90vw',
      textAlign: 'center', lineHeight: '1.6',
    },
  }, [
    '⚠️ پیکربندی Supabase اعمال نشده است. ',
    el('br'),
    'مقادیر SUPABASE_URL و SUPABASE_ANON را در js/config/supabase.js تنظیم کنید.',
  ]);
  document.body.appendChild(warn);
}

/* =========================================================================
   Keyboard shortcuts
   ========================================================================= */

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'ArrowLeft')  shiftDate(1);
  else if (e.key === 'ArrowRight') shiftDate(-1);
  else if (e.key === 't' || e.key === 'T') {
    state.date = todayISO();
    updateDateBar();
    refreshCurrentPage();
  }
});

/* =========================================================================
   Go!
   ========================================================================= */

boot().catch((e) => {
  console.error('[boot] fatal:', e);
  hideBoot();
  document.body.innerHTML = `
    <div style="padding:40px;text-align:center;font-family:sans-serif;color:#eee">
      <h1>خطای راه‌اندازی</h1>
      <p>${e.message || 'مشکلی پیش آمد.'}</p>
    </div>
  `;
});