/**
 * Profile page — view + edit own profile.
 * Requires an authenticated session.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { profilesService } from '../services/profiles.service.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';
import { pageHeader } from '../components/page-header.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { formatDate, initials, formatNumber } from '../utils/format.js';

const ROLE_LABELS = {
  admin: 'مدیر',
  editor: 'ویرایشگر',
  contributor: 'مشارکت‌کننده',
  member: 'عضو',
};

export default async function profilePage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  const user = session.user;
  let profile = appStore.get('profile');
  if (!profile) {
    profile = await profilesService.getById(user.id);
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildView({ user, profile }));

  return () => {};
}

function buildLoading() {
  return el('div', { class: 'container' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block' }),
    ]),
  ]);
}

function buildView({ user, profile }) {
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'کاربر';
  const roleLabel = ROLE_LABELS[profile?.role] || 'عضو';
  const memberSince = formatDate(profile?.created_at || user.created_at);

  const header = pageHeader({
    eyebrow: 'حساب کاربری',
    title: 'پروفایل من',
    subtitle: 'اطلاعات حساب خود را مدیریت کنید.',
  });

  const sidebar = el('aside', { class: 'profile-sidebar' }, [
    el('span', { class: 'avatar avatar--2xl' }, [
      profile?.avatar_url
        ? el('img', { src: profile.avatar_url, alt: displayName, loading: 'lazy' })
        : el('span', {}, [initials(displayName)]),
    ]),
    el('div', { class: 'profile-sidebar__name' }, [displayName]),
    el('div', { class: 'profile-sidebar__role' }, [roleLabel]),
    el('div', { class: 'profile-sidebar__meta' }, [
      metaRow('mail', user.email || '—'),
      profile?.location ? metaRow('flag', profile.location) : null,
      profile?.website ? metaRow('link', profile.website) : null,
      metaRow('calendar', `عضو از ${memberSince}`),
    ]),
  ]);

  const form = buildEditForm({ user, profile });

  const main = el('div', { class: 'profile-main' }, [form]);

  const grid = el('div', { class: 'profile-grid' }, [sidebar, main]);

  return el('div', { class: 'container' }, [
    el('div', { class: 'profile' }, [header, grid]),
  ]);
}

function metaRow(iconName, text) {
  return el('div', { class: 'profile-sidebar__meta-row' }, [
    icon(iconName),
    el('span', { class: 'truncate' }, [text]),
  ]);
}

function buildEditForm({ user, profile }) {
  const nameInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'pf-name',
    value: profile?.display_name || '',
    placeholder: 'نام نمایشی شما',
  });
  const bioInput = el('textarea', {
    class: 'textarea',
    id: 'pf-bio',
    rows: 4,
    placeholder: 'چند خط درباره خودتان...',
  });
  bioInput.value = profile?.bio || '';

  const locationInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'pf-location',
    value: profile?.location || '',
    placeholder: 'مثلاً: اسکرنتون، پنسیلوانیا',
  });
  const websiteInput = el('input', {
    type: 'url',
    class: 'input',
    id: 'pf-website',
    dir: 'ltr',
    value: profile?.website || '',
    placeholder: 'https://example.com',
  });

  const saveBtn = el(
    'button',
    { type: 'submit', class: 'btn btn--primary' },
    [icon('save'), 'ذخیره تغییرات']
  );

  const form = el('form', { class: 'form-grid' }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'pf-name' }, ['نام نمایشی']),
      nameInput,
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'pf-bio' }, ['معرفی کوتاه']),
      bioInput,
      el('p', { class: 'form-help' }, ['حداکثر ۳۰۰ کاراکتر.']),
    ]),
    el('div', { class: 'form-grid form-grid--2' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label', for: 'pf-location' }, ['موقعیت مکانی']),
        locationInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label', for: 'pf-website' }, ['وب‌سایت']),
        websiteInput,
      ]),
    ]),
    el(
      'div',
      { class: 'form-actions', style: { borderTop: '1px solid var(--border-subtle)' } },
      [saveBtn]
    ),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {
      display_name: nameInput.value.trim(),
      bio: bioInput.value.trim(),
      location: locationInput.value.trim(),
      website: websiteInput.value.trim(),
    };

    const errors = validate(values, {
      display_name: [rules.required('نام نمایشی الزامی است'), rules.maxLength(60)],
      bio: [rules.maxLength(300)],
      website: [rules.url()],
    });
    if (hasErrors(errors)) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;
    try {
      const updated = await profilesService.update(user.id, values);
      appStore.set('profile', updated);
      toast.success('پروفایل شما به‌روز شد.');
    } catch (err) {
      toast.error(err.message || 'ذخیره ناموفق بود.');
    } finally {
      saveBtn.classList.remove('is-loading');
      saveBtn.disabled = false;
    }
  });

  return el('section', { class: 'profile-card' }, [
    el('h2', { class: 'profile-card__title' }, ['اطلاعات پروفایل']),
    form,
  ]);
}