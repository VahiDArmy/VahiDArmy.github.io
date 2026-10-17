/* ============================================================
   js/pages/dashboard.page.js
   Dashboard: stats, recent activity, charts, quick actions.
   FIXED: Added try/catch around chart rendering to prevent the
          whole page from crashing if a chart fails.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { ROUTES, LIE_TYPES } from '../config/app.config.js';
import * as statsService from '../services/stats.service.js';
import * as liesService from '../services/lies.service.js';
import { statCardsGrid } from '../features/dashboard/stat-cards.js';
import { recentActivity } from '../features/dashboard/recent-activity.js';
import { quickActions } from '../features/dashboard/quick-actions.js';
import { sessionStore } from '../core/store.js';
import { lineChart, donutChart, barChart } from '../ui/charts/index.js';
import { skeletonPage } from '../ui/skeleton.js';
import { toFaDigits, formatDate } from '../utils/format.js';
import { getJalaliParts } from '../utils/jalali.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));

/**
 * @param {HTMLElement} container
 */
export async function renderDashboard(container) {
  container.appendChild(skeletonPage({ variant: 'grid' }));

  let bundle = null;
  let recent = [];
  try {
    const [b, recentRes] = await Promise.all([
      statsService.dashboardBundle(),
      liesService.list({ status: 'active', sort: 'updated_desc', pageSize: 6, withTags: false }),
    ]);
    bundle = b;
    recent = recentRes.items;
  } catch (err) {
    console.error('[dashboard] load failed', err);
    clear(container);
    container.appendChild(renderError(err));
    return;
  }

  clear(container);

  const page = el('div', { class: 'page page--dashboard' });

  // Hero
  const user = sessionStore.get('user');
  const profile = sessionStore.get('profile');
  const name = profile?.display_name || user?.email?.split('@')[0] || 'کاربر';

  const jal = getJalaliParts(new Date());
  const greeting = getGreeting();

  const hero = el('header', { class: 'dashboard-hero' });
  const heroLeft = el('div', { class: 'dashboard-hero__left' });

  heroLeft.appendChild(el('span', { class: 'dashboard-hero__greeting' }, {
    children: [`${greeting}، ${name} 👋`],
  }));
  heroLeft.appendChild(el('h1', { class: 'dashboard-hero__title' }, {
    children: ['آینهٔ درون'],
  }));
  heroLeft.appendChild(el('p', { class: 'dashboard-hero__subtitle' }, {
    children: [
      'این فضای خصوصی شماست. هیچ‌کس جز خودتان به اینجا دسترسی ندارد. ',
      'امروز چه دروغی را می‌خواهی با آن روبه‌رو شوی؟',
    ],
  }));

  const heroRight = el('div', { class: 'dashboard-hero__right' });
  const dateChip = el('div', { class: 'dashboard-hero__date' });
  dateChip.appendChild(el('span', { class: 'dashboard-hero__date-icon' }, { children: ['🗓'] }));
  dateChip.appendChild(el('span', {}, { children: [formatDate(new Date(), { style: 'long' })] }));
  heroRight.appendChild(dateChip);
  hero.appendChild(heroLeft);
  hero.appendChild(heroRight);

  page.appendChild(hero);

  // Quick actions
  page.appendChild(sectionHead('دسترسی سریع', '⚡'));
  page.appendChild(quickActions());

  // Stat cards
  page.appendChild(sectionHead('آمار کلی', '📈'));
  page.appendChild(statCardsGrid({
    overview: bundle.overview,
    monthlyCounts: bundle.monthly,
  }));

  // Charts row
  const chartsRow = el('div', { class: 'dashboard-charts' });

  const chartCard = el('div', { class: 'dashboard-card' });
  chartCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [
      el('h3', { class: 'dashboard-card__title' }, {
        children: [el('span', {}, { children: ['📊'] }), 'روند ۱۲ ماه گذشته'],
      }),
    ],
  }));
  
  const monthlyData = (bundle.monthly || []).map((m) => ({
    label: m.month.split('-')[1] ? toFaDigits(Number(m.month.split('-')[1])) : '',
    value: m.count,
  }));

  if (monthlyData.length) {
    try {
      const chartWrap = el('div', { class: 'dashboard-card__chart' });
      chartWrap.appendChild(lineChart({
        data: monthlyData,
        height: 220,
        color: 'var(--accent)',
        showDots: monthlyData.length <= 12,
      }));
      chartCard.appendChild(chartWrap);
    } catch (e) {
      chartCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] }));
    }
  } else {
    chartCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  chartsRow.appendChild(chartCard);

  const typeCard = el('div', { class: 'dashboard-card' });
  typeCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [
      el('h3', { class: 'dashboard-card__title' }, {
        children: [el('span', {}, { children: ['🎭'] }), 'توزیع انواع'],
      }),
    ],
  }));
  
  const typeData = (bundle.byType || []).slice(0, 6).map((t) => {
    const meta = TYPES_BY_ID[t.type] || TYPES_BY_ID.other;
    return { label: meta.label, value: t.count, color: meta.color, icon: meta.icon };
  });

  if (typeData.length) {
    try {
      const donut = donutChart({
        data: typeData,
        size: 200,
        thickness: 28,
        centerLabel: toFaDigits(bundle.overview.active),
        centerSub: 'مورد فعال',
      });
      typeCard.appendChild(donut);
    } catch (e) {
      typeCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] }));
    }
  } else {
    typeCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  chartsRow.appendChild(typeCard);

  page.appendChild(chartsRow);

  // Recent activity + intensity histogram
  const bottomRow = el('div', { class: 'dashboard-charts' });

  const recentCard = el('div', { class: 'dashboard-card' });
  recentCard.appendChild(recentActivity(recent, {
    onSeeAll: () => { location.hash = '#/lies'; },
  }));
  bottomRow.appendChild(recentCard);

  const intCard = el('div', { class: 'dashboard-card' });
  intCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [
      el('h3', { class: 'dashboard-card__title' }, {
        children: [el('span', {}, { children: ['⚡'] }), 'توزیع شدت احساس'],
      }),
    ],
  }));
  
  const histData = (bundle.intensityHistogram || []).map((n, i) => ({
    label: toFaDigits(i),
    value: n,
  }));

  if (histData.some((d) => d.value > 0)) {
    try {
      const chartWrap = el('div', { class: 'dashboard-card__chart' });
      chartWrap.appendChild(barChart({ data: histData, height: 200, color: 'var(--warning)' }));
      intCard.appendChild(chartWrap);
    } catch (e) {
      intCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] }));
    }
  } else {
    intCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  bottomRow.appendChild(intCard);

  page.appendChild(bottomRow);

  container.appendChild(page);
}

/* ── Helpers ─────────────────────────────────────────────── */

function sectionHead(title, icon) {
  return el('div', { class: 'dashboard-section-head' }, {
    children: [
      el('h2', { class: 'dashboard-section-title' }, {
        children: [el('span', {}, { children: [icon] }), title],
      }),
    ],
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'شب بخیر';
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'ظهر بخیر';
  if (h < 20) return 'عصر بخیر';
  return 'شب بخیر';
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا در بارگذاری'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  const btn = el('button', { class: 'btn btn--primary' }, { children: ['تلاش دوباره'] });
  btn.addEventListener('click', () => { location.reload(); });
  box.appendChild(btn);
  return box;
}

export default { renderDashboard };