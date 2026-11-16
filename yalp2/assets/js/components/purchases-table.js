/* ============================================================
   Purchases table — filtered, sortable, with row actions
   ============================================================ */
import { store } from '../state.js';
import { el, formatDate, formatPrice, toFaDigits, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS } from '../state.js';
import { computeFilteredPurchases, hasActiveFilters } from '../selectors.js';
import { deletePurchase, refreshPurchases } from '../api.js';
import { openPurchaseModal } from './purchase-modal.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import { openShopDrawer, openProductDrawer } from './details-drawer.js';

const SHOP_AVATAR_CLASSES = ['violet', 'cyan', 'rose', 'amber', 'emerald', 'indigo'];
function shopAvatarClass(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SHOP_AVATAR_CLASSES[Math.abs(h) % SHOP_AVATAR_CLASSES.length];
}

export function mountPurchasesTable() {
  const wrap = el('div', { class: 'purchases-table-host' });

  function render() {
    const purchases = store.purchases.get();
    const filters = store.filters.get();

    if (!purchases.length) {
      wrap.innerHTML = '';
      wrap.appendChild(renderGlobalEmpty());
      return;
    }

    const filtered = computeFilteredPurchases(purchases, filters);

    wrap.innerHTML = '';
    if (!filtered.length) {
      wrap.appendChild(renderFilterEmpty());
      return;
    }

    const tableWrap = el('div', { class: 'data-table-wrap' });
    const scroll = el('div', { class: 'data-table-scroll' });
    const table = el('table', { class: 'data-table' });

    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        th('تاریخ', 'col-date'),
        th('فروشگاه', 'col-shop'),
        th('محصول', 'col-product'),
        th('پلتفرم', 'col-platform'),
        th('امتیاز', 'col-rating'),
        th('قیمت', 'col-price'),
        th('', 'col-actions'),
      ]),
    ]));

    const tbody = el('tbody');
    for (const p of filtered) {
      tbody.appendChild(renderRow(p));
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    tableWrap.appendChild(scroll);
    wrap.appendChild(tableWrap);
  }

  function th(label, cls) {
    return el('th', { class: cls, text: label });
  }

  function renderRow(p) {
    const shop = p.shop || {};
    const product = p.product || {};
    const platform = p.platform || null;
    const rating = RATINGS[p.rating] || { label: '—' };

    const shopCell = el('td', { class: 'col-shop' }, [
      el('div', {
        class: 'cell-shop',
        onclick: () => openShopDrawer(p.shop_id),
      }, [
        el('span', {
          class: `avatar-shop avatar-shop--${shopAvatarClass(shop.id || 'x')}`,
          text: (shop.name?.[0] || '؟').toUpperCase(),
        }),
        el('div', { class: 'cell-shop__info' }, [
          el('div', { class: 'cell-shop__name', text: shop.name || '—' }),
          shop.category ? el('div', { class: 'cell-shop__meta', text: shop.category }) : null,
        ].filter(Boolean)),
      ]),
    ]);

    const productCell = el('td', { class: 'col-product' }, [
      el('div', {
        class: 'cell-product',
        onclick: () => openProductDrawer(p.product_id),
      }, [
        el('div', { class: 'cell-product__info' }, [
          el('div', { class: 'cell-product__name', text: product.name || '—' }),
          (product.category || product.unit)
            ? el('div', { class: 'cell-product__meta',
                text: [product.category, product.unit].filter(Boolean).join(' · ') })
            : null,
        ].filter(Boolean)),
      ]),
    ]);

    const platformCell = el('td', { class: 'col-platform' },
      platform ? [
        el('span', { class: 'platform-badge' }, [
          el('span', {
            class: 'platform-badge__dot',
            style: { background: platform.color || '#6366f1' },
          }),
          el('span', { text: platform.name }),
        ]),
      ] : [el('span', { style: { color: 'var(--text-4)' }, text: '—' })],
    );

    const ratingCell = el('td', { class: 'col-rating' }, [
      el('span', { class: `rating rating--${p.rating}` }, [
        el('span', { class: 'rating__dot' }),
        el('span', { text: rating.label }),
      ]),
    ]);

    const priceCell = el('td', { class: 'col-price' }, [
      p.price != null
        ? document.createTextNode(formatPrice(p.price))
        : el('span', { style: { color: 'var(--text-4)' }, text: '—' }),
    ]);

    const actionsCell = el('td', { class: 'col-actions' }, [
      el('div', { class: 'row-actions' }, [
        el('button', {
          type: 'button', class: 'btn btn--icon btn--sm', 'aria-label': 'ویرایش',
          'data-tooltip': 'ویرایش', html: icon('edit', 14),
          onclick: () => handleEdit(p),
        }),
        el('button', {
          type: 'button', class: 'btn btn--icon btn--sm is-danger', 'aria-label': 'حذف',
          'data-tooltip': 'حذف', html: icon('trash', 14),
          onclick: () => handleDelete(p),
        }),
      ]),
    ]);

    return el('tr', {}, [
      el('td', { class: 'col-date', text: formatDate(p.purchased_at || p.created_at) }),
      shopCell,
      productCell,
      platformCell,
      ratingCell,
      priceCell,
      actionsCell,
    ]);
  }

  function renderGlobalEmpty() {
    return el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__icon', html: icon('cart', 32) }),
      el('div', { class: 'empty-state__title', text: 'هنوز خریدی ثبت نکردی' }),
      el('div', { class: 'empty-state__desc',
        text: 'روی «ثبت خرید» بزن، فروشگاه، محصول، پلتفرم و امتیاز را وارد کن. جدول خریدها با جستجوی زنده همین‌جا نمایش داده می‌شود.' }),
      el('button', {
        type: 'button', class: 'btn btn--primary btn--lg',
        html: `${icon('plus', 16)}<span>ثبت اولین خرید</span>`,
        onclick: () => openPurchaseModal({ mode: 'create' }),
      }),
    ]);
  }

  function renderFilterEmpty() {
    return el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__icon', html: icon('search', 32) }),
      el('div', { class: 'empty-state__title', text: 'چیزی مطابق فیلترها پیدا نشد' }),
      el('div', { class: 'empty-state__desc',
        text: 'فیلترها را تغییر بده یا جستجو را پاک کن.' }),
      el('button', {
        type: 'button', class: 'btn btn--outline btn--lg',
        html: `${icon('refresh', 16)}<span>پاک کردن فیلترها</span>`,
        onclick: () => {
          const f = store.filters.get();
          store.filters.set({
            ...f,
            ratings: new Set(),
            platformIds: new Set(),
            shopIds: new Set(),
            productIds: new Set(),
          });
        },
      }),
    ]);
  }

  async function handleEdit(p) {
    await openPurchaseModal({ mode: 'edit', initial: p });
  }

  async function handleDelete(p) {
    const ok = await confirmDialog({
      title: 'حذف خرید',
      message: `خرید «${p.shop?.name || ''} → ${p.product?.name || ''}» حذف شود؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePurchase(p.id);
      store.purchases.set(store.purchases.get().filter((x) => x.id !== p.id));
      notify.success('خرید حذف شد');
    } catch (err) {
      notify.error(err?.message || 'خطا در حذف');
    }
  }

  store.purchases.subscribe(render);
  store.filters.subscribe(render);
  render();
  return wrap;
}
