/* ============================================================
   js/pages/dashboard.page.js
   FIXED: Removed all extra hero text. Just stats and charts.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as statsService from '../services/stats.service.js';
import * as liesService from '../services/lies.service.js';
import * as taxonomyService from '../services/taxonomy.service.js';
import { statCardsGrid } from '../features/dashboard/stat-cards.js';
import { recentActivity } from '../features/dashboard/recent-activity.js';
import { quickActions } from '../features/dashboard/quick-actions.js';
import { lineChart, donutChart, barChart } from '../ui/charts/index.js';
import { skeletonPage } from '../ui/skeleton.js';
import { toFaDigits } from '../utils/format.js';
import { getJalaliParts, getMonthName } from '../utils/jalali.js';

export async function renderDashboard(container) {
  clear(container);
  container.appendChild(skeletonPage({ variant: 'grid' }));

  let bundle = null;
  let recent = [];
  let lieTypes = [];
  
  try {
    const [b, recentRes, types] = await Promise.all([
      statsService.dashboardBundle(),
      liesService.list({ status: 'active', sort: 'updated_desc', pageSize: 6, withTags: false }),
      taxonomyService.listTypes().catch(() => []),
    ]);
    bundle = b;
    recent = recentRes?.items || [];
    lieTypes = types || [];
  } catch (err) {
    console.error('[dashboard] load failed', err);
    clear(container);
    container.appendChild(renderError(err));
    return;
  }

  clear(container);
  const typesMap = Object.fromEntries(lieTypes.map((t) => [t.id, t]));

  const page = el('div', { class: 'page page--dashboard' });

  // 🛡️ FIX: Minimal Header (No extra text)
  const j = getJalaliParts(new Date());
  const monthName = getMonthName(j.month) || 'مهر';
  const dateStr = `${toFaDigits(j.day || 1)} ${monthName} ${toFaDigits(j.year || 1403)}`;

  const header = el('div', { style: { marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
  header.appendChild(el('h1', { style: { fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' } }, { children: ['داشبورد'] }));
  header.appendChild(el('div', { style: { padding: '6px 16px', background: 'var(--bg-surface-2)', borderRadius: '20px', fontSize: '13px', color: 'var(--text-tertiary)' } }, {
    children: [dateStr]
  }));
  page.appendChild(header);

  // 1. Quick Actions
  page.appendChild(sectionHead('دسترسی سریع', '⚡'));
  page.appendChild(quickActions());

  // 2. Stat Cards
  page.appendChild(sectionHead('آمار کلی', '📈'));
  page.appendChild(statCardsGrid({
    overview: bundle.overview,
    monthlyCounts: bundle.monthly || [],
  }));

  // 3. Charts Row
  const chartsRow = el('div', { class: 'dashboard-charts' });

  const chartCard = el('div', { class: 'dashboard-card' });
  chartCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [el('h3', { class: 'dashboard-card__title' }, { children: [el('span', {}, { children: ['📊'] }), 'روند ۱۲ ماه گذشته'] })],
  }));
  
  const monthlyData = (bundle.monthly || []).map((m) => ({
    label: m.month.split('-')[1] ? toFaDigits(Number(m.month.split('-')[1])) : '',
    value: m.count,
  }));

  if (monthlyData.length) {
    try {
      const chartWrap = el('div', { class: 'dashboard-card__chart' });
      chartWrap.appendChild(lineChart({ data: monthlyData, height: 220, color: 'var(--accent)', showDots: monthlyData.length <= 12 }));
      chartCard.appendChild(chartWrap);
    } catch (e) { chartCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] })); }
  } else {
    chartCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  chartsRow.appendChild(chartCard);

  const typeCard = el('div', { class: 'dashboard-card' });
  typeCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [el('h3', { class: 'dashboard-card__title' }, { children: [el('span', {}, { children: ['🎭'] }), 'توزیع انواع'] })],
  }));
  
  const typeData = (bundle.byType || []).slice(0, 6).map((t) => {
    const meta = typesMap[t.type] || { label: 'دروغ دیگر', color: 'var(--text-tertiary)', icon: '✳️' };
    return { label: meta.label, value: t.count, color: meta.color, icon: meta.icon };
  });

  if (typeData.length) {
    try {
      const donut = donutChart({ data: typeData, size: 200, thickness: 28, centerLabel: toFaDigits(bundle.overview.active), centerSub: 'مورد فعال' });
      typeCard.appendChild(donut);
    } catch (e) { typeCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] })); }
  } else {
    typeCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  chartsRow.appendChild(typeCard);
  page.appendChild(chartsRow);

  // 4. Bottom Row (Recent + Histogram)
  const bottomRow = el('div', { class: 'dashboard-charts' });

  const recentCard = el('div', { class: 'dashboard-card' });
  recentCard.appendChild(recentActivity(recent, { onSeeAll: () => { location.hash = '#/lies'; } }));
  bottomRow.appendChild(recentCard);

  const intCard = el('div', { class: 'dashboard-card' });
  intCard.appendChild(el('header', { class: 'dashboard-card__head' }, {
    children: [el('h3', { class: 'dashboard-card__title' }, { children: [el('span', {}, { children: ['⚡'] }), 'توزیع شدت احساس'] })],
  }));
  
  const histData = (bundle.intensityHistogram || []).map((n, i) => ({ label: toFaDigits(i), value: n }));

  if (histData.some((d) => d.value > 0)) {
    try {
      const chartWrap = el('div', { class: 'dashboard-card__chart' });
      chartWrap.appendChild(barChart({ data: histData, height: 200, color: 'var(--warning)' }));
      intCard.appendChild(chartWrap);
    } catch (e) { intCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['خطا در رسم نمودار'] })); }
  } else {
    intCard.appendChild(el('p', { class: 'dashboard-card__empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  bottomRow.appendChild(intCard);

  page.appendChild(bottomRow);
  container.appendChild(page);
}

function sectionHead(title, icon) {
  return el('div', { class: 'dashboard-section-head' }, {
    children: [el('h2', { class: 'dashboard-section-title' }, { children: [el('span', {}, { children: [icon] }), title] })],
  });
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا در بارگذاری'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  return box;
}