/**
 * بازاربان — میان‌برهای صفحه‌کلید
 * ---------------------------------------------------------------------------
 * ناوبری سریع با کلیدهای ترتیبی (g سپس h)، باز کردن راهنمای میان‌برها با «؟»
 * و تغییر تم با t. همهٔ کلیدها وقتی فوکوس داخل ورودی است نادیده گرفته می‌شوند.
 *
 * میان‌بر «/» و «⌘K» در app.js مدیریت می‌شوند و این‌جا تکرار نمی‌شوند.
 */

import { icon } from './icons.js';
import { esc } from './utils.js';
import { navigate } from './router.js';
import { openModal, toast } from './ui.js';

const SEQUENCES = [
  { key: 'h', label: 'خانه', href: '/' },
  { key: 'v', label: 'فروشنده‌ها', href: '/vendors' },
  { key: 's', label: 'فروشگاه‌ها', href: '/shops' },
  { key: 'p', label: 'محصولات', href: '/products' },
  { key: 'r', label: 'نقدها', href: '/reviews' },
  { key: 'c', label: 'مقایسه', href: '/compare' },
  { key: 'n', label: 'ثبت تجربه', href: '/new' },
  { key: 'i', label: 'بینش بازار', href: '/insights' },
  { key: 'm', label: 'داشبورد من', href: '/me' },
  { key: 'g', label: 'راهنما', href: '/guide' },
];

const GROUPS = [
  {
    title: 'ناوبری',
    items: [
      { keys: ['g', 'h'], label: 'خانه' },
      { keys: ['g', 'v'], label: 'فروشنده‌ها' },
      { keys: ['g', 's'], label: 'فروشگاه‌ها و شعبه‌ها' },
      { keys: ['g', 'p'], label: 'محصولات' },
      { keys: ['g', 'r'], label: 'جریان نقدها' },
      { keys: ['g', 'c'], label: 'میز مقایسه' },
      { keys: ['g', 'i'], label: 'بینش بازار' },
      { keys: ['g', 'm'], label: 'داشبورد من' },
    ],
  },
  {
    title: 'کنش‌ها',
    items: [
      { keys: ['n'], label: 'ثبت تجربهٔ جدید' },
      { keys: ['t'], label: 'تغییر تم روشن / تاریک' },
      { keys: ['?'], label: 'همین راهنما' },
      { keys: ['Esc'], label: 'بستن پنجره‌ها' },
    ],
  },
  {
    title: 'جست‌وجو',
    items: [
      { keys: ['/'], label: 'باز کردن جست‌وجوی سراسری' },
      { keys: ['⌘', 'K'], label: 'جست‌وجو (مک)' },
      { keys: ['Ctrl', 'K'], label: 'جست‌وجو (ویندوز و لینوکس)' },
    ],
  },
];

function kbd(value) {
  return `<kbd class="kbd kbd--shortcut">${esc(value)}</kbd>`;
}

export function openShortcutsHelp() {
  openModal({
    title: 'میان‌برهای صفحه‌کلید',
    subtitle: 'برای حرکت سریع‌تر بین صفحه‌ها؛ کلیدها به فارسی هم کار می‌کنند.',
    size: 'narrow',
    body: `<div class="shortcuts">
      ${GROUPS.map(
        (group) => `<section class="shortcuts__group">
          <h3 class="shortcuts__title">${esc(group.title)}</h3>
          <div class="shortcuts__list">
            ${group.items
              .map(
                (item) => `<div class="shortcuts__row">
                  <span class="shortcuts__label">${esc(item.label)}</span>
                  <span class="shortcuts__keys">${item.keys.map(kbd).join('<span class="shortcuts__plus">+</span>')}</span>
                </div>`,
              )
              .join('')}
          </div>
        </section>`,
      ).join('')}
    </div>
    <p class="hint" style="margin-top:var(--sp-5);line-height:1.9">
      ${icon('info', 12)} میان‌برها وقتی فعال‌اند که داخل یک کادر متنی نباشی. اگر با صفحه‌کلید
      کار می‌کنی، از Tab برای حرکت بین دکمه‌ها و Enter برای انتخاب استفاده کن.
    </p>`,
    footer: `<button class="btn btn--primary" type="button" data-close-modal>فهمیدم</button>`,
  });
}

/**
 * راه‌اندازی شنوندهٔ کلیدها.
 * @returns {() => void} تابع پاک‌سازی
 */
export function initShortcuts() {
  let pendingG = 0;
  let lastKey = '';

  const isTyping = (target) =>
    target instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable ||
      target.closest('[role="textbox"]'));

  const hasOverlay = () =>
    Boolean(document.querySelector('.modal, .drawer, .palette, .menu--floating'));

  const onKey = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) return;

    // «؟» روی صفحه‌کلید فارسی همان Shift+/ است
    if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
      if (hasOverlay()) return;
      event.preventDefault();
      openShortcutsHelp();
      return;
    }

    if (hasOverlay()) return;

    const key = String(event.key || '').toLowerCase();
    const now = Date.now();

    if (pendingG && now - pendingG < 1400) {
      pendingG = 0;
      const sequence = SEQUENCES.find((item) => item.key === key);
      if (sequence) {
        event.preventDefault();
        navigate(sequence.href);
        return;
      }
    }

    if (key === 'g') {
      pendingG = now;
      lastKey = 'g';
      return;
    }

    if (key === 't' && lastKey !== 'g') {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('bb:set-theme', { detail: { theme: document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' } }));
      toast(document.documentElement.dataset.theme === 'light' ? 'تم روشن شد.' : 'تم تاریک شد.', {
        type: 'info',
        duration: 1600,
      });
      return;
    }

    if (key === 'n') {
      event.preventDefault();
      navigate('/new');
      return;
    }

    lastKey = key;
  };

  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
