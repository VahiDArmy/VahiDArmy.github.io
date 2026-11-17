/* ==========================================================================
   lists.js — لیست‌های خرید: بخر دوباره، نخر و لیست‌های سفارشی
   ========================================================================== */

import { getState, subscribe } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import { openDrawer, openModal, confirmDialog, toast, openMenu, setBusy } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { esc, faNum, pct, copyText } from '../lib/utils.js';
import { openEntitySheet } from '../components/entitySheet.js';
import { openReviewForm } from './reviewForm.js';
import { createPicker } from '../components/picker.js';
import { emptyState, sectionHead } from '../components/parts.js';

const TONE_META = {
  buy: { label: 'بخر دوباره', icon: 'check-circle', tone: 'good' },
  avoid: { label: 'نخر', icon: 'x-circle', tone: 'bad' },
  custom: { label: 'سفارشی', icon: 'list', tone: 'info' },
};

export function mount(container) {
  container.innerHTML = `<div class="page__inner">
    <header class="page__head">
      <div class="page__head-text">
        <span class="eyebrow">حافظه خرید</span>
        <h1 class="page__title">لیست‌ها</h1>
        <p class="page__sub">چیزهایی که باید دوباره بخری، چیزهایی که هرگز نباید، و هر فهرست دیگری که برای خرید لازم داری.</p>
      </div>
      <div class="page__actions">
        <button type="button" class="btn btn--primary" data-create-list>${icon('plus', 16)} لیست جدید</button>
      </div>
    </header>
    <div data-lists></div>
  </div>`;

  const slot = container.querySelector('[data-lists]');

  function entityOf(item) {
    const data = getState().data;
    if (item.target_type === 'product') return data.products.find((row) => row.id === item.target_id);
    if (item.target_type === 'shop') return data.shops.find((row) => row.id === item.target_id);
    if (item.target_type === 'vendor') return data.vendors.find((row) => row.id === item.target_id);
    return data.reviews.find((row) => row.id === item.target_id);
  }

  function itemLabel(item) {
    const data = getState().data;
    if (item.target_type === 'review') {
      const review = data.reviews.find((row) => row.id === item.target_id);
      if (!review) return { name: 'تجربه حذف‌شده', emoji: '⭐', type: 'review' };
      const product = data.products.find((row) => row.id === review.product_id);
      return { name: `${product?.name || 'تجربه'}`, emoji: product?.emoji || '⭐', type: 'review', id: review.id };
    }
    const entity = entityOf(item);
    return {
      name: entity?.name || 'آیتم حذف‌شده',
      emoji: entity?.emoji || (item.target_type === 'shop' ? '🏪' : item.target_type === 'vendor' ? '🛒' : '📦'),
      type: item.target_type,
      id: item.target_id,
    };
  }

  function render() {
    const data = getState().data;
    if (!data.lists.length) {
      slot.innerHTML = emptyState({
        iconName: 'list',
        title: 'هنوز لیستی نساخته‌ای',
        text: 'یک لیست «بخر دوباره» بساز تا بهترین ترکیب‌ها همیشه دم دستت باشد، یا لیست «نخر» برای یادآوری تجربه‌های بد.',
        actions: `<button type="button" class="btn btn--primary btn--sm" data-create-list data-tone="buy">${icon('plus', 14)} ساخت لیست</button>`,
      });
      return;
    }

    slot.innerHTML = `<div class="grid-cards stagger">
      ${data.lists
        .map((list, index) => {
          const items = data.listItems.filter((item) => item.list_id === list.id);
          const done = items.filter((item) => item.done).length;
          const meta = TONE_META[list.tone] || TONE_META.custom;
          return `<article class="lcard" data-list-id="${esc(list.id)}" style="--i:${index}" tabindex="0" role="button">
            <div class="lcard__head">
              <span class="lcard__emoji">${esc(list.emoji || '📝')}</span>
              <div class="u-grow" style="min-width:0">
                <div class="lcard__name u-truncate">${esc(list.name)}</div>
                <div class="lcard__meta">${faNum(items.length)} آیتم · ${faNum(done)} انجام‌شده</div>
              </div>
              <span class="badge badge--${meta.tone}">${icon(meta.icon, 12)} ${esc(meta.label)}</span>
            </div>
            ${list.note ? `<p class="u-xs u-dim u-clamp-2" style="line-height:1.8">${esc(list.note)}</p>` : ''}
            <div class="lcard__bar"><i style="width:${items.length ? pct(done, items.length) : 0}%"></i></div>
            <div class="u-row u-gap-2 u-wrap" style="min-height:24px">
              ${items
                .slice(0, 4)
                .map((item) => {
                  const info = itemLabel(item);
                  return `<span class="tag">${esc(info.emoji)} ${esc(info.name)}</span>`;
                })
                .join('')}
              ${items.length > 4 ? `<span class="tag">+${faNum(items.length - 4)}</span>` : ''}
              ${items.length === 0 ? '<span class="u-xs u-faint">خالی است</span>' : ''}
            </div>
            <div class="u-between">
              <span class="u-xs u-faint">${list.created_at ? `ساخته‌شده ${faNum(new Date(list.created_at).toLocaleDateString('fa-IR'))}` : ''}</span>
              <span class="u-row u-gap-1 u-xs u-acc">مشاهده ${icon('chevron-left', 13)}</span>
            </div>
          </article>`;
        })
        .join('')}
    </div>`;
  }

  function openList(listId) {
    let drawer = null;

    function build() {
      const data = getState().data;
      const list = data.lists.find((row) => row.id === listId);
      if (!list) {
        drawer?.close();
        return;
      }
      const items = data.listItems.filter((item) => item.list_id === list.id);
      const meta = TONE_META[list.tone] || TONE_META.custom;
      const done = items.filter((i) => i.done).length;

      drawer.setHead(`
        <div class="u-row u-gap-3">
          <span class="avatar avatar--lg"><span class="avatar__emoji">${esc(list.emoji || '📝')}</span></span>
          <div class="u-grow" style="min-width:0">
            <span class="badge badge--${meta.tone}">${esc(meta.label)}</span>
            <h2 class="modal__title u-mt-1" style="font-size:var(--fs-lg)">${esc(list.name)}</h2>
            <p class="modal__sub">${faNum(items.length)} آیتم · ${faNum(done)} انجام‌شده</p>
          </div>
        </div>
      `);

      drawer.setBody(`
        ${list.note ? `<div class="panel"><p class="u-xs" style="line-height:1.9;color:var(--txt-2)">${esc(list.note)}</p></div>` : ''}
        <div class="btn-row">
          <button type="button" class="btn btn--primary btn--sm" data-add-item>${icon('plus', 15)} افزودن آیتم</button>
          <button type="button" class="btn btn--ghost btn--sm" data-edit-list>${icon('edit', 15)} ویرایش لیست</button>
          <span class="u-grow"></span>
          <button type="button" class="icon-btn icon-btn--danger" data-delete-list aria-label="حذف لیست">${icon('trash', 16)}</button>
        </div>
        <div class="stack stack--sm" data-items>
          ${
            items.length
              ? items
                  .map((item) => {
                    const info = itemLabel(item);
                    return `<div class="litem ${item.done ? 'is-done' : ''}" data-item-id="${esc(item.id)}">
                      <button type="button" class="checkbox ${item.done ? 'is-checked' : ''}" data-toggle-item aria-label="انجام شد" style="${item.done ? 'background:var(--acc);border-color:var(--acc)' : ''}"></button>
                      <button type="button" class="avatar avatar--sm" data-open-item style="border:0"><span class="avatar__emoji">${esc(info.emoji)}</span></button>
                      <div class="u-grow" style="min-width:0">
                        <div class="litem__name u-truncate">${esc(info.name)}</div>
                        <div class="litem__meta">${item.note ? esc(item.note) : esc(info.type === 'product' ? 'محصول' : info.type === 'shop' ? 'فروشگاه' : info.type === 'vendor' ? 'پلتفرم' : 'تجربه')}</div>
                      </div>
                      <button type="button" class="icon-btn icon-btn--danger" data-remove-item aria-label="حذف آیتم">${icon('x', 14)}</button>
                    </div>`;
                  })
                  .join('')
              : `<p class="u-xs u-faint" style="padding:14px 0">این لیست خالی است. با «افزودن آیتم» شروع کن.</p>`
          }
        </div>
      `);

      drawer.setFooter(`
        <button type="button" class="btn btn--ghost btn--sm" data-close>بستن</button>
        <span class="u-grow"></span>
        <button type="button" class="btn btn--soft btn--sm" data-copy>${icon('copy', 14)} کپی لیست</button>
      `);

      wire(list, items);
    }

    function wire(list, items) {
      const root = drawer.bodyEl;

      root.querySelector('[data-close]')?.addEventListener('click', () => drawer.close());
      drawer.el.querySelector('[data-close]')?.addEventListener('click', () => drawer.close());

      root.querySelector('[data-copy]')?.addEventListener('click', async () => {
        const text = [`${list.emoji || ''} ${list.name}`]
          .concat(items.map((item) => `${item.done ? '✓' : '•'} ${itemLabel(item).name}${item.note ? ` (${item.note})` : ''}`))
          .join('\n');
        const ok = await copyText(text);
        toast[ok ? 'success' : 'error'](ok ? 'لیست کپی شد.' : 'کپی نشد.');
      });

      root.querySelector('[data-edit-list]')?.addEventListener('click', () => {
        openListForm(list, { onSaved: () => build() });
      });

      root.querySelector('[data-delete-list]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'حذف لیست',
          message: `لیست «${list.name}» و ${faNum(items.length)} آیتمش حذف شود؟`,
          confirmText: 'حذف کن',
        });
        if (!ok) return;
        try {
          await repo.deleteList(list.id);
          toast.success('لیست حذف شد.');
          drawer.close();
          render();
        } catch (error) {
          toast.error(error.message);
        }
      });

      root.querySelector('[data-add-item]')?.addEventListener('click', () => openAddItem(list.id, () => build()));

      root.querySelectorAll('[data-item-id]').forEach((row) => {
        const itemId = row.dataset.itemId;
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        row.querySelector('[data-toggle-item]')?.addEventListener('click', async () => {
          try {
            await repo.toggleListItem(itemId, !item.done);
            build();
            render();
          } catch (error) {
            toast.error(error.message);
          }
        });

        row.querySelector('[data-remove-item]')?.addEventListener('click', async () => {
          try {
            await repo.deleteListItem(itemId);
            toast.success('آیتم حذف شد.');
            build();
            render();
          } catch (error) {
            toast.error(error.message);
          }
        });

        row.querySelector('[data-open-item]')?.addEventListener('click', () => {
          const info = itemLabel(item);
          if (info.type === 'review') import('../components/entitySheet.js').then((mod) => mod.openReviewSheet(info.id));
          else openEntitySheet(info.type, info.id);
        });
      });
    }

    drawer = openDrawer({
      head: '<div class="u-row u-gap-2"><span class="searchbox__spinner"></span></div>',
      body: '',
      wide: true,
      onMount: () => build(),
    });
  }

  function openListForm(list = null, { onSaved = null } = {}) {
    const isEdit = Boolean(list?.id);
    openModal({
      title: isEdit ? 'ویرایش لیست' : 'لیست جدید',
      size: 'sm',
      body: `<form class="stack" data-list-form>
        <div class="field">
          <label class="field__label" for="lf-name">نام لیست <span class="field__req">*</span></label>
          <input class="input" id="lf-name" name="name" maxlength="60" value="${esc(list?.name || '')}" placeholder="مثلاً بخر دوباره" />
        </div>
        <div class="field">
          <label class="field__label">نوع</label>
          <div class="segmented" data-tone-seg>
            ${Object.entries(TONE_META)
              .map(
                ([key, meta]) =>
                  `<button type="button" class="segmented__btn ${((list?.tone || 'buy') === key) ? 'is-active' : ''}" data-tone="${key}">${esc(meta.label)}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="field">
          <label class="field__label">آیکون</label>
          <div class="chips" data-emoji>
            ${['📝', '🔁', '🚫', '🛒', '⭐', '🥬', '🧺', '💡', '🎁', '📦']
              .map(
                (emoji) =>
                  `<button type="button" class="chip ${((list?.emoji || '📝') === emoji) ? 'is-active' : ''}" data-emoji-value="${emoji}" style="font-size:16px;width:36px;justify-content:center">${emoji}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="lf-note">توضیح</label>
          <textarea class="textarea textarea--sm" id="lf-note" name="note" maxlength="500" placeholder="اختیاری">${esc(list?.note || '')}</textarea>
        </div>
      </form>`,
      footer: `<span class="u-grow"></span><button type="button" class="btn btn--ghost" data-cancel>انصراف</button><button type="button" class="btn btn--primary" data-save>${icon('check', 16)} ذخیره</button>`,
      onMount({ el, close }) {
        let tone = list?.tone || 'buy';
        let emoji = list?.emoji || '📝';

        el.querySelectorAll('[data-tone]').forEach((btn) =>
          btn.addEventListener('click', () => {
            tone = btn.dataset.tone;
            el.querySelectorAll('[data-tone]').forEach((other) => other.classList.toggle('is-active', other === btn));
          }),
        );
        el.querySelectorAll('[data-emoji-value]').forEach((btn) =>
          btn.addEventListener('click', () => {
            emoji = btn.dataset.emojiValue;
            el.querySelectorAll('[data-emoji-value]').forEach((other) => other.classList.toggle('is-active', other === btn));
          }),
        );

        el.querySelector('[data-cancel]')?.addEventListener('click', close);
        el.querySelector('[data-save]')?.addEventListener('click', async () => {
          const saveBtn = el.querySelector('[data-save]');
          const name = el.querySelector('[name="name"]').value.trim();
          if (!name) {
            toast.warn('نام لیست را بنویس.');
            return;
          }
          setBusy(saveBtn, true);
          try {
            const saved = await repo.saveList({
              id: list?.id || null,
              name,
              emoji,
              tone,
              note: el.querySelector('[name="note"]').value,
            });
            toast.success(isEdit ? 'لیست ویرایش شد.' : 'لیست ساخته شد.');
            close();
            onSaved?.(saved);
            render();
          } catch (error) {
            setBusy(saveBtn, false);
            toast.error(error.message);
          }
        });
      },
    });
  }

  function openAddItem(listId, onDone) {
    const data = getState().data;
    let type = 'product';
    let picker = null;

    const modal = openModal({
      title: 'افزودن آیتم به لیست',
      size: 'sm',
      body: `<div class="stack">
        <div class="segmented" data-type-seg>
          <button type="button" class="segmented__btn is-active" data-type="product">محصول</button>
          <button type="button" class="segmented__btn" data-type="shop">فروشگاه</button>
          <button type="button" class="segmented__btn" data-type="vendor">پلتفرم</button>
        </div>
        <div data-picker-slot></div>
        <div class="field">
          <label class="field__label">یادداشت</label>
          <input class="input" data-item-note maxlength="300" placeholder="مثلاً ۲ کیلو، برای صبحانه…" />
        </div>
      </div>`,
      footer: `<span class="u-grow"></span><button type="button" class="btn btn--ghost" data-cancel>انصراف</button><button type="button" class="btn btn--primary" data-add>${icon('plus', 15)} افزودن</button>`,
      onMount({ el, close }) {
        const slot = el.querySelector('[data-picker-slot]');

        function buildPicker() {
          if (picker) picker.destroy();
          const items = type === 'product' ? data.products : type === 'shop' ? data.shops : data.vendors;
          picker = createPicker({ type, items, allowCreate: true, onCreate: async (name) => (type === 'product' ? repo.saveProduct({ name }) : type === 'shop' ? repo.saveShop({ name }) : repo.saveVendor({ name })) });
          slot.innerHTML = '';
          slot.appendChild(picker.el);
        }

        el.querySelectorAll('[data-type]').forEach((btn) =>
          btn.addEventListener('click', () => {
            type = btn.dataset.type;
            el.querySelectorAll('[data-type]').forEach((other) => other.classList.toggle('is-active', other === btn));
            buildPicker();
          }),
        );

        buildPicker();
        el.querySelector('[data-cancel]')?.addEventListener('click', close);

        el.querySelector('[data-add]')?.addEventListener('click', async () => {
          const value = picker.getValue();
          if (!value) {
            toast.warn('یک مورد انتخاب کن.');
            return;
          }
          try {
            await repo.addListItem({ list_id: listId, target_type: type, target_id: value, note: el.querySelector('[data-item-note]').value });
            toast.success('آیتم اضافه شد.');
            close();
            onDone?.();
            render();
          } catch (error) {
            toast.warn(error.message);
          }
        });
      },
    });

    return modal;
  }

  container.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('[data-create-list]')) {
      openListForm(null, { onSaved: (list) => list && openList(list.id) });
      return;
    }
    const card = target.closest('[data-list-id]');
    if (card && !target.closest('button')) openList(card.dataset.listId);
  });

  container.addEventListener('keydown', (event) => {
    const card = event.target.closest('[data-list-id]');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openList(card.dataset.listId);
    }
  });

  const unsubscribe = subscribe((state, keys) => {
    if (!keys || keys.includes('*') || keys.some((key) => ['lists', 'listItems', 'products', 'shops', 'vendors'].includes(key))) render();
  });

  render();
  return { destroy: () => unsubscribe() };
}
