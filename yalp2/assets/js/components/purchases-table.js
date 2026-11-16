/* ============================================================
   Purchases table — with bulk actions, sortable headers, actions
   ============================================================ */
import { store } from '../state.js';
import { el, formatDate, formatPrice, formatNumber, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS } from '../state.js';
import { computeFilteredPurchases } from '../selectors.js';
import { deletePurchase, refreshPurchases } from '../api.js';
import { openPurchaseModal } from './purchase-modal.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import { openShopDrawer, openProductDrawer } from './details-drawer.js';
import { downloadPurchasesCsv } from '../utils/csv.js';

const SHOP_AVATAR_CLASSES = ['violet', 'cyan', 'rose', 'amber', 'emerald', 'indigo'];
function shopAvatarClass(id) {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SHOP_AVATAR_CLASSES[Math.abs(h) % SHOP_AVATAR_CLASSES.length];
}

export function mountPurchasesTable() {
  const wrap = el('div', { class: 'purchases-table-host' });
  const selection = new Set();       // selected purchase ids
  let lastVisible = [];

  function render() {
    const purchases = store.purchases.get();
    const filters = store.filters.get();
    wrap.innerHTML = '';

    if (!purchases.length) {
      wrap.appendChild(renderGlobalEmpty());
      return;
    }

    const filtered = computeFilteredPurchases(purchases, filters);
    lastVisible = filtered;

    // Prune selection that fell out of filtered set
    for (const id of [...selection]) {
      if (!filtered.some((p) => p.id === id)) selection.delete(id);
    }

    wrap.appendChild(renderToolbar(filtered));

    if (!filtered.length) {
      wrap.appendChild(renderFilterEmpty());
      return;
    }

    wrap.appendChild(renderTable(filtered));
  }

  /* ---------- Bulk toolbar ---------- */

  function renderToolbar(filtered) {
    const n = selection.size;
    const bar = el('div', { class: 'bulk-bar' + (n ? ' is-active' : '') });

    if (n === 0) {
      bar.appendChild(el('div', { class: 'bulk-bar__hint' }, [
        el('span', { html: icon('info', 14) }),
        el('span', { text: 'برای انتخاب چند خرید، از ستون سمت راست تیک بزن.' }),
      ]));
      // Export all visible
      const exportBtn = el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--sm',
        html: `${icon('arrowUp', 14)}<span>خروجی CSV (${formatNumber(filtered.length)})</span>`,
        onclick: () => {
          try {
            downloadPurchasesCsv(filtered);
            notify.success('فایل CSV آماده شد');
          } catch (err) {
            notify.error(err?.message || 'خطا در ساخت CSV');
          }
        },
      });
      bar.appendChild(exportBtn);
      return bar;
    }

    // Selection summary
    bar.appendChild(el('div', { class: 'bulk-bar__count' }, [
      el('span', { class: 'bulk-bar__count-num', text: formatNumber(n) }),
      el('span', { class: 'bulk-bar__count-label', text: 'خرید انتخاب شده' }),
    ]));

    const selectedItems = filtered.filter((p) => selection.has(p.id));

    // Export selected CSV
    bar.appendChild(el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm',
      html: `${icon('arrowUp', 14)}<span>CSV انتخاب‌شده</span>`,
      onclick: () => {
        try {
          downloadPurchasesCsv(selectedItems);
          notify.success('CSV انتخاب‌شده آماده شد');
        } catch (err) {
          notify.error(err?.message || 'خطا');
        }
      },
    }));

    // Bulk delete
    bar.appendChild(el('button', {
      type: 'button', class: 'btn btn--danger btn--sm',
      html: `${icon('trash', 14)}<span>حذف</span>`,
      onclick: async () => {
        const ok = await confirmDialog({
          title: `حذف ${formatNumber(n)} خرید`,
          message: 'این خریدها برای همیشه حذف شوند؟',
          confirmLabel: 'حذف همه',
          danger: true,
        });
        if (!ok) return;
        try {
          await Promise.all([...selection].map((id) => deletePurchase(id)));
          store.purchases.set(store.purchases.get().filter((p) => !selection.has(p.id)));
          selection.clear();
          notify.success(`${formatNumber(n)} خرید حذف شد`);
        } catch (err) {
          notify.error(err?.message || 'خطا در حذف');
        }
      },
    }));

    // Clear selection
    bar.appendChild(el('button', {
      type: 'button', class: 'btn btn--ghost btn--icon btn--sm',
      'aria-label': 'لغو انتخاب',
      html: icon('close', 14),
      onclick: () => { selection.clear(); render(); },
    }));

    return bar;
  }

  /* ---------- Table ---------- */

  function renderTable(filtered) {
    const tableWrap = el('div', { class: 'data-table-wrap' });
    const scroll = el('div', { class: 'data-table-scroll' });
    const table = el('table', { class: 'data-table' });

    // Header
    const allSelected = filtered.every((p) => selection.has(p.id));
    const someSelected = !allSelected && filtered.some((p) => selection.has(p.id));

    const masterCb = el('input', {
      type: 'checkbox',
      class: 'cb',
      'aria-label': 'انتخاب همه',
    });
    masterCb.checked = allSelected;
    masterCb.indeterminate = someSelected;
    masterCb.addEventListener('change', () => {
      if (masterCb.checked) {
        for (const p of filtered) selection.add(p.id);
      } else {
        for (const p of filtered) selection.delete(p.id);
      }
      render();
    });

    const thead = el('thead', {}, [
      el('tr', {}, [
        el('th', { class: 'col-select' }, [masterCb]),
        th('تاریخ', 'col-date'),
        th('فروشگاه', 'col-shop'),
        th('محصول', 'col-product'),
        th('پلتفرم', 'col-platform'),
        th('امتیاز', 'col-rating'),
        th('قیمت', 'col-price'),
        th('', 'col-actions'),
      ]),
    ]);

    const tbody = el('tbody');
    for (const p of filtered) tbody.appendChild(renderRow(p));

    table.append(thead, tbody);
    scroll.appendChild(table);
    tableWrap.appendChild(scroll);
    return tableWrap;
  }

  function th(label, cls) {
    return el('th', { class: cls, text: label });
  }

  function renderRow(p) {
    const shop = p.shop || {};
    const product = p.product || {};
    const platform = p.platform || null;
    const rating = RATINGS[p.rating] || { label: '—' };
    const isSelected = selection.has(p.id);

    const cb = el('input', {
      type: 'checkbox',
      class: 'cb',
      'aria-label': 'انتخاب',
    });
    cb.checked = isSelected;
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      if (cb.checked) selection.add(p.id);
      else selection.delete(p.id);
      render();
    });

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

    const tr = el('tr', { class: isSelected ? 'is-selected' : '' }, [
      el('td', { class: 'col-select' }, [cb]),
      el('td', { class: 'col-date', text: formatDate(p.purchased_at || p.created_at) }),
      shopCell,
      productCell,
      platformCell,
      ratingCell,
      priceCell,
      actionsCell,
    ]);
    return tr;
  }

  function renderGlobalEmpty() {
    return el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__icon', html: icon('cart', 32) }),
      el('div', { class: 'empty-state__title', text: 'هنوز خریدی ثبت نکردی' }),
      el('div', { class: 'empty-state__desc',
        text: 'روی «ثبت خرید» بزن، فروشگاه، محصول، پلتفرم و امتیاز را وارد کن.' }),
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
      selection.delete(p.id);
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
