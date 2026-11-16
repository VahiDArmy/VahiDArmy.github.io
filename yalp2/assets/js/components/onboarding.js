/* ============================================================
   Onboarding tour — first-visit walkthrough with highlights
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';

const STORAGE_KEY = 'smyar.onboarding.v1';

const STEPS = [
  {
    selector: '.header-search',
    title: 'جستجوی زنده',
    desc: 'هرچی خرید کردی اینجا جستجو کن. کافیه بخشی از اسم فروشگاه یا محصول رو بنویسی.',
    placement: 'bottom',
  },
  {
    selector: '.header-add-btn',
    title: 'ثبت خرید',
    desc: 'فروشگاه، محصول، پلتفرم و امتیاز رو اینجا ثبت کن. همه چیز به فروشگاه برمی‌گرده.',
    placement: 'bottom',
  },
  {
    selector: '.filters-panel',
    title: 'فیلتر و سورت',
    desc: 'فقط خریدهای خوب، یا فقط یک فروشگاه خاص، یا بر اساس قیمت — همه‌چی اینجاست.',
    placement: 'bottom',
  },
  {
    selector: '.data-table-wrap, .grouped-view',
    title: 'لیست خریدها',
    desc: 'روی نام فروشگاه یا محصول کلیک کن تا جزئیات و آمار ببینی. ویرایش و حذف هم از همین‌جاست.',
    placement: 'top',
  },
];

export function maybeStartOnboarding() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch { return; }
  // slight delay so home renders
  setTimeout(() => startTour(), 700);
}

export function startTour() {
  let stepIndex = 0;
  let overlay = null;
  let tooltip = null;

  function cleanup() {
    document.querySelectorAll('.onboarding-highlight').forEach((n) => n.classList.remove('onboarding-highlight'));
    if (overlay) overlay.remove();
    if (tooltip) tooltip.remove();
    overlay = null;
    tooltip = null;
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, { capture: true });
  }

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    cleanup();
  }

  function skip() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    cleanup();
  }

  function showStep() {
    cleanup();

    if (stepIndex >= STEPS.length) { finish(); return; }

    const step = STEPS[stepIndex];
    const target = document.querySelector(step.selector);

    if (!target) {
      stepIndex++;
      showStep();
      return;
    }

    // Add highlight class
    target.classList.add('onboarding-highlight');

    // Overlay for click-block
    overlay = el('div', { class: 'onboarding-overlay' });
    overlay.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(overlay);

    // Tooltip
    const isLast = stepIndex === STEPS.length - 1;
    tooltip = el('div', { class: 'onboarding-tooltip' }, [
      el('div', { class: 'onboarding-tooltip__step',
        text: `گام ${toFa(stepIndex + 1)} از ${toFa(STEPS.length)}` }),
      el('div', { class: 'onboarding-tooltip__title', text: step.title }),
      el('div', { class: 'onboarding-tooltip__desc', text: step.desc }),
      el('div', { class: 'onboarding-tooltip__actions' }, [
        el('button', {
          type: 'button', class: 'btn btn--ghost btn--sm', text: 'رد کردن',
          onclick: skip,
        }),
        el('div', { style: { flex: '1' } }),
        stepIndex > 0 ? el('button', {
          type: 'button', class: 'btn btn--ghost btn--sm',
          html: `${icon('chevronRight', 14)}<span>قبلی</span>`,
          onclick: () => { stepIndex--; showStep(); },
        }) : null,
        el('button', {
          type: 'button', class: 'btn btn--primary btn--sm',
          html: `<span>${isLast ? 'شروع کن!' : 'بعدی'}</span>${!isLast ? icon('chevronLeft', 14) : ''}`,
          onclick: () => { stepIndex++; showStep(); },
        }),
      ].filter(Boolean)),
    ]);
    document.body.appendChild(tooltip);

    position(step, target);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', () => position(step, target), { capture: true, passive: true });
  }

  function position(step, target) {
    if (!tooltip) return;
    const r = target.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    const margin = 12;
    let top = 0, left = 0;

    if (step.placement === 'bottom' || r.bottom + tRect.height + margin < window.innerHeight) {
      top = r.bottom + margin;
      left = Math.max(16, Math.min(window.innerWidth - tRect.width - 16, r.left + r.width / 2 - tRect.width / 2));
    } else {
      top = r.top - tRect.height - margin;
      left = Math.max(16, Math.min(window.innerWidth - tRect.width - 16, r.left + r.width / 2 - tRect.width / 2));
    }
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function reposition() {
    if (!STEPS[stepIndex]) return;
    const target = document.querySelector(STEPS[stepIndex].selector);
    if (target) position(STEPS[stepIndex], target);
  }

  showStep();
}

function toFa(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

export function resetOnboarding() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
