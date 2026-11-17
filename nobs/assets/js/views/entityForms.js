/* ==========================================================================
   entityForms.js — فرم ساخت/ویرایش محصول، فروشگاه و پلتفرم
   ========================================================================== */

import { getState } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import { openModal, toast, setBusy, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { esc, faNum } from '../lib/utils.js';
import { ENTITY_TYPES, allCategories, shopCategories, relatedReviews } from '../lib/domain.js';
import { suggestSimilar } from '../lib/search.js';
import { entityAvatar } from '../components/parts.js';

const EMOJI_PICKS = {
  product: ['📦', '🥛', '🧀', '🍞', '🥚', '🍚', '🫒', '🍵', '🍫', '🍎', '🍌', '🥒', '💧', '🥣', '🥫', '🫛'],
  shop: ['🏪', '🏬', '🍎', '🥛', '🥖', '🌱', '🍫', '🛒', '🧺', '🏘️', '🚚', '🥬'],
  vendor: ['🛒', '🛍️', '🛵', '🥬', '🤝', '🏬', '🚶', '📱', '🌐', '⚡'],
};

function categoryOptions(type) {
  const data = getState().data;
  const list = type === 'product' ? allCategories(data) : shopCategories(data);
  return list.map((item) => `<option value="${esc(item)}"></option>`).join('');
}

export function openEntityForm(type, entity = null, { onSaved = null } = {}) {
  const isEdit = Boolean(entity?.id);
  const label = ENTITY_TYPES[type]?.label || 'مورد';
  const data = getState().data;

  const fields = {
    product: `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field__label" for="ef-name">نام محصول <span class="field__req">*</span></label>
          <input class="input" id="ef-name" name="name" maxlength="120" value="${esc(entity?.name || '')}" placeholder="مثلاً ماست پرچرب ۹۰۰ گرمی" />
          <div data-similar></div>
        </div>
        <div class="field">
          <label class="field__label" for="ef-category">دسته‌بندی</label>
          <input class="input" id="ef-category" name="category" list="cat-list" maxlength="60" value="${esc(entity?.category || '')}" placeholder="لبنیات" />
          <datalist id="cat-list">${categoryOptions('product')}</datalist>
        </div>
        <div class="field">
          <label class="field__label" for="ef-brand">برند</label>
          <input class="input" id="ef-brand" name="brand" maxlength="60" value="${esc(entity?.brand || '')}" placeholder="اختیاری" />
        </div>
        <div class="field span-2">
          <label class="field__label" for="ef-unit">واحد / بسته‌بندی</label>
          <input class="input" id="ef-unit" name="unit" maxlength="30" value="${esc(entity?.unit || '')}" placeholder="۹۰۰ گرم، ۵ کیلو، بسته ۶ عددی…" />
        </div>
      </div>`,
    shop: `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field__label" for="ef-name">نام فروشگاه <span class="field__req">*</span></label>
          <input class="input" id="ef-name" name="name" maxlength="100" value="${esc(entity?.name || '')}" placeholder="مثلاً سوپرمارکت گلستان" />
          <div data-similar></div>
        </div>
        <div class="field">
          <label class="field__label" for="ef-category">دسته‌بندی</label>
          <input class="input" id="ef-category" name="category" list="cat-list" maxlength="60" value="${esc(entity?.category || '')}" placeholder="سوپرمارکت" />
          <datalist id="cat-list">${categoryOptions('shop')}</datalist>
        </div>
        <div class="field">
          <label class="field__label" for="ef-city">شهر</label>
          <input class="input" id="ef-city" name="city" maxlength="60" value="${esc(entity?.city || '')}" placeholder="تهران" />
        </div>
        <div class="field span-2">
          <label class="field__label" for="ef-address">نشانی</label>
          <input class="input" id="ef-address" name="address" maxlength="200" value="${esc(entity?.address || '')}" placeholder="اختیاری" />
        </div>
      </div>`,
    vendor: `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field__label" for="ef-name">نام پلتفرم <span class="field__req">*</span></label>
          <input class="input" id="ef-name" name="name" maxlength="60" value="${esc(entity?.name || '')}" placeholder="دیجی‌کالا، اسنپ‌فود، اکالا…" />
          <div data-similar></div>
        </div>
        <div class="field">
          <label class="field__label" for="ef-website">وب‌سایت</label>
          <input class="input" id="ef-website" name="website" dir="ltr" maxlength="200" value="${esc(entity?.website || '')}" placeholder="https://…" />
        </div>
        <div class="field">
          <label class="field__label" for="ef-color">رنگ برند</label>
          <div class="u-row u-gap-2">
            <input type="color" id="ef-color" name="color" value="${esc(entity?.color || '#35e0a1')}" style="width:44px;height:40px;border-radius:10px;border:1px solid var(--line-2);background:transparent;padding:2px" />
            <input class="input" name="colorText" dir="ltr" value="${esc(entity?.color || '#35e0a1')}" maxlength="7" />
          </div>
        </div>
      </div>`,
  };

  const modal = openModal({
    title: isEdit ? `ویرایش ${label}` : `${label} جدید`,
    subtitle: 'برای جلوگیری از داده تکراری، نام‌های مشابه پیشنهاد می‌شوند.',
    size: 'md',
    body: `
      <form class="stack" data-entity-form data-type="${type}" novalidate>
        <div class="u-row u-gap-3">
          ${entityAvatar(type, entity || { name: '؟', emoji: EMOJI_PICKS[type][0] }, 'lg')}
          <div class="u-grow">
            <div class="field__label">آیکون</div>
            <div class="chips" data-emoji-row>
              ${EMOJI_PICKS[type]
                .map(
                  (emoji) =>
                    `<button type="button" class="chip" data-emoji="${emoji}" style="font-size:15px;width:34px;padding:0;justify-content:center">${emoji}</button>`,
                )
                .join('')}
            </div>
          </div>
        </div>
        ${fields[type]}
        <div class="field">
          <label class="field__label" for="ef-note">یادداشت</label>
          <textarea class="textarea textarea--sm" id="ef-note" name="note" rows="3" maxlength="1000" placeholder="نکته‌ای که باید یادت بماند…">${esc(entity?.note || '')}</textarea>
        </div>
        <p class="field__hint" data-count-hint></p>
      </form>
    `,
    footer: `
      <span class="u-grow"></span>
      <button type="button" class="btn btn--ghost" data-cancel>انصراف</button>
      <button type="button" class="btn btn--primary" data-save>${icon('check', 16)} ${isEdit ? 'ذخیره' : 'ساختن'}</button>
    `,
    onMount({ el, close }) {
      const form = el.querySelector('[data-entity-form]');
      const nameInput = form.querySelector('[name="name"]');
      const similarBox = form.querySelector('[data-similar]');
      const emojiRow = el.querySelector('[data-emoji-row]');
      const colorText = form.querySelector('[name="colorText"]');
      const colorPicker = form.querySelector('[name="color"]');
      let emoji = entity?.emoji || EMOJI_PICKS[type][0];

      const pool = type === 'product' ? data.products : type === 'shop' ? data.shops : data.vendors;

      function renderSimilar() {
        const value = nameInput.value.trim();
        if (value.length < 2) {
          similarBox.innerHTML = '';
          return;
        }
        const matches = suggestSimilar(value, pool, { limit: 3 }).filter((row) => row.item.id !== entity?.id);
        if (!matches.length) {
          similarBox.innerHTML = '';
          return;
        }
        similarBox.innerHTML = `<div class="callout callout--warn u-mt-2" style="padding:9px 11px">
          ${icon('alert', 15)}
          <div class="u-grow" style="font-size:10.5px;line-height:1.8">
            شاید منظورتان یکی از این‌هاست:
            ${matches
              .map(
                (row) =>
                  `<button type="button" class="chip u-mt-1" data-similar-name="${esc(row.item.name)}" style="height:24px;font-size:10px">${esc(row.item.name)}</button>`,
              )
              .join(' ')}
            <div class="u-faint" style="font-size:9.5px;margin-top:4px">اگر واقعاً مورد جدیدی است، نام متفاوتی بگذارید.</div>
          </div>
        </div>`;
        similarBox.querySelectorAll('[data-similar-name]').forEach((btn) => {
          btn.addEventListener('click', () => {
            nameInput.value = btn.dataset.similarName;
            renderSimilar();
          });
        });
      }

      nameInput.addEventListener('input', renderSimilar);

      emojiRow.querySelectorAll('[data-emoji]').forEach((btn) => {
        btn.addEventListener('click', () => {
          emoji = btn.dataset.emoji;
          emojiRow.querySelectorAll('[data-emoji]').forEach((other) => other.classList.toggle('is-active', other === btn));
          const avatarNode = el.querySelector('.avatar');
          if (avatarNode) avatarNode.innerHTML = `<span class="avatar__emoji">${emoji}</span>`;
        });
      });

      colorPicker?.addEventListener('input', () => {
        if (colorText) colorText.value = colorPicker.value;
      });
      colorText?.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(colorText.value) && colorPicker) colorPicker.value = colorText.value;
      });

      el.querySelector('[data-cancel]')?.addEventListener('click', close);

      el.querySelector('[data-save]')?.addEventListener('click', async () => {
        const saveBtn = el.querySelector('[data-save]');
        const name = nameInput.value.trim();
        if (name.length < 2) {
          toast.warn('نام باید حداقل ۲ حرف باشد.');
          nameInput.focus();
          return;
        }

        const payload = {
          id: entity?.id || null,
          name,
          emoji,
          note: form.querySelector('[name="note"]').value,
        };

        if (type === 'product') {
          payload.category = form.querySelector('[name="category"]').value;
          payload.brand = form.querySelector('[name="brand"]').value;
          payload.unit = form.querySelector('[name="unit"]').value;
        } else if (type === 'shop') {
          payload.category = form.querySelector('[name="category"]').value;
          payload.city = form.querySelector('[name="city"]').value;
          payload.address = form.querySelector('[name="address"]').value;
        } else {
          payload.website = form.querySelector('[name="website"]').value;
          payload.color = /^#[0-9a-fA-F]{6}$/.test(colorText?.value || '') ? colorText.value : '#35e0a1';
        }

        setBusy(saveBtn, true);
        try {
          const saved =
            type === 'product'
              ? await repo.saveProduct(payload)
              : type === 'shop'
                ? await repo.saveShop(payload)
                : await repo.saveVendor(payload);
          toast.success(isEdit ? 'ویرایش شد.' : `${label} ساخته شد.`);
          close();
          onSaved?.(saved);
        } catch (error) {
          setBusy(saveBtn, false);
          if (error.code === 'DUPLICATE_NAME') {
            toast.error(error.message);
            renderSimilar();
          } else {
            toast.error(error.message);
          }
        }
      });

      setTimeout(() => nameInput.focus(), 120);
    },
  });

  return modal;
}

export function deleteEntityWithConfirm(type, entity, { onDeleted = null } = {}) {
  const label = ENTITY_TYPES[type]?.label || 'مورد';
  const count = relatedReviews(type, entity.id, getState().data).length;
  confirmDialog({
    title: `حذف ${label}`,
    message:
      count > 0
        ? `«${entity.name}» و ${faNum(count)} تجربه مرتبط با آن حذف می‌شوند. ادامه می‌دهید؟`
        : `«${entity.name}» حذف شود؟`,
    confirmText: 'حذف کن',
  }).then(async (ok) => {
    if (!ok) return;
    try {
      if (type === 'product') await repo.deleteProduct(entity.id);
      else if (type === 'shop') await repo.deleteShop(entity.id);
      else await repo.deleteVendor(entity.id);
      toast.success('حذف شد.');
      onDeleted?.();
    } catch (error) {
      toast.error(error.message);
    }
  });
}
