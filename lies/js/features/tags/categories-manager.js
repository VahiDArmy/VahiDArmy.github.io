/* ============================================================
   js/features/tags/categories-manager.js
   CRUD + drag-reorder + inline edit for categories
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import * as categoriesService from '../../services/categories.service.js';
import { COLOR_PALETTE, LIMITS } from '../../config/app.config.js';
import { toast } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';
import { toFaDigits } from '../../utils/format.js';
import { emptyState } from '../../ui/empty-state.js';
import { colorFromString } from '../../utils/id.js';

const ICONS = ['📁', '🎭', '💭', '🔥', '🌊', '⚡', '🌱', '🗝️', '🎯', '🌙', '☀️', '💎', '🪞', '🧩', '🧭', '⏳'];

/**
 * @param {{
 *   categories: any[],
 *   counts: Record<string, number>,
 *   onChange: ()=>void,
 * }} opts
 * @returns {HTMLElement}
 */
export function categoriesManager(opts) {
  const { categories = [], counts = {}, onChange } = opts;

  const wrap = el('section', { class: 'manager manager--categories' });

  /* Head */
  const head = el('header', { class: 'manager__head' });
  head.appendChild(el('div', { class: 'manager__title-wrap' }, {
    children: [
      el('h2', { class: 'manager__title' }, {
        children: [el('span', {}, { children: ['📁'] }), 'دسته‌بندی‌ها'],
      }),
      el('p', { class: 'manager__subtitle' }, {
        children: [`${toFaDigits(categories.length)} دسته · مرتب‌سازی با کشیدن`],
      }),
    ],
  }));

  const addBtn = el('button', {
    class: 'btn btn--primary btn--sm',
    attrs: { type: 'button' },
  });
  addBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['＋'] }));
  addBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['دسته جدید'] }));
  addBtn.addEventListener('click', () => openCategoryEditor(null, () => onChange?.()));
  head.appendChild(addBtn);
  wrap.appendChild(head);

  /* List */
  const list = el('div', { class: 'manager__list manager__list--drag' });

  if (!categories.length) {
    list.appendChild(emptyState({
      icon: '📁',
      title: 'هنوز دسته‌ای نساخته‌اید',
      message: 'دسته‌بندی به تو کمک می‌کند الگوها را سریع‌تر ببینی.',
      action: { label: 'ساخت اولین دسته', onClick: () => openCategoryEditor(null, () => onChange?.()) },
      variant: 'compact',
    }));
  } else {
    categories.forEach((cat, idx) => {
      list.appendChild(renderCategoryRow(cat, idx, counts[cat.id] || 0, onChange, categories, list));
    });
  }

  wrap.appendChild(list);
  initDragReorder(list, categories, onChange);

  return wrap;
}

function renderCategoryRow(cat, idx, count, onChange, categories, listEl) {
  const row = el('div', {
    class: 'manager-row manager-row--category',
    dataset: { id: cat.id, idx: String(idx) },
    attrs: { draggable: 'true' },
  });

  // Drag handle
  const handle = el('div', { class: 'manager-row__handle', attrs: { title: 'کشیدن برای مرتب‌سازی' } }, { children: ['⋮⋮'] });
  row.appendChild(handle);

  // Icon (clickable to edit)
  const iconBtn = el('button', {
    class: 'manager-row__icon',
    attrs: { type: 'button', title: 'تغییر آیکون' },
    style: { '--cat-color': cat.color },
    on: { click: () => pickIcon(cat, () => onChange?.()) },
  }, { children: [cat.icon || '📁'] });
  row.appendChild(iconBtn);

  // Body
  const body = el('div', { class: 'manager-row__body' });
  body.appendChild(el('div', { class: 'manager-row__name' }, { children: [cat.name] }));
  if (cat.description) {
    body.appendChild(el('div', { class: 'manager-row__desc' }, { children: [cat.description] }));
  }
  row.appendChild(body);

  // Count
  const countEl = el('span', { class: 'manager-row__count' }, {
    children: [`${toFaDigits(count)} دروغ`],
    attrs: { title: `${count} مورد` },
  });
  row.appendChild(countEl);

  // Color swatch
  const swatch = el('button', {
    class: 'manager-row__swatch',
    attrs: { type: 'button', title: 'تغییر رنگ' },
    style: { background: cat.color },
    on: { click: () => pickColor(cat, () => onChange?.()) },
  });
  row.appendChild(swatch);

  // Actions
  const actions = el('div', { class: 'manager-row__actions' });
  const editBtn = el('button', { class: 'icon-btn', attrs: { type: 'button', title: 'ویرایش' } }, { children: ['✎'] });
  editBtn.addEventListener('click', () => openCategoryEditor(cat, () => onChange?.()));
  actions.appendChild(editBtn);

  const delBtn = el('button', { class: 'icon-btn manager-row__delete', attrs: { type: 'button', title: 'حذف' } }, { children: ['🗑️'] });
  delBtn.addEventListener('click', async () => {
    const ok = await confirm({
      title: 'حذف دسته',
      message: `دسته «${cat.name}» حذف شود؟ دروغ‌های مربوطه بدون دسته خواهند شد.`,
      confirmLabel: 'حذف',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await categoriesService.remove(cat.id);
      toast.success('دسته حذف شد.');
      onChange?.();
    } catch (err) { toast.error(err.message); }
  });
  actions.appendChild(delBtn);

  row.appendChild(actions);

  return row;
}

/* ── Drag reorder ────────────────────────────────────────── */

function initDragReorder(listEl, categories, onChange) {
  let draggedId = null;

  listEl.addEventListener('dragstart', (ev) => {
    const row = ev.target.closest('.manager-row[draggable="true"]');
    if (!row) return;
    draggedId = row.dataset.id;
    row.classList.add('is-dragging');
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', draggedId); } catch { /* noop */ }
  });

  listEl.addEventListener('dragover', (ev) => {
    if (!draggedId) return;
    ev.preventDefault();
    const target = ev.target.closest('.manager-row');
    if (!target || target.dataset.id === draggedId) return;
    const rect = target.getBoundingClientRect();
    const before = ev.clientY < rect.top + rect.height / 2;
    listEl.querySelectorAll('.manager-row').forEach((n) => n.classList.remove('is-over-top', 'is-over-bottom'));
    target.classList.add(before ? 'is-over-top' : 'is-over-bottom');
  });

  listEl.addEventListener('dragleave', (ev) => {
    const target = ev.target.closest?.('.manager-row');
    target?.classList.remove('is-over-top', 'is-over-bottom');
  });

  listEl.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    const target = ev.target.closest('.manager-row');
    listEl.querySelectorAll('.manager-row').forEach((n) => n.classList.remove('is-over-top', 'is-over-bottom', 'is-dragging'));

    if (!draggedId || !target || target.dataset.id === draggedId) { draggedId = null; return; }
    const rect = target.getBoundingClientRect();
    const before = ev.clientY < rect.top + rect.height / 2;
    const ids = categories.map((c) => c.id);
    const fromIdx = ids.indexOf(draggedId);
    let toIdx = ids.indexOf(target.dataset.id);
    if (before) toIdx = Math.max(0, toIdx - 0.5) | 0;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    draggedId = null;
    try {
      await categoriesService.reorder(ids);
      toast.success('ترتیب ذخیره شد.');
      onChange?.();
    } catch (err) { toast.error(err.message); }
  });

  listEl.addEventListener('dragend', () => {
    draggedId = null;
    listEl.querySelectorAll('.manager-row').forEach((n) => n.classList.remove('is-dragging', 'is-over-top', 'is-over-bottom'));
  });
}

/* ── Editors ─────────────────────────────────────────────── */

async function openCategoryEditor(cat, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');

  const isEdit = !!cat;
  const body = el('div', { class: 'editor-form' });

  // Name
  const nameField = el('div', { class: 'field' });
  nameField.appendChild(el('label', { class: 'field__label' }, { children: ['نام', el('span', { class: 'req' }, { children: ['*'] })] }));
  const nameInput = el('input', {
    class: 'input',
    attrs: { type: 'text', maxlength: String(LIMITS.categoryNameMax), placeholder: 'مثلاً: ترس از شکست' },
  });
  nameInput.value = cat?.name || '';
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  // Icon + color in one row
  const row = el('div', { class: 'editor-form__row' });

  const iconField = el('div', { class: 'field' });
  iconField.appendChild(el('label', { class: 'field__label' }, { children: ['آیکون'] }));
  const iconWrap = el('div', { class: 'icon-picker' });
  let selectedIcon = cat?.icon || '📁';
  for (const ic of ICONS) {
    const b = el('button', {
      class: ['icon-picker__item', ic === selectedIcon ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
    }, { children: [ic] });
    b.addEventListener('click', () => {
      selectedIcon = ic;
      iconWrap.querySelectorAll('.icon-picker__item').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    iconWrap.appendChild(b);
  }
  iconField.appendChild(iconWrap);
  row.appendChild(iconField);

  const colorField = el('div', { class: 'field' });
  colorField.appendChild(el('label', { class: 'field__label' }, { children: ['رنگ'] }));
  const colorWrap = el('div', { class: 'color-picker' });
  let selectedColor = cat?.color || COLOR_PALETTE[0];
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
  row.appendChild(colorField);
  body.appendChild(row);

  // Description
  const descField = el('div', { class: 'field' });
  descField.appendChild(el('label', { class: 'field__label' }, { children: ['توضیح (اختیاری)'] }));
  const descInput = el('textarea', { class: 'textarea', attrs: { rows: 2, maxlength: '400' } });
  descInput.value = cat?.description || '';
  descField.appendChild(descInput);
  body.appendChild(descField);

  // Footer
  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: [isEdit ? 'ذخیره' : 'ساخت'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: isEdit ? 'ویرایش دسته' : 'دسته جدید',
    icon: '📁',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.classList.add('anim-shake'); setTimeout(() => nameInput.classList.remove('anim-shake'), 450); return; }
    try {
      if (isEdit) {
        await categoriesService.update(cat.id, {
          name, icon: selectedIcon, color: selectedColor, description: descInput.value.trim(),
        });
      } else {
        await categoriesService.create({
          name, icon: selectedIcon, color: selectedColor, description: descInput.value.trim(),
        });
      }
      toast.success(isEdit ? 'دسته به‌روزرسانی شد.' : 'دسته ساخته شد.');
      modal.close();
      onDone?.();
    } catch (err) { toast.error(err.message); }
  });

  requestAnimationFrame(() => nameInput.focus());
}

async function pickIcon(cat, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const body = el('div', { class: 'icon-picker icon-picker--lg' });
  const modal = openModal({ title: 'انتخاب آیکون', icon: '🎨', size: MODAL_SIZES.SM, content: body });
  for (const ic of ICONS) {
    const b = el('button', {
      class: ['icon-picker__item', ic === cat.icon ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
    }, { children: [ic] });
    b.addEventListener('click', async () => {
      await categoriesService.update(cat.id, { icon: ic });
      modal.close();
      toast.success('آیکون به‌روزرسانی شد.');
      onDone?.();
    });
    body.appendChild(b);
  }
}

async function pickColor(cat, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const body = el('div', { class: 'color-picker color-picker--lg' });
  const modal = openModal({ title: 'انتخاب رنگ', icon: '🎨', size: MODAL_SIZES.SM, content: body });
  for (const c of COLOR_PALETTE) {
    const b = el('button', {
      class: ['color-picker__item', c === cat.color ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
      style: { background: c },
    });
    b.addEventListener('click', async () => {
      await categoriesService.update(cat.id, { color: c });
      modal.close();
      toast.success('رنگ به‌روزرسانی شد.');
      onDone?.();
    });
    body.appendChild(b);
  }
}

export default { categoriesManager };