import { supabase } from './supabase.js';
import { $ } from './utils.js';
import { toast, setLoading } from './ui.js';

let bound = false;

function setMessage(el, text, kind = 'error') {
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.className = `auth-message ${kind === 'success' ? 'auth-success' : 'auth-error'}`;
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#auth-signin')?.classList.toggle('active', tab === 'signin');
  $('#auth-signup')?.classList.toggle('active', tab === 'signup');
  setMessage($('#auth-error'), '');
  setMessage($('#auth-success'), '');
}

export function showAuthScreen() {
  const splash = $('#splash');
  splash?.classList.add('hide');
  
  const auth = $('#auth-screen');
  const app = $('#app');
  
  if (auth) auth.classList.add('is-active');
  if (app) app.classList.remove('is-active');
}

export function hideAuthScreen() {
  const auth = $('#auth-screen');
  const app = $('#app');
  
  if (auth) auth.classList.remove('is-active');
  if (app) app.classList.add('is-active');
  
  document.getElementById('splash')?.classList.add('hide');
}

export function bindAuthForms() {
  if (bound) return;
  bound = true;

  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#auth-signin')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#signin-email').value.trim();
    const password = $('#signin-password').value;
    const errEl = $('#auth-error');
    setMessage(errEl, '');
    if (!email || !password) {
      setMessage(errEl, 'ایمیل و رمز عبور را وارد کن.');
      return;
    }
    const btn = event.submitter || event.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast('خوش آمدی! 🌟', 'success');
    } catch (err) {
      setMessage(errEl, translateAuthError(err.message));
    } finally {
      setLoading(btn, false);
    }
  });

  $('#auth-signup')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#signup-name').value.trim();
    const email = $('#signup-email').value.trim();
    const password = $('#signup-password').value;
    const errEl = $('#auth-error');
    const okEl = $('#auth-success');
    setMessage(errEl, '');
    setMessage(okEl, '');
    if (!name) { setMessage(errEl, 'یک نام نمایشی انتخاب کن.'); return; }
    if (!email) { setMessage(errEl, 'ایمیل را وارد کن.'); return; }
    if (password.length < 6) { setMessage(errEl, 'رمز عبور باید حداقل ۶ کاراکتر باشد.'); return; }

    const btn = event.submitter || event.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
      if (data?.user && !data.session) {
        setMessage(okEl, 'حسابت ساخته شد! لینک تأیید را در ایمیلت بررسی کن. 📬', 'success');
      } else {
        setMessage(okEl, 'حساب ساخته شد! در حال ورود...', 'success');
      }
      toast('به شادی‌یار خوش آمدی! ✨', 'success');
    } catch (err) {
      setMessage(errEl, translateAuthError(err.message));
    } finally {
      setLoading(btn, false);
    }
  });

  $('#magic-link-btn')?.addEventListener('click', async () => {
    const email = $('#signin-email').value.trim();
    const errEl = $('#auth-error');
    const okEl = $('#auth-success');
    setMessage(errEl, '');
    setMessage(okEl, '');
    if (!email) { setMessage(errEl, 'برای ورود با لینک جادویی، اول ایمیلت را وارد کن.'); return; }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
      });
      if (error) throw error;
      setMessage(okEl, 'لینک ورود به ایمیلت ارسال شد. ✨', 'success');
    } catch (err) {
      setMessage(errEl, translateAuthError(err.message));
    }
  });

  $('#forgot-btn')?.addEventListener('click', async () => {
    const email = $('#signin-email').value.trim();
    const errEl = $('#auth-error');
    const okEl = $('#auth-success');
    setMessage(errEl, '');
    setMessage(okEl, '');
    if (!email) { setMessage(errEl, 'اول ایمیلت را وارد کن.'); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      });
      if (error) throw error;
      setMessage(okEl, 'لینک بازیابی رمز عبور به ایمیلت ارسال شد. 📬', 'success');
    } catch (err) {
      setMessage(errEl, translateAuthError(err.message));
    }
  });
}

function translateAuthError(message = '') {
  const map = {
    'Invalid login credentials': 'ایمیل یا رمز عبور اشتباه است.',
    'Email not confirmed': 'ایمیلت هنوز تأیید نشده است. صندوق ورودی را بررسی کن.',
    'User already registered': 'این ایمیل قبلاً ثبت‌نام کرده است.',
    'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
    'Unable to validate email address: invalid format': 'فرمت ایمیل معتبر نیست.',
    'Signups not allowed for this instance': 'ثبت‌نام در حال حاضر غیرفعال است.',
    'Email rate limit exceeded': 'تعداد درخواست‌ها زیاد است. کمی صبر کن.',
  };
  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }
  return message || 'خطایی رخ داد. دوباره تلاش کن.';
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn(err);
  }
  toast('خدانگهدار! 👋', 'info');
}
