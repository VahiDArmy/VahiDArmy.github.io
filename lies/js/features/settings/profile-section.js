/* ============================================================
   js/features/settings/profile-section.js
   COMPLETE FILE - NO TRUNCATION.
   Added Share Link UI.
   ============================================================ */

import { el } from '../../utils/dom.js';
import * as authService from '../../services/auth.service.js';
import * as suggestionsService from '../../services/suggestions.service.js';
import { sessionStore } from '../../core/store.js';
import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';
import { COLOR_PALETTE } from '../../config/constants.js';
import { toast } from '../../ui/toast.js';
import { setButtonLoading } from '../../ui/loader.js';
import { avatar } from '../../ui/avatar.js';
import { validateDisplayName } from '../../utils/validation.js';
import { confirm } from '../../ui/confirm.js';

export function profileSection() {
  const section = el('section', { class: 'settings-section' });
  
  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [el('h2', { class: 'settings-section__title' }, { children: [el('span', {}, { children: ['👤'] }), 'پروفایل'] })],
  }));

  const body = el('div', { class: 'settings-section__body' });
  const state = sessionStore.getState();
  const user = state.user;
  const profile = state.profile || {};
  if (!user) return section;

  const name = profile.display_name || user.email?.split('@')[0] || '';
  const email = user.email || '';
  const initialColor = profile.avatar_color || COLOR_PALETTE[0];

  // Avatar Preview
  const previewRow = el('div', { class: 'profile-preview' });
  const avatarWrap = el('div', { class: 'profile-preview__avatar' });
  const avatarEl = avatar({ name, color: initialColor, size: 'xl', ring: true });
  avatarWrap.appendChild(avatarEl);
  previewRow.appendChild(avatarWrap);

  const previewInfo = el('div', { class: 'profile-preview__info' });
  previewInfo.appendChild(el('div', { class: 'profile-preview__name' }, { children: [name || '—'] }));
  previewInfo.appendChild(el('div', { class: 'profile-preview__email' }, { children: [email] }));
  previewRow.appendChild(previewInfo);
  body.appendChild(previewRow);

  // Display name
  const nameField = el('div', { class: 'field' });
  nameField.appendChild(el('label', { class: 'field__label' }, { children: ['نام نمایشی'] }));
  const nameInput = el('input', { class: 'input', attrs: { type: 'text', maxlength: '40' } });
  nameInput.value = name;
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  // Bio
  const bioField = el('div', { class: 'field' });
  bioField.appendChild(el('label', { class: 'field__label' }, { children: ['درباره من (اختیاری)'] }));
  const bioInput = el('textarea', { class: 'textarea', attrs: { rows: 3, maxlength: '400' } });
  bioInput.value = profile.bio || '';
  bioField.appendChild(bioInput);
  body.appendChild(bioField);

  // Avatar Color
  const colorField = el('div', { class: 'field' });
  colorField.appendChild(el('label', { class: 'field__label' }, { children: ['رنگ آواتار'] }));
  const colorWrap = el('div', { class: 'color-picker' });
  let selectedColor = initialColor;
  for (const c of COLOR_PALETTE) {
    const b = el('button', { class: ['color-picker__item', c === selectedColor ? 'is-active' : ''].filter(Boolean), style: { background: c } });
    b.addEventListener('click', () => {
      selectedColor = c;
      colorWrap.querySelectorAll('.color-picker__item').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
      avatarEl.style.setProperty('--avatar-color', c);
    });
    colorWrap.appendChild(b);
  }
  colorField.appendChild(colorWrap);
  body.appendChild(colorField);

  const saveBtn = el('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, { children: ['ذخیره پروفایل'] });
  saveBtn.addEventListener('click', async () => {
    const nameRes = validateDisplayName(nameInput.value);
    if (!nameRes.valid) return toast.error(nameRes.message);

    setButtonLoading(saveBtn, true, 'در حال ذخیره…');
    try {
      await authService.updateProfile({ display_name: nameRes.value, bio: bioInput.value.trim(), avatar_color: selectedColor });
      const updated = await authService.getProfile();
      sessionStore.set({ profile: updated });
      toast.success('پروفایل ذخیره شد.');
    } catch (err) { toast.error(err.message); } finally { setButtonLoading(saveBtn, false); }
  });
  body.appendChild(el('div', { class: 'settings-section__actions' }, { children: [saveBtn] }));

  // 🛡️ SHARE LINK SECTION
  const shareCard = el('div', { style: { marginTop: '32px', padding: '20px', background: 'var(--bg-inset)', borderRadius: '12px', border: '1px solid var(--border)' } });
  shareCard.appendChild(el('h3', { style: { fontSize: '16px', marginBottom: '8px' } }, { children: ['🔗 لینک دریافت پیشنهاد ناشناس'] }));
  shareCard.appendChild(el('p', { style: { fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' } }, {
    children: ['این لینک را برای دوستانتان بفرستید تا بتوانند بدون نیاز به ثبت‌نام، نظر خود را درباره دروغ‌های شما بگویند.']
  }));

  const linkWrap = el('div', { style: { display: 'flex', gap: '8px' } });
  const linkInput = el('input', { class: 'input', attrs: { type: 'text', readonly: 'true' } });
  const copyBtn = el('button', { class: 'btn btn--surface' }, { children: ['کپی'] });
  const resetBtn = el('button', { class: 'btn btn--danger btn--sm', attrs: { title: 'ساخت لینک جدید (لینک قبلی منقضی می‌شود)' } }, { children: ['🔄'] });

  linkWrap.appendChild(linkInput);
  linkWrap.appendChild(copyBtn);
  linkWrap.appendChild(resetBtn);
  shareCard.appendChild(linkWrap);
  body.appendChild(shareCard);

  // Load Token asynchronously
  suggestionsService.getShareToken().then(token => {
    if (token) {
      const url = `${window.location.origin}${window.location.pathname}#/suggest/${token}`;
      linkInput.value = url;
    }
  }).catch(() => { linkInput.value = 'خطا در دریافت لینک'; });

  copyBtn.addEventListener('click', () => {
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value);
    toast.success('لینک کپی شد.');
  });

  resetBtn.addEventListener('click', async () => {
    const ok = await confirm({ title: 'لینک جدید', message: 'با این کار لینک قبلی منقضی شده و دیگر کار نمی‌کند. ادامه می‌دهید؟', variant: 'danger' });
    if (!ok) return;
    try {
      const newToken = await suggestionsService.regenerateShareToken();
      linkInput.value = `${window.location.origin}${window.location.pathname}#/suggest/${newToken}`;
      toast.success('لینک جدید ساخته شد.');
    } catch (err) { toast.error(err.message); }
  });

  section.appendChild(body);
  return section;
}