/* ============================================================
   Period comparison — side-by-side metrics for two ranges
   ============================================================ */
import { store } from '../state.js';
import { el, formatNumber, formatPrice } from '../utils.js';
import { icon } from './icons.js';

const PRESETS = [
  { key: '7d',  label: '۷ روز اخیر',        days: 7 },
  { key: '30d', label: '۳۰ روز اخیر',       days: 30 },
  { key: '90d', label: '۳ ماه اخیر',        days: 90 },
];

export function mountPeriodCompare() {
  const wrap = el('div', { class: 'period-compare' });
  let activePreset = '30d';

  function render() {
    wrap.innerHTML = '';
    const preset = PRESETS.find((p) => p.key === activePreset);
    const purchases = store.purchases.get();
    const { current, previous } = splitPeriods(purchases, preset.days);

    // Switcher
    const switcher = el('div', { class: 'period-switcher' });
    for (const p of PRESETS) {
      switcher.appendChild(el('button', {
        type: 'button',
        class: 'period-switcher__btn' + (p.key === activePreset ? ' is-active' : ''),
        text: p.label,
        onclick: () => { activePreset = p.key; render(); },
      }));
    }
    wrap.appendChild(switcher);

    // Stats
    const cur = metrics(current);
    const prev = metrics(previous);

    wrap.appendChild(el('div', { class: 'period-grid' }, [
      metricCard('خریدها', cur.total, prev.total, 'count'),
      metricCard('خرید خوب', cur.good, prev.good, 'count'),
      metricCard('افتضاح', cur.shit, prev.shit, 'count', true),
      metricCard('هزینه', cur.spent, prev.spent, 'money', true),
      metricCard('میانگین خرید', cur.avg, prev.avg, 'money', true),
      metricCard('فروشگاه‌ها', cur.shops, prev.shops, 'count'),
    ]));
  }

  function metricCard(label, cur, prev, type, inverted = false) {
    const delta = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
    const isFlat = delta === 0;
    let tone = 'flat';
    if (!isFlat) {
      const up = delta > 0;
      tone = (up !== inverted) ? 'up' : 'down';
    }
    const fmt = type === 'money' ? formatPrice : formatNumber;

    return el('div', { class: `period-stat period-stat--${tone}` }, [
      el('div', { class: 'period-stat__label', text: label }),
      el('div', { class: 'period-stat__value', text: fmt(cur) }),
      el('div', { class: 'period-stat__delta' }, [
        el('span', { class: 'period-stat__delta-icon',
          html: icon(isFlat ? 'minus' : (delta > 0 ? 'arrowUp' : 'arrowDown'), 12) }),
        el('span', {
          text: isFlat ? 'بدون تغییر' :
            `${formatNumber(Math.abs(delta))}٪ ${delta > 0 ? 'بیشتر' : 'کمتر'}`,
        }),
      ]),
      el('div', { class: 'period-stat__sub', text: `قبلی: ${fmt(prev)}` }),
    ]);
  }

  store.purchases.subscribe(render);
  render();
  return wrap;
}

function splitPeriods(purchases, days) {
  const now = Date.now();
  const day = 86400000;
  const cutoff = now - days * day;
  const prevCutoff = cutoff - days * day;
  const current = [];
  const previous = [];
  for (const p of purchases) {
    const t = new Date(p.purchased_at || p.created_at).getTime();
    if (t >= cutoff && t <= now) current.push(p);
    else if (t >= prevCutoff && t < cutoff) previous.push(p);
  }
  return { current, previous };
}

function metrics(list) {
  let total = 0, good = 0, shit = 0, spent = 0, priced = 0;
  const shops = new Set();
  for (const p of list) {
    total++;
    if (p.rating === 'good') good++;
    if (p.rating === 'shit') shit++;
    if (p.price != null) { spent += Number(p.price) * (Number(p.quantity) || 1); priced++; }
    if (p.shop_id) shops.add(p.shop_id);
  }
  return {
    total, good, shit, spent,
    avg: priced ? Math.round(spent / priced) : 0,
    shops: shops.size,
  };
}
