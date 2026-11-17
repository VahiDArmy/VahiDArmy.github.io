/* ==========================================================================
   entitySheet.js — کشوی جزئیات موجودیت + تجربه + نظرها + افزودن به لیست
   ========================================================================== */

import { getState } from '../lib/store.js';
import {
  buildIndex,
  computeStats,
  entityMeta,
  relatedReviews,
  hydrateReview,
  commentThread,
  ratingInfo,
  summaryLine,
  entityEmoji,
  ENTITY_TYPES,
} from '../lib/domain.js';
import { formatJalali } from '../lib/jalali.js';
import { openDrawer, openModal, confirmDialog, toast, openMenu } from '../lib/ui.js';
import { esc, faNum, fmtInt, fmtMoney, fmtQty, copyText, hashHue } from '../lib/utils.js';
import { icon } from '../lib/icons.js';
import * as repo from '../lib/repo.js';
import {
  ratingPill,
  avatar,
  entityAvatar,
  meterHTML,
  scoreColor,
  scoreBadge,
  reviewCardHTML,
  commentHTML,
  commentComposer,
  emptyState,
  sectionHead,
  detailStat,
  tagsHTML,
} from './parts.js';

function profileName() {
  const profile = getState().data.profile;
  return profile?.display_name || 'شما';
}

function findEntity(type, id, index) {
  if (type === 'product') return index.products.get(id);
  if (type === 'shop') return index.shops.get(id);
  if (type === 'vendor') return index.vendors.get(id);
  return null;
}

/* --------------------------------- نظرها --------------------------------- */

function commentsSectionHTML(type, id, index) {
  const thread = commentThread(index, type, id);
  const count = index.commentsByTarget.get(`${type}:${id}`)?.length || 0;
  return `<div class="stack stack--sm" data-comments-section>
    ${sectionHead(`یادداشت‌ها`, count ? `${faNum(count)} نظر ثبت‌شده` : 'اولین یادداشت را بنویسید', '', 'message')}
    ${commentComposer({ placeholder: 'نظر یا یادداشت خودت را بنویس…', rating: true })}
    <div data-comments-list>
      ${thread.length ? thread.map((comment) => commentHTML(comment, { profileName: profileName(), replies: comment.replies })).join('') : '<p class="u-xs u-faint" style="padding:8px 2px">هنوز یادداشتی ثبت نشده.</p>'}
    </div>
  </div>`;
}

async function wireComments(root, type, id, refresh) {
  const list = root.querySelector('[data-comments-list]');
  const form = root.querySelector('[data-comment-form]');
  let selectedRating = null;

  root.querySelectorAll('[data-comment-rating]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.commentRating;
      selectedRating = selectedRating === value ? null : value;
      root.querySelectorAll('[data-comment-rating]').forEach((other) => {
        other.classList.toggle('is-active', other.dataset.commentRating === selectedRating);
      });
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const textarea = form.querySelector('textarea');
    const content = textarea.value.trim();
    if (!content) {
      toast.warn('متن نظر خالی است.');
      textarea.focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await repo.saveComment({ target_type: type, target_id: id, content, rating: selectedRating });
      toast.success('یادداشت ثبت شد.');
      refresh();
    } catch (error) {
      toast.error(error.message);
      submit.disabled = false;
    }
  });

  list?.addEventListener('click', async (event) => {
    const node = event.target.closest('[data-comment-id]');
    if (!node) return;
    const commentId = node.dataset.commentId;
    const index = buildIndex(getState().data);
    const comment = (index.commentsByTarget.get(`${type}:${id}`) || []).find((c) => c.id === commentId);
    if (!comment) return;

    if (event.target.closest('[data-comment-delete]')) {
      const ok = await confirmDialog({
        title: 'حذف یادداشت',
        message: 'این یادداشت (و پاسخ‌هایش) حذف شود؟',
        confirmText: 'حذف کن',
      });
      if (!ok) return;
      try {
        await repo.deleteComment(commentId);
        toast.success('یادداشت حذف شد.');
        refresh();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    if (event.target.closest('[data-comment-edit]')) {
      const body = node.querySelector('.cmt__body');
      if (!body || node.querySelector('textarea')) return;
      const original = comment.content;
      body.innerHTML = `<textarea class="textarea textarea--sm" rows="2" maxlength="2000">${esc(original)}</textarea>
        <div class="btn-row u-mt-2">
          <button type="button" class="btn btn--soft btn--sm" data-save-edit>ذخیره</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel-edit>انصراف</button>
        </div>`;
      body.querySelector('[data-save-edit]')?.addEventListener('click', async () => {
        const value = body.querySelector('textarea').value.trim();
        if (!value) return;
        try {
          await repo.saveComment({ id: commentId, target_type: type, target_id: id, content: value, rating: comment.rating, parent_id: comment.parent_id });
          toast.success('ویرایش شد.');
          refresh();
        } catch (error) {
          toast.error(error.message);
        }
      });
      body.querySelector('[data-cancel-edit]')?.addEventListener('click', () => refresh());
      return;
    }

    if (event.target.closest('[data-comment-reply]')) {
      if (node.querySelector('[data-reply-form]')) return;
      const formEl = document.createElement('div');
      formEl.dataset.replyForm = '1';
      formEl.className = 'u-mt-2 stack stack--sm';
      formEl.innerHTML = `<textarea class="textarea textarea--sm" rows="2" placeholder="پاسخ…" maxlength="2000"></textarea>
        <div class="btn-row">
          <button type="button" class="btn btn--soft btn--sm" data-send-reply>${icon('send', 13)} ارسال</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel-reply>انصراف</button>
        </div>`;
      node.querySelector('.cmt__main')?.appendChild(formEl);
      formEl.querySelector('textarea')?.focus();
      formEl.querySelector('[data-cancel-reply]')?.addEventListener('click', () => formEl.remove());
      formEl.querySelector('[data-send-reply]')?.addEventListener('click', async () => {
        const value = formEl.querySelector('textarea').value.trim();
        if (!value) return;
        try {
          await repo.saveComment({ target_type: type, target_id: id, content: value, parent_id: commentId });
          toast.success('پاسخ ثبت شد.');
          refresh();
        } catch (error) {
          toast.error(error.message);
        }
      });
    }
  });
}

/* ------------------------------ افزودن به لیست ---------------------------- */

export function openAddToList(type, id) {
  const state = getState();
  const lists = state.data.lists;
  const entityOptions = lists
    .map(
      (list) => `<button type="button" class="picker__option" data-list-id="${esc(list.id)}">
        <span class="avatar avatar--sm"><span class="avatar__emoji">${esc(list.emoji || '📝')}</span></span>
        <span class="picker__option-text">
          <span class="picker__option-name">${esc(list.name)}</span>
          <span class="picker__option-meta">${faNum(state.data.listItems.filter((item) => item.list_id === list.id).length)} آیتم</span>
        </span>
        ${icon('plus', 14)}
      </button>`,
    )
    .join('');

  const modal = openModal({
    title: 'افزودن به لیست',
    subtitle: `${ENTITY_TYPES[type]?.label || 'مورد'} در کدام لیست ذخیره شود؟`,
    size: 'sm',
    body: `<div class="stack stack--sm">
      ${entityOptions || '<p class="u-xs u-faint">هنوز لیستی نساخته‌اید.</p>'}
      <form class="u-row u-gap-2 u-mt-2" data-new-list-form>
        <input class="input" name="name" placeholder="لیست جدید…" maxlength="60" />
        <button type="submit" class="btn btn--soft btn--sm">${icon('plus', 14)} بساز</button>
      </form>
    </div>`,
    onMount({ el, close }) {
      el.querySelectorAll('[data-list-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await repo.addListItem({ list_id: btn.dataset.listId, target_type: type, target_id: id });
            toast.success('به لیست اضافه شد.');
            close();
          } catch (error) {
            toast.warn(error.message);
          }
        });
      });

      el.querySelector('[data-new-list-form]')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = el.querySelector('[data-new-list-form] input');
        const name = input.value.trim();
        if (!name) return;
        try {
          const list = await repo.saveList({ name });
          await repo.addListItem({ list_id: list.id, target_type: type, target_id: id });
          toast.success('لیست ساخته و آیتم اضافه شد.');
          close();
        } catch (error) {
          toast.error(error.message);
        }
      });
    },
  });

  return modal;
}

/* ------------------------------- کشوی موجودیت ----------------------------- */

export function openEntitySheet(type, id) {
  let drawer = null;
  let currentType = type;
  let currentId = id;

  function build() {
    const state = getState();
    const index = buildIndex(state.data);
    const entity = findEntity(currentType, currentId, index);
    if (!entity) {
      drawer?.close();
      return;
    }

    const reviews = relatedReviews(currentType, currentId, state.data)
      .map((review) => hydrateReview(review, index))
      .sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)));
    const stats = computeStats(reviews);
    const meta = entityMeta(currentType, entity);
    const color = scoreColor(stats);
    const label = ENTITY_TYPES[currentType]?.label || '';

    drawer.setHead(`
      <div class="u-row u-gap-3 u-start">
        ${entityAvatar(currentType, entity, 'xl')}
        <div class="u-grow" style="min-width:0">
          <div class="u-row u-gap-2 u-wrap">
            <span class="badge badge--outline">${icon(ENTITY_TYPES[currentType]?.icon || 'grid', 12)} ${esc(label)}</span>
            ${scoreBadge(stats)}
          </div>
          <h2 class="modal__title u-mt-1" style="font-size:var(--fs-xl)">${esc(entity.name)}</h2>
          <p class="modal__sub">${esc(meta || 'بدون جزئیات')}</p>
        </div>
      </div>
    `);

    const relatedHTML = reviews.length
      ? `<div class="stack stack--sm">${reviews.slice(0, 12).map((review) => reviewCardHTML(review)).join('')}</div>`
      : emptyState({
          iconName: 'star',
          title: 'هنوز تجربه‌ای ثبت نشده',
          text: 'اولین خریدت از این مورد را با امتیاز ثبت کن.',
          actions: `<button type="button" class="btn btn--primary btn--sm" data-new-review>${icon('plus', 14)} ثبت تجربه</button>`,
          small: true,
        });

    const combosNote =
      currentType === 'product'
        ? 'این محصول در ترکیب با فروشگاه و پلتفرم امتیاز می‌گیرد، نه به‌تنهایی.'
        : currentType === 'shop'
          ? 'امتیاز هر فروشگاه بر اساس همه محصولاتی است که از آن خریده‌اید.'
          : 'امتیاز پلتفرم از مجموع تجربه‌های ثبت‌شده روی آن به دست می‌آید.';

    drawer.setBody(`
      <div class="detail-hero">
        <div class="detail-hero__stats" style="padding-top:0;border-top:0">
          ${detailStat(stats.count ? faNum(stats.avgScore.toFixed(1)) : '—', 'میانگین از ۳', color)}
          ${detailStat(faNum(stats.count), 'تجربه')}
          ${detailStat(`${faNum(stats.health)}٪`, 'سلامت')}
          ${stats.spend ? detailStat(fmtInt(stats.spend), 'هزینه (تومان)') : ''}
        </div>
        ${meterHTML(stats, { height: 8 })}
        <div class="u-between u-gap-2 u-wrap u-xs u-dim">
          <span>${stats.lastPurchasedAt ? `آخرین خرید: ${formatJalali(stats.lastPurchasedAt, 'long')}` : 'خریدی ثبت نشده'}</span>
          ${stats.count ? `<span>${faNum(stats.good)} خوب · ${faNum(stats.notGood)} نه‌خوب · ${faNum(stats.shit)} افتضاح</span>` : ''}
        </div>
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn--primary btn--sm" data-new-review>${icon('plus', 15)} ثبت تجربه</button>
        <button type="button" class="btn btn--soft btn--sm" data-add-list>${icon('list', 15)} افزودن به لیست</button>
        <button type="button" class="btn btn--ghost btn--sm" data-copy-summary>${icon('copy', 15)} کپی خلاصه</button>
        <span class="u-grow"></span>
        <button type="button" class="btn btn--ghost btn--sm" data-edit-entity>${icon('edit', 15)} ویرایش</button>
        <button type="button" class="icon-btn icon-btn--danger" data-delete-entity aria-label="حذف">${icon('trash', 16)}</button>
      </div>

      ${entity.note ? `<div class="panel"><div class="u-xs u-dim u-mb-3">یادداشت</div><p class="u-sm" style="line-height:2;color:var(--txt-2)">${esc(entity.note)}</p></div>` : ''}

      ${entity.website ? `<div class="copy-field">${esc(entity.website)}</div>` : ''}

      <div class="stack stack--sm">
        ${sectionHead('تجربه‌های مرتبط', `${faNum(reviews.length)} خرید ثبت‌شده`, '', 'package')}
        ${relatedHTML}
        <p class="u-xs u-faint" style="line-height:1.9">${esc(combosNote)}</p>
      </div>

      ${commentsSectionHTML(currentType, currentId, index)}
    `);

    drawer.setFooter(`
      <button type="button" class="btn btn--ghost btn--sm" data-sheet-close>بستن</button>
      <span class="u-grow"></span>
      <span class="u-xs u-faint">${esc(label)} · ${faNum(reviews.length)} تجربه</span>
    `);

    wire(drawer.bodyEl, entity, reviews, stats);
  }

  function wire(root, entity, reviews, stats) {
    drawer.el.querySelector('[data-sheet-close]')?.addEventListener('click', () => drawer.close());
    root.querySelectorAll('[data-new-review]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const { openReviewForm } = await import('../views/reviewForm.js');
        const prefill =
          currentType === 'product'
            ? { product_id: currentId }
            : currentType === 'shop'
              ? { shop_id: currentId }
              : { vendor_id: currentId };
        openReviewForm({ prefill, onSaved: () => drawer?.close() });
      }),
    );

    root.querySelector('[data-add-list]')?.addEventListener('click', () => openAddToList(currentType, currentId));

    root.querySelector('[data-copy-summary]')?.addEventListener('click', async () => {
      const ok = await copyText(summaryLine(currentType, entity, stats));
      toast[ok ? 'success' : 'error'](ok ? 'خلاصه کپی شد.' : 'کپی انجام نشد.');
    });

    root.querySelector('[data-edit-entity]')?.addEventListener('click', async () => {
      const { openEntityForm } = await import('../views/entityForms.js');
      openEntityForm(currentType, entity, { onSaved: () => build() });
    });

    root.querySelector('[data-delete-entity]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `حذف ${ENTITY_TYPES[currentType]?.label || ''}`,
        message:
          reviews.length > 0
            ? `با حذف «${entity.name}» ${faNum(reviews.length)} تجربه مرتبط هم حذف می‌شوند. مطمئن هستید؟`
            : `«${entity.name}» حذف شود؟`,
        confirmText: 'حذف کن',
      });
      if (!ok) return;
      try {
        if (currentType === 'product') await repo.deleteProduct(currentId);
        else if (currentType === 'shop') await repo.deleteShop(currentId);
        else await repo.deleteVendor(currentId);
        toast.success('حذف شد.');
        drawer.close();
      } catch (error) {
        toast.error(error.message);
      }
    });

    wireComments(root, currentType, currentId, build);
  }

  drawer = openDrawer({
    head: '<div class="u-row u-gap-2"><span class="searchbox__spinner"></span><span class="u-xs u-dim">در حال بارگذاری…</span></div>',
    body: '',
    wide: true,
    onMount: () => build(),
    onClose: () => {
      drawer = null;
    },
  });

  return drawer;
}

/* ------------------------------- کشوی تجربه ------------------------------ */

export function openReviewSheet(reviewId) {
  let drawer = null;

  function build() {
    const state = getState();
    const index = buildIndex(state.data);
    const raw = state.data.reviews.find((row) => row.id === reviewId);
    if (!raw) {
      drawer?.close();
      toast.warn('این تجربه دیگر وجود ندارد.');
      return;
    }
    const review = hydrateReview(raw, index);
    const meta = ratingInfo(review.rating);

    drawer.setHead(`
      <div class="u-row u-gap-3 u-start">
        ${avatar({ name: review.productName, emoji: review.product?.emoji || '📦', size: 'xl' })}
        <div class="u-grow" style="min-width:0">
          <div class="u-row u-gap-2 u-wrap">
            <span class="badge badge--outline">${icon('star', 12)} تجربه خرید</span>
            ${ratingPill(review.rating, { withLabel: true })}
          </div>
          <h2 class="modal__title u-mt-1" style="font-size:var(--fs-xl)">${esc(review.productName)}</h2>
          <p class="modal__sub">${esc(review.shopName)} · ${esc(review.vendorName)}</p>
        </div>
      </div>
    `);

    drawer.setBody(`
      <div class="rating-summary" style="border-color:${meta?.color}33;background:${meta?.color}0d">
        <div class="rating-summary__top">
          <div class="rating-summary__score" style="color:${meta?.color}">${esc(meta?.label || '—')}</div>
          <div class="u-grow">
            <div class="u-xs u-muted">${esc(meta?.description || '')}</div>
            <div class="u-xs u-faint u-mt-1">${esc(meta?.advice || '')}</div>
          </div>
          ${review.would_buy_again === true ? '<span class="badge badge--good">دوباره می‌خرم</span>' : review.would_buy_again === false ? '<span class="badge badge--bad">دوباره نمی‌خرم</span>' : ''}
        </div>
      </div>

      <dl class="kv">
        <dt>فروشگاه</dt><dd><button type="button" class="link" data-open-shop>${esc(review.shopName)}</button></dd>
        <dt>پلتفرم</dt><dd><button type="button" class="link" data-open-vendor>${esc(review.vendorName)}</button></dd>
        <dt>تاریخ خرید</dt><dd>${formatJalali(review.purchased_at, 'full')}</dd>
        <dt>قیمت واحد</dt><dd>${review.price === null ? 'ثبت نشده' : fmtMoney(review.price)}</dd>
        <dt>تعداد</dt><dd>${fmtQty(review.quantity)}</dd>
        <dt>هزینه کل</dt><dd>${review.total ? fmtMoney(review.total) : '—'}</dd>
        <dt>ثبت شده در</dt><dd>${formatJalali(String(review.created_at).slice(0, 10), 'long')}</dd>
      </dl>

      ${review.note ? `<div class="panel"><div class="u-xs u-dim u-mb-3">یادداشت شما</div><p class="u-sm" style="line-height:2;color:var(--txt-2);white-space:pre-wrap">${esc(review.note)}</p></div>` : ''}

      ${review.tags?.length ? `<div class="chips">${tagsHTML(review.tags)}</div>` : ''}

      <div class="btn-row">
        <button type="button" class="btn btn--primary btn--sm" data-edit-review>${icon('edit', 15)} ویرایش تجربه</button>
        <button type="button" class="btn btn--soft btn--sm" data-open-product>${icon('package', 15)} صفحه محصول</button>
        <button type="button" class="btn btn--soft btn--sm" data-add-list>${icon('list', 15)} افزودن به لیست</button>
        <span class="u-grow"></span>
        <button type="button" class="btn btn--danger btn--sm" data-delete-review>${icon('trash', 15)} حذف</button>
      </div>

      ${commentsSectionHTML('review', reviewId, index)}
    `);

    drawer.setFooter(`
      <button type="button" class="btn btn--ghost btn--sm" data-sheet-close>بستن</button>
      <span class="u-grow"></span>
      <span class="u-xs u-faint">${esc(review.productName)} · ${esc(review.vendorName)}</span>
    `);

    wire(review);
  }

  function wire(review) {
    const root = drawer.bodyEl;
    drawer.el.querySelector('[data-sheet-close]')?.addEventListener('click', () => drawer.close());
    root.querySelector('[data-open-shop]')?.addEventListener('click', () => {
      drawer.close();
      openEntitySheet('shop', review.shop_id);
    });
    root.querySelector('[data-open-vendor]')?.addEventListener('click', () => {
      drawer.close();
      openEntitySheet('vendor', review.vendor_id);
    });
    root.querySelector('[data-open-product]')?.addEventListener('click', () => {
      drawer.close();
      openEntitySheet('product', review.product_id);
    });
    root.querySelector('[data-add-list]')?.addEventListener('click', () => openAddToList('review', reviewId));

    root.querySelector('[data-edit-review]')?.addEventListener('click', async () => {
      const { openReviewForm } = await import('../views/reviewForm.js');
      drawer.close();
      openReviewForm({ reviewId, onSaved: () => {} });
    });

    root.querySelector('[data-delete-review]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'حذف تجربه',
        message: `این تجربه «${review.productName}» از «${review.shopName}» حذف شود؟`,
        confirmText: 'حذف کن',
      });
      if (!ok) return;
      try {
        await repo.deleteReview(reviewId);
        toast.success('تجربه حذف شد.');
        drawer.close();
      } catch (error) {
        toast.error(error.message);
      }
    });

    wireComments(root, 'review', reviewId, build);
  }

  drawer = openDrawer({
    head: '<div class="u-row u-gap-2"><span class="searchbox__spinner"></span><span class="u-xs u-dim">در حال بارگذاری…</span></div>',
    body: '',
    wide: true,
    onMount: () => build(),
    onClose: () => {
      drawer = null;
    },
  });

  return drawer;
}
