/* ============================================================
   Analytics modal — charts + period comparison
   ============================================================ */
import { store } from '../state.js';
import { el, formatNumber, formatPrice } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { hBarChart, vBarChart, donutChart, pickColor } from './charts.js';
import { purchaseStats } from '../api.js';
import { openReportModal } from './report-modal.js';
import { mountPeriodCompare } from './period-compare.js';

const FA_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function openAnalyticsModal() {
  const bodyHost = el('div', { class: 'analytics-body' });

  const { close } = mountModal({
    title: 'تحلیل خریدها',
    subtitle: 'نگاه عمیق به عادت‌های خریدت',
    size: 'xl',
    body: [bodyHost],
    footer: [
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--lg', text: 'بستن',
        onclick: () => close(),
      }),
      el('button', {
        type: 'button', class: 'btn btn--outline btn--lg',
        html: `${icon('external', 16)}<span>گزارش ماهانه</span>`,
        onclick: () => { close(); setTimeout(() => openReportModal(), 200); },
      }),
    ],
  });

  function render() {
    bodyHost.innerHTML = '';
    const purchases = store.purchases.get();
    const stats = purchaseStats(purchases);

    if (!purchases.length) {
      bodyHost.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__icon', html: icon('barChart', 32) }),
        el('div', { class: 'empty-state__title', text: 'داده‌ای برای تحلیل نیست' }),
        el('div', { class: 'empty-state__desc', text: 'چند خرید ثبت کن تا نمودارها ظاهر شوند.' }),
      ]));
      return;
    }

    const goodPct = Math.round((stats.good / stats.total) * 100);
    const shitPct = Math.round((stats.shit / stats.total) * 100);
    const avgPrice = computeAvgPrice(purchases);
    const bestDay = computeBestDay(purchases);
    const trend = computeSpendTrend(purchases);

    bodyHost.appendChild(el('div', { class: 'analytics-summary analytics-summary--six' }, [
      summaryCard('کل خریدها', formatNumber(stats.total), 'brand'),
      summaryCard('خرید خوب', `${formatNumber(stats.good)} (${formatNumber(goodPct)}٪)`, 'good'),
      summaryCard('افتضاح', `${formatNumber(stats.shit)} (${formatNumber(shitPct)}٪)`, 'shit'),
      summaryCard('مجموع هزینه', formatPrice(stats.totalSpent), 'cyan'),
      summaryCard('میانگین هر خرید', avgPrice ? formatPrice(avgPrice) : '—', 'brand'),
      summaryCard('بهترین روز', bestDay || '—', 'good'),
    ]));

    if (trend) bodyHost.appendChild(renderTrendCard(trend));

    // Period comparison
    bodyHost.appendChild(el('div', { class: 'analytics-panel analytics-panel--wide' }, [
      el('div', { class: 'analytics-panel__header' }, [
        el('div', { class: 'analytics-panel__icon', html: icon('clock', 16) }),
        el('div', {}, [
          el('div', { class: 'analytics-panel__title', text: 'مقایسهٔ دوره‌ای' }),
          el('div', { class: 'analytics-panel__sub', text: 'این دوره در برابر دورهٔ قبل' }),
        ]),
      ]),
      (() => {
        const b = el('div', { class: 'analytics-panel__body' });
        b.appendChild(mountPeriodCompare());
        return b;
      })(),
    ]));

    const grid = el('div', { class: 'analytics-grid' });

    grid.appendChild(renderPanel({
      title: 'روزهای هفته',
      subtitle: 'کدام روزها بیشتر خرید می‌کنی',
      icon: 'calendar',
      content: buildDayOfWeekChart(purchases),
    }));
    grid.appendChild(renderPanel({
      title: 'بهترین فروشگاه‌ها',
      subtitle: 'بر اساس تعداد خریدهای خوب',
      icon: 'star',
      content: buildTopShops(purchases, 'good', 5, 'good'),
    }));
    grid.appendChild(renderPanel({
      title: 'فروشگاه‌های مشکل‌دار',
      subtitle: 'بر اساس خریدهای افتضاح',
      icon: 'alert',
      content: buildTopShops(purchases, 'shit', 5, 'shit'),
    }));
    grid.appendChild(renderPanel({
      title: 'روند ماهانه',
      subtitle: 'تعداد خرید در ۶ ماه اخیر',
      icon: 'barChart',
      content: buildMonthlyTimeline(purchases),
    }));
    grid.appendChild(renderPanel({
      title: 'پلتفرم‌ها',
      subtitle: 'توزیع خرید بر اساس پلتفرم',
      icon: 'layers',
      content: buildPlatformDistribution(purchases),
    }));
    grid.appendChild(renderPanel({
      title: 'پرتکرارترین محصولات',
      subtitle: 'محصولاتی که بیش از همه خریدی',
      icon: 'package',
      content: buildTopProducts(purchases, 8),
      wide: true,
    }));

    bodyHost.appendChild(grid);
  }

  function summaryCard(label, value, tone) {
    return el('div', { class: `analytics-stat analytics-stat--${tone}` }, [
      el('div', { class: 'analytics-stat__label', text: label }),
      el('div', { class: 'analytics-stat__value', text: String(value) }),
    ]);
  }

  function renderTrendCard(trend) {
    const up = trend.delta >= 0;
    return el('div', { class: `trend-card ${up ? 'trend-card--up' : 'trend-card--down'}` }, [
      el('div', { class: 'trend-card__icon', html: icon(up ? 'arrowUp' : 'arrowDown', 20) }),
      el('div', { class: 'trend-card__body' }, [
        el('div', { class: 'trend-card__title',
          text: up ? 'هزینهٔ این ماه بیشتر از ماه قبل' : 'هزینهٔ این ماه کمتر از ماه قبل' }),
        el('div', { class: 'trend-card__desc',
          text: `${formatPrice(trend.thisMonth)} در برابر ${formatPrice(trend.lastMonth)}` }),
      ]),
      el('div', { class: 'trend-card__delta' }, [
        el('span', { class: 'trend-card__delta-num',
          text: (up ? '+' : '−') + formatNumber(Math.abs(trend.pct)) + '٪' }),
      ]),
    ]);
  }

  function computeAvgPrice(purchases) {
    let sum = 0, n = 0;
    for (const p of purchases) if (p.price != null) { sum += Number(p.price) * (Number(p.quantity) || 1); n++; }
    return n ? Math.round(sum / n) : 0;
  }

  function computeBestDay(purchases) {
    if (!purchases.length) return null;
    const counts = new Array(7).fill(0);
    for (const p of purchases) counts[new Date(p.purchased_at || p.created_at).getDay()]++;
    let best = 0, bestIdx = 0;
    for (let i = 0; i < 7; i++) if (counts[i] > best) { best = counts[i]; bestIdx = i; }
    return FA_DAYS[bestIdx] || null;
  }

  function computeSpendTrend(purchases) {
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
    let thisSpent = 0, lastSpent = 0;
    for (const p of purchases) {
      if (p.price == null) continue;
      const d = new Date(p.purchased_at || p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amt = Number(p.price) * (Number(p.quantity) || 1);
      if (key === thisKey) thisSpent += amt;
      else if (key === lastKey) lastSpent += amt;
    }
    if (!thisSpent && !lastSpent) return null;
    const delta = thisSpent - lastSpent;
    const pct = lastSpent > 0 ? Math.round((delta / lastSpent) * 100) : 100;
    return { thisMonth: thisSpent, lastMonth: lastSpent, delta, pct };
  }

  function renderPanel({ title, subtitle, icon: iconName, content, wide }) {
    const panel = el('div', { class: 'analytics-panel' + (wide ? ' analytics-panel--wide' : '') });
    panel.appendChild(el('div', { class: 'analytics-panel__header' }, [
      el('div', { class: 'analytics-panel__icon', html: icon(iconName, 16) }),
      el('div', {}, [
        el('div', { class: 'analytics-panel__title', text: title }),
        subtitle ? el('div', { class: 'analytics-panel__sub', text: subtitle }) : null,
      ].filter(Boolean)),
    ]));
    const b = el('div', { class: 'analytics-panel__body' });
    if (content && content.nodeType) b.appendChild(content);
    else b.innerHTML = content;
    panel.appendChild(b);
    return panel;
  }

  function buildDayOfWeekChart(purchases) {
    const counts = new Array(7).fill(0);
    for (const p of purchases) counts[new Date(p.purchased_at || p.created_at).getDay()]++;
    const order = [6, 0, 1, 2, 3, 4, 5];
    const items = order.map((i) => ({ label: FA_DAYS[i], value: counts[i], color: 'var(--brand-grad)' }));
    return vBarChart(items, { height: 180 });
  }

  function buildTopShops(purchases, ratingKey, limit, tone) {
    const counts = new Map();
    for (const p of purchases) {
      if (p.rating !== ratingKey) continue;
      const k = p.shop_id;
      const name = p.shop?.name || '—';
      const cur = counts.get(k) || { label: name, value: 0 };
      cur.value++;
      counts.set(k, cur);
    }
    const items = [...counts.values()].sort((a, b) => b.value - a.value).slice(0, limit);
    if (!items.length) {
      return `<div class="chart-empty">${
        ratingKey === 'good' ? 'هنوز خرید خوبی ثبت نکردی' : 'خوشبختانه خرید افتضاحی نداشتی'
      }</div>`;
    }
    const color = tone === 'good'
      ? 'linear-gradient(90deg, #10b981, #34d399)'
      : 'linear-gradient(90deg, #ef4444, #f87171)';
    return hBarChart(items.map((i) => ({ ...i, color })));
  }

  function buildTopProducts(purchases, limit) {
    const counts = new Map();
    for (const p of purchases) {
      const k = p.product_id;
      const name = p.product?.name || '—';
      const cur = counts.get(k) || { label: name, value: 0 };
      cur.value++;
      counts.set(k, cur);
    }
    const items = [...counts.values()].sort((a, b) => b.value - a.value).slice(0, limit);
    return hBarChart(items.map((i, idx) => ({ ...i, color: pickColor(idx) })));
  }

  function buildMonthlyTimeline(purchases) {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      let label = '';
      try { label = new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(d); }
      catch { label = `${d.getMonth() + 1}`; }
      const total = purchases.filter((p) => {
        const pd = new Date(p.purchased_at || p.created_at);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).length;
      months.push({ label, value: total, color: 'var(--brand-grad)' });
    }
    return vBarChart(months, { height: 200 });
  }

  function buildPlatformDistribution(purchases) {
    const counts = new Map();
    let unassigned = 0;
    for (const p of purchases) {
      if (!p.platform_id) { unassigned++; continue; }
      const k = p.platform_id;
      const name = p.platform?.name || '—';
      const color = p.platform?.color || pickColor(counts.size);
      const cur = counts.get(k) || { label: name, value: 0, color };
      cur.value++;
      counts.set(k, cur);
    }
    const items = [...counts.values()].sort((a, b) => b.value - a.value);
    if (unassigned) items.push({ label: 'بدون پلتفرم', value: unassigned, color: '#4b5563' });
    return donutChart(items, { size: 190 });
  }

  store.purchases.subscribe(render);
  render();
}
