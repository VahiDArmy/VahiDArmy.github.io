/* ============================================================
   js/features/settings/appearance-section.js
   Theme, accent, font-size pickers
   ============================================================ */

import { el } from '../../utils/dom.js';
import { THEMES, ACCENTS, FONT_SIZES, applyTheme, getTheme } from '../../ui/theme.js';
import { settingsService } from '../../services/index.js';
import { toast } from '../../ui/toast.js';

const THEME_LABELS = {
  dark: { label: 'تاریک', icon: '🌙', desc: 'پیش‌فرض' },
  midnight: { label: 'نیمه‌شب', icon: '🌌', desc: 'آبی عمیق' },
  obsidian: { label: 'اُبسیدیَن', icon: '⚫', desc: 'مشکی گرم' },
  light: { label: 'روشن', icon: '☀️', desc: 'برای نور زیاد' },
};

const FONT_LABELS = {
  sm: { label: 'کوچک', size: '۱۴' },
  md: { label: 'متوسط', size: '۱۵' },
  lg: { label: 'بزرگ', size: '۱۶.۵' },
  xl: { label: 'خیلی بزرگ', size: '۱۸' },
};

/**
 * @returns {HTMLElement}
 */
export function appearanceSection() {
  const section = el('section', { class: 'settings-section' });

  section.appendChild(el('header', { class: 'settings-section__head' }, {
    children: [
      el('h2', { class: 'settings-section__title' }, {
        children: [el('span', {}, { children: ['🎨'] }), 'ظاهر'],
      }),
      el('p', { class: 'settings-section__subtitle' }, {
        children: ['تم، رنگ اکسنت و اندازه فونت را شخصی‌سازی کن.'],
      }),
    ],
  }));

  const body = el('div', { class: 'settings-section__body' });

  const current = getTheme();

  /* Theme */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['تم'] }));
  const themeGrid = el('div', { class: 'theme-grid' });

  for (const id of THEMES) {
    const meta = THEME_LABELS[id] || { label: id, icon: '🎨' };
    const card = el('button', {
      class: ['theme-card', id === current.theme ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button', 'data-theme': id },
    });
    const preview = el('div', { class: `theme-card__preview theme-card__preview--${id}` });
    preview.appendChild(el('span', { class: 'theme-card__dot theme-card__dot--a' }));
    preview.appendChild(el('span', { class: 'theme-card__dot theme-card__dot--b' }));
    preview.appendChild(el('span', { class: 'theme-card__dot theme-card__dot--c' }));
    card.appendChild(preview);
    card.appendChild(el('span', { class: 'theme-card__label' }, { children: [meta.icon + ' ' + meta.label] }));
    if (meta.desc) card.appendChild(el('span', { class: 'theme-card__desc' }, { children: [meta.desc] }));

    card.addEventListener('click', () => {
      applyTheme({ theme: id });
      themeGrid.querySelectorAll('.theme-card').forEach((n) => n.classList.remove('is-active'));
      card.classList.add('is-active');
      settingsService.update({ theme: id }).catch(() => {});
      toast.success(`تم: ${meta.label}`);
    });
    themeGrid.appendChild(card);
  }
  body.appendChild(themeGrid);

  /* Accent */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['رنگ اکسنت'] }));
  const accentGrid = el('div', { class: 'accent-grid' });
  for (const a of ACCENTS) {
    const swatch = el('button', {
      class: ['accent-swatch', a.id === current.accent ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button', title: a.label },
      style: { '--swatch-h': String(a.hsl) },
    });
    swatch.appendChild(el('span', { class: 'accent-swatch__fill' }));
    swatch.appendChild(el('span', { class: 'accent-swatch__label' }, { children: [a.label] }));
    swatch.addEventListener('click', () => {
      applyTheme({ accent: a.id });
      accentGrid.querySelectorAll('.accent-swatch').forEach((n) => n.classList.remove('is-active'));
      swatch.classList.add('is-active');
      settingsService.update({ accent: a.id }).catch(() => {});
    });
    accentGrid.appendChild(swatch);
  }
  body.appendChild(accentGrid);

  /* Font size */
  body.appendChild(el('h3', { class: 'settings-section__group' }, { children: ['اندازه فونت'] }));
  const fontRow = el('div', { class: 'font-size-grid' });
  for (const id of FONT_SIZES) {
    const meta = FONT_LABELS[id];
    const b = el('button', {
      class: ['font-size-btn', id === current.fontSize ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
    });
    b.appendChild(el('span', { class: 'font-size-btn__label' }, { children: [meta.label] }));
    b.appendChild(el('span', { class: 'font-size-btn__value' }, { children: [meta.size + ' px'] }));
    b.addEventListener('click', () => {
      applyTheme({ fontSize: id });
      fontRow.querySelectorAll('.font-size-btn').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
      settingsService.update({ font_size: id }).catch(() => {});
    });
    fontRow.appendChild(b);
  }
  body.appendChild(fontRow);

  section.appendChild(body);
  return section;
}

export default { appearanceSection };