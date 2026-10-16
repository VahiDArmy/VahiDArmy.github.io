/* ============================================================
   js/features/settings/about-section.js
   About, keyboard shortcuts, privacy info
   ============================================================ */

import { el } from '../../utils/dom.js';
import { APP } from '../../config/app.config.js';
import { shortcuts } from '../../core/shortcuts.js';

/**
 * @returns {HTMLElement}
 */
export function aboutSection() {
  const section = el('section', { class: 'settings-section' });

  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [
      el('h2', { class: 'settings-section__title' }, {
        children: [el('span', {}, { children: ['ℹ️'] }), 'درباره'],
      }),
    ],
  }));

  const body = el('div', { class: 'settings-section__body' });

  const brandCard = el('div', { class: 'about-brand' });
  brandCard.appendChild(el('div', { class: 'about-brand__mark' }, { children: ['🎭'] }));
  const brandText = el('div');
  brandText.appendChild(el('div', { class: 'about-brand__name' }, { children: [APP.fullName] }));
  brandText.appendChild(el('div', { class: 'about-brand__version' }, { children: [`نسخهٔ ${APP.version} · ${APP.build}`] }));
  brandCard.appendChild(brandText);
  body.appendChild(brandCard);

  body.appendChild(el('p', { class: 'about-text' }, {
    children: [
      'این یک ژورنال خصوصی برای ثبت، بازنگری و رویارویی با دروغ‌هایی است که هر روز به خودمان می‌گوییم. ',
      'هیچ داده‌ای به اشتراک گذاشته نمی‌شود، هیچ تحلیلی در سرور انجام نمی‌شود، و همه‌چیز با RLS سطح ردیف قفل شده است.',
    ],
  }));

  /* Privacy bullets */
  const privacy = el('ul', { class: 'about-list' });
  [
    ['🔒', 'دسترسی سطح ردیف (RLS): فقط خودت می‌توانی داده‌های خودت را بخوانی یا بنویسی.'],
    ['🚫', 'کاربر ناشناس (anon) هیچ دسترسی‌ای به هیچ جدولی ندارد.'],
    ['🛡️', 'احراز هویت با ایمیل و رمز + جریان PKCE.'],
    ['📤', 'خروجی کامل در هر زمان (JSON/CSV/Markdown).'],
    ['🗑️', 'حذف کامل حساب در یک مرحله (با تأیید دو مرحله‌ای).'],
  ].forEach(([ico, text]) => {
    const li = el('li', { class: 'about-list__item' });
    li.appendChild(el('span', { class: 'about-list__icon' }, { children: [ico] }));
    li.appendChild(el('span', {}, { children: [text] }));
    privacy.appendChild(li);
  });
  body.appendChild(privacy);

  /* Shortcuts */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['میان‌برهای کیبورد'] }));
  const groups = shortcuts.grouped();
  if (groups.length) {
    const grid = el('div', { class: 'shortcuts-grid' });
    for (const g of groups) {
      const groupCard = el('div', { class: 'shortcuts-group-card' });
      groupCard.appendChild(el('h4', { class: 'shortcuts-group-card__title' }, { children: [g.group] }));
      for (const item of g.items) {
        const row = el('div', { class: 'shortcut-line' });
        row.appendChild(el('span', { class: 'shortcut-line__label' }, { children: [item.label] }));
        const keys = el('span', { class: 'shortcut-line__keys' });
        for (const part of item.combo.split(/[\s+]+/)) {
          const k = el('kbd', {}, { children: [formatKey(part)] });
          keys.appendChild(k);
        }
        row.appendChild(keys);
        groupCard.appendChild(row);
      }
      grid.appendChild(groupCard);
    }
    body.appendChild(grid);
  }

  /* Footer */
  const footer = el('div', { class: 'about-footer' });
  footer.appendChild(el('p', {}, {
    children: ['ساخته‌شده برای رویارویی با خود · ' + new Date().getFullYear()],
  }));
  body.appendChild(footer);

  section.appendChild(body);
  return section;
}

function formatKey(k) {
  const s = String(k).toLowerCase();
  if (s === 'ctrl') return 'Ctrl';
  if (s === 'meta') return '⌘';
  if (s === 'alt') return 'Alt';
  if (s === 'shift') return 'Shift';
  if (s === 'esc') return 'Esc';
  if (s === 'enter') return 'Enter';
  if (s === 'space') return 'Space';
  if (s.length === 1) return s.toUpperCase();
  return s;
}

export default { aboutSection };