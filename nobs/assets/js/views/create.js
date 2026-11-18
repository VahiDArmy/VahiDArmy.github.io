/**
 * بازاربان — ویزارد ثبت تجربه
 * ---------------------------------------------------------------------------
 * مسیر اصلی «انتخاب از فهرست» است، نه ساخت رکورد جدید؛ تا از تکرار موجودیت‌هایی
 * مثل «اسنپ» و «اسنپ‌فود» جلوگیری شود. ساخت مورد جدید هم ممکن است، اما گام
 * دوم به‌وضوح پیشنهاد می‌کند اول جست‌وجو کنی.
 */

import { icon } from '../icons.js';
import { CONFIG, KINDS, CATEGORIES, CITIES, LEVELS, kindById, categoryById } from '../config.js';
import { esc, attr, toFa, latinSlug, slugify, isValidUrl, $, $$ } from '../utils.js';
import * as store from '../store.js';
import {
  breadcrumbs,
  pageHead,
  toast,
  createCombobox,
  levelChip,
  scoreBadge,
  brandBadge,
  setupReveal,
  emptyState,
} from '../ui.js';
import { modeBanner } from './home.js';

const STEPS = [
  { id: 1, label: 'نوع تجربه' },
  { id: 2, label: 'انتخاب مورد' },
  { id: 3, label: 'نوشتن نقد' },
  { id: 4, label: 'پایان' },
];

function stepsBar(step) {
  return `<div class="wizard__steps" aria-label="مراحل">
    ${STEPS.map(
      (item, index) => `<div class="wizard__step" data-state="${step === item.id ? 'active' : step > item.id ? 'done' : 'idle'}">
        <span class="wizard__step-num">${step > item.id ? icon('check', 11) : toFa(item.id)}</span>
        <span>${esc(item.label)}</span>
      </div>
      ${index < STEPS.length - 1 ? `<span class="wizard__sep">${icon('chevron-left', 12)}</span>` : ''}`,
    ).join('')}
  </div>`;
}

const typeHints = {
  vendor: 'پلتفرم یا برندی که از آن سفارش دادی',
  shop: 'شعبهٔ مشخص با آدرس و ساعات کاری',
  product: 'کالای مشخص با برند و واحد فروش',
};

function typeStep() {
  return `<div class="wizard__title">چه چیزی را می‌خواهی ثبت کنی؟</div>
    <div class="type-picker" data-type-picker>
      ${CONFIG.ENTITY_TYPES.map(
        (entity) => `<button class="type-card" type="button" data-type="${entity.id}" aria-pressed="false">
          <span class="type-card__icon">${icon(entity.icon, 19)}</span>
          <span class="type-card__name">${esc(entity.label)}</span>
          <span class="type-card__hint">${esc(typeHints[entity.id] || entity.hint)}</span>
        </button>`,
      ).join('')}
    </div>
    <div class="callout callout--good">
      <span class="callout__icon">${icon('info', 14)}</span>
      <div>
        <div class="callout__title">قانون طلایی: اول انتخاب، بعد ساخت</div>
        در گام بعد، فهرست موجود را می‌بینی. اگر موردی که می‌خواهی هست، همان را انتخاب کن؛
        ساخت مورد تکراری باعث می‌شود امتیازها پخش شوند و مقایسه سخت شود.
      </div>
    </div>
    <div class="wizard__foot">
      <a class="btn btn--ghost" href="#/" data-link>انصراف</a>
      <button class="btn btn--primary" type="button" data-wizard-next disabled>ادامه ${icon('arrow-left', 15)}</button>
    </div>`;
}

/* --------------------------------------------------------------------------
   گام انتخاب
   -------------------------------------------------------------------------- */
function entityOptions(type) {
  if (type === 'vendor') {
    return store.allVendors().map((vendor) => ({
      id: vendor.id,
      label: vendor.nameFa,
      sub: `${CONFIG.KIND_MAP[vendor.kind] || ''}${vendor.city ? ` · ${vendor.city}` : ''}`,
      hue: vendor.brandHue,
      icon: 'store',
    }));
  }
  if (type === 'shop') {
    return store.allShops().map((shop) => {
      const vendor = store.getVendor(shop.vendorId);
      return {
        id: shop.id,
        label: shop.name,
        sub: `${vendor?.nameFa || ''} · ${shop.city || ''}${shop.district ? ` · ${shop.district}` : ''}`,
        icon: 'building',
        hue: 190,
      };
    });
  }
  return store.allProducts().map((product) => {
    const vendor = store.getVendor(product.vendorId);
    return {
      id: product.id,
      label: `${product.name}${product.brand ? ` — ${product.brand}` : ''}`,
      sub: `${CONFIG.CATEGORY_MAP[product.category] || ''} · ${vendor?.nameFa || ''}`,
      icon: 'package',
      hue: 120,
    };
  });
}

function pickStep(state) {
  const typeMeta = CONFIG.ENTITY_MAP[state.type];
  const count = entityOptions(state.type).length;
  return `<div class="wizard__title">کدام ${esc(typeMeta.label)}؟</div>
    <p class="wizard__sub">
      ${toFa(count)} مورد ثبت‌شده وجود دارد. نامش را جست‌وجو کن و از فهرست انتخاب کن؛
      اگر واقعاً وجود ندارد، مورد جدید بساز.
    </p>

    ${
      state.createMode
        ? createForm(state)
        : `<div class="pickup-box">
            <div class="pickup-box__head">${icon('hand', 16)} <b>اول از فهرست انتخاب کن</b> — از ساخت رکورد تکراری خودداری کن</div>
            <div data-pick-combo></div>
            <div class="hint mt-4">${icon('search', 12)} جست‌وجو در نام، برند، محله و دسته انجام می‌شود.</div>
          </div>

          <div class="pickup-switch">
            ${icon('info', 16)}
            <span>موردی که می‌خواهی در فهرست نیست؟
              <button class="link" type="button" data-start-create>مورد جدید بساز</button>
              — ولی اول مطمئن شو با نام دیگری ثبت نشده است.
            </span>
          </div>`
    }

    <div class="wizard__foot">
      <button class="btn btn--ghost" type="button" data-wizard-back>${icon('arrow-right', 15)} برگشت</button>
      <div class="cluster cluster--sm">
        ${state.createMode ? `<button class="btn btn--ghost btn--sm" type="button" data-cancel-create>انصراف از ساخت</button>` : ''}
        ${
          !state.createMode
            ? `<button class="btn btn--primary" type="button" data-wizard-next disabled>ادامه ${icon('arrow-left', 15)}</button>`
            : ''
        }
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   فرم ساخت
   -------------------------------------------------------------------------- */
function vendorSelectField() {
  return `<div class="field span-2">
    <label class="label">فروشنده <span class="label__req">*</span></label>
    <div data-vendor-combo></div>
    <span class="hint">شعبه باید زیرمجموعهٔ یک فروشنده باشد.</span>
  </div>`;
}

function createForm(state) {
  const type = state.type;
  const draft = state.draft;
  const titles = {
    vendor: 'فروشندهٔ جدید',
    shop: 'شعبهٔ جدید',
    product: 'محصول جدید',
  };

  if (type === 'vendor') {
    return `<div class="wizard__title">${esc(titles.vendor)}</div>
      <p class="wizard__sub">فقط وقتی این را بساز که مطمئنی فروشنده با نام دیگری ثبت نشده است. نام فارسی را کامل بنویس.</p>
      <form class="form-grid" data-create-form="vendor">
        <div class="field">
          <label class="label" for="vendor-name-fa">نام فارسی <span class="label__req">*</span></label>
          <input class="input" id="vendor-name-fa" name="nameFa" required maxlength="80" value="${attr(draft.nameFa)}" placeholder="مثلاً اسنپ‌فود" />
        </div>
        <div class="field">
          <label class="label" for="vendor-name">نام لاتین / برند</label>
          <input class="input" id="vendor-name" name="name" dir="ltr" maxlength="80" value="${attr(draft.name)}" placeholder="Snappfood" />
        </div>
        <div class="field">
          <label class="label" for="vendor-kind">نوع</label>
          <select class="select" id="vendor-kind" name="kind">
            ${KINDS.map((kind) => `<option value="${kind.id}" ${draft.kind === kind.id ? 'selected' : ''}>${esc(kind.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label" for="vendor-city">شهر</label>
          <select class="select" id="vendor-city" name="city">
            <option value="">انتخاب کن</option>
            ${CITIES.map((city) => `<option value="${attr(city)}" ${draft.city === city ? 'selected' : ''}>${esc(city)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label" for="vendor-site">وب‌سایت</label>
          <input class="input" id="vendor-site" name="website" dir="ltr" value="${attr(draft.website)}" placeholder="example.com" />
        </div>
        <div class="field">
          <label class="label" for="vendor-tagline">شعار کوتاه</label>
          <input class="input" id="vendor-tagline" name="tagline" maxlength="100" value="${attr(draft.tagline)}" placeholder="مثلاً خرید روزانه با تحویل سریع" />
        </div>
        <div class="field span-2">
          <label class="label" for="vendor-desc">توضیح</label>
          <textarea class="textarea" id="vendor-desc" name="description" rows="3" maxlength="600" placeholder="این فروشنده چه چیزی می‌فروشد و از کجا سفارش می‌گیرد؟">${esc(draft.description)}</textarea>
        </div>
      </form>
      <div class="wizard__foot">
        <button class="btn btn--ghost" type="button" data-wizard-back>${icon('arrow-right', 15)} برگشت</button>
        <button class="btn btn--primary" type="button" data-submit-create>ساختن و ادامه ${icon('arrow-left', 15)}</button>
      </div>`;
  }

  if (type === 'shop') {
    return `<div class="wizard__title">${esc(titles.shop)}</div>
      <p class="wizard__sub">شعبه را دقیق مشخص کن: نام برند + محله. دو شعبه با نام یکسان، امتیازها را خراب می‌کند.</p>
      <form class="form-grid" data-create-form="shop">
        ${vendorSelectField()}
        <div class="field">
          <label class="label" for="shop-name">نام شعبه <span class="label__req">*</span></label>
          <input class="input" id="shop-name" name="name" required maxlength="90" value="${attr(draft.name)}" placeholder="مثلاً افق کوروش — شعبهٔ پونک" />
        </div>
        <div class="field">
          <label class="label" for="shop-city">شهر</label>
          <select class="select" id="shop-city" name="city">
            <option value="">انتخاب کن</option>
            ${CITIES.map((city) => `<option value="${attr(city)}" ${draft.city === city ? 'selected' : ''}>${esc(city)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label" for="shop-district">محله</label>
          <input class="input" id="shop-district" name="district" maxlength="60" value="${attr(draft.district)}" placeholder="مثلاً پونک" />
        </div>
        <div class="field">
          <label class="label" for="shop-hours">ساعات کاری</label>
          <input class="input" id="shop-hours" name="hours" maxlength="60" value="${attr(draft.hours)}" placeholder="۹:۰۰ تا ۲۳:۰۰" />
        </div>
        <div class="field span-2">
          <label class="label" for="shop-address">آدرس</label>
          <input class="input" id="shop-address" name="address" maxlength="220" value="${attr(draft.address)}" placeholder="خیابان، کوچه، پلاک" />
        </div>
        <div class="field">
          <label class="label" for="shop-phone">تلفن</label>
          <input class="input" id="shop-phone" name="phone" dir="ltr" maxlength="30" value="${attr(draft.phone)}" placeholder="021-00000000" />
        </div>
        <div class="field">
          <span class="label">خدمات</span>
          <div class="stack stack--sm">
            <label class="switch">
              <input type="checkbox" name="pickup" ${draft.pickup ? 'checked' : ''} />
              <span class="switch__track"></span>
              <span>تحویل حضوری</span>
            </label>
            <label class="switch">
              <input type="checkbox" name="delivery" ${draft.delivery ? 'checked' : ''} />
              <span class="switch__track"></span>
              <span>ارسال به آدرس</span>
            </label>
          </div>
        </div>
      </form>
      <div class="wizard__foot">
        <button class="btn btn--ghost" type="button" data-wizard-back>${icon('arrow-right', 15)} برگشت</button>
        <button class="btn btn--primary" type="button" data-submit-create>ساختن و ادامه ${icon('arrow-left', 15)}</button>
      </div>`;
  }

  return `<div class="wizard__title">${esc(titles.product)}</div>
    <p class="wizard__sub">محصول را با نام دقیق و واحد فروش بنویس. اگر همین کالا با نام دیگری ثبت شده، آن را از فهرست انتخاب کن.</p>
    <form class="form-grid" data-create-form="product">
      ${vendorSelectField()}
      <div class="field span-2">
        <label class="label">شعبه (اختیاری)</label>
        <div data-shop-combo></div>
        <span class="hint">اگر این محصول فقط در شعبهٔ خاصی موجود است، شعبه را انتخاب کن؛ وگرنه خالی بگذار.</span>
      </div>
      <div class="field">
        <label class="label" for="product-name">نام محصول <span class="label__req">*</span></label>
        <input class="input" id="product-name" name="name" required maxlength="120" value="${attr(draft.name)}" placeholder="مثلاً شیر پرچرب ۱ لیتری" />
      </div>
      <div class="field">
        <label class="label" for="product-brand">برند</label>
        <input class="input" id="product-brand" name="brand" maxlength="60" value="${attr(draft.brand)}" placeholder="مثلاً میهن" />
      </div>
      <div class="field">
        <label class="label" for="product-category">دسته‌بندی</label>
        <select class="select" id="product-category" name="category">
          ${CATEGORIES.map((category) => `<option value="${category.id}" ${draft.category === category.id ? 'selected' : ''}>${esc(category.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label class="label" for="product-unit">واحد فروش</label>
        <input class="input" id="product-unit" name="unit" maxlength="40" value="${attr(draft.unit)}" placeholder="مثلاً بطری ۱ لیتری" />
      </div>
      <div class="field">
        <label class="label" for="product-price">قیمت (تومان)</label>
        <input class="input" id="product-price" name="price" type="number" min="0" step="1000" value="${attr(draft.price)}" placeholder="۴۲۰۰۰" />
      </div>
      <div class="field">
        <label class="label" for="product-barcode">بارکد</label>
        <input class="input" id="product-barcode" name="barcode" dir="ltr" maxlength="20" value="${attr(draft.barcode)}" placeholder="6260000000000" />
      </div>
    </form>
    <div class="wizard__foot">
      <button class="btn btn--ghost" type="button" data-wizard-back>${icon('arrow-right', 15)} برگشت</button>
      <button class="btn btn--primary" type="button" data-submit-create>ساختن و ادامه ${icon('arrow-left', 15)}</button>
    </div>`;
}

/* --------------------------------------------------------------------------
   گام نقد
   -------------------------------------------------------------------------- */
function reviewStep(state) {
  const entity = store.getEntity(state.type, state.selectedId);
  if (!entity) {
    return emptyState({
      iconName: 'alert-circle',
      title: 'مورد انتخاب‌شده پیدا نشد',
      text: 'احتمالاً در همان لحظه حذف شده است. یک بار دیگر انتخاب کن.',
      actions: `<button class="btn btn--outline btn--sm" type="button" data-wizard-back>بازگشت به انتخاب</button>`,
    });
  }
  const mine = store.myRating(state.type, entity.id);

  return `<div class="wizard__title">تجربه‌ات را ثبت کن</div>
    <p class="wizard__sub">حداقل یکی از دو کار را انجام بده: یک سطح انتخاب کن، یا یک جمله بنویس. هر دو با هم بهتر است.</p>

    <div class="summary-box">
      <div class="summary-box__row">
        <span class="summary-box__k">مورد انتخاب‌شده</span>
        <span class="summary-box__v">
          ${esc(store.entityName(state.type, entity))}
          <span class="badge badge--outline" style="margin-inline-start:6px">${esc(CONFIG.ENTITY_MAP[state.type].label)}</span>
        </span>
      </div>
      <div class="summary-box__row">
        <span class="summary-box__k">وضعیت فعلی</span>
        <span class="summary-box__v">${scoreBadge(state.type, entity, { withCount: true })}</span>
      </div>
      ${
        mine
          ? `<div class="summary-box__row">
              <span class="summary-box__k">امتیاز قبلی تو</span>
              <span class="summary-box__v">${levelChip(mine.value)} <span class="t-faint" style="font-size:10px">(بعد از ثبت عوض می‌شود)</span></span>
            </div>`
          : ''
      }
    </div>

    <form class="review-form" data-wizard-form novalidate>
      <div class="review-form__level">
        <div class="review-form__level-label">
          <span>${esc(CONFIG.COPY.levelQuestion)}</span>
          <span class="t-faint" style="font-size:var(--fs-2xs)">${esc(CONFIG.COPY.levelHelp)}</span>
        </div>
        <div class="level-picker">
          ${LEVELS.map(
            (level) => `<button class="level-btn level-btn--${level.className}" type="button"
              data-wizard-level="${level.id}" aria-pressed="${mine?.value === level.id}" data-selected="${mine?.value === level.id}">
              <span class="level-btn__icon">${icon(level.icon, 18)}</span>
              <span>${esc(level.label)}</span>
              <span class="level-btn__hint">${esc(level.hint.split('؛')[0])}</span>
            </button>`,
          ).join('')}
        </div>
      </div>

      <div class="field" style="position:relative">
        <label class="label" for="wizard-body">نقد (اختیاری، اما ارزشمند)</label>
        <textarea class="textarea" id="wizard-body" name="body" rows="5" maxlength="${CONFIG.COMMENT_MAX}"
          placeholder="چه سفارش دادی، چه شد و دفعهٔ بعد چه می‌کنی؟ یک جزئیات دقیق کافی است." data-wizard-text></textarea>
        <span class="input-counter" data-wizard-counter>۰ / ${toFa(CONFIG.COMMENT_MAX)}</span>
      </div>

      <div class="field">
        <span class="label">برچسب‌ها <span class="label__hint">اختیاری</span></span>
        <div class="tag-picker" data-wizard-tags>
          ${CONFIG.COMMENT_TAGS.slice(0, 12)
            .map((tag) => `<button class="tag-chip" type="button" data-wizard-tag="${attr(tag)}" aria-pressed="false">#${esc(tag)}</button>`)
            .join('')}
        </div>
      </div>

      <div class="wizard__foot" style="border:0;padding:0;margin-top:var(--sp-4)">
        <button class="btn btn--ghost" type="button" data-wizard-back>${icon('arrow-right', 15)} انتخاب دیگر</button>
        <button class="btn btn--primary btn--lg" type="submit">${icon('check', 17)} ثبت نهایی</button>
      </div>
    </form>`;
}

/* --------------------------------------------------------------------------
   گام پایان
   -------------------------------------------------------------------------- */
function doneStep(state) {
  const entity = store.getEntity(state.type, state.selectedId);
  return `<div style="text-align:center;padding:var(--sp-8) var(--sp-4)">
    <div style="display:grid;place-items:center;width:78px;height:78px;margin:0 auto var(--sp-6);border-radius:50%;background:var(--good-tint);border:1px solid var(--good-line);color:var(--good)">
      ${icon('check-circle', 36)}
    </div>
    <h2 class="wizard__title">ثبت شد!</h2>
    <p class="wizard__sub" style="margin-inline:auto;max-width:46ch">
      ممنون که تجربه‌ات را نوشتی. همین حالا یک نفر دیگر می‌تواند با اطلاعات تو بهتر تصمیم بگیرد.
    </p>
    ${
      entity
        ? `<div class="summary-box" style="max-width:420px;margin-inline:auto;text-align:start">
            <div class="summary-box__row">
              <span class="summary-box__k">مورد</span>
              <span class="summary-box__v">${esc(store.entityName(state.type, entity))}</span>
            </div>
            <div class="summary-box__row">
              <span class="summary-box__k">تعداد رأی</span>
              <span class="summary-box__v">${toFa(store.scoreFor(state.type, entity.id).total)}</span>
            </div>
            <div class="summary-box__row">
              <span class="summary-box__k">امتیاز کلی</span>
              <span class="summary-box__v">${scoreBadge(state.type, entity)}</span>
            </div>
          </div>`
        : ''
    }
    <div class="cluster" style="justify-content:center;margin-top:var(--sp-6)">
      ${entity ? `<a class="btn btn--primary" href="${attr(store.entityHref(state.type, entity))}" data-link>دیدن پرونده</a>` : ''}
      <button class="btn btn--outline" type="button" data-wizard-reset>ثبت تجربهٔ دیگر</button>
      <a class="btn btn--ghost" href="#/me" data-link>داشبورد من</a>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   صفحه
   -------------------------------------------------------------------------- */
export const createView = {
  title: 'ثبت تجربه',
  render(ctx) {
    const state = store.getState();
    return `<div class="page">
      ${modeBanner(state)}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'ثبت تجربه' }])}
        ${pageHead({
          eyebrow: 'سه سطح، یک دقیقه',
          title: 'تجربه‌ات را ثبت کن',
          sub: 'اول از فهرست انتخاب کن؛ اگر نبود بساز.',
          actions: `<a class="btn btn--ghost btn--sm" href="#/guide" data-link>${icon('help', 15)} راهنما</a>`,
        })}
        <div class="wizard">
          <div data-wizard-steps>${stepsBar(1)}</div>
          <div class="wizard__panel" data-wizard-body></div>
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);
    const body = root.querySelector('[data-wizard-body]');
    const stepsHost = root.querySelector('[data-wizard-steps]');

    const state = {
      step: 1,
      type: ['vendor', 'shop', 'product'].includes(ctx.query.type) ? ctx.query.type : '',
      selectedId: ctx.query.id || '',
      createMode: false,
      draft: {
        name: '',
        nameFa: '',
        kind: 'platform',
        city: '',
        tagline: '',
        website: '',
        description: '',
        vendorId: ctx.query.vendor || '',
        shopId: ctx.query.shop || '',
        district: '',
        address: '',
        hours: '',
        phone: '',
        pickup: true,
        delivery: true,
        brand: '',
        category: 'other',
        unit: '',
        price: '',
        barcode: '',
      },
      review: { level: '', tags: new Set(), body: '' },
      combos: {},
      pendingSubmit: false,
      creating: false,
    };

    // اگر از صفحهٔ یک موجودیت آمده‌ایم، مستقیم به گام نقد برو
    if (state.type && state.selectedId && store.getEntity(state.type, state.selectedId)) {
      state.step = 3;
    }

    const destroyCombos = () => {
      Object.values(state.combos).forEach((combo) => combo?.destroy?.());
      state.combos = {};
    };

    const go = (step) => {
      state.step = step;
      paint();
      body.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const paint = () => {
      destroyCombos();
      stepsHost.innerHTML = stepsBar(state.step);
      if (state.step === 1) {
        body.innerHTML = typeStep();
        body.querySelectorAll('[data-type]').forEach((button) => {
          button.addEventListener('click', () => {
            state.type = button.dataset.type;
            state.selectedId = '';
            state.createMode = false;
            body.querySelectorAll('[data-type]').forEach((node) => {
              node.setAttribute('aria-pressed', String(node === button));
            });
            const next = body.querySelector('[data-wizard-next]');
            if (next) next.disabled = false;
          });
        });
      } else if (state.step === 2) {
        body.innerHTML = pickStep(state);
        if (state.createMode) {
          mountCreateCombos();
          bindCreateForm();
        } else {
          const host = body.querySelector('[data-pick-combo]');
          if (host) {
            const combo = createCombobox(host, {
              name: 'entity',
              items: entityOptions(state.type),
              placeholder: `جست‌وجوی ${CONFIG.ENTITY_MAP[state.type].label}…`,
              emptyText: 'موردی با این نام نیست',
              value: state.selectedId,
              allowCreate: false,
              onSelect: (item) => {
                state.selectedId = item.id;
                const next = body.querySelector('[data-wizard-next]');
                if (next) next.disabled = false;
              },
            });
            state.combos.pick = combo;
          }
          const next = body.querySelector('[data-wizard-next]');
          if (next) next.disabled = !state.selectedId;
        }
      } else if (state.step === 3) {
        body.innerHTML = reviewStep(state);
        const textarea = body.querySelector('[data-wizard-text]');
        const counter = body.querySelector('[data-wizard-counter]');
        if (textarea) {
          textarea.value = state.review.body;
          const update = () => {
            state.review.body = textarea.value;
            counter.textContent = `${toFa(textarea.value.length)} / ${toFa(CONFIG.COMMENT_MAX)}`;
          };
          textarea.addEventListener('input', update);
          update();
        }
        body.querySelectorAll('[data-wizard-level]').forEach((button) => {
          button.addEventListener('click', () => {
            const level = button.dataset.wizardLevel;
            state.review.level = state.review.level === level ? '' : level;
            body.querySelectorAll('[data-wizard-level]').forEach((node) => {
              const active = node.dataset.wizardLevel === state.review.level;
              node.dataset.selected = String(active);
              node.setAttribute('aria-pressed', String(active));
            });
          });
        });
        body.querySelectorAll('[data-wizard-tag]').forEach((button) => {
          button.addEventListener('click', () => {
            const tag = button.dataset.wizardTag;
            if (state.review.tags.has(tag)) state.review.tags.delete(tag);
            else {
              if (state.review.tags.size >= 5) {
                toast('حداکثر ۵ برچسب.', { type: 'meh' });
                return;
              }
              state.review.tags.add(tag);
            }
            button.setAttribute('aria-pressed', String(state.review.tags.has(tag)));
          });
        });
        body.querySelector('[data-wizard-form]')?.addEventListener('submit', (event) => {
          event.preventDefault();
          submitReview();
        });
      } else {
        body.innerHTML = doneStep(state);
        body.querySelector('[data-wizard-reset]')?.addEventListener('click', () => {
          state.step = 1;
          state.type = '';
          state.selectedId = '';
          state.createMode = false;
          state.review = { level: '', tags: new Set(), body: '' };
          paint();
        });
      }
    };

    /* -------------------------------------------------- ساخت موجودیت */
    function mountCreateCombos() {
      const vendorHost = body.querySelector('[data-vendor-combo]');
      if (vendorHost) {
        const combo = createCombobox(vendorHost, {
          name: 'vendorId',
          items: store.allVendors().map((vendor) => ({
            id: vendor.id,
            label: vendor.nameFa,
            sub: `${CONFIG.KIND_MAP[vendor.kind]} · ${vendor.city || 'ایران'}`,
            hue: vendor.brandHue,
          })),
          placeholder: 'فروشنده را جست‌وجو کن…',
          value: state.draft.vendorId,
          onSelect: (item) => {
            state.draft.vendorId = item.id;
            if (state.type === 'product') refreshShopCombo();
          },
        });
        state.combos.vendor = combo;
      }

      const shopHost = body.querySelector('[data-shop-combo]');
      if (shopHost) refreshShopCombo();
    }

    function refreshShopCombo() {
      const host = body.querySelector('[data-shop-combo]');
      if (!host) return;
      state.combos.shop?.destroy?.();
      const shops = store.allShops().filter((shop) => !state.draft.vendorId || shop.vendorId === state.draft.vendorId);
      state.combos.shop = createCombobox(host, {
        name: 'shopId',
        items: shops.map((shop) => ({
          id: shop.id,
          label: shop.name,
          sub: `${shop.city || ''}${shop.district ? ` · ${shop.district}` : ''}`,
          icon: 'building',
        })),
        placeholder: 'شعبه (اختیاری)…',
        value: state.draft.shopId,
        onSelect: (item) => {
          state.draft.shopId = item.id;
        },
      });
    }

    function bindCreateForm() {
      state.combos.pick = null;
      body.querySelector('[data-submit-create]')?.addEventListener('click', submitCreate);
    }

    async function submitCreate() {
      if (state.creating) return;
      const form = body.querySelector('[data-create-form]');
      if (!form) return;
      const data = new FormData(form);

      if (state.type === 'vendor') {
        const nameFa = String(data.get('nameFa') || '').trim();
        if (nameFa.length < 2) {
          toast('نام فارسی فروشنده را بنویس.', { type: 'meh' });
          form.querySelector('[name="nameFa"]')?.focus();
          return;
        }
        const name = String(data.get('name') || '').trim() || nameFa;
        const website = String(data.get('website') || '').trim();
        if (website && !isValidUrl(website)) {
          toast('آدرس وب‌سایت درست نیست.', { type: 'meh' });
          return;
        }
        state.creating = true;
        setBusy(true);
        try {
          const entity = await store.createEntity('vendor', {
            name,
            nameFa,
            slug: latinSlug(name) || slugify(nameFa),
            kind: String(data.get('kind') || 'platform'),
            city: String(data.get('city') || ''),
            tagline: String(data.get('tagline') || '').trim(),
            website,
            description: String(data.get('description') || '').trim(),
            brandHue: Math.floor(Math.random() * 360),
          });
          state.selectedId = entity.id;
          state.createMode = false;
          toast('فروشنده ساخته شد. حالا تجربه‌ات را بنویس.', { type: 'good' });
          go(3);
        } catch (error) {
          toast(error.message || 'ساخت فروشنده ناموفق بود.', { type: 'bad' });
        } finally {
          state.creating = false;
          setBusy(false);
        }
        return;
      }

      if (state.type === 'shop') {
        const name = String(data.get('name') || '').trim();
        const vendorId = state.combos.vendor?.value || state.draft.vendorId;
        if (!vendorId) {
          toast('اول فروشنده را انتخاب کن.', { type: 'meh' });
          return;
        }
        if (name.length < 2) {
          toast('نام شعبه را بنویس.', { type: 'meh' });
          return;
        }
        state.creating = true;
        setBusy(true);
        try {
          const entity = await store.createEntity('shop', {
            vendorId,
            name,
            city: String(data.get('city') || ''),
            district: String(data.get('district') || '').trim(),
            address: String(data.get('address') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
            hours: String(data.get('hours') || '').trim(),
            pickup: form.querySelector('[name="pickup"]')?.checked ?? true,
            delivery: form.querySelector('[name="delivery"]')?.checked ?? true,
          });
          state.selectedId = entity.id;
          state.createMode = false;
          toast('شعبه ثبت شد. حالا تجربه‌ات را بنویس.', { type: 'good' });
          go(3);
        } catch (error) {
          toast(error.message || 'ساخت شعبه ناموفق بود.', { type: 'bad' });
        } finally {
          state.creating = false;
          setBusy(false);
        }
        return;
      }

      // product
      const name = String(data.get('name') || '').trim();
      const vendorId = state.combos.vendor?.value || state.draft.vendorId;
      if (!vendorId) {
        toast('اول فروشنده را انتخاب کن.', { type: 'meh' });
        return;
      }
      if (name.length < 2) {
        toast('نام محصول را بنویس.', { type: 'meh' });
        return;
      }
      const priceRaw = String(data.get('price') || '').trim();
      state.creating = true;
      setBusy(true);
      try {
        const entity = await store.createEntity('product', {
          vendorId,
          shopId: state.combos.shop?.value || null,
          name,
          brand: String(data.get('brand') || '').trim(),
          category: String(data.get('category') || 'other'),
          unit: String(data.get('unit') || '').trim() || 'عدد',
          price: priceRaw ? Number(priceRaw) : null,
          barcode: String(data.get('barcode') || '').trim(),
        });
        state.selectedId = entity.id;
        state.createMode = false;
        toast('محصول ثبت شد. حالا تجربه‌ات را بنویس.', { type: 'good' });
        go(3);
      } catch (error) {
        toast(error.message || 'ساخت محصول ناموفق بود.', { type: 'bad' });
      } finally {
        state.creating = false;
        setBusy(false);
      }
    }

    const setBusy = (busy) => {
      const button = body.querySelector('[data-submit-create]') || body.querySelector('[data-wizard-form] button[type="submit"]');
      if (button) {
        button.disabled = busy;
        if (busy) button.innerHTML = `<span class="btn__spinner"></span> در حال ثبت…`;
      }
    };

    /* -------------------------------------------------- ثبت نقد */
    async function submitReview() {
      if (state.pendingSubmit) return;
      if (!state.review.level && state.review.body.trim().length < CONFIG.COMMENT_MIN) {
        toast('یک سطح انتخاب کن یا حداقل یک جمله بنویس.', { type: 'meh' });
        return;
      }

      if (!store.currentUser()) {
        state.pendingSubmit = true;
        document.dispatchEvent(new CustomEvent('bb:require-auth', { detail: { reason: 'create' } }));
        return;
      }

      const submit = body.querySelector('[data-wizard-form] button[type="submit"]');
      const original = submit?.innerHTML;
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = `<span class="btn__spinner"></span> در حال ثبت…`;
      }

      try {
        if (state.review.level) {
          await store.rate(state.type, state.selectedId, state.review.level);
        }
        if (state.review.body.trim().length >= CONFIG.COMMENT_MIN) {
          await store.addComment({
            type: state.type,
            id: state.selectedId,
            body: state.review.body,
            level: state.review.level || null,
            tags: [...state.review.tags],
          });
        }
        state.pendingSubmit = false;
        go(4);
      } catch (error) {
        toast(error.message || 'ثبت تجربه ناموفق بود.', { type: 'bad' });
        if (submit) {
          submit.disabled = false;
          submit.innerHTML = original;
        }
      }
    }

    const onAuthSuccess = () => {
      if (state.pendingSubmit) {
        state.pendingSubmit = false;
        submitReview();
      }
    };
    document.addEventListener('bb:auth-success', onAuthSuccess);

    /* -------------------------------------------------- رویدادها */
    body.addEventListener('click', (event) => {
      if (event.target.closest('[data-wizard-next]')) {
        if (state.step === 1 && !state.type) {
          toast('اول نوع تجربه را انتخاب کن.', { type: 'meh' });
          return;
        }
        if (state.step === 2 && !state.createMode && !state.selectedId) {
          toast('یک مورد از فهرست انتخاب کن یا مورد جدید بساز.', { type: 'meh' });
          return;
        }
        if (state.step === 2 && state.createMode) return;
        go(state.step + 1);
        return;
      }
      if (event.target.closest('[data-wizard-back]')) {
        if (state.step === 3) {
          state.createMode = false;
          go(2);
        } else if (state.step === 2) {
          state.createMode = false;
          go(1);
        } else {
          go(Math.max(1, state.step - 1));
        }
        return;
      }
      if (event.target.closest('[data-start-create]')) {
        state.createMode = true;
        state.draft.vendorId = state.draft.vendorId || ctx.query.vendor || '';
        state.draft.name = '';
        state.draft.nameFa = '';
        paint();
        return;
      }
      if (event.target.closest('[data-cancel-create]')) {
        state.createMode = false;
        paint();
      }
    });

    paint();

    return () => {
      document.removeEventListener('bb:auth-success', onAuthSuccess);
      destroyCombos();
    };
  },
};
