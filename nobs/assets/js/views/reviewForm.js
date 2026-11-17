/* ==========================================================================
   reviewForm.js — ثبت/ویرایش تجربه: محصول × فروشگاه × پلتفرم + امتیاز
   ========================================================================== */

import { getState } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import { openModal, toast, setBusy, confirmDialog, openMenu } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { esc, faNum, parseNum, normFa, uid, todayISO, fmtMoney } from '../lib/utils.js';
import { RATING_LIST, RATINGS, ratingInfo, comboKey, findCombo, allTags } from '../lib/domain.js';
import { createPicker } from '../components/picker.js';
import { createDateInput } from '../components/datepicker.js';
import { ratingSelector, avatar } from '../components/parts.js';
import { suggestTags } from '../lib/search.js';
import { openEntitySheet } from '../components/entitySheet.js';

export function openReviewForm({ reviewId = null, prefill = {}, onSaved = null } = {}) {
  const state = getState();
  const editing = reviewId ? state.data.reviews.find((row) => row.id === reviewId) : null;
  const base = editing || { ...prefill };

  let rating = base.rating || 'good';
  let tags = Array.isArray(base.tags) ? [...base.tags] : [];
  let again = typeof base.would_buy_again === 'boolean' ? base.would_buy_again : null;
  let conflictReview = null;

  const tagPool = allTags(state.data);

  const modal = openModal({
    title: editing ? 'ویرایش تجربه' : 'ثبت تجربه خرید',
    subtitle: editing
      ? 'امتیاز این ترکیب محصول، فروشگاه و پلتفرم را تغییر بده.'
      : 'هر ترکیب محصول × فروشگاه × پلتفرم فقط یک بار امتیاز می‌گیرد و بعد از آن قابل ویرایش است.',
    size: 'lg',
    body: `
      <form class="stack" data-review-form novalidate>
        <div class="form-grid">
          <div class="field span-2">
            <label class="field__label">محصول <span class="field__req">*</span></label>
            <div data-slot="product"></div>
            <p class="field__hint">اگر محصولی نیست، همین‌جا با نام دقیق بسازش.</p>
          </div>
          <div class="field">
            <label class="field__label">فروشگاه <span class="field__req">*</span></label>
            <div data-slot="shop"></div>
          </div>
          <div class="field">
            <label class="field__label">پلتفرم خرید <span class="field__req">*</span></label>
            <div data-slot="vendor"></div>
          </div>
        </div>

        <div class="field">
          <label class="field__label">امتیاز تجربه <span class="field__req">*</span></label>
          ${ratingSelector(rating)}
          <p class="field__hint" data-rating-hint>${esc(RATINGS[rating]?.description || '')}</p>
        </div>

        <div class="form-grid form-grid--3">
          <div class="field">
            <label class="field__label" for="review-price">قیمت واحد (تومان)</label>
            <input class="input input--num" id="review-price" name="price" inputmode="numeric" placeholder="مثلاً ۴۵۰۰۰"
              value="${base.price ?? ''}" />
          </div>
          <div class="field">
            <label class="field__label" for="review-qty">تعداد</label>
            <input class="input input--num" id="review-qty" name="quantity" inputmode="decimal" value="${base.quantity ?? 1}" />
          </div>
          <div class="field">
            <label class="field__label">تاریخ خرید</label>
            <div data-slot="date"></div>
          </div>
        </div>

        <div class="field">
          <label class="field__label">دوباره می‌خری؟</label>
          <div class="segmented" data-again-seg>
            <button type="button" class="segmented__btn ${again === true ? 'is-active is-good' : ''}" data-again="true">${icon('check', 13)} بله</button>
            <button type="button" class="segmented__btn ${again === false ? 'is-active is-bad' : ''}" data-again="false">${icon('x', 13)} نه</button>
            <button type="button" class="segmented__btn ${again === null ? 'is-active' : ''}" data-again="null">مطمئن نیستم</button>
          </div>
        </div>

        <div class="field">
          <label class="field__label">برچسب‌ها</label>
          <div class="tag-input" data-tag-input>
            <input class="tag-input__field" data-tag-field placeholder="تگ بنویس و Enter بزن" maxlength="30" />
          </div>
          <div class="tag-suggest" data-tag-suggest></div>
        </div>

        <div class="field">
          <label class="field__label" for="review-note">یادداشت</label>
          <textarea class="textarea" id="review-note" name="note" rows="3" maxlength="2000"
            placeholder="چه چیزی خوب یا بد بود؟ بسته‌بندی، تازگی، قیمت، ارسال…">${esc(base.note || '')}</textarea>
          <div class="u-between u-xs u-faint">
            <span>یادداشت فقط برای خودت ذخیره می‌شود.</span>
            <span data-note-count>${faNum((base.note || '').length)} / ۲۰۰۰</span>
          </div>
        </div>

        <div data-conflict></div>
        <div class="callout callout--info" data-edit-hint hidden>
          ${icon('info', 17)}
          <div class="u-grow">
            <div class="callout__title">این ترکیب قبلاً ثبت شده</div>
            <div class="callout__text">برای جلوگیری از داده تکراری، همان تجربه را ویرایش کن.</div>
            <div class="callout__actions">
              <button type="button" class="btn btn--soft btn--sm" data-open-existing>${icon('edit', 14)} ویرایش تجربه موجود</button>
            </div>
          </div>
        </div>
      </form>
    `,
    footer: `
      ${editing ? `<button type="button" class="btn btn--danger btn--sm" data-delete>${icon('trash', 14)} حذف</button>` : ''}
      <span class="u-grow"></span>
      <button type="button" class="btn btn--ghost" data-cancel>انصراف</button>
      <button type="button" class="btn btn--primary" data-save>${icon('check', 16)} ${editing ? 'ذخیره تغییرات' : 'ثبت تجربه'}</button>
    `,
    onMount({ el, close }) {
      const form = el.querySelector('[data-review-form]');
      const conflictBox = el.querySelector('[data-conflict]');
      const editHint = el.querySelector('[data-edit-hint]');
      const noteField = el.querySelector('#review-note');
      const noteCount = el.querySelector('[data-note-count]');

      /* ------------------------------ پیکرها ------------------------------ */
      const productPicker = createPicker({
        type: 'product',
        items: state.data.products,
        value: base.product_id || '',
        allowCreate: true,
        onCreate: async (name) => {
          const created = await repo.saveProduct({ name });
          toast.success(`محصول «${created.name}» ساخته شد.`);
          return created;
        },
        onChange: () => checkConflict(),
      });

      const shopPicker = createPicker({
        type: 'shop',
        items: state.data.shops,
        value: base.shop_id || '',
        allowCreate: true,
        onCreate: async (name) => {
          const created = await repo.saveShop({ name });
          toast.success(`فروشگاه «${created.name}» ساخته شد.`);
          return created;
        },
        onChange: () => checkConflict(),
      });

      const vendorPicker = createPicker({
        type: 'vendor',
        items: state.data.vendors,
        value: base.vendor_id || '',
        allowCreate: true,
        onCreate: async (name) => {
          const created = await repo.saveVendor({ name });
          toast.success(`پلتفرم «${created.name}» ساخته شد.`);
          return created;
        },
        onChange: () => checkConflict(),
      });

      el.querySelector('[data-slot="product"]').appendChild(productPicker.el);
      el.querySelector('[data-slot="shop"]').appendChild(shopPicker.el);
      el.querySelector('[data-slot="vendor"]').appendChild(vendorPicker.el);

      /* ------------------------------ تاریخ ------------------------------- */
      const dateInput = createDateInput({
        value: base.purchased_at || todayISO(),
        onChange: () => {},
      });
      el.querySelector('[data-slot="date"]').appendChild(dateInput.el);

      /* ------------------------------ امتیاز ------------------------------ */
      el.querySelectorAll('.rating-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          rating = btn.dataset.rating;
          el.querySelectorAll('.rating-choice').forEach((other) => {
            const active = other.dataset.rating === rating;
            other.classList.toggle('is-active', active);
            other.setAttribute('aria-checked', String(active));
          });
          const hint = el.querySelector('[data-rating-hint]');
          if (hint) hint.textContent = RATINGS[rating]?.description || '';
        });
      });

      /* --------------------------- دوباره می‌خرم -------------------------- */
      el.querySelectorAll('[data-again]').forEach((btn) => {
        btn.addEventListener('click', () => {
          again = btn.dataset.again === 'null' ? null : btn.dataset.again === 'true';
          el.querySelectorAll('[data-again]').forEach((other) => other.classList.toggle('is-active', other === btn));
        });
      });

      /* ------------------------------- تگ‌ها ------------------------------ */
      const tagInput = el.querySelector('[data-tag-input]');
      const tagField = el.querySelector('[data-tag-field]');
      const tagSuggest = el.querySelector('[data-tag-suggest]');

      function renderTags() {
        tagInput.querySelectorAll('.tag-input__tag').forEach((node) => node.remove());
        tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'tag-input__tag';
          chip.innerHTML = `#${esc(tag)}<button type="button" class="tag-input__x" aria-label="حذف تگ">${icon('x', 10)}</button>`;
          chip.querySelector('button').addEventListener('click', () => {
            tags = tags.filter((item) => item !== tag);
            renderTags();
            renderSuggestions();
          });
          tagInput.insertBefore(chip, tagField);
        });
      }

      function addTag(value) {
        const clean = String(value || '').trim().replace(/^#/, '');
        if (!clean) return;
        if (tags.some((tag) => normFa(tag) === normFa(clean))) return;
        if (tags.length >= 12) {
          toast.warn('حداکثر ۱۲ برچسب مجاز است.');
          return;
        }
        tags.push(clean);
        renderTags();
        renderSuggestions();
      }

      function renderSuggestions() {
        const suggestions = suggestTags(noteField.value || '', tagPool, 8)
          .filter((label) => !tags.some((tag) => normFa(tag) === normFa(label)))
          .slice(0, 6);
        tagSuggest.innerHTML = suggestions
          .map((label) => `<button type="button" class="tag-suggest__btn" data-suggest="${esc(label)}">#${esc(label)}</button>`)
          .join('');
        tagSuggest.querySelectorAll('[data-suggest]').forEach((btn) => {
          btn.addEventListener('click', () => addTag(btn.dataset.suggest));
        });
      }

      tagField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          addTag(tagField.value);
          tagField.value = '';
        } else if (event.key === 'Backspace' && !tagField.value && tags.length) {
          tags.pop();
          renderTags();
        }
      });
      tagField.addEventListener('blur', () => {
        if (tagField.value.trim()) {
          addTag(tagField.value);
          tagField.value = '';
        }
      });

      renderTags();
      renderSuggestions();

      noteField.addEventListener('input', () => {
        noteCount.textContent = `${faNum(noteField.value.length)} / ۲۰۰۰`;
      });

      /* --------------------------- تضاد ترکیب ---------------------------- */
      function checkConflict() {
        const productId = productPicker.getValue();
        const shopId = shopPicker.getValue();
        const vendorId = vendorPicker.getValue();
        if (!productId || !shopId || !vendorId) {
          conflictReview = null;
          editHint.hidden = true;
          conflictBox.innerHTML = '';
          updateSaveState();
          return;
        }
        const existing = findCombo(getState().data.reviews, {
          product_id: productId,
          shop_id: shopId,
          vendor_id: vendorId,
        }, editing?.id || null);

        conflictReview = existing;
        const sameAsEditing = editing && existing?.id === editing.id;
        editHint.hidden = !existing || sameAsEditing;
        conflictBox.innerHTML = existing && !sameAsEditing
          ? `<div class="callout callout--warn">
              ${icon('alert', 17)}
              <div class="u-grow">
                <div class="callout__title">این ترکیب قبلاً امتیاز گرفته</div>
                <div class="callout__text">ترکیب «${esc(
                  getState().data.products.find((p) => p.id === productId)?.name || 'این محصول',
                )} × ${esc(getState().data.shops.find((s) => s.id === shopId)?.name || 'این فروشگاه')} × ${esc(
                  getState().data.vendors.find((v) => v.id === vendorId)?.name || 'این پلتفرم',
                )}» قبلاً ثبت شده. برای تغییر، همان تجربه را ویرایش کنید.</div>
              </div>
            </div>`
          : '';
        updateSaveState();
      }

      function updateSaveState() {
        const saveBtn = el.querySelector('[data-save]');
        if (!saveBtn) return;
        const ready = Boolean(productPicker.getValue() && shopPicker.getValue() && vendorPicker.getValue() && rating);
        saveBtn.disabled = !ready || Boolean(conflictReview && conflictReview.id !== editing?.id);
      }

      el.querySelector('[data-open-existing]')?.addEventListener('click', () => {
        if (!conflictReview) return;
        const targetId = conflictReview.id;
        close();
        openReviewForm({ reviewId: targetId, onSaved });
      });

      /* -------------------------------- ذخیره ---------------------------- */
      el.querySelector('[data-save]')?.addEventListener('click', async () => {
        const saveBtn = el.querySelector('[data-save]');
        const productId = productPicker.getValue();
        const shopId = shopPicker.getValue();
        const vendorId = vendorPicker.getValue();

        if (!productId) {
          toast.warn('محصول را انتخاب کنید.');
          productPicker.focus();
          return;
        }
        if (!shopId) {
          toast.warn('فروشگاه را انتخاب کنید.');
          shopPicker.focus();
          return;
        }
        if (!vendorId) {
          toast.warn('پلتفرم را انتخاب کنید.');
          vendorPicker.focus();
          return;
        }

        const priceRaw = el.querySelector('#review-price').value.trim();
        const price = priceRaw ? parseNum(priceRaw) : null;
        if (priceRaw && (price === null || price < 0)) {
          toast.error('قیمت معتبر نیست.');
          el.querySelector('#review-price').focus();
          return;
        }
        const qty = parseNum(el.querySelector('#review-qty').value) || 1;

        setBusy(saveBtn, true);
        try {
          await repo.saveReview({
            id: editing?.id || null,
            product_id: productId,
            shop_id: shopId,
            vendor_id: vendorId,
            rating,
            price,
            quantity: qty,
            purchased_at: dateInput.getValue(),
            note: noteField.value,
            tags,
            would_buy_again: again,
          });
          toast.success(editing ? 'تجربه به‌روزرسانی شد.' : 'تجربه ثبت شد.');
          close();
          onSaved?.();
        } catch (error) {
          setBusy(saveBtn, false);
          if (error.code === 'COMBO_EXISTS') {
            conflictReview = error.payload?.review || null;
            editHint.hidden = false;
            conflictBox.innerHTML = `<div class="callout callout--warn">${icon('alert', 17)}<div class="u-grow"><div class="callout__title">قبلاً ثبت شده</div><div class="callout__text">${esc(error.message)}</div></div></div>`;
            updateSaveState();
          } else {
            toast.error(error.message);
          }
        }
      });

      /* -------------------------------- حذف ------------------------------ */
      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'حذف تجربه',
          message: 'این تجربه برای همیشه حذف شود؟',
          confirmText: 'حذف کن',
        });
        if (!ok) return;
        try {
          await repo.deleteReview(editing.id);
          toast.success('حذف شد.');
          close();
          onSaved?.();
        } catch (error) {
          toast.error(error.message);
        }
      });

      el.querySelector('[data-cancel]')?.addEventListener('click', close);

      setTimeout(() => {
        if (!base.product_id) productPicker.el.querySelector('.picker__control')?.focus();
      }, 120);

      updateSaveState();
    },
  });

  return modal;
}
