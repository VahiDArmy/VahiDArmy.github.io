/* ============================================================
   Grouped view — purchases grouped by month (accordion)
   ============================================================ */
import { store } from '../state.js';
import { el, formatNumber, formatDate, formatPrice, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS } from '../state.js';
import { computeFilteredPurchases } from '../selectors.js';
import { openShopDrawer, openProductDrawer } from './details-drawer.js';

const SHOP_AVATAR_CLASSES = ['violet', 'cyan', 'rose', 'amber', 'emerald', 'indigo'];
function shopAvatarClass(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SHOP_AVATAR_CLASSES[Math.abs(h) % SHOP_AVATAR_CLASSES.length];
}

export function mountGroupedView() {
  const wrap = el('div', { class: 'grouped-view' });
  const openMonths = new Set(); // persisted in closure

  function render() {
    const purchases = store.purchases.get();
    const filters = store.filters.get();
    const filtered = computeFilteredPurchases(purchases, filters);

    wrap.innerHTML = '';

    if (!filtered.length) {
      wrap.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state__icon', html: icon('calendar', 32) }),
        el('div', { class: 'empty-state__title',
          text: purchases.length ? 'چیزی مطابق فیلترها پیدا نشد' : 'هنوز خریدی ثبت نکردی' }),
      ]));
      return;
    }

    // Group by YYYY-MM
    const groups = new Map();
    for (const p of filtered) {
      const d = new Date(p.purchased_at || p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

    // Default: open the newest month
    if (!openMonths.size && sortedKeys.length) openMonths.add(sortedKeys[0]);

    for (const key of sortedKeys) {
      const items = groups.get(key);
      wrap.appendChild(renderMonth(key, items));
    }
  }

  function renderMonth(key, items) {
    const [year, month] = key.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 1);
    let monthLabel = '';
    try {
      monthLabel = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(dateObj);
    } catch {
      monthLabel = key;
    }

    const isOpen = openMonths.has(key);
    const good = items.filter((p) => p.rating === 'good').length;
    const bad = items.filter((p) => p.rating === 'bad').length;
    const shit = items.filter((p) => p.rating === 'shit').length;
    let spent = 0;
    for (const p of items) if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);

    const header = el('button', {
      type: 'button',
      class: 'grouped-month__header',
      onclick: () => {
        if (openMonths.has(key)) openMonths.delete(key);
        else openMonths.add(key);
        render();
      },
    }, [
      el('span', {
        class: 'grouped-month__chev',
        style: { transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' },
        html: icon('chevronDown', 18),
      }),
      el('div', { class: 'grouped-month__title-block' }, [
        el('div', { class: 'grouped-month__title', text: monthLabel }),
        el('div', { class: 'grouped-month__sub',
          text: `${formatNumber(items.length)} خرید · ${formatPrice(spent)}` }),
      ]),
      el('div', { class: 'grouped-month__chips' }, [
        good ? el('span', { class: 'mini-chip mini-chip--good', text: `${formatNumber(good)} خوب` }) : null,
        bad  ? el('span', { class: 'mini-chip mini-chip--bad',  text: `${formatNumber(bad)} بد` })   : null,
        shit ? el('span', { class: 'mini-chip mini-chip--shit', text: `${formatNumber(shit)} افتضاح` }) : null,
      ].filter(Boolean)),
    ]);

    const body = el('div', { class: 'grouped-month__body', style: { display: isOpen ? 'block' : 'none' } });
    for (const p of items) body.appendChild(renderRow(p));

    return el('div', { class: 'grouped-month' + (isOpen ? ' is-open' : '') }, [header, body]);
  }

  function renderRow(p) {
    const shop = p.shop || {};
    const product = p.product || {};
    const platform = p.platform || null;
    const rating = RATINGS[p.rating] || { label: '—' };

    const shopBtn = el('button', {
      type: 'button',
      class: 'grouped-row__shop',
      onclick: () => openShopDrawer(p.shop_id),
    }, [
      el('span', {
        class: `avatar-shop avatar-shop--${shopAvatarClass(shop.id || 'x')}`,
        style: { '--_size': '28px', fontSize: '11px' },
        text: (shop.name?.[0] || '؟').toUpperCase(),
      }),
      el('span', { class: 'grouped-row__shop-name', text: shop.name || '—' }),
    ]);

    const productBtn = el('button', {
      type: 'button',
      class: 'grouped-row__product',
      onclick: () => openProductDrawer(p.product_id),
    }, [
      el('span', { class: 'grouped-row__product-name', text: product.name || '—' }),
      (product.category || product.unit) ? el('span', { class: 'grouped-row__product-meta',
        text: [product.category, product.unit].filter(Boolean).join(' · ') }) : null,
    ].filter(Boolean));

    return el('div', { class: 'grouped-row' }, [
      el('div', { class: 'grouped-row__date', text: formatDate(p.purchased_at || p.created_at) }),
      shopBtn,
      productBtn,
      platform ? el('span', { class: 'platform-badge grouped-row__platform' }, [
        el('span', { class: 'platform-badge__dot', style: { background: platform.color || '#6366f1' } }),
        el('span', { text: platform.name }),
      ]) : el('span', { class: 'grouped-row__platform', style: { color: 'var(--text-4)' }, text: '—' }),
      el('span', { class: `rating rating--${p.rating} grouped-row__rating` }, [
        el('span', { class: 'rating__dot' }),
        el('span', { text: rating.label }),
      ]),
      el('span', { class: 'grouped-row__price', text: p.price != null ? formatPrice(p.price) : '—' }),
    ]);
  }

  store.purchases.subscribe(render);
  store.filters.subscribe(render);
  render();
  return wrap;
}
