/* ============================================================
   js/features/settings/account-section.js
   Email, password, delete account
   ============================================================ */

import { el } from '../../utils/dom.js';
import * as authService from '../../services/auth.service.js';
import { sessionStore } from '../../core/store.js';
import { toast } from '../../ui/toast.js';
import { confirm, prompt } from '../../ui/confirm.js';
import { setButtonLoading } from '../../ui/loader.js';
import { validateEmail, validatePassword } from '../../utils/validation.js';

/**
 * @returns {HTMLElement}
 */
export function accountSection() {
  const section = el('section', { class: 'settings-section settings-section--danger-zone' });

  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [
      el('h2', { class: 'settings-section__title' }, {
        children: [el('span', {}, { children: ['🔐'] }), 'حساب و امنیت'],
      }),
      el('p', { class: 'settings-section__subtitle' }, {
        children: ['مدیریت ایمیل، رمز عبور، و حذف حساب.'],
      }),
    ],
  }));

  const body = el('div', { class: 'settings-section__body' });
  const user = sessionStore.get('user');
  if (!user) return section;

  /* Email */
  const emailRow = el('div', { class: 'settings-item' });
  const emailInfo = el('div', { class: 'settings-item__info' });
  emailInfo.appendChild(el('div', { class: 'settings-item__label' }, { children: ['ایمیل'] }));
  emailInfo.appendChild(el('div', { class: 'settings-item__value', attrs: { dir: 'ltr' } }, { children: [user.email || '—'] }));
  emailRow.appendChild(emailInfo);

  const changeEmailBtn = el('button', {
    class: 'btn btn--ghost btn--sm',
    attrs: { type: 'button' },
  }, { children: ['تغییر ایمیل'] });
  changeEmailBtn.addEventListener('click', async () => {
    const next = await prompt({
      title: 'تغییر ایمیل',
      message: 'ایمیل جدید را وارد کن. اگر تأییدیه فعال باشد، یک ایمیل تأیید دریافت می‌کنی.',
      placeholder: 'new@example.com',
      validate: (v) => validateEmail(v).valid ? null : 'ایمیل معتبر نیست.',
    });
    if (!next) return;
    try {
      await authService.updateEmail(next);
      toast.success('اگر تأییدیه فعال باشد، ایمیل تأیید ارسال شد.');
    } catch (err) { toast.error(err.message); }
  });
  emailRow.appendChild(changeEmailBtn);
  body.appendChild(emailRow);

  /* Password */
  const passRow = el('div', { class: 'settings-item' });
  const passInfo = el('div', { class: 'settings-item__info' });
  passInfo.appendChild(el('div', { class: 'settings-item__label' }, { children: ['رمز عبور'] }));
  passInfo.appendChild(el('div', { class: 'settings-item__value' }, { children: ['••••••••'] }));
  passRow.appendChild(passInfo);

  const changePassBtn = el('button', {
    class: 'btn btn--ghost btn--sm',
    attrs: { type: 'button' },
  }, { children: ['تغییر رمز'] });
  changePassBtn.addEventListener('click', async () => {
    const newPass = await prompt({
      title: 'تغییر رمز عبور',
      message: 'رمز جدید را وارد کن (حداقل ۸ کاراکتر).',
      placeholder: '••••••••',
      validate: (v) => validatePassword(v).valid ? null : 'رمز حداقل ۸ کاراکتر باشد.',
    });
    if (!newPass) return;
    try {
      await authService.updatePassword(newPass);
      toast.success('رمز عبور تغییر کرد.');
    } catch (err) { toast.error(err.message); }
  });
  passRow.appendChild(changePassBtn);
  body.appendChild(passRow);

  /* Danger zone */
  const dangerZone = el('div', { class: 'danger-zone' });
  dangerZone.appendChild(el('div', { class: 'danger-zone__head' }, {
    children: [
      el('span', { class: 'danger-zone__icon' }, { children: ['⚠️'] }),
      el('h3', { class: 'danger-zone__title' }, { children: ['منطقهٔ خطر'] }),
    ],
  }));
  dangerZone.appendChild(el('p', { class: 'danger-zone__desc' }, {
    children: ['حذف حساب برای همیشه است و تمامی داده‌های تو (دروغ‌ها، برچسب‌ها، بازتاب‌ها) پاک می‌شود. این عملیات قابل بازگشت نیست.'],
  }));

  const deleteBtn = el('button', {
    class: 'btn btn--danger',
    attrs: { type: 'button' },
  }, { children: ['🗑️ حذف کامل حساب'] });
  deleteBtn.addEventListener('click', async () => {
    const ok = await confirm({
      title: 'حذف کامل حساب',
      message: 'برای تأیید، رمز عبور خود را وارد کن و عبارت «حذف حساب» را بنویس. تمام داده‌ها برای همیشه پاک می‌شوند.',
      confirmLabel: 'حذف قطعی حساب',
      variant: 'danger',
      requireTyping: 'حذف حساب',
    });
    if (!ok) return;

    const password = await prompt({
      title: 'تأیید رمز عبور',
      message: 'برای اطمینان، رمز عبور فعلی خود را وارد کن.',
      placeholder: '••••••••',
      okLabel: 'حذف حساب',
    });
    if (!password) return;

    setButtonLoading(deleteBtn, true, 'در حال حذف…');
    try {
      await authService.deleteAccount(password);
      toast.success('حساب حذف شد. خدانگهدار.');
    } catch (err) {
      toast.error(err.message || 'خطا در حذف حساب');
      setButtonLoading(deleteBtn, false);
    }
  });
  dangerZone.appendChild(deleteBtn);

  body.appendChild(dangerZone);

  section.appendChild(body);
  return section;
}

export default { accountSection };