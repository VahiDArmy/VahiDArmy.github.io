/**
 * Signed-in user chip + dropdown menu.
 */

import { el, icon } from '../utils/dom.js';
import { appStore } from '../core/store.js';
import { auth } from '../core/auth.js';
import { router } from '../core/router.js';
import { createDropdown } from '../ui/dropdown.js';
import { toast } from '../ui/toast.js';
import { confirm } from '../ui/confirm.js';
import { ROUTES } from '../config/constants.js';
import { initials } from '../utils/format.js';

export function createUserMenu() {
  const root = el('div', { class: 'header__user' });

  function render() {
    root.innerHTML = '';
    const user = appStore.get('user');
    const profile = appStore.get('profile');

    if (!user) {
      const wrap = el('div', { class: 'header__auth' }, [
        el('a', { class: 'btn btn--ghost btn--sm', href: router.href(ROUTES.LOGIN) }, ['ورود']),
        el('a', { class: 'btn btn--primary btn--sm', href: router.href(ROUTES.SIGNUP) }, ['ثبت‌نام']),
      ]);
      root.appendChild(wrap);
      return;
    }

    const displayName = profile?.display_name || user.email?.split('@')[0] || 'کاربر';
    const avatarUrl = profile?.avatar_url;

    const avatarInner = avatarUrl
      ? el('img', { src: avatarUrl, alt: displayName, loading: 'lazy' })
      : el('span', {}, [initials(displayName)]);

    const chip = el(
      'button',
      {
        type: 'button',
        class: 'user-chip',
        'aria-haspopup': 'menu',
        'aria-label': 'منوی کاربر',
      },
      [
        el('span', { class: 'user-chip__avatar' }, [avatarInner]),
        el('span', { class: 'user-chip__name' }, [displayName]),
        el('span', { class: 'icon', style: { width: '14px', height: '14px', color: 'var(--text-tertiary)' } }, [icon('chevron-down')]),
      ]
    );

    root.appendChild(chip);

    const dd = createDropdown(
      chip,
      [
        { header: displayName },
        {
          label: 'پروفایل',
          icon: 'user',
          onClick: () => router.navigate(ROUTES.PROFILE),
        },
        {
          label: 'جدول‌های من',
          icon: 'table',
          onClick: () => router.navigate('/tables?my=true'), // FIX: Added query param
        },
        { divider: true },
        {
          label: 'خروج',
          icon: 'log-out',
          danger: true,
          onClick: async () => {
            const ok = await confirm({
              title: 'خروج',
              message: 'آیا از حساب خود خارج می‌شوید؟',
              confirmLabel: 'خروج',
              variant: 'danger',
            });
            if (!ok) return;
            try {
              await auth.signOut();
              toast.success('با موفقیت خارج شدید.');
              router.navigate(ROUTES.HOME);
            } catch (err) {
              toast.error(err.message || 'خروج ناموفق بود.');
            }
          },
        },
      ],
      { align: 'end' }
    );

    chip._dropdown = dd;
  }

  render();
  appStore.subscribe((_, keys) => {
    if (keys.includes('user') || keys.includes('profile')) render();
  });

  return root;
}

export default createUserMenu;