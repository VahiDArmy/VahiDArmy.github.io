/**
 * Madacto Login Page
 */

import { supabase } from '../services/api.js';
import { showToast } from '../utils/ui.js';

export function renderLogin(root, onSuccess) {
  const isSignup = window.location.hash === '#/signup';

  // Build the exact redirect URL for email confirmation
  const baseUrl = window.location.origin + window.location.pathname;
  const redirectUrl = `${baseUrl}#/auth/callback`;

  root.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h1>${isSignup ? 'ثبت‌نام در ماداکتو' : 'ورود به ماداکتو'}</h1>
        <p>برای رزرو غذا وارد حساب خود شوید.</p>
        <form id="auth-form">
          
          ${isSignup ? `
          <div class="input-group">
            <label for="name-input">نام نمایشی</label>
            <input type="text" id="name-input" required autocomplete="name" placeholder="مثلاً: مایکل اسکات">
          </div>
          ` : ''}

          <div class="input-group">
            <label for="email-input">ایمیل</label>
            <input type="email" id="email-input" dir="ltr" autocomplete="email" required>
          </div>
          <div class="input-group">
            <label for="pwd-input">رمز عبور</label>
            <input type="password" id="pwd-input" dir="ltr" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required>
          </div>
          <button type="submit" class="btn btn--primary" style="width:100%;margin-top:8px">
            ${isSignup ? 'ثبت‌نام' : 'ورود'}
          </button>
        </form>
        <div style="text-align:center;margin-top:16px;font-size:13px">
          ${isSignup 
            ? `حساب دارید؟ <a href="#/login">وارد شوید</a>` 
            : `حساب ندارید؟ <a href="#/signup">ثبت‌نام کنید</a>`}
          <br><br>
          <a href="#/" style="color: var(--text-tertiary); font-size: 12px;">&rarr; بازگشت به جدول غذا (مشاهده به عنوان مهمان)</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email-input').value;
    const pwd = document.getElementById('pwd-input').value;
    const btn = e.target.querySelector('button');

    let displayName = '';
    if (isSignup) {
      displayName = document.getElementById('name-input').value.trim();
      if (!displayName) {
        return showToast('نام نمایشی الزامی است.', 'error');
      }
    }
    
    btn.textContent = 'در حال پردازش...';
    btn.disabled = true;

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password: pwd,
          options: {
            data: {
              display_name: displayName
            },
            emailRedirectTo: redirectUrl // <--- هدایت به سایت ماداکتو
          }
        });
        if (error) throw error;
        showToast('ایمیل تأیید ارسال شد. لطفاً پس از تأیید وارد شوید.', 'success');
        window.location.hash = '#/login';
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.textContent = isSignup ? 'ثبت‌نام' : 'ورود';
      btn.disabled = false;
    }
  };
}