/* ============================================================
   Password reset flow — forgot + set new
   ============================================================ */
import { sb } from '../supabase.js';
import { el } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { notify } from './toast.js';

export function openForgotPasswordModal({ defaultEmail = '' } = {}) {
  return new Promise((resolve) => {
    const emailInput = el('input', {
      type: 'email', class: 'input',
      placeholder: 'name@example.com',
      dir: 'ltr', style: { textAlign: 'left' },
      value: defaultEmail,
    });
    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };

    const sendBtn = el('button', {
      type: 'button', class: 'btn btn--primary btn--lg',
      html: `${icon('external', 16)}<span>ارسال لینک</span>`,
    });
    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--lg', text: 'انصراف',
    });

    const body = el('div', { class: 'entity-form' }, [
      el('p', {
        style: { fontSize: 'var(--fs-sm)', color: 'var(--text-3)', lineHeight: '1.7', margin: 0 },
        text: 'ایمیلت را وارد کن. لینک بازنشانی رمز برایت ارسال می‌شود.',
      }),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', html: 'ایمیل<span class="req">*</span>' }),
        emailInput,
      ]),
    ]);

    const { close } = mountModal({
      title: 'بازیابی رمز عبور',
      subtitle: 'ما یک لینک امن برایت ایمیل می‌کنیم',
      size: 'sm',
      body,
      footer: [cancelBtn, sendBtn],
      onClose: () => finish(false),
    });

    cancelBtn.addEventListener('click', () => { finish(false); close(); });

    sendBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.style.borderColor = 'var(--shit-border)';
        setTimeout(() => { emailInput.style.borderColor = ''; }, 1200);
        return;
      }
      sendBtn.classList.add('is-loading');
      sendBtn.disabled = true;
      try {
        const redirectTo = `${window.location.origin}${window.location.pathname}?reset=1`;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        notify.success('لینک بازنشانی ارسال شد. ایمیلت را چک کن.');
        finish(true);
        close();
      } catch (err) {
        notify.error(err?.message || 'ارسال ناموفق بود');
        sendBtn.classList.remove('is-loading');
        sendBtn.disabled = false;
      }
    });

    setTimeout(() => emailInput.focus(), 60);
  });
}

export function openSetNewPasswordModal() {
  return new Promise((resolve) => {
    const passInput = el('input', {
      type: 'password', class: 'input',
      placeholder: '••••••••',
      dir: 'ltr', style: { textAlign: 'left', paddingInlineEnd: '40px' },
      autocomplete: 'new-password',
    });
    const confirmInput = el('input', {
      type: 'password', class: 'input',
      placeholder: '••••••••',
      dir: 'ltr', style: { textAlign: 'left' },
      autocomplete: 'new-password',
    });

    const strength = el('div', { class: 'password-strength' });
    function updateStrength() {
      const p = passInput.value;
      let score = 0;
      if (p.length >= 6) score++;
      if (p.length >= 10) score++;
      if (/[A-Z]/.test(p)) score++;
      if (/[0-9]/.test(p)) score++;
      if (/[^A-Za-z0-9]/.test(p)) score++;
      strength.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        strength.appendChild(el('span', {
          class: 'password-strength__seg' + (i < score ? ' is-on' : ''),
          style: { background: i < score
            ? (score >= 4 ? 'var(--good)' : score >= 3 ? 'var(--bad)' : 'var(--shit)')
            : 'var(--surface-3)' },
        }));
      }
    }
    passInput.addEventListener('input', updateStrength);

    const saveBtn = el('button', {
      type: 'button', class: 'btn btn--primary btn--lg',
      html: `${icon('check', 16)}<span>ذخیره رمز جدید</span>`,
    });
    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--lg', text: 'انصراف',
    });

    const body = el('div', { class: 'entity-form' }, [
      el('p', {
        style: { fontSize: 'var(--fs-sm)', color: 'var(--text-3)', lineHeight: '1.7', margin: 0 },
        text: 'رمز عبور جدیدت را وارد کن (حداقل ۶ کاراکتر).',
      }),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', html: 'رمز جدید<span class="req">*</span>' }),
        passInput,
        strength,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', html: 'تکرار رمز<span class="req">*</span>' }),
        confirmInput,
      ]),
    ]);

    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };

    const { close } = mountModal({
      title: 'تعیین رمز جدید',
      subtitle: 'یک رمز قوی انتخاب کن',
      size: 'sm',
      body,
      footer: [cancelBtn, saveBtn],
      onClose: () => finish(false),
    });

    cancelBtn.addEventListener('click', () => { finish(false); close(); });

    saveBtn.addEventListener('click', async () => {
      const p1 = passInput.value;
      const p2 = confirmInput.value;
      if (p1.length < 6) {
        notify.error('رمز باید حداقل ۶ کاراکتر باشد');
        return;
      }
      if (p1 !== p2) {
        notify.error('رمزها یکسان نیستند');
        confirmInput.style.borderColor = 'var(--shit-border)';
        setTimeout(() => { confirmInput.style.borderColor = ''; }, 1200);
        return;
      }
      saveBtn.classList.add('is-loading');
      saveBtn.disabled = true;
      try {
        const { error } = await sb.auth.updateUser({ password: p1 });
        if (error) throw error;
        notify.success('رمز عبور به‌روزرسانی شد');
        finish(true);
        close();
      } catch (err) {
        notify.error(err?.message || 'ذخیره ناموفق بود');
        saveBtn.classList.remove('is-loading');
        saveBtn.disabled = false;
      }
    });

    setTimeout(() => passInput.focus(), 60);
  });
}

export function isRecoveryCallback() {
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (/type=recovery/.test(hash)) return true;
    if (/type=recovery/.test(search)) return true;
    if (/[?&]reset=1/.test(search) || /[?&]reset=1/.test(hash)) return true;
  } catch {}
  return false;
}

export function clearRecoveryUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    if (url.hash && /type=recovery/.test(url.hash)) url.hash = '';
    window.history.replaceState({}, '', url.pathname + (url.search || ''));
  } catch {}
}
