/* ============================================================
   Objects list + object detail views
   ============================================================ */
import { el, escapeHtml, debounce, formatNumber, buildQuery } from '../utils.js';
import { state } from '../state.js';
import { navigate, setBreadcrumbs } from '../router.js';
import { listObjects, getObject, deleteObject, updateObject, listLinks } from '../data.js';
import { objectTile, pagination, emptyState, skeletonCards, placeholder, tagPill, categoryChip } from '../components.js';
import { toastSuccess, toastError, openLightbox, confirm, openModal } from '../ui.js';
import { formatJalali, relativeJalali } from '../shamsi.js';
import { APP, OBJECT_TYPE_MAP, LINK_TYPE_MAP } from '../config.js';

export const renderObjects = async (root, { query = {} } = {}) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-shape-2-line"></i>اشیاء</div>
      <h1 class="page-header__title">اشیاء نظریه‌ها</h1>
      <p class="page-header__desc">همه اشیاء تصویری، اسناد، مفاهیم و یادداشت‌های متصل به نظریه‌ها در یک نگاه.</p>
    </div>
  `;
  page.appendChild(header);

  const filters = document.createElement('div');
  filters.className = 'search-filters';
  filters.innerHTML = `<input class="input" placeholder="جستجوی عنوان…" style="max-width:280px;height:36px;" data-search />`;
  page.appendChild(filters);

  const results = document.createElement('div');
  results.style.cssText = 'margin-top:16px;';
  results.appendChild(skeletonCards(6));
  page.appendChild(results);
  root.appendChild(page);

  let currentPage = Number(query.page || 1);
  let currentQ = query.q || '';

  const load = async () => {
    results.innerHTML = '';
    results.appendChild(skeletonCards(6));
    try {
      const { items, count } = await listObjects({ page: currentPage, perPage: APP.pagination.objectsPerPage });
      const filtered = currentQ
        ? items.filter(o => (o.title || '').toLowerCase().includes(currentQ.toLowerCase()))
        : items;
      results.innerHTML = '';
      if (!filtered.length) {
        results.appendChild(emptyState({
          title: 'شیئی یافت نشد',
          desc: currentQ ? 'عبارت دیگری امتحان کنید.' : 'اشیاء از داخل ویرایش نظریه‌ها اضافه می‌شوند.',
          actions: [{ label: 'نظریه‌ها', primary: true, onClick: () => navigate('/theories') }]
        }));
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'gallery-grid stagger';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
      filtered.forEach(o => grid.appendChild(objectTile(o, { onClick: (obj) => navigate(`/objects/${obj.id}`) })));
      results.appendChild(grid);
      if (count > APP.pagination.objectsPerPage) {
        results.appendChild(pagination({
          page: currentPage, perPage: APP.pagination.objectsPerPage, total: count,
          onPage: (p) => { currentPage = p; load(); }
        }));
      }
    } catch (e) {
      console.error(e);
      results.innerHTML = '';
      results.appendChild(emptyState({ title: 'خطا در بارگذاری', desc: e.message }));
    }
  };

  filters.querySelector('[data-search]').addEventListener('input', debounce((e) => {
    currentQ = e.target.value.trim();
    currentPage = 1;
    load();
  }, 300));

  await load();
};

/* ---------------- Object detail ---------------- */
export const renderObjectDetail = async (root, { params }) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = '<div class="skeleton skeleton--title" style="height:38px;width:50%"></div>';
  root.appendChild(page);

  let obj;
  try {
    obj = await getObject(params.id);
  } catch (e) {
    page.replaceChildren(emptyState({ title: 'خطا', desc: e.message, actions: [{ label: 'اشیاء', onClick: () => navigate('/objects') }] }));
    return;
  }
  if (!obj) {
    page.replaceChildren(emptyState({ title: 'شیء یافت نشد', desc: 'شاید حذف شده است.', actions: [{ label: 'اشیاء', primary: true, onClick: () => navigate('/objects') }] }));
    return;
  }
  setBreadcrumbs([
    { label: 'خانه', href: '#/home' },
    { label: 'اشیاء', href: '#/objects' },
    { label: obj.title }
  ]);

  const isOwner = state.user && state.user.id === obj.user_id;
  const typeMeta = OBJECT_TYPE_MAP[obj.object_type] || { label: obj.object_type, icon: 'ri-shape-2-line' };

  page.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="${typeMeta.icon}"></i>${escapeHtml(typeMeta.label)}</div>
      <h1 class="page-header__title">${escapeHtml(obj.title)}</h1>
      <div class="theory-detail__meta" style="margin-top:6px;">
        <span><i class="ri-calendar-line"></i>${formatJalali(obj.created_at)}</span>
        <span class="divider"></span>
        <span><i class="ri-time-line"></i>${relativeJalali(obj.created_at)}</span>
        ${obj.theory ? `<span class="divider"></span><span><i class="ri-lightbulb-line"></i><a href="#/theories/${obj.theory.id}" data-link>${escapeHtml(obj.theory.title)}</a></span>` : ''}
      </div>
    </div>
    <div class="page-header__actions">
      ${isOwner ? `<button class="btn" data-act="edit"><i class="ri-edit-line"></i>ویرایش</button><button class="btn btn--danger" data-act="delete"><i class="ri-delete-bin-line"></i>حذف</button>` : ''}
    </div>
  `;
  page.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'object-detail-grid';
  const viewer = document.createElement('div');
  viewer.className = 'object-viewer';
  if (obj.image_url) {
    const img = document.createElement('img');
    img.src = obj.image_url;
    img.alt = obj.title;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(obj.image_url, obj.title));
    viewer.appendChild(img);
  } else {
    viewer.appendChild(placeholder('برای این شیء تصویری بارگذاری نشده'));
  }
  grid.appendChild(viewer);

  const info = document.createElement('div');
  info.style.display = 'flex';
  info.style.flexDirection = 'column';
  info.style.gap = '12px';
  info.innerHTML = `
    <div class="aside-card">
      <div class="aside-card__title"><i class="ri-file-info-line"></i>توضیحات</div>
      <div style="font-size:var(--fs-sm);color:var(--ink-soft);line-height:1.85;white-space:pre-wrap;">${escapeHtml(obj.description || 'هنوز توضیحی ثبت نشده است.')}</div>
    </div>
    <div class="aside-card">
      <div class="aside-card__title"><i class="ri-list-check-2"></i>مشخصات</div>
      <div class="object-meta-list">
        <div class="metric-row"><span class="metric-row__label">نوع</span><span class="metric-row__value">${escapeHtml(typeMeta.label)}</span></div>
        <div class="metric-row"><span class="metric-row__label">تاریخ ثبت</span><span class="metric-row__value">${formatJalali(obj.created_at, { long: true })}</span></div>
        <div class="metric-row"><span class="metric-row__label">نظریه</span><span class="metric-row__value">${escapeHtml(obj.theory?.title || '—')}</span></div>
      </div>
    </div>
  `;
  grid.appendChild(info);
  page.appendChild(grid);
  root.appendChild(page);

  page.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    const ok = await confirm({ title: 'حذف شیء', danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try {
      await deleteObject(obj.id);
      toastSuccess('حذف شد');
      navigate(obj.theory ? `/theories/${obj.theory.id}` : '/objects');
    } catch (e) { toastError('خطا', e.message); }
  });

  page.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    body.innerHTML = `
      <div class="field"><label class="field__label">عنوان</label><input class="input" name="title" value="${escapeHtml(obj.title)}" /></div>
      <div class="field"><label class="field__label">نوع</label>
        <select class="select" name="object_type">
          ${APP.objectTypes.map(o => `<option value="${o.id}" ${o.id === obj.object_type ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field__label">توضیح</label><textarea class="textarea" name="description" rows="4">${escapeHtml(obj.description || '')}</textarea></div>
    `;
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:8px;';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'انصراف';
    const save = document.createElement('button'); save.className = 'btn btn--primary'; save.textContent = 'ذخیره';
    footer.append(cancel, save);
    const modal = openModal({ title: 'ویرایش شیء', body, footer });
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      try {
        await updateObject(obj.id, {
          title: body.querySelector('[name="title"]').value.trim(),
          object_type: body.querySelector('[name="object_type"]').value,
          description: body.querySelector('[name="description"]').value.trim()
        });
        toastSuccess('ذخیره شد');
        modal.close();
        renderObjectDetail(root, { params });
      } catch (e) { toastError('خطا', e.message); }
    });
  });
};
