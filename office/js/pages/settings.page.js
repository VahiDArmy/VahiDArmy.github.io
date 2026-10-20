/**
 * Settings page — theme, notifications, language, shortcuts, account actions.
 * Requires an authenticated session for account-related actions.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { theme as themeCore } from '../core/theme.js';
import { auth } from '../core/auth.js';
import { profilesService } from '../services/profiles.service.js';
import { pageHeader } from '../components/page-header.js';
import { confirm } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { openShortcutsHelp } from '../ui/shortcuts-help.js';
import { ROUTES, STORAGE_KEYS, APP_VERSION } from '../config/constants.js';
import { storage } from '../utils/storage.js';
import { toFaDigits } from '../utils/format.js';
import { bus } from '../utils/events.js';

export default function settingsPage(info, outlet) {
  outlet.innerHTML = '';

  const page = el('div', { class: 'container settings-page' });

  page.appendChild(
    pageHeader({
      eyebrow: 'تنظیمات',
      title: 'تنظیمات',
      subtitle: 'ظاهر، حریم خصوصی، اعلان‌ها و سایر گزینه‌ها را شخصی‌سازی کنید.',
    })
  );

  /* ---- Appearance ---- */
  page.appendChild(
    buildSection({
      iconName: 'sun',
      title: 'ظاهر',
      desc: 'حالت نمایش و رنگ‌بندی برنامه را انتخاب کنید.',
      body: [
        buildThemeRow(),
        buildCompactRow(),
      ],
    })
  );

  /* ---- Notifications ---- */
  page.appendChild(
    buildSection({
      iconName: 'message',
      title: 'اعلان‌ها',
      desc: 'نحوه دریافت اعلان‌ها را تنظیم کنید.',
      body: [
        buildToggleRow({
          key: 'notify.toasts',
          label: 'اعلان‌های کوچک (Toast)',
          help: 'نمایش پیام‌های کوتاه در گوشه صفحه.',
          defaultOn: true,
        }),
        buildToggleRow({
          key: 'notify.sounds',
          label: 'صدای اعلان',
          help: 'پخش یک صدای کوتاه هنگام دریافت اعلان مهم.',
          defaultOn: false,
        }),
      ],
    })
  );

  /* ---- Shortcuts ---- */
  page.appendChild(
    buildSection({
      iconName: 'command',
      title: 'میانبرهای صفحه‌کلید',
      desc: 'با کمک میانبرها سریع‌تر کار کنید.',
      body: [
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary',
            style: { alignSelf: 'flex-start' },
            on: { click: () => openShortcutsHelp() },
          },
          [icon('command'), 'مشاهده راهنمای میانبرها']
        ),
      ],
    })
  );

  /* ---- Account / Danger ---- */
  const user = appStore.get('user');
  if (user) {
    page.appendChild(buildAccountSection(user));
    page.appendChild(buildDangerSection());
  }

  /* ---- About ---- */
  page.appendChild(buildAboutSection());

  outlet.appendChild(page);
  return () => {};
}

function buildSection({ iconName = 'settings', title, desc, body = [] } = {}) {
  return el('section', { class: 'settings-section' }, [
    el('div', { class: 'settings-section__head' }, [
      el('h2', { class: 'settings-section__title' }, [icon(iconName), title]),
      desc ? el('p', { class: 'settings-section__desc' }, [desc]) : null,
    ]),
    el('div', { class: 'settings-section__body' }, body),
  ]);
}

function buildThemeRow() {
  const current = themeCore.get();

  function optionNode(value, label) {
    const isActive = current === value;
    return el(
      'button',
      {
        type: 'button',
        class: `settings-theme-option${isActive ? ' is-active' : ''}`,
        dataset: { themeValue: value },
        on: {
          click: () => {
            if (value === 'system') {
              storage.remove(STORAGE_KEYS.THEME);
              const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', sys);
              appStore.set('theme', sys);
              bus.emit('theme:toggled', sys);
            } else {
              themeCore.set(value);
              bus.emit('theme:toggled', value);
            }
            // Re-render active classes
            const parent = optionNode.parentNode;
          },
        },
      },
      [
        el('span', { class: 'settings-theme-option__swatch' }, [
          el('span', { class: 'settings-theme-option__swatch-bar' }),
          el('span', { class: 'settings-theme-option__swatch-body' }),
        ]),
        el('span', {}, [label]),
      ]
    );
  }

  const container = el('div', { class: 'settings-theme-preview' }, [
    optionNode('light', 'روشن'),
    optionNode('dark', 'تیره'),
    optionNode('system', 'سیستم'),
  ]);

  // Re-render on theme change
  bus.on('theme:toggled', () => {
    const current = themeCore.get();
    container.querySelectorAll('.settings-theme-option').forEach((btn) => {
      const v = btn.dataset.themeValue;
      const isActive = v === current;
      btn.classList.toggle('is-active', isActive);
    });
  });

  return el('div', { class: 'settings-row' }, [
    el('div', { class: 'settings-row__main' }, [
      el('div', { class: 'settings-row__label' }, ['حالت نمایش']),
      el('div', { class: 'settings-row__help' }, [
        'می‌توانید بین حالت روشن، تیره یا هماهنگ با سیستم جابه‌جا شوید.',
      ]),
    ]),
    container,
  ]);
}

function buildCompactRow() {
  const key = 'pref.compactLists';
  const initial = !!storage.get(key, false);
  const toggle = el('input', { type: 'checkbox', checked: initial });
  const sw = el('label', { class: 'switch' }, [
    toggle,
    el('span', { class: 'switch__track' }, [el('span', { class: 'switch__thumb' })]),
  ]);
  toggle.addEventListener('change', () => {
    storage.set(key, toggle.checked);
    toast.success(toggle.checked ? 'فهرست‌ها فشرده شدند.' : 'فهرست‌ها باز شدند.');
  });

  return el('div', { class: 'settings-row' }, [
    el('div', { class: 'settings-row__main' }, [
      el('div', { class: 'settings-row__label' }, ['فهرست‌های فشرده']),
      el('div', { class: 'settings-row__help' }, [
        'در فهرست‌ها، خلاصه‌ها پنهان می‌شوند تا محتوای بیشتری نمایش داده شود.',
      ]),
    ]),
    el('div', { class: 'settings-row__control' }, [sw]),
  ]);
}

function buildToggleRow({ key, label, help, defaultOn = false } = {}) {
  const initial = storage.get(key, defaultOn);
  const toggle = el('input', { type: 'checkbox', checked: !!initial });
  const sw = el('label', { class: 'switch' }, [
    toggle,
    el('span', { class: 'switch__track' }, [el('span', { class: 'switch__thumb' })]),
  ]);
  toggle.addEventListener('change', () => {
    storage.set(key, toggle.checked);
  });

  return el('div', { class: 'settings-row' }, [
    el('div', { class: 'settings-row__main' }, [
      el('div', { class: 'settings-row__label' }, [label]),
      help ? el('div', { class: 'settings-row__help' }, [help]) : null,
    ]),
    el('div', { class: 'settings-row__control' }, [sw]),
  ]);
}

function buildAccountSection(user) {
  return buildSection({
    iconName: 'user',
    title: 'حساب کاربری',
    desc: 'اطلاعات و تنظیمات حساب خود را مدیریت کنید.',
    body: [
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__label' }, ['ایمیل']),
          el('div', { class: 'settings-row__help' }, [user.email || '—']),
        ]),
        el('div', { class: 'settings-row__control' }, [
          el(
            'a',
            { class: 'btn btn--secondary btn--sm', href: router.href(ROUTES.PROFILE) },
            ['ویرایش پروفایل']
          ),
        ]),
      ]),
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__label' }, ['تغییر رمز عبور']),
          el('div', { class: 'settings-row__help' }, [
            'برای تنظیم رمز جدید، از طریق ایمیل بازیابی اقدام کنید.',
          ]),
        ]),
        el('div', { class: 'settings-row__control' }, [
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary btn--sm',
              on: {
                click: async () => {
                  const ok = await confirm({
                    title: 'بازیابی رمز عبور',
                    message: 'ایمیل بازیابی رمز به آدرس شما ارسال شود؟',
                    confirmLabel: 'ارسال',
                  });
                  if (!ok) return;
                  try {
                    await auth.requestPasswordReset(user.email);
                    toast.success('ایمیل بازیابی ارسال شد.');
                  } catch (err) {
                    toast.error(err?.message || 'ارسال ناموفق بود.');
                  }
                },
              },
            },
            ['بازیابی رمز']
          ),
        ]),
      ]),
    ],
  });
}

function buildDangerSection() {
  return el('section', { class: 'settings-section settings-danger' }, [
    el('div', { class: 'settings-section__head' }, [
      el('h2', { class: 'settings-section__title' }, [icon('alert-triangle'), 'منطقه خطر']),
      el('p', { class: 'settings-section__desc' }, [
        'این عملیات‌ها حساس هستند و ممکن است غیرقابل بازگشت باشند.',
      ]),
    ]),
    el('div', { class: 'settings-section__body' }, [
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__label' }, ['خروج از حساب']),
          el('div', { class: 'settings-row__help' }, [
            'با خروج، نشست فعلی این دستگاه بسته می‌شود.',
          ]),
        ]),
        el('div', { class: 'settings-row__control' }, [
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn--danger btn--sm',
              on: {
                click: async () => {
                  const ok = await confirm({
                    title: 'خروج',
                    message: 'آیا از حساب خود خارج می‌شوید؟',
                    confirmLabel: 'خروج',
                    variant: 'danger',
                  });
                  if (!ok) return;
                  try {
                    await auth.signOut();
                    toast.success('خارج شدید.');
                    router.navigate(ROUTES.HOME, { replace: true });
                  } catch (err) {
                    toast.error(err?.message || 'خروج ناموفق بود.');
                  }
                },
              },
            },
            [icon('log-out'), 'خروج']
          ),
        ]),
      ]),
    ]),
  ]);
}

function buildAboutSection() {
  return buildSection({
    iconName: 'info',
    title: 'درباره',
    desc: 'اطلاعات نسخه و ساخت.',
    body: [
      el('div', { class: 'settings-about' }, [
        el('p', {}, [
          'The Office — بایگانی داخلی اداره. ',
          el('span', { class: 'settings-about__version' }, [`v${toFaDigits(APP_VERSION)}`]),
        ]),
        el('p', { style: { marginBlockStart: 'var(--space-2)' } }, [
          'ساخته‌شده با ❤ برای تیم. برای بازخورد با مدیر سیستم تماس بگیرید.',
        ]),
      ]),
    ],
  });
}