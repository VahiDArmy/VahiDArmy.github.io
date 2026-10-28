/**
 * Madacto Login Page
 */

import { supabase } from '../services/api.js';

export function renderLogin(root, onSuccess) {
  const isSignup = window.location.hash === '#/signup';

  root.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h1>${isSignup ? 'ثبت‌نام در ماداکتو' : 'ورود به ماداکتو'}</h1>
        <p>برای رزرو غذا وارد حساب خود شوید.</p>
        <form id="auth-form">
          <div class="input-group">
            <label>ایمیل</label>
            <input type="email" id="email" dir="ltr" required>
          </div>
          <div class="input-group">
            <label>رمز عبور</label>
            <input type="password" id="password" dir="ltr" required>
          </div>
          <button type="submit" class="btn btn--primary" style="width:100%;margin-top:8px">
            ${isSignup ? 'ثبت‌نام' : 'ورود'}
          </button>
        </form>
        <div style="text-align:center;margin-top:16px;font-size:13px">
          ${isSignup 
            ? `حساب دارید؟ <a href="#/">وارد شوید</a>` 
            : `حساب ندارید؟ <a href="#/signup">ثبت‌نام کنید</a>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pwd = document.getElementById('password').value;
    const btn = e.target.querySelector('button');
    btn.textContent = 'در حال پردازش...';
    btn.disabled = true;

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password: pwd });
        if (error) throw error;
        alert('ایمیل تأیید ارسال شد. لطفاً پس از تأیید وارد شوید.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      alert(err.message);
      btn.textContent = isSignup ? 'ثبت‌نام' : 'ورود';
      btn.disabled = false;
    }
  };
}