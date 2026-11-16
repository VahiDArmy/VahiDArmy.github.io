/* ============================================================
   Details drawer — shop / product with stats, comparison, purchases
   ============================================================ */
import { store } from '../state.js';
import { el, formatDate, formatPrice, formatRelative, formatNumber } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS } from '../state.js';
import { buildShopStats, buildProductStats } from '../selectors.js';
import { deleteShop, deleteProduct } from '../api.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import { mountComments } from './comments.js';
import { openPurchaseModal } from './purchase-modal.js';

let current = null;

const SHOP_AVATAR_CLASSES = ['violet', 'cyan', 'rose', 'amber', 'emerald', 'indigo'];
function shopAvatarClass(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SHOP_AVATAR_CLASSES[Math.abs(h) % SHOP_AVATAR_CLASSES.length];
}

export function openShopDrawer(shopId) {
  const shop = store.shops.get().find((s) => s.id === shopId);
  if (!shop) return notify.error('فروشگاه یافت نشد');
  openDrawer({ type: 'shop', entity: shop });
}

export function openProductDrawer(productId) {
  const product = store.products.get().find((p) => p.id === productId);
  if (!product) return notify.error('محصول یافت نشد');
  openDrawer({ type: 'product', entity: product });
}

function closeCurrent() {
  if (current) { current.close(); current = null; }
}

function openDrawer({ type, entity }) {
  closeCurrent();

  const backdrop = el('div', { class: 'drawer-backdrop' });
  const drawer = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true' });

  const header = el('div', { class: 'drawer__header' });
  const body = el('div', { class: 'drawer__body' });
  drawer.append(header, body);

  const portal = document.getElementById('portal-root') || document.body;
  portal.appendChild(backdrop);
  portal.appendChild(drawer);
  document.body.classList.add('has-modal');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    drawer.classList.add('is-closing');
    backdrop.classList.add('is-closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      drawer.remove();
      backdrop.remove();
      if (!document.querySelector('.modal-backdrop') && !document.querySelector('.drawer')) {
        document.body.classList.remove('has-modal');
      }
      if (current && current.close === close) current = null;
    }, 200);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', close);

  current = { close };

  function renderHeader() {
    header.innerHTML = '';
    const backBtn = el('button', {
      type: 'button', class: 'btn btn--icon btn--sm', 'aria-label': 'بستن',
      html: icon('chevronRight', 16), onclick: close,
    });
    const title = el('div', { class: 'drawer__title', text: type === 'shop' ? 'فروشگاه' : 'محصول' });
    const deleteBtn = el('button', {
      type: 'button',
      class: 'btn btn--icon btn--sm',
      'aria-label': 'حذف', 'data-tooltip': 'حذف',
      html: icon('trash', 14),
      onclick: handleDelete,
    });
    const addBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary btn--sm',
      html: `${icon('plus', 14)}<span>خرید</span>`,
      onclick: () => openPurchaseModal({ mode: 'create' }),
    });
    header.append(backBtn, title, el('div', { style: { marginInlineStart: 'auto', display: 'flex', gap: '6px' } }, [deleteBtn, addBtn]));
  }

  function render() {
    renderHeader();
    body.innerHTML = '';

    const purchases = store.purchases.get();
    const stats = type === 'shop'
      ? buildShopStats(purchases, entity.id)
      : buildProductStats(purchases, entity.id);

    // hero
    const hero = el('div', { class: 'details-hero' }, [
      el('div', {
        class: type === 'shop'
          ? `avatar-shop avatar-shop--${shopAvatarClass(entity.id)} details-hero__avatar`
          : 'avatar details-hero__avatar',
        style: { '--_size': '64px', fontSize: '24px' },
        text: (entity.name?.[0] || '؟').toUpperCase(),
      }),
      el('div', { class: 'details-hero__name', text: entity.name }),
      (entity.category || entity.unit) ? el('div', { class: 'details-hero__meta',
        text: [entity.category, entity.unit].filter(Boolean).join(' · ') }) : null,
      el('div', { class: 'details-hero__meta',
        text: `${formatNumber(stats.total)} خرید ثبت‌شده` }),
    ].filter(Boolean));

    // stats grid
    const statsGrid = el('div', { class: 'details-stats' }, [
      statBox('خوب', stats.good, 'good'),
      statBox('بد', stats.bad, 'bad'),
      statBox('افتضاح', stats.shit, 'shit'),
    ]);

    const spend = el('div', { class: 'details-row' }, [
      el('span', { class: 'details-row__label', text: 'مجموع هزینه' }),
      el('span', { class: 'details-row__value', text: formatPrice(stats.spent) }),
    ]);
    const last = el('div', { class: 'details-row' }, [
      el('span', { class: 'details-row__label', text: 'آخرین خرید' }),
      el('span', { class: 'details-row__value',
        text: stats.lastAt ? formatRelative(new Date(stats.lastAt).toISOString()) : '—' }),
    ]);

    // Product: shop comparison
    const comparison = type === 'product' ? renderShopComparison(purchases, entity.id) : null;

    // purchases list
    const purchasesBlock = renderPurchasesList(stats.items);

    // comments
    const comments = mountComments({
      targetType: type,
      targetId: entity.id,
      compact: true,
    });

    body.append(
      hero,
      el('div', { class: 'details-section' }, [
        el('div', { class: 'details-section__title', text: 'آمار' }),
        statsGrid,
        spend,
        last,
      ]),
    );

    if (comparison) {
      body.appendChild(el('div', { class: 'details-section' }, [
        el('div', { class: 'details-section__title', text: 'مقایسه فروشگاه‌ها' }),
        comparison,
      ]));
    }

    body.append(
      el('div', { class: 'details-section' }, [
        el('div', { class: 'details-section__title', text: 'خریدهای مرتبط' }),
        purchasesBlock,
      ]),
      el('div', { class: 'details-section' }, [
        el('div', { class: 'details-section__title', text: 'یادداشت‌ها' }),
        comments,
      ]),
    );
  }

  function statBox(label, value, cls) {
    return el('div', { class: `details-stat details-stat--${cls}` }, [
      el('div', { class: 'details-stat__value', text: formatNumber(value) }),
      el('div', { class: 'details-stat__label', text: label }),
    ]);
  }

  /* ---------- Product → shop comparison ---------- */

  function renderShopComparison(purchases, productId) {
    const byShop = new Map();
    for (const p of purchases) {
      if (p.product_id !== productId) continue;
      const k = p.shop_id;
      if (!byShop.has(k)) {
        byShop.set(k, {
          shop: p.shop,
          good: 0, bad: 0, shit: 0, total: 0,
          lastAt: 0,
          prices: [],
        });
      }
      const acc = byShop.get(k);
      acc[p.rating] = (acc[p.rating] || 0) + 1;
      acc.total++;
      const t = new Date(p.purchased_at || p.created_at).getTime();
      if (t > acc.lastAt) acc.lastAt = t;
      if (p.price != null) acc.prices.push(Number(p.price));
    }

    if (byShop.size < 2) {
      return el('div', { class: 'details-empty',
        text: 'این محصول فقط از یک فروشگاه خریداری شده. با خرید از فروشگاه‌های دیگر، مقایسه نمایش داده می‌شود.' });
    }

    const arr = [...byShop.values()]
      .map((x) => ({
        ...x,
        score: x.good * 3 + x.bad * 1 - x.shit * 2,
        avgPrice: x.prices.length ? x.prices.reduce((a, b) => a + b, 0) / x.prices.length : null,
      }))
      .sort((a, b) => b.score - a.score || b.total - a.total);

    const wrap = el('div', { class: 'shop-compare' });
    arr.forEach((x, idx) => {
      const isBest = idx === 0 && x.score > 0;
      const total = x.total || 1;
      const goodPct = Math.round((x.good / total) * 100);
      const badPct = Math.round((x.bad / total) * 100);
      const shitPct = Math.round((x.shit / total) * 100);

      const row = el('button', {
        type: 'button',
        class: 'shop-compare__row' + (isBest ? ' is-best' : ''),
        onclick: () => {
          // open the shop drawer
          const shopId = x.shop?.id;
          if (shopId) { close(); setTimeout(() => openShopDrawer(shopId), 80); }
        },
      }, [
        el('span', {
          class: `avatar-shop avatar-shop--${shopAvatarClass(x.shop?.id || 'x')}`,
          style: { '--_size': '32px', fontSize: '12px' },
          text: (x.shop?.name?.[0] || '؟').toUpperCase(),
        }),
        el('div', { class: 'shop-compare__body' }, [
          el('div', { class: 'shop-compare__name' }, [
            document.createTextNode(x.shop?.name || '—'),
            isBest ? el('span', { class: 'shop-compare__best', text: 'بهترین' }) : null,
          ].filter(Boolean)),
          el('div', { class: 'shop-compare__bar' }, [
            goodPct ? el('span', { class: 'shop-compare__seg shop-compare__seg--good', style: { flex: String(goodPct) } }) : null,
            badPct  ? el('span', { class: 'shop-compare__seg shop-compare__seg--bad',  style: { flex: String(badPct) } })  : null,
            shitPct ? el('span', { class: 'shop-compare__seg shop-compare__seg--shit', style: { flex: String(shitPct) } }) : null,
          ].filter(Boolean)),
          el('div', { class: 'shop-compare__meta' }, [
            el('span', { text: `${formatNumber(x.good)} خوب · ${formatNumber(x.bad)} بد · ${formatNumber(x.shit)} افتضاح` }),
            x.avgPrice != null
              ? el('span', { text: 'میانگین ' + formatPrice(Math.round(x.avgPrice)) })
              : null,
          ].filter(Boolean)),
        ]),
        el('span', { class: 'shop-compare__chevron', html: icon('chevronLeft', 14) }),
      ]);
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ---------- Purchases list ---------- */

  function renderPurchasesList(items) {
    if (!items.length) {
      return el('div', { class: 'details-empty', text: 'خریدی ثبت نشده' });
    }
    const list = el('div', { class: 'details-purchases' });
    const recent = [...items]
      .sort((a, b) => new Date(b.purchased_at || b.created_at).getTime() - new Date(a.purchased_at || a.created_at).getTime())
      .slice(0, 10);
    for (const p of recent) {
      const r = RATINGS[p.rating] || { label: '—' };
      list.appendChild(el('div', { class: 'details-purchase' }, [
        el('div', { style: { flex: '1', minWidth: '0' } }, [
          el('div', { class: 'details-purchase__main',
            text: type === 'shop' ? (p.product?.name || '—') : (p.shop?.name || '—') }),
          el('div', { class: 'details-purchase__meta' }, [
            document.createTextNode(formatDate(p.purchased_at || p.created_at)),
            p.platform ? document.createTextNode(' · ' + p.platform.name) : null,
            p.price != null ? document.createTextNode(' · ' + formatPrice(p.price)) : null,
          ].filter(Boolean)),
        ]),
        el('span', { class: `rating rating--${p.rating}` }, [
          el('span', { class: 'rating__dot' }),
          el('span', { text: r.label }),
        ]),
      ]));
    }
    return list;
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `حذف ${type === 'shop' ? 'فروشگاه' : 'محصول'}`,
      message: `آیا مطمئنی؟ تمام خریدهای مرتبط هم حذف می‌شوند.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    try {
      if (type === 'shop') {
        await deleteShop(entity.id);
        store.shops.set(store.shops.get().filter((s) => s.id !== entity.id));
        store.purchases.set(store.purchases.get().filter((p) => p.shop_id !== entity.id));
      } else {
        await deleteProduct(entity.id);
        store.products.set(store.products.get().filter((p) => p.id !== entity.id));
        store.purchases.set(store.purchases.get().filter((p) => p.product_id !== entity.id));
      }
      notify.success('حذف شد');
      close();
    } catch (err) {
      notify.error(err?.message || 'خطا در حذف');
    }
  }

  store.purchases.subscribe(render);
  store.comments.subscribe(render);
  render();
}
