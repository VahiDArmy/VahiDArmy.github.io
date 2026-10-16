/* ============================================================
   js/pages/analytics.page.js
   Full analytics: heatmap, donuts, histograms, trends, top tags
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as statsService from '../services/stats.service.js';
import { sessionStore } from '../core/store.js';
import { lineChart, barChart, donutChart, heatmap } from '../ui/charts/index.js';
import { LIE_TYPES, MOODS } from '../config/app.config.js';
import { toFaDigits } from '../utils/format.js';
import { getJalaliParts, getMonthName, FA_MONTHS } from '../utils/jalali.js';
import { emptyState } from '../ui/empty-state.js';
import { tabs } from '../ui/tabs.js';
import { skeletonPage } from '../ui/skeleton.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));
const MOODS_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/**
 * @param {HTMLElement} container
 */
export async function renderAnalytics(container) {
  container.appendChild(skeletonPage({ variant: 'grid' }));

  const currentYear = new Date().getFullYear();
  const j = getJalaliParts(new Date());

  let bundle = null;
  let heatmapData = {};
  let yearTrend = [];
  try {
    const [b, heat, daily] = await Promise.all([
      statsService.dashboardBundle(currentYear),
      statsService.heatmapByYear(currentYear),
      statsService.monthlyCounts(12),
    ]);
    bundle = b;
    heatmapData = heat;
    yearTrend = daily;
  } catch (err) {
    clear(container);
    container.appendChild(renderError(err));
    return;
  }

  clear(container);

  const page = el('div', { class: 'page page--analytics' });

  // Header
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['📊'] }), 'تحلیل و آمار'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['الگوها، روند، و بینش‌های حاصل از دروغ‌هایی که به خودت گفته‌ای.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  // Overview KPIs
  const kpi = el('div', { class: 'analytics-kpis' });
  kpi.appendChild(kpiTile('کل دروغ‌های فعال', bundle.overview.active, 'var(--accent)'));
  kpi.appendChild(kpiTile('میانگین شدت', bundle.overview.avg_intensity?.toFixed(1) || '0', 'var(--warning)'));
  kpi.appendChild(kpiTile('میانگین باور', bundle.overview.avg_belief?.toFixed(1) || '0', 'var(--cat-2)'));
  kpi.appendChild(kpiTile('بازتاب‌ها', bundle.overview.reflections, 'var(--cat-3)'));
  kpi.appendChild(kpiTile('این ماه', bundle.overview.this_month, 'var(--info)'));
  page.appendChild(kpi);

  // Heatmap (Jalali)
  const heatSection = el('section', { class: 'analytics-section' });
  heatSection.appendChild(sectionHead('نقشهٔ فعالیت', '🔥', 'الگوی روزانه در ماه‌ها'));
  const heatCard = el('div', { class: 'analytics-card analytics-card--wide' });
  heatCard.appendChild(heatmap({
    dataByDay: heatmapData,
    jy: j.year,
    jm: j.month,
  }));
  heatSection.appendChild(heatCard);
  page.appendChild(heatSection);

  // Trend line (12 months)
  const trendSection = el('section', { class: 'analytics-section' });
  trendSection.appendChild(sectionHead('روند ۱۲ ماه', '📈', 'تعداد دروغ‌های فعال در ماه‌های گذشته'));
  const trendCard = el('div', { class: 'analytics-card analytics-card--wide' });
  const trendData = yearTrend.map((m) => {
    const mo = Number(m.month.split('-')[1]);
    return { label: mo ? getMonthName(mo).slice(0, 4) : '', value: m.count };
  });
  if (trendData.some((d) => d.value > 0)) {
    trendCard.appendChild(lineChart({ data: trendData, height: 260, color: 'var(--accent)' }));
  } else {
    trendCard.appendChild(el('p', { class: 'analytics-empty' }, { children: ['داده‌ای برای نمایش نیست'] }));
  }
  trendSection.appendChild(trendCard);
  page.appendChild(trendSection);

  // Two-col: type donut + mood donut
  const donutRow = el('div', { class: 'analytics-row' });

  const typeCard = el('div', { class: 'analytics-card' });
  typeCard.appendChild(cardHead('🎭 توزیع انواع'));
  if (bundle.byType?.length) {
    typeCard.appendChild(donutChart({
      data: bundle.byType.slice(0, 8).map((t) => {
        const m = TYPES_BY_ID[t.type] || TYPES_BY_ID.other;
        return { label: m.label, value: t.count, color: m.color, icon: m.icon };
      }),
      size: 200,
      thickness: 30,
      centerLabel: toFaDigits(bundle.overview.active),
      centerSub: 'فعال',
    }));
  } else {
    typeCard.appendChild(el('p', { class: 'analytics-empty' }, { children: ['داده‌ای نیست'] }));
  }
  donutRow.appendChild(typeCard);

  const moodCard = el('div', { class: 'analytics-card' });
  moodCard.appendChild(cardHead('😶 توزیع حال و احساس'));
  if (bundle.byMood?.length) {
    moodCard.appendChild(donutChart({
      data: bundle.byMood.slice(0, 8).map((m) => {
        const meta = MOODS_BY_ID[m.mood] || { label: m.mood, icon: '•' };
        return { label: meta.label, value: m.count, icon: meta.icon };
      }),
      size: 200,
      thickness: 30,
    }));
  } else {
    moodCard.appendChild(el('p', { class: 'analytics-empty' }, { children: ['داده‌ای نیست'] }));
  }
  donutRow.appendChild(moodCard);
  page.appendChild(donutRow);

  // Histograms
  const histRow = el('div', { class: 'analytics-row' });

  const intCard = el('div', { class: 'analytics-card' });
  intCard.appendChild(cardHead('⚡ توزیع شدت'));
  intCard.appendChild(barChart({
    data: bundle.intensityHistogram.map((n, i) => ({ label: toFaDigits(i), value: n })),
    height: 220,
    color: 'var(--warning)',
  }));
  histRow.appendChild(intCard);

  const beliefCard = el('div', { class: 'analytics-card' });
  beliefCard.appendChild(cardHead('◉ توزیع باور'));
  const beliefHist = await statsService.beliefHistogram().catch(() => new Array(11).fill(0));
  beliefCard.appendChild(barChart({
    data: beliefHist.map((n, i) => ({ label: toFaDigits(i), value: n })),
    height: 220,
    color: 'var(--cat-2)',
  }));
  histRow.appendChild(beliefCard);
  page.appendChild(histRow);

  // Top tags & categories
  const tagsRow = el('div', { class: 'analytics-row' });

  const topTagsCard = el('div', { class: 'analytics-card' });
  topTagsCard.appendChild(cardHead('🏷️ پرکاربردترین برچسب‌ها'));
  if (bundle.topTags?.length) {
    const list = el('ul', { class: 'analytics-list' });
    const max = bundle.topTags[0].count;
    for (const t of bundle.topTags) {
      const li = el('li', { class: 'analytics-list__item' });
      li.appendChild(el('span', { class: 'analytics-list__dot', style: { background: t.color } }));
      li.appendChild(el('span', { class: 'analytics-list__label' }, { children: [t.name] }));
      li.appendChild(el('span', { class: 'analytics-list__bar-wrap' }, {
        children: [el('span', { class: 'analytics-list__bar', style: { width: `${(t.count / max) * 100}%`, background: t.color } })],
      }));
      li.appendChild(el('span', { class: 'analytics-list__value' }, { children: [toFaDigits(t.count)] }));
      list.appendChild(li);
    }
    topTagsCard.appendChild(list);
  } else {
    topTagsCard.appendChild(el('p', { class: 'analytics-empty' }, { children: ['برچسبی ثبت نشده'] }));
  }
  tagsRow.appendChild(topTagsCard);

  const catsCard = el('div', { class: 'analytics-card' });
  catsCard.appendChild(cardHead('📁 دسته‌بندی‌ها'));
  if (bundle.categories?.length) {
    const list = el('ul', { class: 'analytics-list' });
    const max = bundle.categories[0].count;
    for (const c of bundle.categories) {
      const li = el('li', { class: 'analytics-list__item' });
      li.appendChild(el('span', { class: 'analytics-list__icon' }, { children: [c.icon] }));
      li.appendChild(el('span', { class: 'analytics-list__label' }, { children: [c.name] }));
      li.appendChild(el('span', { class: 'analytics-list__bar-wrap' }, {
        children: [el('span', { class: 'analytics-list__bar', style: { width: `${(c.count / max) * 100}%`, background: c.color } })],
      }));
      li.appendChild(el('span', { class: 'analytics-list__value' }, { children: [toFaDigits(c.count)] }));
      list.appendChild(li);
    }
    catsCard.appendChild(list);
  } else {
    catsCard.appendChild(el('p', { class: 'analytics-empty' }, { children: ['دسته‌ای ثبت نشده'] }));
  }
  tagsRow.appendChild(catsCard);
  page.appendChild(tagsRow);

  container.appendChild(page);
}

/* ── Helpers ─────────────────────────────────────────────── */

function kpiTile(label, value, accent) {
  const tile = el('div', { class: 'kpi-tile', style: { '--kpi-accent': accent } });
  tile.appendChild(el('span', { class: 'kpi-tile__value' }, {
    children: [typeof value === 'number' ? toFaDigits(value) : value],
  }));
  tile.appendChild(el('span', { class: 'kpi-tile__label' }, { children: [label] }));
  return tile;
}

function sectionHead(title, icon, subtitle) {
  const head = el('header', { class: 'analytics-section__head' });
  head.appendChild(el('h2', { class: 'analytics-section__title' }, {
    children: [el('span', {}, { children: [icon] }), title],
  }));
  if (subtitle) head.appendChild(el('p', { class: 'analytics-section__subtitle' }, { children: [subtitle] }));
  return head;
}

function cardHead(title) {
  return el('header', { class: 'analytics-card__head' }, {
    children: [el('h3', { class: 'analytics-card__title' }, { children: [title] })],
  });
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  return box;
}

export default { renderAnalytics };