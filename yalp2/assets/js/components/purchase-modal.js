/* ============================================================
   Purchase modal — create & edit
   ============================================================ */
import { store } from '../state.js';
import { mountModal } from './modal-shell.js';
import {
  createPicker,
  renderShopItem,
  renderProductItem,
  renderPlatformItem,
} from './picker.js';
import { el, toEnDigits, formatDate } from '../utils.js';
import { icon } from './icons.js';
import {
  createPurchase,
  updatePurchase,
  createShop,
  createProduct,
  createPlatform,
  refreshPurchases,
} from '../api.js';
import { notify } from './toast.js';

export function openPurchaseModal({ mode = 'create', initial = null } = {}) {
  return new Promise((resolve) => {
    let rating = initial?.rating || 'good';
    let shopId = initial?.shop_id || null;
    let productId = initial?.product_id || null;
    let platformId = initial?.platform_id || null;
    let price = initial?.price ?? '';
    let quantity = initial?.quantity ?? 1;
    let purchasedAt = initial?.purchased_at || new Date().toISOString().slice(0, 10);
    let note = initial?.note || '';

    let resolved = false;
    function finish(v) { if (resolved) return; resolved = true; resolve(v); }

    /* ---------- rating selector ---------- */
    const ratingWrap = el('div', { class: 'rating-selector' });
    const ratingOpts = [
      { key: 'good', icon: '✓', label: 'خوب',    desc: 'خرید موفق',      cls: 'good' },
      { key: 'bad',  icon: '~', label: 'بد',     desc: 'نچندان خوب',     cls: 'bad'  },
      { key: 'shit', icon: '✕', label: 'افتضاح', desc: 'پشیمان شدم',     cls: 'shit' },
    ];
    function renderRating() {
      ratingWrap.innerHTML = '';
      for (const o of ratingOpts) {
        const b = el('button', {
          type: 'button',
          class: `rating-selector__opt rating-selector__opt--${o.cls}${rating === o.key ? ' is-active' : ''}`,
        }, [
          el('span', { class: 'rating-selector__icon', text: o.icon }),
          el('span', { class: 'rating-selector__label', text: o.label }),
          el('span', { class: 'rating-selector__desc', text: o.desc }),
        ]);
        b.addEventListener('click', () => { rating = o.key; renderRating(); });
        ratingWrap.appendChild(b);
      }
    }
    renderRating();

    /* ---------- pickers ---------- */
    const shopPicker = createPicker({
      storeSignal: store.shops,
      placeholder: 'انتخاب فروشگاه',
      value: shopId,
      onChange: (v) => { shopId = v; },
      allowCreate: true,
      createFields: [
        { key: 'name', label: 'نام فروشگاه', required: true },
        { key: 'category', label: 'دسته (مثلاً ساندویچی)', required: false },
      ],
      onCreate: async (values) => {
        const created = await createShop(values);
        store.shops.set([...store.shops.get(), created]);
        notify.success('فروشگاه ساخته شد');
        return created;
      },
      renderItem: renderShopItem,
      renderTrigger: (s) => `${escapeHtml(s.name)}`,
    });

    const productPicker = createPicker({
      storeSignal: store.products,
      placeholder: 'انتخاب محصول',
      value: productId,
      onChange: (v) => { productId = v; },
      allowCreate: true,
      createFields: [
        { key: 'name', label: 'نام محصول', required: true },
        { key: 'category', label: 'دسته (مثلاً نوشیدنی)', required: false },
        { key: 'unit', label: 'واحد (مثلاً عدد)', required: false },
      ],
      onCreate: async (values) => {
        const created = await createProduct(values);
        store.products.set([...store.products.get(), created]);
        notify.success('محصول ساخته شد');
        return created;
      },
      renderItem: renderProductItem,
      renderTrigger: (p) => `${escapeHtml(p.name)}`,
    });

    const platformPicker = createPicker({
      storeSignal: store.platforms,
      placeholder: 'انتخاب پلتفرم (اختیاری)',
      value: platformId,
      onChange: (v) => { platformId = v; },
      allowCreate: true,
      createFields: [
        { key: 'name', label: 'نام پلتفرم', required: true },
        { key: 'color', label: 'رنگ (مثلاً #ef4056)', required: false },
      ],
      onCreate: async (values) => {
        const color = (values.color || '').trim() || '#6366f1';
        const created = await createPlatform({ ...values, color });
        store.platforms.set([...store.platforms.get(), created]);
        notify.success('پلتفرم ساخته شد');
        return created;
      },
      renderItem: renderPlatformItem,
      renderTrigger: (p) => `${escapeHtml(p.name)}`,
    });

    /* ---------- form fields ---------- */
    const priceInput = el('input', {
      type: 'text',
      inputmode: 'numeric',
      class: 'input',
      placeholder: 'مثلاً ۱۲۵۰۰۰',
      value: price === '' || price == null ? '' : String(price),
      dir: 'ltr',
      style: { textAlign: 'left' },
    });
    priceInput.addEventListener('input', () => {
      priceInput.value = priceInput.value.replace(/[^\d۰-۹٠-٩]/g, '');
    });

    const qtyInput = el('input', {
      type: 'text',
      inputmode: 'decimal',
      class: 'input',
      placeholder: '۱',
      value: quantity === '' || quantity == null ? '1' : String(quantity),
      dir: 'ltr',
      style: { textAlign: 'left' },
    });

    const dateInput = el('input', {
      type: 'date',
      class: 'input',
      value: purchasedAt,
      dir: 'ltr',
      style: { textAlign: 'left' },
    });
    dateInput.addEventListener('change', () => { purchasedAt = dateInput.value; });

    const noteInput = el('textarea', {
      class: 'textarea',
      placeholder: 'یادداشت (اختیاری)…',
      rows: '3',
      value: note,
    });
    noteInput.addEventListener('input', () => { note = noteInput.value; });

    /* ---------- body ---------- */
    const body = el('div', { class: 'purchase-form' }, [
      field('امتیاز خرید', ratingWrap, true),
      field('فروشگاه', shopPicker.el, true),
      field('محصول', productPicker.el, true),
      field('پلتفرم', platformPicker.el, false),
      el('div', { class: 'purchase-form__row' }, [
        field('قیمت (تومان)', priceInput, false),
        field('تعداد', qtyInput, false),
      ]),
      field('تاریخ خرید', dateInput, false),
      field('یادداشت', noteInput, false),
    ]);

    /* ---------- footer ---------- */
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--lg', text: 'انصراف' });
    const submitBtn = el('button', {
      type: 'submit',
      form: 'purchase-form-el',
      class: 'btn btn--primary btn--lg',
      text: mode === 'edit' ? 'ذخیره تغییرات' : 'ثبت خرید',
    });
    const footer = el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]);

    const { body: bodyHost, close } = mountModal({
      title: mode === 'edit' ? 'ویرایش خرید' : 'ثبت خرید جدید',
      subtitle: mode === 'edit' ? 'تغییرات را اعمال کن' : 'یک خرید را ثبت کن و امتیاز بده',
      size: 'lg',
      body,
      footer,
      onClose: () => finish(null),
    });

    const form = el('form', { id: 'purchase-form-el', novalidate: 'novalidate' });
    while (bodyHost.firstChild) form.appendChild(bodyHost.firstChild);
    bodyHost.appendChild(form);

    cancelBtn.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!shopId) return notify.error('فروشگاه را انتخاب کن');
      if (!productId) return notify.error('محصول را انتخاب کن');

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        const priceNum = priceInput.value.trim();
        const qtyNum = qtyInput.value.trim();
        const payload = {
          shop_id: shopId,
          product_id: productId,
          platform_id: platformId,
          rating,
          price: priceNum === '' ? null : Number(toEnDigits(priceNum)),
          quantity: qtyNum === '' ? 1 : Number(toEnDigits(qtyNum)),
          purchased_at: purchasedAt || new Date().toISOString().slice(0, 10),
          note: noteInput.value.trim(),
        };

        let result;
        if (mode === 'edit' && initial?.id) {
          result = await updatePurchase(initial.id, payload);
        } else {
          result = await createPurchase(payload);
        }
        await refreshPurchases();
        notify.success(mode === 'edit' ? 'خرید ویرایش شد' : 'خرید ثبت شد');
        finish(result);
        close();
      } catch (err) {
        notify.error(err?.message || 'خطا در ذخیره');
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    });

    return finish;
  });
}

function field(label, control, required) {
  const labelEl = el('label', { class: 'field__label' }, [
    document.createTextNode(label),
    required ? el('span', { class: 'req', text: '*' }) : null,
  ].filter(Boolean));
  return el('div', { class: 'field' }, [labelEl, control]);
}

/* tiny helper — picker import doesn't re-export escapeHtml */
import { escapeHtml } from '../utils.js';
