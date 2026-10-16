/* ============================================================
   js/features/tags/tags-manager.js
   Tags CRUD + merge + search
   FIXED: COLOR_PALETTE from constants.js, LIMITS from app.config.js
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import * as tagsService from '../../services/tags.service.js';
import { LIMITS } from '../../config/app.config.js';
import { COLOR_PALETTE } from '../../config/constants.js';   // ← FIXED
import { toast } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';
import { toFaDigits } from '../../utils/format.js';
import { emptyState } from '../../ui/empty-state.js';

/**
 * @param {{
 *   tags: Array<{id:string,name:string,color:string,count:number}>,
 *   onChange: ()=>void,
 * }} opts
 * @returns {HTMLElement}
 */
export function tagsManager(opts) {
  const { tags = [], onChange } = opts;

  const wrap = el('section', { class: 'manager manager--tags' });

  /* Head */
  const head = el('header', { class: 'manager__head' });
  head.appendChild(el('div', { class: 'manager__title-wrap' }, {
    children: [
      el('h2', { class: 'manager__title' }, {
        children: [el('span', {}, { children: ['🏷️'] }), 'برچسب‌ها'],
      }),
      el('p', { class: 'manager__subtitle' }, {
        children: [`${toFaDigits(tags.length)} برچسب`],
      }),
    ],
  }));

  const actions = el('div', { class: 'manager__head-actions' });

  const mergeBtn = el('button', {
    class: 'btn btn--ghost btn--sm',
    attrs: { type: 'button' },
  }, { children: ['🔗 ادغام'] });
  mergeBtn.addEventListener('click', () => openMergeDialog(tags, () => onChange?.()));
  actions.appendChild(mergeBtn);

  const addBtn = el('button', {
    class: 'btn btn--primary btn--sm',
    attrs: { type: 'button' },
  });
  addBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['＋'] }));
  addBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['برچسب جدید'] }));
  addBtn.addEventListener('click', () => openTagEditor(null, () => onChange?.()));
  actions.appendChild(addBtn);

  head.appendChild(actions);
  wrap.appendChild(head);

  /* Search */
  const searchWrap = el('div', { class: 'manager__search' });
  const searchIco = el('span', { class: 'search-input__ico' }, { children: ['🔍'] });
  const searchInput = el('input', {
    class: 'input',
    attrs: { type: 'text', placeholder: 'جست‌وجوی برچسب…' },
  });
  searchWrap.appendChild(searchIco);
  searchWrap.appendChild(searchInput);
  wrap.appendChild(searchWrap);

  /* Grid */
  const grid = el('div', { class: 'tags-grid' });
  wrap.appendChild(grid);

  const renderGrid = (items) => {
    clear(grid);
    if (!items.length) {
      grid.appendChild(emptyState({
        icon: '🏷️',
        title: 'برچسبی یافت نشد',
        message: 'برچسب‌ها به تو کمک می‌کنند موضوعات مشترک را سریع‌تر پیدا کنی.',
        action: { label: 'ساخت اولین برچسب', onClick: () => openTagEditor(null, () => onChange?.()) },
        variant: 'compact',
      }));
      return;
    }

    const sorted = [...items].sort((a, b) => (b.count || 0) - (a.count || 0));
    for (const tag of sorted) {
      grid.appendChild(renderTagCard(tag, () => onChange?.()));
    }
  };

  renderGrid(tags);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
    renderGrid(filtered);
  });

  return wrap;
}

function renderTagCard(tag, onChange) {
  const card = el('div', {
    class: 'tag-card',
    style: { '--tag-color': tag.color },
  });

  card.appendChild(el('span', { class: 'tag-card__dot', style: { background: tag.color } }));
  card.appendChild(el('span', { class: 'tag-card__name' }, { children: [tag.name] }));

  const count = tag.count || 0;
  card.appendChild(el('span', {
    class: 'tag-card__count',
    attrs: { title: `${count} مورد` },
  }, { children: [toFaDigits(count)] }));

  const actions = el('div', { class: 'tag-card__actions' });

  const editBtn = el('button', {
    class: 'icon-btn icon-btn--xs',
    attrs: { type: 'button', title: 'ویرایش' },
  }, { children: ['✎'] });
  editBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openTagEditor(tag, () => onChange?.());
  });
  actions.appendChild(editBtn);

  const delBtn = el('button', {
    class: 'icon-btn icon-btn--xs tag-card__delete',
    attrs: { type: 'button', title: 'حذف' },
  }, { children: ['✕'] });
  delBtn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const ok = await confirm({
      title: 'حذف برچسب',
      message: `برچسب «${tag.name}» از همهٔ دروغ‌ها حذف شود؟`,
      confirmLabel: 'حذف',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await tagsService.remove(tag.id);
      toast.success('برچسب حذف شد.');
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    }
  });
  actions.appendChild(delBtn);

  card.appendChild(actions);

  card.addEventListener('click', () => { location.hash = `#/lies?tagId=${tag.id}`; });

  return card;
}

/* ── Editors ─────────────────────────────────────────────── */

async function openTagEditor(tag, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const isEdit = !!tag;

  const body = el('div', { class: 'editor-form' });

  const nameField = el('div', { class: 'field' });
  nameField.appendChild(el('label', { class: 'field__label' }, {
    children: ['نام', el('span', { class: 'req' }, { children: ['*'] })],
  }));
  const nameInput = el('input', {
    class: 'input',
    attrs: { type: 'text', maxlength: String(LIMITS.tagNameMax), placeholder: 'مثلاً: ترس از شکست' },
  });
  nameInput.value = tag?.name || '';
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  const colorField = el('div', { class: 'field' });
  colorField.appendChild(el('label', { class: 'field__label' }, { children: ['رنگ'] }));
  const colorWrap = el('div', { class: 'color-picker' });
  let selectedColor = tag?.color || COLOR_PALETTE[0];
  for (const c of COLOR_PALETTE) {
    const b = el('button', {
      class: ['color-picker__item', c === selectedColor ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
      style: { background: c },
    });
    b.addEventListener('click', () => {
      selectedColor = c;
      colorWrap.querySelectorAll('.color-picker__item').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    colorWrap.appendChild(b);
  }
  colorField.appendChild(colorWrap);
  body.appendChild(colorField);

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: [isEdit ? 'ذخیره' : 'ساخت'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: isEdit ? 'ویرایش برچسب' : 'برچسب جدید',
    icon: '🏷️',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      nameInput.classList.add('anim-shake');
      setTimeout(() => nameInput.classList.remove('anim-shake'), 450);
      return;
    }
    try {
      if (isEdit) await tagsService.update(tag.id, { name, color: selectedColor });
      else await tagsService.create({ name, color: selectedColor });
      toast.success(isEdit ? 'برچسب به‌روزرسانی شد.' : 'برچسب ساخته شد.');
      modal.close();
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    }
  });

  requestAnimationFrame(() => nameInput.focus());
}

async function openMergeDialog(tags, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');

  const body = el('div', { class: 'editor-form' });

  body.appendChild(el('p', { class: 'field__hint' }, {
    children: ['دو برچسب را انتخاب کن. برچسب اول به برچسب دوم منتقل می‌شود و سپس حذف می‌گردد.'],
  }));

  const fromField = el('div', { class: 'field' });
  fromField.appendChild(el('label', { class: 'field__label' }, { children: ['از برچسب'] }));
  const fromSelect = el('select', { class: 'select' });
  fromSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['— انتخاب —'] }));
  for (const t of tags) fromSelect.appendChild(el('option', { attrs: { value: t.id } }, { children: [t.name] }));
  fromField.appendChild(fromSelect);
  body.appendChild(fromField);

  const toField = el('div', { class: 'field' });
  toField.appendChild(el('label', { class: 'field__label' }, { children: ['به برچسب'] }));
  const toSelect = el('select', { class: 'select' });
  toSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['— انتخاب —'] }));
  for (const t of tags) toSelect.appendChild(el('option', { attrs: { value: t.id } }, { children: [t.name] }));
  toField.appendChild(toSelect);
  body.appendChild(toField);

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: ['ادغام'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: 'ادغام برچسب‌ها',
    icon: '🔗',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const fromId = fromSelect.value;
    const toId = toSelect.value;
    if (!fromId || !toId || fromId === toId) {
      toast.warning('دو برچسب متفاوت انتخاب کنید.');
      return;
    }
    try {
      await tagsService.merge(fromId, toId);
      toast.success('برچسب‌ها ادغام شدند.');
      modal.close();
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    }
  });
}

export default { tagsManager };