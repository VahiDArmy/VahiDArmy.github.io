/* ============================================================
   Theory create / edit view
   ============================================================ */
import { el, escapeHtml, truncate, normalizeFa, uid, compressImage, isImageFile } from '../utils.js';
import { state, subscribe } from '../state.js';
import { navigate, setBreadcrumbs } from '../router.js';
import { getTheory, createTheory, updateTheory, uploadImage, listObjects, createObject, deleteObject, listImages, createImage, deleteImage, listLinks, createLink, deleteLink } from '../data.js';
import { formatJalali, toJalali } from '../shamsi.js';
import { toastSuccess, toastError, toastInfo, openModal, openLightbox, confirm, prompt } from '../ui.js';
import { APP, CATEGORY_MAP, LINK_TYPE_MAP, OBJECT_TYPE_MAP } from '../config.js';
import { tagPill, placeholder } from '../components.js';

let quillInstance = null;

export const renderTheoryForm = async (root, { params, name }) => {
  if (!state.user) { navigate('/auth'); return; }
  const isEdit = name === 'theory-edit';
  const theoryId = isEdit ? params.id : null;
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page page--narrow';
  page.innerHTML = `<div class="skeleton skeleton--title" style="height:38px;width:50%"></div>`;
  root.appendChild(page);

  let theory = null;
  if (isEdit) {
    try {
      theory = await getTheory(theoryId);
    } catch (e) {
      toastError('خطا', e.message);
      navigate('/theories');
      return;
    }
    if (!theory || theory.user_id !== state.user.id) {
      toastError('دسترسی ندارید');
      navigate('/theories');
      return;
    }
  }

  setBreadcrumbs([
    { label: 'خانه', href: '#/home' },
    { label: 'نظریه‌ها', href: '#/theories' },
    { label: isEdit ? 'ویرایش' : 'نظریه جدید' }
  ]);

  page.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-lightbulb-flash-line"></i>${isEdit ? 'ویرایش' : 'ساخت'}</div>
      <h1 class="page-header__title">${isEdit ? 'ویرایش نظریه' : 'نظریه جدید'}</h1>
      <p class="page-header__desc">${isEdit ? 'تغییرات را ذخیره کنید.' : 'ایده خود را ثبت کنید، دسته‌بندی و برچسب بگذارید، سپس اشیاء تصویری را اضافه کنید.'}</p>
    </div>
    <div class="page-header__actions">
      <button class="btn" data-act="cancel"><i class="ri-close-line"></i>انصراف</button>
    </div>
  `;
  page.appendChild(header);

  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '20px';

  /* Title */
  const titleField = document.createElement('div');
  titleField.className = 'field';
  titleField.innerHTML = `
    <label class="field__label">عنوان <span class="req">*</span></label>
    <input class="input" name="title" required maxlength="${APP.limits.titleMax}" placeholder="مثلاً: نظریه پیچیدگی جهان" value="${escapeHtml(theory?.title || '')}" />
    <div class="field__hint">حداکثر ${APP.limits.titleMax} کاراکتر</div>
  `;
  form.appendChild(titleField);

  /* Category + Status + Favorite + Public */
  const row1 = document.createElement('div');
  row1.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;';
  const catField = document.createElement('div');
  catField.className = 'field';
  catField.innerHTML = `
    <label class="field__label">دسته‌بندی</label>
    <select class="select" name="category">
      ${APP.categories.map(c => `<option value="${c.id}" ${theory?.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
    </select>
  `;
  row1.appendChild(catField);

  const statusField = document.createElement('div');
  statusField.className = 'field';
  statusField.innerHTML = `
    <label class="field__label">وضعیت</label>
    <select class="select" name="status">
      <option value="published" ${theory?.status === 'published' ? 'selected' : ''}>منتشر شده</option>
      <option value="draft" ${theory?.status === 'draft' ? 'selected' : ''}>پیش‌نویس</option>
      <option value="archived" ${theory?.status === 'archived' ? 'selected' : ''}>آرشیو</option>
    </select>
  `;
  row1.appendChild(statusField);

  const colorField = document.createElement('div');
  colorField.className = 'field';
  colorField.innerHTML = `
    <label class="field__label">رنگ</label>
    <input class="input" name="color" type="color" value="${theory?.color || '#7c3aed'}" style="height:42px;padding:4px;" />
  `;
  row1.appendChild(colorField);
  form.appendChild(row1);

  /* Summary */
  const summaryField = document.createElement('div');
  summaryField.className = 'field';
  summaryField.innerHTML = `
    <label class="field__label">خلاصه</label>
    <textarea class="textarea" name="summary" rows="2" maxlength="${APP.limits.summaryMax}" placeholder="یک یا دو جمله‌ی جذاب…">${escapeHtml(theory?.summary || '')}</textarea>
  `;
  form.appendChild(summaryField);

  /* Cover upload */
  const coverField = document.createElement('div');
  coverField.className = 'field';
  coverField.innerHTML = `<label class="field__label">تصویر جلد</label>`;
  const coverPreview = document.createElement('div');
  coverPreview.style.cssText = 'position:relative;aspect-ratio:21/9;border-radius:var(--r-lg);overflow:hidden;border:1.5px dashed var(--line-strong);background:var(--bg-soft);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--ink-faint);cursor:pointer;';
  const coverInput = document.createElement('input');
  coverInput.type = 'file';
  coverInput.accept = 'image/*';
  coverInput.hidden = true;
  let coverFile = null;
  let coverCurrentUrl = theory?.cover_image || '';
  const coverPath = theory?.cover_path || '';
  const renderCoverPreview = () => {
    coverPreview.innerHTML = '';
    if (coverCurrentUrl) {
      const img = document.createElement('img');
      img.src = coverCurrentUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      coverPreview.appendChild(img);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn btn--sm';
      rm.style.cssText = 'position:absolute;top:8px;inset-inline-end:8px;';
      rm.innerHTML = '<i class="ri-delete-bin-line"></i>حذف';
      rm.addEventListener('click', (e) => { e.stopPropagation(); coverCurrentUrl = ''; coverFile = null; renderCoverPreview(); });
      coverPreview.appendChild(rm);
    } else {
      coverPreview.innerHTML = `<i class="ri-image-add-line" style="font-size:32px;"></i><span style="font-size:var(--fs-sm);">برای انتخاب تصویر کلیک کنید</span>`;
    }
  };
  renderCoverPreview();
  coverPreview.addEventListener('click', () => coverInput.click());
  coverInput.addEventListener('change', () => {
    const f = coverInput.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) { toastError('فقط تصویر مجاز است'); return; }
    if (f.size > APP.storage.maxFileSize) { toastError('حجم فایل زیاد است', 'حداکثر ۱۰ مگابایت'); return; }
    coverFile = f;
    coverCurrentUrl = URL.createObjectURL(f);
    renderCoverPreview();
  });
  coverField.append(coverPreview, coverInput);
  form.appendChild(coverField);

  /* Tags */
  const tagsField = document.createElement('div');
  tagsField.className = 'field';
  tagsField.innerHTML = `
    <label class="field__label">برچسب‌ها</label>
    <div class="input-group" style="padding:0">
      <input class="input" name="tagInput" placeholder="برچسب زده و Enter بزنید" />
    </div>
    <div class="tag-list" data-tags></div>
  `;
  let tags = [...(theory?.tags || [])];
  const tagsListEl = tagsField.querySelector('[data-tags]');
  const renderTags = () => {
    tagsListEl.innerHTML = '';
    tags.forEach(t => tagsListEl.appendChild(tagPill(t, { removable: true, onRemove: (tag) => {
      tags = tags.filter(x => x !== tag);
      renderTags();
    }})));
  };
  renderTags();
  const tagInput = tagsField.querySelector('input[name="tagInput"]');
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = normalizeFa(tagInput.value.trim()).slice(0, APP.limits.tagLenMax);
      if (!v) return;
      if (tags.includes(v)) { tagInput.value = ''; return; }
      if (tags.length >= APP.limits.tagsMax) { toastWarning('حداکثر برچسب', `تا ${APP.limits.tagsMax} برچسب`); return; }
      tags.push(v);
      tagInput.value = '';
      renderTags();
    }
  });
  form.appendChild(tagsField);

  /* Shamsi date */
  const dateRow = document.createElement('div');
  dateRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';
  const now = toJalali(new Date());
  const jy = theory?.shamsi_year || now.jy;
  const jm = theory?.shamsi_month || now.jm;
  const jd = theory?.shamsi_day || now.jd;
  dateRow.innerHTML = `
    <div class="field"><label class="field__label">سال (شمسی)</label><input class="input" type="number" name="shamsi_year" value="${jy}" min="1300" max="1500" /></div>
    <div class="field"><label class="field__label">ماه</label>
      <select class="select" name="shamsi_month">
        ${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>`<option value="${i+1}" ${jm===i+1?'selected':''}>${m}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label class="field__label">روز</label><input class="input" type="number" name="shamsi_day" value="${jd}" min="1" max="31" /></div>
  `;
  form.appendChild(dateRow);

  /* Content editor */
  const contentField = document.createElement('div');
  contentField.className = 'field';
  contentField.innerHTML = `<label class="field__label">محتوا</label><div class="editor-shell" id="theory-editor"></div>`;
  form.appendChild(contentField);

  /* Footer actions */
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding-top:12px;';
  actionsRow.innerHTML = `
    <button type="button" class="btn" data-act="cancel"><i class="ri-close-line"></i>انصراف</button>
    <button type="submit" class="btn btn--primary"><i class="ri-save-3-line"></i>${isEdit ? 'ذخیره تغییرات' : 'ساخت نظریه'}</button>
  `;
  form.appendChild(actionsRow);

  /* Attachments section (only on edit) */
  let attachmentsSection = null;
  if (isEdit) {
    attachmentsSection = buildAttachmentsSection(theory);
    page.appendChild(form);
    page.appendChild(attachmentsSection);
  } else {
    page.appendChild(form);
  }

  /* Init Quill */
  const editorHost = form.querySelector('#theory-editor');
  const editor = new window.Quill(editorHost, {
    theme: 'snow',
    placeholder: 'شرح نظریه…',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean']
      ]
    }
  });
  editor.root.dir = 'rtl';
  if (theory?.content) editor.clipboard.dangerouslyPasteHTML(theory.content);
  quillInstance = editor;

  /* Submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) { toastError('عنوان الزامی است'); return; }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('btn--loading');
    try {
      let coverUrl = coverCurrentUrl;
      let coverPathVal = coverPath;
      if (coverFile) {
        const compressed = await compressImage(coverFile, 1600, 0.85).catch(() => coverFile);
        const res = await uploadImage(compressed, 'cover');
        coverUrl = res.url;
        coverPathVal = res.path;
      }
      const payload = {
        title,
        summary: String(fd.get('summary') || '').trim(),
        content: editor.root.innerHTML,
        category: String(fd.get('category') || 'other'),
        status: String(fd.get('status') || 'published'),
        color: String(fd.get('color') || '#7c3aed'),
        cover_image: coverUrl || null,
        cover_path: coverPathVal || null,
        tags,
        shamsi_year: Number(fd.get('shamsi_year')) || null,
        shamsi_month: Number(fd.get('shamsi_month')) || null,
        shamsi_day: Number(fd.get('shamsi_day')) || null
      };
      if (isEdit) {
        await updateTheory(theory.id, payload);
        toastSuccess('ذخیره شد');
        navigate(`/theories/${theory.id}`);
      } else {
        const created = await createTheory(payload);
        toastSuccess('نظریه ساخته شد');
        navigate(`/theories/${created.id}/edit`);
      }
    } catch (err) {
      console.error(err);
      toastError('خطا', err.message || 'ذخیره ناموفق بود');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn--loading');
    }
  });

  form.querySelectorAll('[data-act="cancel"]').forEach(b => b.addEventListener('click', () => navigate(isEdit ? `/theories/${theoryId}` : '/theories')));
};

/* ---------------- Attachments section ---------------- */
const buildAttachmentsSection = (theory) => {
  const section = document.createElement('section');
  section.className = 'section';
  section.innerHTML = `
    <div class="section__head">
      <h2 class="section__title"><i class="ri-attachment-2"></i>اشیاء، تصاویر و پیوندها</h2>
    </div>
  `;

  /* Objects */
  const objCard = document.createElement('div');
  objCard.className = 'card';
  objCard.style.padding = '18px';
  objCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-bold);"><i class="ri-shape-2-line"></i> اشیاء</h3>
      <button type="button" class="btn btn--soft btn--sm" data-act="add-object"><i class="ri-add-line"></i>شیء جدید</button>
    </div>
    <div data-objects></div>
  `;
  section.appendChild(objCard);

  /* Images */
  const imgCard = document.createElement('div');
  imgCard.className = 'card';
  imgCard.style.padding = '18px';
  imgCard.style.marginTop = '16px';
  imgCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-bold);"><i class="ri-image-line"></i> گالری تصاویر</h3>
      <button type="button" class="btn btn--soft btn--sm" data-act="add-image"><i class="ri-upload-line"></i>بارگذاری تصویر</button>
    </div>
    <div data-images class="gallery-grid"></div>
  `;
  section.appendChild(imgCard);

  /* Links */
  const linkCard = document.createElement('div');
  linkCard.className = 'card';
  linkCard.style.padding = '18px';
  linkCard.style.marginTop = '16px';
  linkCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:var(--fs-lg);font-weight:var(--fw-bold);"><i class="ri-link"></i> پیوندها</h3>
      <button type="button" class="btn btn--soft btn--sm" data-act="add-link"><i class="ri-add-line"></i>پیوند جدید</button>
    </div>
    <div data-links></div>
  `;
  section.appendChild(linkCard);

  /* Load objects */
  const loadObjects = async () => {
    const host = objCard.querySelector('[data-objects]');
    host.innerHTML = '<div class="skeleton skeleton--text"></div>';
    try {
      const { items } = await listObjects({ theoryId: theory.id, perPage: 100 });
      host.innerHTML = '';
      if (!items.length) {
        host.innerHTML = '<div style="color:var(--ink-faint);font-size:var(--fs-sm);padding:12px 0;">هنوز شیئی اضافه نشده است.</div>';
      } else {
        items.forEach(o => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);';
          const img = o.image_url ? `<img src="${escapeHtml(o.image_url)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;" />` : `<div style="width:44px;height:44px;border-radius:8px;background:var(--bg-soft);display:grid;place-items:center;color:var(--ink-faint);"><i class="ri-image-line"></i></div>`;
          row.innerHTML = `${img}<div style="flex:1;min-width:0;"><div style="font-weight:600;">${escapeHtml(o.title)}</div><div style="font-size:var(--fs-xs);color:var(--ink-faint);">${escapeHtml(OBJECT_TYPE_MAP[o.object_type]?.label || '')}</div></div>`;
          const del = document.createElement('button');
          del.className = 'icon-btn icon-btn--sm';
          del.innerHTML = '<i class="ri-delete-bin-line"></i>';
          del.addEventListener('click', async () => {
            const ok = await confirm({ title: 'حذف شیء', danger: true, confirmText: 'حذف' });
            if (!ok) return;
            await deleteObject(o.id);
            toastSuccess('حذف شد');
            loadObjects();
          });
          row.appendChild(del);
          host.appendChild(row);
        });
      }
    } catch (e) { host.innerHTML = '<div style="color:var(--danger);">خطا در بارگذاری</div>'; }
  };
  loadObjects();

  objCard.querySelector('[data-act="add-object"]').addEventListener('click', () => openObjectModal(theory.id, loadObjects));

  /* Load images */
  const loadImages = async () => {
    const host = imgCard.querySelector('[data-images]');
    host.innerHTML = '<div class="skeleton skeleton--thumb"></div>';
    try {
      const { items } = await listImages({ theoryId: theory.id, perPage: 100 });
      host.innerHTML = '';
      items.forEach(img => {
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.className = 'gallery-item';
        wrap.innerHTML = `<img src="${escapeHtml(img.image_url)}" alt="" />`;
        const del = document.createElement('button');
        del.className = 'icon-btn icon-btn--sm';
        del.style.cssText = 'position:absolute;top:6px;inset-inline-end:6px;background:rgba(0,0,0,.5);color:#fff;';
        del.innerHTML = '<i class="ri-close-line"></i>';
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirm({ title: 'حذف تصویر', danger: true, confirmText: 'حذف' });
          if (!ok) return;
          await deleteImage(img.id);
          toastSuccess('حذف شد');
          loadImages();
        });
        wrap.appendChild(del);
        host.appendChild(wrap);
      });
      if (!items.length) host.innerHTML = '<div style="color:var(--ink-faint);font-size:var(--fs-sm);">هنوز تصویری بارگذاری نشده است.</div>';
    } catch (e) { host.innerHTML = '<div style="color:var(--danger);">خطا در بارگذاری</div>'; }
  };
  loadImages();

  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.accept = 'image/*';
  imgInput.multiple = true;
  imgInput.hidden = true;
  imgCard.appendChild(imgInput);
  imgCard.querySelector('[data-act="add-image"]').addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', async () => {
    const files = Array.from(imgInput.files || []);
    for (const f of files) {
      if (!isImageFile(f) || f.size > APP.storage.maxFileSize) { toastError('فایل نامعتبر'); continue; }
      try {
        const compressed = await compressImage(f, 1920, 0.85).catch(() => f);
        const res = await uploadImage(compressed, 'gallery');
        await createImage({ theory_id: theory.id, image_url: res.url, image_path: res.path, caption: f.name });
      } catch (e) { toastError('خطا', e.message); }
    }
    imgInput.value = '';
    loadImages();
    toastSuccess('بارگذاری انجام شد');
  });

  /* Load links */
  const loadLinks = async () => {
    const host = linkCard.querySelector('[data-links]');
    host.innerHTML = '<div class="skeleton skeleton--text"></div>';
    try {
      const items = await listLinks({ theoryId: theory.id });
      host.innerHTML = '';
      if (!items.length) host.innerHTML = '<div style="color:var(--ink-faint);font-size:var(--fs-sm);padding:12px 0;">هنوز پیوندی نیست.</div>';
      items.forEach(l => {
        const other = l.source_theory_id === theory.id ? l.target : l.source;
        if (!other) return;
        const meta = LINK_TYPE_MAP[l.link_type] || { label: l.link_type };
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line-soft);align-items:center;';
        row.innerHTML = `<div><span class="badge">${escapeHtml(meta.label)}</span> ${escapeHtml(other.title)}</div>`;
        const del = document.createElement('button');
        del.className = 'icon-btn icon-btn--sm';
        del.innerHTML = '<i class="ri-close-line"></i>';
        del.addEventListener('click', async () => { await deleteLink(l.id); loadLinks(); });
        row.appendChild(del);
        host.appendChild(row);
      });
    } catch (e) { host.innerHTML = '<div style="color:var(--danger);">خطا</div>'; }
  };
  loadLinks();

  linkCard.querySelector('[data-act="add-link"]').addEventListener('click', () => openLinkModal(theory.id, loadLinks));

  return section;
};

/* ---------------- Object modal ---------------- */
const openObjectModal = (theoryId, onDone) => {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
  body.innerHTML = `
    <div class="field"><label class="field__label">عنوان <span class="req">*</span></label><input class="input" name="title" maxlength="${APP.limits.objectTitleMax}" required /></div>
    <div class="field"><label class="field__label">نوع شیء</label>
      <select class="select" name="object_type">
        ${APP.objectTypes.map(o => `<option value="${o.id}">${o.label}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label class="field__label">توضیح</label><textarea class="textarea" name="description" rows="3" maxlength="${APP.limits.objectDescMax}"></textarea></div>
    <div class="field"><label class="field__label">تصویر</label>
      <input type="file" accept="image/*" name="image" class="input" style="padding:6px;" />
    </div>
  `;
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;';
  const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'انصراف';
  const ok = document.createElement('button'); ok.className = 'btn btn--primary'; ok.innerHTML = '<i class="ri-save-line"></i>ذخیره';
  footer.append(cancel, ok);
  const modal = openModal({ title: 'شیء جدید', body, footer });
  cancel.addEventListener('click', modal.close);
  ok.addEventListener('click', async () => {
    const title = body.querySelector('[name="title"]').value.trim();
    if (!title) { toastError('عنوان الزامی'); return; }
    const object_type = body.querySelector('[name="object_type"]').value;
    const description = body.querySelector('[name="description"]').value.trim();
    const file = body.querySelector('[name="image"]').files?.[0];
    ok.disabled = true;
    try {
      let image_url = null, image_path = null;
      if (file) {
        const compressed = await compressImage(file, 1600, 0.85).catch(() => file);
        const res = await uploadImage(compressed, 'object');
        image_url = res.url; image_path = res.path;
      }
      await createObject({ theory_id: theoryId, title, object_type, description, image_url, image_path });
      toastSuccess('شیء ساخته شد');
      modal.close();
      onDone?.();
    } catch (e) { toastError('خطا', e.message); ok.disabled = false; }
  });
};

/* ---------------- Link modal ---------------- */
const openLinkModal = async (theoryId, onDone) => {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
  body.innerHTML = `
    <div class="field"><label class="field__label">شناسه نظریه هدف <span class="req">*</span></label><input class="input" name="target" placeholder="UUID نظریه هدف" required /></div>
    <div class="field"><label class="field__label">نوع پیوند</label>
      <select class="select" name="link_type">
        ${APP.linkTypes.map(l => `<option value="${l.id}">${l.label}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label class="field__label">برچسب</label><input class="input" name="label" /></div>
  `;
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;';
  const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'انصراف';
  const ok = document.createElement('button'); ok.className = 'btn btn--primary'; ok.textContent = 'ذخیره';
  footer.append(cancel, ok);
  const modal = openModal({ title: 'پیوند جدید', body, footer });
  cancel.addEventListener('click', modal.close);
  ok.addEventListener('click', async () => {
    const target = body.querySelector('[name="target"]').value.trim();
    if (!target || target === theoryId) { toastError('شناسه نامعتبر'); return; }
    try {
      await createLink({ source_theory_id: theoryId, target_theory_id: target, link_type: body.querySelector('[name="link_type"]').value, label: body.querySelector('[name="label"]').value });
      toastSuccess('پیوند ساخته شد');
      modal.close();
      onDone?.();
    } catch (e) { toastError('خطا', e.message); }
  });
};
