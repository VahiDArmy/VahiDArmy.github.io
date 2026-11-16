/* ============================================================
   Settings modal — tabs with CSV import added to data tab
   ============================================================ */
import { store } from '../state.js';
import { el, escapeHtml, formatNumber } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import {
  createPlatform, updatePlatform, deletePlatform,
  createShop, updateShop, deleteShop,
  createProduct, updateProduct, deleteProduct,
  refreshPurchases, signOut,
} from '../api.js';
import { downloadSnapshot, importSnapshot, readJsonFile } from '../utils/import-export.js';
import { seedDemoData } from './seed-demo.js';
import { openCsvImportModal } from './csv-import.js';

const TABS = [
  { key: 'platforms', label: 'پلتفرم‌ها', icon: 'layers' },
  { key: 'shops', label: 'فروشگاه‌ها', icon: 'store' },
  { key: 'products', label: 'محصولات', icon: 'package' },
  { key: 'data', label: 'داده‌ها', icon: 'refresh' },
  { key: 'account', label: 'حساب', icon: 'user' },
];

export function openSettingsModal({ initialTab = 'platforms' } = {}) {
  let activeTab = initialTab;
  const bodyHost = el('div', { class: 'settings-body' });

  const { close } = mountModal({
    title: 'تنظیمات',
    subtitle: 'مدیریت کامل داده‌ها و حساب',
    size: 'xl',
    body: [bodyHost],
    footer: [
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--lg', text: 'بستن',
        onclick: () => close(),
      }),
    ],
  });

  function refresh() {
    bodyHost.innerHTML = '';
    bodyHost.appendChild(renderTabs());
    bodyHost.appendChild(renderActiveTab());
  }

  function renderTabs() {
    const tabs = el('div', { class: 'settings-tabs' });
    for (const t of TABS) {
      const isActive = t.key === activeTab;
      tabs.appendChild(el('button', {
        type: 'button',
        class: 'settings-tab' + (isActive ? ' is-active' : ''),
        onclick: () => { activeTab = t.key; refresh(); },
      }, [
        el('span', { class: 'settings-tab__icon', html: icon(t.icon, 16) }),
        el('span', { class: 'settings-tab__label', text: t.label }),
      ]));
    }
    return tabs;
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'platforms': return renderPlatformsTab();
      case 'shops': return renderShopsTab();
      case 'products': return renderProductsTab();
      case 'data': return renderDataTab();
      case 'account': return renderAccountTab();
      default: return el('div');
    }
  }

  function renderPlatformsTab() {
    const wrap = el('div', { class: 'settings-section' });
    const items = store.platforms.get();
    wrap.appendChild(renderSectionHeader({
      title: 'پلتفرم‌ها',
      subtitle: 'دیجی‌کالا، اسنپ‌فود، اکالا و ...',
      count: items.length,
      onAdd: async () => {
        const values = await promptEntity({
          title: 'پلتفرم جدید', submitLabel: 'ساخت',
          fields: [
            { key: 'name', label: 'نام', required: true, placeholder: 'مثلاً دیجی‌کالا' },
            { key: 'color', label: 'رنگ (hex)', placeholder: '#8b5cf6', default: '#8b5cf6' },
            { key: 'icon', label: 'آیکن (اختیاری)', placeholder: '🛒' },
            { key: 'note', label: 'یادداشت', multiline: true },
          ],
        });
        if (!values) return;
        try {
          const created = await createPlatform(values);
          store.platforms.set([...store.platforms.get(), created]);
          notify.success('پلتفرم ساخته شد');
          refresh();
        } catch (err) { notify.error(err?.message || 'خطا'); }
      },
    }));
    if (!items.length) { wrap.appendChild(renderEmpty('هنوز پلتفرمی نیست')); return wrap; }
    const list = el('div', { class: 'settings-list' });
    for (const p of items) {
      list.appendChild(el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__icon' }, [
          el('span', { class: 'settings-row__dot',
            style: { background: p.color || '#6366f1', boxShadow: `0 0 12px ${p.color || '#6366f1'}` } }),
        ]),
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__title', text: p.name }),
          p.note ? el('div', { class: 'settings-row__sub', text: p.note }) : null,
        ].filter(Boolean)),
        el('div', { class: 'settings-row__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm', 'aria-label': 'ویرایش',
            html: icon('edit', 14),
            onclick: async () => {
              const values = await promptEntity({
                title: 'ویرایش پلتفرم', submitLabel: 'ذخیره', initial: p,
                fields: [
                  { key: 'name', label: 'نام', required: true },
                  { key: 'color', label: 'رنگ (hex)' },
                  { key: 'icon', label: 'آیکن' },
                  { key: 'note', label: 'یادداشت', multiline: true },
                ],
              });
              if (!values) return;
              try {
                const updated = await updatePlatform(p.id, values);
                store.platforms.set(store.platforms.get().map((x) => x.id === p.id ? updated : x));
                notify.success('ذخیره شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm is-danger', 'aria-label': 'حذف',
            html: icon('trash', 14),
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'حذف پلتفرم',
                message: `«${p.name}» حذف شود؟ خریدها حفظ می‌شوند ولی پلتفرم‌شان خالی می‌شود.`,
                confirmLabel: 'حذف', danger: true,
              });
              if (!ok) return;
              try {
                await deletePlatform(p.id);
                store.platforms.set(store.platforms.get().filter((x) => x.id !== p.id));
                store.purchases.set(store.purchases.get().map((pu) =>
                  pu.platform_id === p.id ? { ...pu, platform_id: null, platform: null } : pu));
                notify.success('حذف شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
        ]),
      ]));
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderShopsTab() {
    const wrap = el('div', { class: 'settings-section' });
    const items = store.shops.get();
    wrap.appendChild(renderSectionHeader({
      title: 'فروشگاه‌ها',
      subtitle: 'ساندویچی علی، رستوران باغ و ...',
      count: items.length,
      onAdd: async () => {
        const values = await promptEntity({
          title: 'فروشگاه جدید', submitLabel: 'ساخت',
          fields: [
            { key: 'name', label: 'نام', required: true, placeholder: 'مثلاً ساندویچی علی' },
            { key: 'category', label: 'دسته', placeholder: 'فست‌فود، رستوران، ...' },
            { key: 'note', label: 'یادداشت', multiline: true },
          ],
        });
        if (!values) return;
        try {
          const created = await createShop(values);
          store.shops.set([...store.shops.get(), created]);
          notify.success('فروشگاه ساخته شد');
          refresh();
        } catch (err) { notify.error(err?.message || 'خطا'); }
      },
    }));
    if (!items.length) { wrap.appendChild(renderEmpty('هنوز فروشگاهی نیست')); return wrap; }
    const purchases = store.purchases.get();
    const list = el('div', { class: 'settings-list' });
    for (const s of items.slice().sort((a, b) => a.name.localeCompare(b.name, 'fa'))) {
      const count = purchases.filter((p) => p.shop_id === s.id).length;
      list.appendChild(el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__icon' }, [
          el('span', { class: 'avatar-shop avatar-shop--violet', text: (s.name?.[0] || '؟').toUpperCase() }),
        ]),
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__title', text: s.name }),
          el('div', { class: 'settings-row__sub',
            text: `${s.category || 'بدون دسته'} · ${formatNumber(count)} خرید` }),
        ]),
        el('div', { class: 'settings-row__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm', 'aria-label': 'ویرایش',
            html: icon('edit', 14),
            onclick: async () => {
              const values = await promptEntity({
                title: 'ویرایش فروشگاه', submitLabel: 'ذخیره', initial: s,
                fields: [
                  { key: 'name', label: 'نام', required: true },
                  { key: 'category', label: 'دسته' },
                  { key: 'note', label: 'یادداشت', multiline: true },
                ],
              });
              if (!values) return;
              try {
                const updated = await updateShop(s.id, values);
                store.shops.set(store.shops.get().map((x) => x.id === s.id ? updated : x));
                notify.success('ذخیره شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm is-danger', 'aria-label': 'حذف',
            html: icon('trash', 14),
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'حذف فروشگاه',
                message: `«${s.name}» و ${formatNumber(count)} خرید مرتبط حذف شوند؟`,
                confirmLabel: 'حذف', danger: true,
              });
              if (!ok) return;
              try {
                await deleteShop(s.id);
                store.shops.set(store.shops.get().filter((x) => x.id !== s.id));
                store.purchases.set(store.purchases.get().filter((p) => p.shop_id !== s.id));
                notify.success('حذف شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
        ]),
      ]));
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderProductsTab() {
    const wrap = el('div', { class: 'settings-section' });
    const items = store.products.get();
    wrap.appendChild(renderSectionHeader({
      title: 'محصولات',
      subtitle: 'محصولاتی که تا حالا خریدی',
      count: items.length,
      onAdd: async () => {
        const values = await promptEntity({
          title: 'محصول جدید', submitLabel: 'ساخت',
          fields: [
            { key: 'name', label: 'نام', required: true, placeholder: 'مثلاً ساندویچ مرغ' },
            { key: 'category', label: 'دسته', placeholder: 'غذا، نوشیدنی، ...' },
            { key: 'unit', label: 'واحد', placeholder: 'عدد، کیلو، پرس، ...' },
            { key: 'note', label: 'یادداشت', multiline: true },
          ],
        });
        if (!values) return;
        try {
          const created = await createProduct(values);
          store.products.set([...store.products.get(), created]);
          notify.success('محصول ساخته شد');
          refresh();
        } catch (err) { notify.error(err?.message || 'خطا'); }
      },
    }));
    if (!items.length) { wrap.appendChild(renderEmpty('هنوز محصولی نیست')); return wrap; }
    const purchases = store.purchases.get();
    const list = el('div', { class: 'settings-list' });
    for (const p of items.slice().sort((a, b) => a.name.localeCompare(b.name, 'fa'))) {
      const count = purchases.filter((pu) => pu.product_id === p.id).length;
      list.appendChild(el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__icon' }, [
          el('span', { class: 'avatar',
            style: { '--_size': '32px', fontSize: '12px' },
            text: (p.name?.[0] || '؟').toUpperCase() }),
        ]),
        el('div', { class: 'settings-row__main' }, [
          el('div', { class: 'settings-row__title', text: p.name }),
          el('div', { class: 'settings-row__sub',
            text: [p.category, p.unit, `${formatNumber(count)} خرید`].filter(Boolean).join(' · ') }),
        ]),
        el('div', { class: 'settings-row__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm', 'aria-label': 'ویرایش',
            html: icon('edit', 14),
            onclick: async () => {
              const values = await promptEntity({
                title: 'ویرایش محصول', submitLabel: 'ذخیره', initial: p,
                fields: [
                  { key: 'name', label: 'نام', required: true },
                  { key: 'category', label: 'دسته' },
                  { key: 'unit', label: 'واحد' },
                  { key: 'note', label: 'یادداشت', multiline: true },
                ],
              });
              if (!values) return;
              try {
                const updated = await updateProduct(p.id, values);
                store.products.set(store.products.get().map((x) => x.id === p.id ? updated : x));
                notify.success('ذخیره شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm is-danger', 'aria-label': 'حذف',
            html: icon('trash', 14),
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'حذف محصول',
                message: `«${p.name}» و ${formatNumber(count)} خرید مرتبط حذف شوند؟`,
                confirmLabel: 'حذف', danger: true,
              });
              if (!ok) return;
              try {
                await deleteProduct(p.id);
                store.products.set(store.products.get().filter((x) => x.id !== p.id));
                store.purchases.set(store.purchases.get().filter((pu) => pu.product_id !== p.id));
                notify.success('حذف شد');
                refresh();
              } catch (err) { notify.error(err?.message || 'خطا'); }
            },
          }),
        ]),
      ]));
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderDataTab() {
    const wrap = el('div', { class: 'settings-section' });

    const exportCard = el('div', { class: 'settings-card' }, [
      el('div', { class: 'settings-card__icon settings-card__icon--brand', html: icon('external', 20) }),
      el('div', { class: 'settings-card__body' }, [
        el('div', { class: 'settings-card__title', text: 'خروجی JSON' }),
        el('div', { class: 'settings-card__desc',
          text: 'یک فایل JSON از کل داده‌هایت دانلود کن.' }),
        el('button', {
          type: 'button', class: 'btn btn--outline btn--sm',
          html: `${icon('external', 14)}<span>دانلود</span>`,
          style: { marginTop: 'var(--s-3)' },
          onclick: () => {
            try {
              const snap = downloadSnapshot();
              notify.success(`فایل با ${formatNumber(snap.purchases.length)} خرید آماده شد`);
            } catch (err) { notify.error(err?.message || 'خطا'); }
          },
        }),
      ]),
    ]);

    const importJsonCard = el('div', { class: 'settings-card' }, [
      el('div', { class: 'settings-card__icon settings-card__icon--warn', html: icon('arrowDown', 20) }),
      el('div', { class: 'settings-card__body' }, [
        el('div', { class: 'settings-card__title', text: 'ورود از JSON' }),
        el('div', { class: 'settings-card__desc',
          text: 'داده‌های فعلی پاک و با فایل جایگزین می‌شوند.' }),
        (() => {
          const fi = el('input', { type: 'file', accept: '.json,application/json', hidden: 'hidden' });
          fi.addEventListener('change', async () => {
            const file = fi.files?.[0];
            fi.value = '';
            if (file) await handleImportJson(file);
          });
          return el('div', {}, [
            el('button', {
              type: 'button', class: 'btn btn--outline btn--sm',
              html: `${icon('arrowUp', 14)}<span>انتخاب فایل</span>`,
              style: { marginTop: 'var(--s-3)' },
              onclick: () => fi.click(),
            }),
            fi,
          ]);
        })(),
      ]),
    ]);

    const importCsvCard = el('div', { class: 'settings-card' }, [
      el('div', { class: 'settings-card__icon settings-card__icon--cyan', html: icon('plus', 20) }),
      el('div', { class: 'settings-card__body' }, [
        el('div', { class: 'settings-card__title', text: 'ورود از CSV' }),
        el('div', { class: 'settings-card__desc',
          text: 'خریدها را به‌صورت انبوه از فایل CSV اضافه کن (بدون پاک کردن داده‌های فعلی).' }),
        el('button', {
          type: 'button', class: 'btn btn--outline btn--sm',
          html: `${icon('arrowUp', 14)}<span>انتخاب فایل CSV</span>`,
          style: { marginTop: 'var(--s-3)' },
          onclick: () => openCsvImportModal(),
        }),
      ]),
    ]);

    const seedCard = el('div', { class: 'settings-card' }, [
      el('div', { class: 'settings-card__icon settings-card__icon--cyan', html: icon('sparkles', 20) }),
      el('div', { class: 'settings-card__body' }, [
        el('div', { class: 'settings-card__title', text: 'دادهٔ نمونه' }),
        el('div', { class: 'settings-card__desc',
          text: 'چند فروشگاه، محصول و خرید تصادفی برای تست اضافه می‌شود.' }),
        el('button', {
          type: 'button', class: 'btn btn--outline btn--sm',
          html: `${icon('sparkles', 14)}<span>افزودن نمونه</span>`,
          style: { marginTop: 'var(--s-3)' },
          onclick: async (e) => {
            const btn = e.currentTarget;
            btn.classList.add('is-loading');
            btn.disabled = true;
            try {
              const result = await seedDemoData({ purchaseCount: 30 });
              await refreshPurchases();
              notify.success(`${formatNumber(result.purchases)} خرید نمونه اضافه شد`);
              refresh();
            } catch (err) {
              notify.error(err?.message || 'خطا');
            } finally {
              btn.classList.remove('is-loading');
              btn.disabled = false;
            }
          },
        }),
      ]),
    ]);

    const dangerCard = el('div', { class: 'settings-card settings-card--danger' }, [
      el('div', { class: 'settings-card__icon settings-card__icon--danger', html: icon('alert', 20) }),
      el('div', { class: 'settings-card__body' }, [
        el('div', { class: 'settings-card__title', text: 'پاک کردن همهٔ داده‌ها' }),
        el('div', { class: 'settings-card__desc',
          text: 'تمام داده‌ها حذف می‌شوند. غیرقابل بازگشت.' }),
        el('button', {
          type: 'button', class: 'btn btn--danger btn--sm',
          html: `${icon('trash', 14)}<span>پاک کردن همه</span>`,
          style: { marginTop: 'var(--s-3)' },
          onclick: async () => {
            const ok = await confirmDialog({
              title: 'پاک کردن همهٔ داده‌ها',
              message: 'مطمئنی؟ همهٔ داده‌ها برای همیشه از بین می‌روند.',
              confirmLabel: 'بله، پاک کن', danger: true,
            });
            if (!ok) return;
            try {
              for (const tbl of ['purchases', 'comments', 'products', 'shops', 'platforms']) {
                const { sb, Tables } = await import('../supabase.js');
                await sb.from(Tables[tbl]).delete().eq('user_id', store.user.get().id);
              }
              store.platforms.set([]);
              store.shops.set([]);
              store.products.set([]);
              store.purchases.set([]);
              store.comments.set([]);
              notify.success('همهٔ داده‌ها پاک شدند');
              refresh();
            } catch (err) { notify.error(err?.message || 'خطا'); }
          },
        }),
      ]),
    ]);

    wrap.append(
      el('div', { class: 'settings-cards-grid' }, [exportCard, importJsonCard, importCsvCard]),
      el('div', { class: 'settings-cards-grid', style: { marginTop: 'var(--s-3)' } }, [seedCard]),
      dangerCard,
    );
    return wrap;
  }

  async function handleImportJson(file) {
    try {
      const json = await readJsonFile(file);
      const ok = await confirmDialog({
        title: 'جایگزینی داده‌ها',
        message: `داده‌های فعلی پاک و محتوای فایل («${file.name}») جایگزین می‌شود. ادامه؟`,
        confirmLabel: 'بله، وارد کن', danger: true,
      });
      if (!ok) return;
      notify.info('در حال وارد کردن…');
      const result = await importSnapshot(json);
      await refreshPurchases();
      const { listPlatforms, listShops, listProducts, listComments } = await import('../api.js');
      const [platforms, shops, products, comments] = await Promise.all([
        listPlatforms(), listShops(), listProducts(), listComments(),
      ]);
      store.platforms.set(platforms);
      store.shops.set(shops);
      store.products.set(products);
      store.comments.set(comments);
      notify.success(`وارد شد: ${formatNumber(result.purchases)} خرید`);
      refresh();
    } catch (err) {
      notify.error(err?.message || 'خطا در ورود');
    }
  }

  function renderAccountTab() {
    const wrap = el('div', { class: 'settings-section' });
    const user = store.user.get();
    const email = user?.email || '—';

    const card = el('div', { class: 'account-card' }, [
      el('div', { class: 'account-card__avatar' },
        [el('span', { text: (email[0] || 'U').toUpperCase() })]),
      el('div', { class: 'account-card__body' }, [
        el('div', { class: 'account-card__email', text: email }),
        el('div', { class: 'account-card__meta',
          text: `عضو از ${user?.created_at ? new Date(user.created_at).toLocaleDateString('fa-IR') : '—'}` }),
      ]),
    ]);

    const logoutBtn = el('button', {
      type: 'button', class: 'btn btn--danger btn--lg',
      html: `${icon('logout', 16)}<span>خروج از حساب</span>`,
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'خروج از حساب',
          message: 'از حسابت خارج می‌شوی.',
          confirmLabel: 'خروج', danger: true,
        });
        if (!ok) return;
        try { await signOut(); close(); notify.info('خارج شدی'); }
        catch (err) { notify.error(err?.message || 'خطا'); }
      },
    });

    const stats = el('div', { class: 'account-stats' }, [
      el('div', { class: 'account-stat' }, [
        el('div', { class: 'account-stat__value', text: formatNumber(store.purchases.get().length) }),
        el('div', { class: 'account-stat__label', text: 'خرید' }),
      ]),
      el('div', { class: 'account-stat' }, [
        el('div', { class: 'account-stat__value', text: formatNumber(store.shops.get().length) }),
        el('div', { class: 'account-stat__label', text: 'فروشگاه' }),
      ]),
      el('div', { class: 'account-stat' }, [
        el('div', { class: 'account-stat__value', text: formatNumber(store.products.get().length) }),
        el('div', { class: 'account-stat__label', text: 'محصول' }),
      ]),
    ]);

    wrap.append(card, stats, el('div', { style: { marginTop: 'var(--s-4)' } }, [logoutBtn]));
    return wrap;
  }

  function renderSectionHeader({ title, subtitle, count, onAdd }) {
    return el('div', { class: 'settings-header' }, [
      el('div', {}, [
        el('div', { class: 'settings-header__title' }, [
          document.createTextNode(title),
          el('span', { class: 'count-badge', text: formatNumber(count || 0) }),
        ]),
        subtitle ? el('div', { class: 'settings-header__sub', text: subtitle }) : null,
      ].filter(Boolean)),
      el('button', {
        type: 'button', class: 'btn btn--primary btn--sm',
        html: `${icon('plus', 14)}<span>افزودن</span>`,
        onclick: onAdd,
      }),
    ]);
  }

  function renderEmpty(text) {
    return el('div', { class: 'settings-empty', text });
  }

  refresh();
}

function promptEntity({ title, fields, initial = {}, submitLabel = 'ذخیره' }) {
  return new Promise((resolve) => {
    const values = {};
    for (const f of fields) values[f.key] = initial[f.key] ?? f.default ?? '';
    const inputs = {};
    const body = el('div', { class: 'entity-form' });
    for (const f of fields) {
      const input = f.multiline
        ? el('textarea', { class: 'textarea', rows: '3', placeholder: f.placeholder || '' })
        : el('input', { type: 'text', class: 'input', placeholder: f.placeholder || '', value: values[f.key] });
      input.value = values[f.key] ?? '';
      input.addEventListener('input', () => { values[f.key] = input.value; });
      inputs[f.key] = input;
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, [
          document.createTextNode(f.label),
          f.required ? el('span', { class: 'req', text: '*' }) : null,
        ].filter(Boolean)),
        input,
      ]));
    }
    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--lg', text: 'انصراف' });
    const saveBtn = el('button', { type: 'button', class: 'btn btn--primary btn--lg', text: submitLabel });
    const { close } = mountModal({
      title, size: 'sm', body, footer: [cancelBtn, saveBtn],
      onClose: () => finish(null),
    });
    cancelBtn.addEventListener('click', () => { finish(null); close(); });
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      for (const f of fields) {
        if (f.required && !String(values[f.key] || '').trim()) {
          inputs[f.key].focus();
          inputs[f.key].style.borderColor = 'var(--shit-border)';
          setTimeout(() => { inputs[f.key].style.borderColor = ''; }, 1200);
          return;
        }
      }
      for (const k of Object.keys(values)) {
        if (typeof values[k] === 'string') values[k] = values[k].trim();
      }
      finish(values);
      close();
    });
    setTimeout(() => {
      const first = Object.values(inputs)[0];
      if (first) first.focus();
    }, 60);
  });
}
