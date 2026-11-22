import { supabase } from '../lib/supabase.js';
import { Sound } from '../lib/sound.js';

export function renderAuth(container, onAuth) {
  container.hidden = false;
  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">MATRIX·3D</div>
      <div class="auth-tag">The three dimensional ranking cube.</div>
      <form id="auth-form" autocomplete="on">
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@domain.com">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" required minlength="6" placeholder="••••••••">
        </div>
        <div class="auth-error" id="auth-error"></div>
        <button type="submit" class="btn btn-primary btn-block" id="auth-submit" style="margin-top:8px">
          <i class="fa-solid fa-right-to-bracket"></i> Sign In
        </button>
      </form>
      <div class="auth-switch">
        <span id="auth-switch-text">No account?</span>
        <button id="auth-toggle" type="button">Create one</button>
      </div>
    </div>
  `;

  let mode = 'signin';
  const form = container.querySelector('#auth-form');
  const errEl = container.querySelector('#auth-error');
  const submitBtn = container.querySelector('#auth-submit');
  const toggleBtn = container.querySelector('#auth-toggle');
  const switchText = container.querySelector('#auth-switch-text');

  toggleBtn.onclick = () => {
    Sound.tap();
    mode = mode === 'signin' ? 'signup' : 'signin';
    submitBtn.innerHTML = mode === 'signin'
      ? '<i class="fa-solid fa-right-to-bracket"></i> Sign In'
      : '<i class="fa-solid fa-user-plus"></i> Create Account';
    toggleBtn.textContent = mode === 'signin' ? 'Create one' : 'Sign in';
    switchText.textContent = mode === 'signin' ? 'No account?' : 'Have an account?';
    errEl.classList.remove('on');
  };

  form.onsubmit = async e => {
    e.preventDefault();
    errEl.classList.remove('on');
    submitBtn.disabled = true;
    const fd = new FormData(form);
    const email = fd.get('email');
    const password = fd.get('password');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      Sound.glass(0.8);
      onAuth();
    } catch (err) {
      errEl.textContent = err.message || 'Authentication failed';
      errEl.classList.add('on');
      Sound.error();
    } finally {
      submitBtn.disabled = false;
    }
  };
}
