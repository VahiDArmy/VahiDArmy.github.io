/* ============================================================
   js/features/tags/taxonomy-manager.js
   FIXED: Re-architected to use the exact same `.manager` UI 
          framework as categories and tags for 100% consistency.
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import * as taxonomyService from '../../services/taxonomy.service.js';
import { COLOR_PALETTE } from '../../config/constants.js';
import { toast } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';
import { emptyState } from '../../ui/empty-state.js';
import { toFaDigits } from '../../utils/format.js';

const ICONS = ['🪞', '⏳', '🙈', '🧩', '⚖️', '💎', '🚪', '🎛️', '🕳️', '✳️', '😌', '😐', '😰', '😔', '😠', '😖', '🌤️', '🌟', '🎭', '🔥', '💭', '🌱', '🎯', '🏁', '🧠', '🔄', '🛋️', '👻', '🧊', '🩹', '🐢', '🏷️', '🛡️', '🌪️'];

export function renderTaxonomyManager(kind, items, onChange) {
  const isType = kind === 'type';
  const title = isType ? 'انواع دروغ' : 'حال و احساس';
  const icon = isType ? '🎭' : '😶';

  const wrap = el('section', { class: 'manager' });

  /* Head (Matches categories-manager) */
  const head = el('header', { class: 'manager__head' });
  head.appendChild(el('div', { class: 'manager__title-wrap' }, {
    children: [
      el('h2', { class: 'manager__title' }, { children: [el('span', {}, { children: [icon] }), title] }),
      el('p', { class: 'manager__subtitle' }, { children: [`${toFaDigits(items.length)} مورد تعریف شده`] }),
    ],
  }));

  const addBtn = el('button', { class: 'btn btn--primary btn--sm' });
  addBtn.appendChild(el('span', { class: 'btn__icon' }, { children: ['＋'] }));
  addBtn.appendChild(el('span', { class: 'btn__label' }, { children: ['افزودن مورد جدید'] }));
  addBtn.addEventListener('click', () => openEditor(kind, null, onChange));
  head.appendChild(addBtn);
  wrap.appendChild(head);

  /* Search (Matches categories-manager) */
  const searchWrap = el('div', { class: 'manager__search' });
  const searchIco = el('span', { class: 'search-input__ico' }, { children: ['🔍'] });
  const searchInput = el('input', { class: 'input', attrs: { type: 'text', placeholder: 'جست‌وجو…' } });
  searchWrap.appendChild(searchIco);
  searchWrap.appendChild(searchInput);
  wrap.appendChild(searchWrap);

  /* List */
  const list = el('div', { class: 'manager__list' });
  wrap.appendChild(list);

  const renderList = (filteredItems) => {
    clear(list);
    if (!filteredItems.length) {
      list.appendChild(emptyState({
        icon: '📭',
        title: 'موردی یافت نشد',
        message: 'هنوز چیزی ثبت نشده است یا نتیجه‌ای برای جست‌وجو وجود ندارد.',
        action: { label: 'افزودن', onClick: () => openEditor(kind, null, onChange) },
        variant: 'compact',
      }));
      return;
    }

    for (const item of filteredItems) {
      list.appendChild(renderRow(kind, item, onChange));
    }
  };

  renderList(items);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? items.filter((t) => t.label.toLowerCase().includes(q)) : items;
    renderList(filtered);
  });

  return wrap;
}

function renderRow(kind, item, onChange) {
  const row = el('div', { class: 'manager-row' });
  
  // Icon
  const iconEl = el('div', { class: 'manager-row__icon', style: { '--cat-color': item.color || 'var(--accent)' } }, { children: [item.icon] });
  row.appendChild(iconEl);

  // Body (Name, Desc, Example)
  const body = el('div', { class: 'manager-row__body', style: { gap: '4px' } });
  body.appendChild(el('div', { class: 'manager-row__name' }, { children: [item.label] }));
  
  if (item.description) {
    body.appendChild(el('div', { class: 'manager-row__desc', style: { whiteSpace: 'normal' } }, { children: [item.description] }));
  }
  
  if (item.example) {
    body.appendChild(el('div', { class: 'manager-row__example', style: { fontSize: '11px', fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: '2px' } }, {
      children: [`مثال: «${item.example}»`]
    }));
  }
  row.appendChild(body);

  // Actions
  const actions = el('div', { class: 'manager-row__actions' });
  
  const editBtn = el('button', { class: 'icon-btn', attrs: { type: 'button', title: 'ویرایش' } }, { children: ['✎'] });
  editBtn.addEventListener('click', () => openEditor(kind, item, onChange));
  actions.appendChild(editBtn);

  const delBtn = el('button', { class: 'icon-btn manager-row__delete', attrs: { type: 'button', title: 'حذف' } }, { children: ['🗑️'] });
  delBtn.addEventListener('click', async () => {
    const ok = await confirm({ title: 'حذف مورد', message: 'آیا مطمئن هستید؟ دروغ‌های مرتبط با این مورد به «دروغ دیگر» تغییر می‌کنند.', variant: 'danger' });
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

/* ── Editor Modal ────────────────────────────────────────── */

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