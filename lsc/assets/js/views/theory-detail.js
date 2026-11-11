/* ============================================================
   Theory detail view
   ============================================================ */
import { el, escapeHtml, formatNumber, sanitizeHtml, excerptFromHtml, stripHtml } from '../utils.js';
import { state, subscribe } from '../state.js';
import { navigate, setBreadcrumbs } from '../router.js';
import { getTheory, incrementView, listObjects, listImages, listLinks, listComments, createComment, deleteComment, isBookmarked, toggleBookmark, deleteTheory } from '../data.js';
import { formatJalali, relativeJalali } from '../shamsi.js';
import { categoryChip, tagPill, placeholder, pagination, emptyState, skeletonCards } from '../components.js';
import { openModal, openLightbox, openDrawer, toastSuccess, toastError, toastInfo, confirm } from '../ui.js';
import { CATEGORY_MAP, LINK_TYPE_MAP, OBJECT_TYPE_MAP, APP } from '../config.js';

export const renderTheoryDetail = async (root, { params }) => {
  const id = params.id;
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `<div class="skeleton skeleton--title" style="height:38px;width:50%"></div>`;
  root.appendChild(page);

  let theory;
  try {
    theory = await getTheory(id);
  } catch (e) {
    page.replaceChildren(emptyState({ title: 'خطا', desc: 'نظریه بارگیری نشد.', actions: [{ label: 'بازگشت', onClick: () => navigate('/theories') }] }));
    return;
  }
  if (!theory) {
    page.replaceChildren(emptyState({ title: 'نظریه یافت نشد', desc: 'شاید حذف شده یا دسترسی ندارید.', actions: [{ label: 'همه نظریه‌ها', primary: true, onClick: () => navigate('/theories') }] }));
    return;
  }

  setBreadcrumbs([
    { label: 'خانه', href: '#/home' },
    { label: 'نظریه‌ها', href: '#/theories' },
    { label: theory.title }
  ]);

  incrementView(theory.id);
  theory.view_count = (theory.view_count || 0) + 1;

  const isOwner = state.user && state.user.id === theory.user_id;
  page.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'theory-detail';
  const main = document.createElement('div');
  main.className = 'theory-detail__main';
  const aside = document.createElement('div');
  aside.className = 'theory-detail__aside';
  wrap.append(main, aside);
  page.appendChild(wrap);

  /* Cover */
  const cover = document.createElement('div');
  cover.className = 'theory-detail__cover';
  if (theory.cover_image) {
    const img = document.createElement('img');
    img.src = theory.cover_image;
    img.alt = theory.title;
    cover.appendChild(img);
  } else {
    const ph = placeholder('برای این نظریه تصویری بارگذاری نشده است');
    cover.appendChild(ph);
  }
  main.appendChild(cover);

  /* Title block */
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.gap = '12px';
  const badges = document.createElement('div');
  badges.style.display = 'flex';
  badges.style.flexWrap = 'wrap';
  badges.style.gap = '8px';
  badges.appendChild(categoryChip(theory.category));
  if (theory.status === 'draft') {
    const b = document.createElement('span'); b.className = 'badge badge--warning badge--dot'; b.textContent = 'پیش‌نویس'; badges.appendChild(b);
  }
  if (theory.favorite) {
    const b = document.createElement('span'); b.className = 'badge badge--love'; b.innerHTML = '<i class="ri-heart-3-fill"></i>علاقه‌مندی'; badges.appendChild(b);
  }
  badges.appendChild(shamsiChipSafe(theory.created_at));
  header.appendChild(badges);

  const title = document.createElement('h1');
  title.className = 'theory-detail__title';
  title.textContent = theory.title;
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'theory-detail__meta';
  meta.innerHTML = `
    <span><i class="ri-eye-line"></i>${formatNumber(theory.view_count)} بازدید</span>
    <span class="divider"></span>
    <span><i class="ri-time-line"></i>${relativeJalali(theory.updated_at)}</span>
    <span class="divider"></span>
    <span><i class="ri-price-tag-3-line"></i>${(theory.tags || []).length} برچسب</span>
  `;
  header.appendChild(meta);

  if (theory.summary) {
    const sum = document.createElement('p');
    sum.className = 'theory-detail__excerpt';
    sum.textContent = theory.summary;
    header.appendChild(sum);
  }

  if ((theory.tags || []).length) {
    const tags = document.createElement('div');
    tags.className = 'tag-list';
    theory.tags.forEach(t => tags.appendChild(tagPill(t)));
    header.appendChild(tags);
  }

  /* Actions bar */
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';
  bar.innerHTML = `
    <button class="btn btn--sm" data-act="bookmark"><i class="ri-bookmark-line"></i>نشان‌کردن</button>
    <button class="btn btn--sm" data-act="share"><i class="ri-share-line"></i>اشتراک</button>
    ${isOwner ? `
      <button class="btn btn--sm" data-act="edit"><i class="ri-edit-line"></i>ویرایش</button>
      <button class="btn btn--sm btn--danger" data-act="delete"><i class="ri-delete-bin-line"></i>حذف</button>
    ` : ''}
  `;
  header.appendChild(bar);
  main.appendChild(header);

  /* Content */
  const contentBox = document.createElement('div');
  contentBox.className = 'rich-content';
  contentBox.innerHTML = sanitizeHtml(theory.content || '') || '<p style="color:var(--ink-faint);">هنوز محتوایی برای این نظریه نوشته نشده است.</p>';
  main.appendChild(contentBox);

  /* Objects section */
  const objectsSection = document.createElement('section');
  objectsSection.className = 'section';
  objectsSection.innerHTML = `<div class="section__head"><h2 class="section__title"><i class="ri-shape-2-line"></i>اشیاء این نظریه</h2></div>`;
  const objectsWrap = document.createElement('div');
  objectsSection.appendChild(objectsWrap);
  main.appendChild(objectsSection);

  /* Images strip */
  const imagesSection = document.createElement('section');
  imagesSection.className = 'section';
  imagesSection.innerHTML = `<div class="section__head"><h2 class="section__title"><i class="ri-image-line"></i>گالری تصاویر</h2></div>`;
  const imgsWrap = document.createElement('div');
  imgsWrap.className = 'gallery-grid';
  imagesSection.appendChild(imgsWrap);
  main.appendChild(imagesSection);

  /* Comments */
  const commentsSection = document.createElement('section');
  commentsSection.className = 'section';
  commentsSection.innerHTML = `<div class="section__head"><h2 class="section__title"><i class="ri-chat-3-line"></i>گفتگوها</h2></div>`;
  const commentsWrap = document.createElement('div');
  commentsWrap.style.display = 'flex';
  commentsWrap.style.flexDirection = 'column';
  commentsWrap.style.gap = '12px';
  commentsSection.appendChild(commentsWrap);
  main.appendChild(commentsSection);

  /* Aside */
  const asideMeta = document.createElement('div');
  asideMeta.className = 'aside-card';
  asideMeta.innerHTML = `
    <div class="aside-card__title"><i class="ri-information-line"></i>اطلاعات</div>
    <div class="metric-row"><span class="metric-row__label">تاریخ ثبت</span><span class="metric-row__value">${formatJalali(theory.created_at, { long: true })}</span></div>
    <div class="metric-row"><span class="metric-row__label">آخرین ویرایش</span><span class="metric-row__value">${formatJalali(theory.updated_at)}</span></div>
    <div class="metric-row"><span class="metric-row__label">دسته‌بندی</span><span class="metric-row__value">${escapeHtml(CATEGORY_MAP[theory.category]?.label || theory.category)}</span></div>
    <div class="metric-row"><span class="metric-row__label">وضعیت</span><span class="metric-row__value">${theory.status === 'published' ? 'منتشر شده' : theory.status === 'draft' ? 'پیش‌نویس' : 'آرشیو'}</span></div>
    <div class="metric-row"><span class="metric-row__value">${theory.is_public ? 'عمومی' : 'خصوصی'}</span></div>
  `;
  aside.appendChild(asideMeta);

  const asideLinks = document.createElement('div');
  asideLinks.className = 'aside-card';
  asideLinks.innerHTML = `<div class="aside-card__title"><i class="ri-link"></i>پیوندهای نظریه</div><div data-links></div>`;
  aside.appendChild(asideLinks);

  root.appendChild(page);

  const shamsiChipSafe = (d) => {
    const s = document.createElement('span');
    s.className = 'badge';
    s.innerHTML = `<i class="ri-calendar-line"></i>${formatJalali(d)}`;
    return s;
  };

  /* Bookmark */
  const bookmarkBtn = bar.querySelector('[data-act="bookmark"]');
  if (state.user) {
    const marked = await isBookmarked(theory.id);
    const update = (v) => {
      bookmarkBtn.innerHTML = v ? '<i class="ri-bookmark-fill"></i>نشان‌شده' : '<i class="ri-bookmark-line"></i>نشان‌کردن';
      bookmarkBtn.classList.toggle('btn--primary', v);
    };
    update(marked);
    bookmarkBtn.addEventListener('click', async () => {
      try {
        const v = await toggleBookmark(theory.id);
        update(v);
        toastSuccess(v ? 'به نشان‌شده‌ها اضافه شد' : 'از نشان‌شده‌ها حذف شد');
      } catch (e) { toastError('خطا', e.message); }
    });
  } else {
    bookmarkBtn.addEventListener('click', () => navigate('/auth'));
  }

  bar.querySelector('[data-act="share"]').addEventListener('click', async () => {
    try {
      const url = window.location.origin + window.location.pathname + `#/theories/${theory.id}`;
      await navigator.clipboard.writeText(url);
      toastSuccess('لینک کپی شد');
    } catch {
      toastInfo('کپی نشد');
    }
  });

  bar.querySelector('[data-act="edit"]')?.addEventListener('click', () => navigate(`/theories/${theory.id}/edit`));
  bar.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    const ok = await confirm({ title: 'حذف نظریه', message: 'این عمل قابل بازگشت نیست. تمام اشیاء و پیوندها هم حذف می‌شوند.', danger: true, confirmText: 'حذف کن' });
    if (!ok) return;
    try {
      await deleteTheory(theory.id);
      toastSuccess('حذف شد');
      navigate('/theories');
    } catch (e) { toastError('خطا', e.message); }
  });

  /* Load objects */
  try {
    const { items } = await listObjects({ theoryId: theory.id, perPage: 100 });
    objectsWrap.innerHTML = '';
    if (!items.length) {
      objectsWrap.appendChild(emptyState({
        title: 'این نظریه هنوز شیئی ندارد',
        desc: 'اشیاء تصویری به نظریه هویت می‌دهند. اولین شیء را اضافه کنید.',
        actions: isOwner ? [{ label: 'افزودن شیء', primary: true, icon: 'ri-add-line', onClick: () => navigate(`/theories/${theory.id}/edit`) }] : []
      }));
    } else {
      const strip = document.createElement('div');
      strip.className = 'object-strip';
      items.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'object-mini';
        b.innerHTML = `${o.image_url ? `<img src="${escapeHtml(o.image_url)}" alt="${escapeHtml(o.title)}" loading="lazy" />` : ''}<div class="object-mini__label">${escapeHtml(o.title)}</div>`;
        b.addEventListener('click', () => navigate(`/objects/${o.id}`));
        strip.appendChild(b);
      });
      objectsWrap.appendChild(strip);
    }
  } catch (e) { console.error(e); }

  /* Load images */
  try {
    const { items } = await listImages({ theoryId: theory.id, perPage: 60 });
    imgsWrap.innerHTML = '';
    if (!items.length) {
      imgsWrap.appendChild(emptyState({ title: 'تصویری بارگذاری نشده', desc: 'گالری این نظریه خالی است.' }));
    } else {
      items.forEach(img => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gallery-item';
        b.innerHTML = `<img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}" loading="lazy" />`;
        b.addEventListener('click', () => openLightbox(img.image_url, img.caption || ''));
        imgsWrap.appendChild(b);
      });
    }
  } catch (e) { console.error(e); }

  /* Load links */
  try {
    const links = await listLinks({ theoryId: theory.id });
    const box = asideLinks.querySelector('[data-links]');
    box.innerHTML = '';
    if (!links.length) {
      box.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--ink-faint);padding:8px 0;">هنوز پیوندی تعریف نشده است.</div>';
    } else {
      links.slice(0, 8).forEach(l => {
        const other = l.source_theory_id === theory.id ? l.target : l.source;
        if (!other) return;
        const a = document.createElement('a');
        a.href = `#/theories/${other.id}`;
        a.dataset.link = '';
        a.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px 0;color:var(--ink-soft);font-size:var(--fs-sm);border-bottom:1px solid var(--line-soft);';
        const meta = LINK_TYPE_MAP[l.link_type] || { label: l.link_type, icon: 'ri-link' };
        a.innerHTML = `<i class="${meta.icon}" style="color:var(--accent-1);"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(other.title)}</span>`;
        box.appendChild(a);
      });
    }
  } catch (e) { console.error(e); }

  /* Comments */
  const renderComments = async () => {
    const items = await listComments(theory.id);
    commentsWrap.innerHTML = '';
    if (!items.length) {
      commentsWrap.appendChild(emptyState({ title: 'هنوز گفتگویی نیست', desc: 'اولین دیدگاه را بنویسید.' }));
    } else {
      items.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '14px';
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span class="avatar avatar--sm"><i class="ri-user-line"></i></span>
            <div style="font-size:var(--fs-xs);color:var(--ink-mute);">${relativeJalali(c.created_at)}</div>
          </div>
          <div style="font-size:var(--fs-sm);color:var(--ink-soft);line-height:1.8;white-space:pre-wrap;">${escapeHtml(c.content)}</div>
        `;
        if (state.user && c.user_id === state.user.id) {
          const del = document.createElement('button');
          del.className = 'btn btn--ghost btn--sm';
          del.style.marginTop = '6px';
          del.innerHTML = '<i class="ri-delete-bin-line"></i>حذف';
          del.addEventListener('click', async () => {
            const ok = await confirm({ title: 'حذف دیدگاه', message: 'مطمئنید؟', danger: true, confirmText: 'حذف' });
            if (!ok) return;
            try { await deleteComment(c.id); toastSuccess('حذف شد'); renderComments(); }
            catch (e) { toastError('خطا', e.message); }
          });
          card.appendChild(del);
        }
        commentsWrap.appendChild(card);
      });
    }
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '8px';
    form.style.marginTop = '8px';
    if (state.user) {
      form.innerHTML = `
        <textarea class="textarea" rows="3" placeholder="دیدگاه خود را بنویسید…" required maxlength="3000"></textarea>
        <button class="btn btn--primary" type="submit"><i class="ri-send-plane-line"></i>ارسال دیدگاه</button>
      `;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ta = form.querySelector('textarea');
        const content = ta.value.trim();
        if (!content) return;
        try {
          await createComment({ theory_id: theory.id, content });
          ta.value = '';
          toastSuccess('ثبت شد');
          renderComments();
        } catch (err) { toastError('خطا', err.message); }
      });
    } else {
      form.innerHTML = `<div style="font-size:var(--fs-sm);color:var(--ink-mute);">برای نوشتن دیدگاه <a href="#/auth" data-link style="color:var(--accent-1);">وارد شوید</a>.</div>`;
    }
    commentsWrap.appendChild(form);
  };
  renderComments().catch(() => {});
};
