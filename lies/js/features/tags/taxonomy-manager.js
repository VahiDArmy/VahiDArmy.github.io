/* ============================================================
   js/features/tags/taxonomy-manager.js
   Manages dynamic Lie Types and Moods.
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import * as taxonomyService from '../../services/taxonomy.service.js';
import { COLOR_PALETTE } from '../../config/constants.js';
import { toast } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';
import { emptyState } from '../../ui/empty-state.js';

const ICONS = ['🪞', '⏳', '🙈', '🧩', '⚖️', '💎', '🚪', '🎛️', '🕳️', '✳️', '😌', '😐', '😰', '😔', '😠', '😖', '🌤️', '🌟', '🎭', '🔥', '💭', '🌱', '🎯'];

export function renderTaxonomyManager(kind, items, onChange) {
  const isType = kind === 'type';
  const title = isType ? 'انواع دروغ' : 'حال و احساس';
  const icon = isType ? '🎭' : '😶';

  const wrap = el('div', { class: 'taxonomy-manager' });

  // Head
  const head = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } });
  head.appendChild(el('h2', { style: { fontSize: '18px', fontWeight: '600' } }, { children: [icon + ' ' + title] }));

  const addBtn = el('button', { class: 'btn btn--primary btn--sm' });
  addBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['＋'] }));
  addBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['افزودن مورد جدید'] }));
  addBtn.addEventListener('click', () => openEditor(kind, null, onChange));
  head.appendChild(addBtn);
  wrap.appendChild(head);

  // List
  if (!items.length) {
    wrap.appendChild(emptyState({ icon: '📭', title: 'لیست خالی است', message: 'هنوز موردی ثبت نشده است.' }));
    return wrap;
  }

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  for (const item of items) {
    list.appendChild(renderRow(kind, item, onChange));
  }
  wrap.appendChild(list);

  return wrap;
}

function renderRow(kind, item, onChange) {
  const row = el('div', { class: 'taxonomy-row' });
  
  const iconEl = el('div', { class: 'taxonomy-row__icon', style: { color: item.color || 'var(--accent)' } }, { children: [item.icon] });
  row.appendChild(iconEl);

  const body = el('div', { class: 'taxonomy-row__body' });
  body.appendChild(el('div', { class: 'taxonomy-row__title' }, { children: [item.label] }));
  
  if (item.description) {
    body.appendChild(el('div', { class: 'taxonomy-row__desc' }, { children: [item.description] }));
  }
  
  if (item.example) {
    body.appendChild(el('div', { class: 'taxonomy-row__example' }, { children: [`مثال: «${item.example}»`] }));
  }
  row.appendChild(body);

  const actions = el('div', { class: 'taxonomy-row__actions' });
  
  const editBtn = el('button', { class: 'icon-btn', attrs: { type: 'button', title: 'ویرایش' } }, { children: ['✎'] });
  editBtn.addEventListener('click', () => openEditor(kind, item, onChange));
  actions.appendChild(editBtn);

  const delBtn = el('button', { class: 'icon-btn', attrs: { type: 'button', title: 'حذف' }, style: { color: 'var(--danger)' } }, { children: ['🗑️'] });
  delBtn.addEventListener('click', async () => {
    const ok = await confirm({ title: 'حذف', message: 'آیا مطمئن هستید؟ دروغ‌های مرتبط با این مورد به «دروغ دیگر» تغییر می‌کنند.', variant: 'danger' });
    if (!ok) return;
    try {
      if (kind === 'type') await taxonomyService.deleteType(item.id);
      else await taxonomyService.deleteMood(item.id);
      toast.success('حذف شد.');
      onChange();
    } catch (err) { toast.error(err.message); }
  });
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

async function openEditor(kind, item, onDone) {
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const isEdit = !!item;
  const isType = kind === 'type';

  const body = el('div', { class: 'editor-form' });

  // Name
  const nameField = el('div', { class: 'field' });
  nameField.appendChild(el('label', { class: 'field__label' }, { children: ['نام', el('span', { class: 'req' }, { children: ['*'] })] }));
  const nameInput = el('input', { class: 'input', attrs: { type: 'text', maxlength: '60', placeholder: isType ? 'مثلاً: ترس از قضاوت' : 'مثلاً: هیجان‌زده' } });
  nameInput.value = item?.label || '';
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  // Description
  const descField = el('div', { class: 'field' });
  descField.appendChild(el('label', { class: 'field__label' }, { children: ['توضیح کوتاه'] }));
  const descInput = el('input', { class: 'input', attrs: { type: 'text', maxlength: '300', placeholder: 'یک جمله کوتاه برای تعریف این مفهوم' } });
  descInput.value = item?.description || '';
  descField.appendChild(descInput);
  body.appendChild(descField);

  // Example (only for types)
  let exampleInput = null;
  if (isType) {
    const exField = el('div', { class: 'field' });
    exField.appendChild(el('label', { class: 'field__label' }, { children: ['مثال (جمله‌ای که به خود می‌گویید)'] }));
    exampleInput = el('input', { class: 'input', attrs: { type: 'text', maxlength: '300', placeholder: 'مثلاً: همه من را قضاوت می‌کنند.' } });
    exampleInput.value = item?.example || '';
    exField.appendChild(exampleInput);
    body.appendChild(exField);
  }

  // Icon + Color
  const row = el('div', { class: 'editor-form__row' });

  const iconField = el('div', { class: 'field' });
  iconField.appendChild(el('label', { class: 'field__label' }, { children: ['آیکون'] }));
  const iconWrap = el('div', { class: 'icon-picker' });
  let selectedIcon = item?.icon || ICONS[0];
  for (const ic of ICONS) {
    const b = el('button', { class: ['icon-picker__item', ic === selectedIcon ? 'is-active' : ''].filter(Boolean), attrs: { type: 'button' } }, { children: [ic] });
    b.addEventListener('click', () => {
      selectedIcon = ic;
      iconWrap.querySelectorAll('.icon-picker__item').forEach((n) => n.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    iconWrap.appendChild(b);
  }
  iconField.appendChild(iconWrap);
  row.appendChild(iconField);

  let selectedColor = item?.color || COLOR_PALETTE[0];
  if (isType) {
    const colorField = el('div', { class: 'field' });
    colorField.appendChild(el('label', { class: 'field__label' }, { children: ['رنگ'] }));
    const colorWrap = el('div', { class: 'color-picker' });
    for (const c of COLOR_PALETTE) {
      const b = el('button', { class: ['color-picker__item', c === selectedColor ? 'is-active' : ''].filter(Boolean), attrs: { type: 'button' }, style: { background: c } });
      b.addEventListener('click', () => {
        selectedColor = c;
        colorWrap.querySelectorAll('.color-picker__item').forEach((n) => n.classList.remove('is-active'));
        b.classList.add('is-active');
      });
      colorWrap.appendChild(b);
    }
    colorField.appendChild(colorWrap);
    row.appendChild(colorField);
  }
  body.appendChild(row);

  // Footer
  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: [isEdit ? 'ذخیره' : 'افزودن'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({ title: isEdit ? 'ویرایش' : 'افزودن', icon: isType ? '🎭' : '😶', size: MODAL_SIZES.SM, content: body, footer: foot });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    try {
      const payload = {
        name,
        description: descInput.value.trim(),
        icon: selectedIcon,
        color: selectedColor,
        example: exampleInput ? exampleInput.value.trim() : undefined,
      };
      if (isEdit) {
        if (isType) await taxonomyService.updateType(item.id, payload);
        else await taxonomyService.updateMood(item.id, payload);
      } else {
        if (isType) await taxonomyService.createType(payload);
        else await taxonomyService.createMood(payload);
      }
      toast.success('ذخیره شد.');
      modal.close();
      onDone();
    } catch (err) { toast.error(err.message); }
  });
}