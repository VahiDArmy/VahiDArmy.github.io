// js/ui/auth.js
import { qs } from './dom.js';
import { toast } from './toast.js';
import {
  signInWithPassword, signUp, signInWithMagicLink,
} from '../services/auth.js';

export function initAuth() {
  const email = qs('#auth-email');
  const pass = qs('#auth-password');
  const err = qs('#auth-error');
  const signInBtn = qs('#auth-signin');
  const signUpBtn = qs('#auth-signup');
  const magicBtn = qs('#auth-magic');

  const setErr = (msg) => { err.textContent = msg || ''; };
  const setBusy = (b) => {
    signInBtn.disabled = b;
    signUpBtn.disabled = b;
    magicBtn.disabled = b;
  };

  signInBtn.addEventListener('click', async () => {
    setErr('');
    if (!email.value.trim() || !pass.value) return setErr('Email and password are required.');
    setBusy(true);
    try {
      await signInWithPassword(email.value.trim(), pass.value);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  });

  signUpBtn.addEventListener('click', async () => {
    setErr('');
    if (!email.value.trim() || !pass.value) return setErr('Email and password are required.');
    if (pass.value.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true);
    try {
      const data = await signUp(email.value.trim(), pass.value);
      if (!data.session) {
        toast('Account created. Check your email to confirm, then sign in.', 'success', 6000);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  });

  magicBtn.addEventListener('click', async () => {
    setErr('');
    if (!email.value.trim()) return setErr('Enter your email first.');
    setBusy(true);
    try {
      await signInWithMagicLink(email.value.trim());
      toast('Magic link sent. Check your inbox.', 'success', 5000);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  });

  pass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') signInBtn.click();
  });
}

export function showAuth() {
  qs('#auth-view').classList.remove('hidden');
  qs('#app-view').classList.add('hidden');
}

export function showApp() {
  qs('#auth-view').classList.add('hidden');
  qs('#app-view').classList.remove('hidden');
}
