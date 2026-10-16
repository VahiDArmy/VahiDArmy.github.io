/* ============================================================
   js/features/settings/profile-section.js
   Profile editor: display name, bio, avatar color
   FIXED: COLOR_PALETTE is imported from constants.js (not app.config.js)
   ============================================================ */

import { el } from '../../utils/dom.js';
import * as authService from '../../services/auth.service.js';
import { sessionStore } from '../../core/store.js';
import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';
import { COLOR_PALETTE } from '../../config/constants.js';    // ← FIXED
import { toast } from '../../ui/toast.js';
import { setButtonLoading } from '../../ui/loader.js';
import { avatar } from '../../ui/avatar.js';
import { validateDisplayName } from '../../utils/validation.js';

/**
 * @returns {HTMLElement}
 */
export function profileSection() {
  const section = el('section', { class: 'settings-section' });

  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [
      el('h2', { class: 'settings-section__title' }, {
        children: [el('span', {}, { children: ['👤'] }), 'پروفایل'],
      }),
      el('p', { class: 'settings-section__subtitle' }, {
        children: ['اطلاعاتی که فقط خودت می‌بینی.'],
      }),
    ],
  }));

  const body = el('div', { class: 'settings-section__body' });

  const state = sessionStore.getState();
  const user = state.user;
  const profile = state.profile || {};
  if (!user) return section;

  const name = profile.display_name || user.email?.split('@')[0] || '';
  const email = user.email || '';
  const initialColor = profile.avatar_color || COLOR_PALETTE[0];

  // Avatar preview
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
  const nameInput = el('input', {
    class: 'input',
    attrs: { type: 'text', maxlength: '40', placeholder: 'مثلاً: مسافر' },
  });
  nameInput.value = name;
  nameField.appendChild(nameInput);
  nameField.appendChild(el('p', { class: 'field__hint' }, { children: ['فقط برای خودت نمایش داده می‌شود.'] }));
  const nameErr = el('p', { class: 'field__error' });
  nameField.appendChild(nameErr);
  body.appendChild(nameField);

  // Bio
  const bioField = el('div', { class: 'field' });
  bioField.appendChild(el('label', { class: 'field__label' }, { children: ['درباره من (اختیاری)'] }));
  const bioInput = el('textarea', {
    class: 'textarea',
    attrs: { rows: 3, maxlength: '400', placeholder: 'چند خط از خودت…' },
  });
  bioInput.value = profile.bio || '';
  bioField.appendChild(bioInput);
  body.appendChild(bioField);

  // Avatar color
  const colorField = el('div', { class: 'field' });
  colorField.appendChild(el('label', { class: 'field__label' }, { children: ['رنگ آواتار'] }));
  const colorWrap = el('div', { class: 'color-picker' });
  let selectedColor = initialColor;
  for (const c of COLOR_PALETTE) {
    const b = el('button', {
      class: ['color-picker__item', c === selectedColor ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
      style: { background: c },
    });
    b.addEventListener('click', () => {
      selectedColor = c;
      colorWrap.querySelectorAll('.color-picker__item').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
      // Update preview avatar color
      avatarEl.style.setProperty('--avatar-color', c);
    });
    colorWrap.appendChild(b);
  }
  colorField.appendChild(colorWrap);
  body.appendChild(colorField);

  // Save
  const saveBtn = el('button', {
    class: 'btn btn--primary',
    attrs: { type: 'button' },
  }, { children: ['ذخیره پروفایل'] });
  saveBtn.addEventListener('click', async () => {
    const nameRes = validateDisplayName(nameInput.value);
    if (!nameRes.valid) {
      nameErr.textContent = nameRes.message;
      nameErr.classList.add('is-visible');
      nameInput.focus();
      return;
    }
    nameErr.textContent = '';
    nameErr.classList.remove('is-visible');

    setButtonLoading(saveBtn, true, 'در حال ذخیره…');
    try {
      await authService.updateProfile({
        display_name: nameRes.value,
        bio: bioInput.value.trim(),
        avatar_color: selectedColor,
      });
      const updated = await authService.getProfile();
      sessionStore.set({ profile: updated });
      bus.emit(EVENTS.AUTH_READY, { user, session: null });
      toast.success('پروفایل ذخیره شد.');
    } catch (err) {
      toast.error(err.message || 'خطا در ذخیره');
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });
  body.appendChild(el('div', { class: 'settings-section__actions' }, { children: [saveBtn] }));

  section.appendChild(body);
  return section;
}

export default { profileSection };