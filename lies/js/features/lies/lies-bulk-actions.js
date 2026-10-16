/* ============================================================
   js/features/lies/lies-bulk-actions.js
   Bulk operation handlers (trash, archive, restore, tag, category, export)
   ============================================================ */

import { liesStore, getSelectedItems, clearSelection } from './lies-store.js';
import * as liesService from '../../services/lies.service.js';
import * as tagsService from '../../services/tags.service.js';
import { toast, toastPromise } from '../../ui/toast.js';
import { confirm, confirmDanger } from '../../ui/confirm.js';
import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';
import { toFaDigits } from '../../utils/format.js';

/**
 * @param {string[]} ids
 */
export async function bulkTrash(ids) {
  if (!ids.length) return;
  const ok = await confirm({
    title: 'انتقال به سطل زباله',
    message: `${toFaDigits(ids.length)} مورد به سطل زباله منتقل شود؟`,
    confirmLabel: 'انتقال',
    variant: 'danger',
    icon: '🗑️',
  });
  if (!ok) return;

  try {
    await liesService.bulk(ids, 'trash');
    clearSelection();
    toast.success(`${toFaDigits(ids.length)} مورد به سطل زباله منتقل شد.`);
    bus.emit(EVENTS.LIES_REFRESHED);
  } catch (err) {
    toast.error(err.message || 'خطا');
  }
}

export async function bulkArchive(ids) {
  if (!ids.length) return;
  try {
    await liesService.bulk(ids, 'archive');
    clearSelection();
    toast.success(`${toFaDigits(ids.length)} مورد بایگانی شد.`);
    bus.emit(EVENTS.LIES_REFRESHED);
  } catch (err) {
    toast.error(err.message || 'خطا');
  }
}

export async function bulkRestore(ids) {
  if (!ids.length) return;
  try {
    await liesService.bulk(ids, 'restore');
    clearSelection();
    toast.success(`${toFaDigits(ids.length)} مورد بازیابی شد.`);
    bus.emit(EVENTS.LIES_REFRESHED);
  } catch (err) {
    toast.error(err.message || 'خطا');
  }
}

export async function bulkHardDelete(ids) {
  if (!ids.length) return;
  const ok = await confirmDanger({
    title: 'حذف قطعی',
    message: `${toFaDigits(ids.length)} مورد برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`,
    phrase: 'حذف',
  });
  if (!ok) return;

  try {
    await liesService.bulk(ids, 'hardDelete');
    clearSelection();
    toast.success(`${toFaDigits(ids.length)} مورد برای همیشه حذف شد.`);
    bus.emit(EVENTS.LIES_REFRESHED);
  } catch (err) {
    toast.error(err.message || 'خطا');
  }
}

export async function bulkAddTag(ids) {
  if (!ids.length) return;
  const state = liesStore.getState();
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const { chipSelector } = await import('../../ui/chips.js');
  const { el } = await import('../../utils/dom.js');

  const body = el('div', { class: 'picker-body' });
  const selector = chipSelector({
    items: state.tags.map((t) => ({ id: t.id, label: t.name, color: t.color })),
    placeholder: 'افزودن برچسب…',
    creatable: true,
    maxItems: 5,
    onCreate: async (name) => {
      const tag = await tagsService.create({ name });
      state.tags.push(tag);
      return { id: tag.id, label: tag.name, color: tag.color };
    },
  });
  body.appendChild(selector);

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: ['افزودن'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: `افزودن برچسب به ${toFaDigits(ids.length)} مورد`,
    icon: '🏷️',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const tagIds = selector._chipSelector.getSelected();
    if (!tagIds.length) { modal.close(); return; }
    try {
      await liesService.bulkAddTags(ids, tagIds);
      modal.close();
      clearSelection();
      toast.success('برچسب‌ها افزوده شد.');
      bus.emit(EVENTS.LIES_REFRESHED);
    } catch (err) { toast.error(err.message); }
  });
}

export async function bulkSetCategory(ids) {
  if (!ids.length) return;
  const state = liesStore.getState();
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const { el } = await import('../../utils/dom.js');

  const body = el('div', { class: 'picker-body' });
  const list = el('div', { class: 'picker-list' });

  let selected = undefined;
  const noneBtn = el('button', { class: 'picker-item', attrs: { type: 'button' } }, { children: ['— بدون دسته —'] });
  noneBtn.addEventListener('click', () => {
    selected = null;
    list.querySelectorAll('.picker-item').forEach((n) => n.classList.remove('is-active'));
    noneBtn.classList.add('is-active');
  });
  list.appendChild(noneBtn);

  for (const c of state.categories) {
    const item = el('button', { class: 'picker-item', attrs: { type: 'button' } });
    item.appendChild(el('span', { style: { marginInlineEnd: '8px' } }, { children: [c.icon || '📁'] }));
    item.appendChild(el('span', {}, { children: [c.name] }));
    item.addEventListener('click', () => {
      selected = c.id;
      list.querySelectorAll('.picker-item').forEach((n) => n.classList.remove('is-active'));
      item.classList.add('is-active');
    });
    list.appendChild(item);
  }
  body.appendChild(list);

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: ['انتقال'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({ title: 'تغییر دسته', icon: '📁', size: MODAL_SIZES.SM, content: body, footer: foot });
  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    if (selected === undefined) { modal.close(); return; }
    try {
      await liesService.bulkSetCategory(ids, selected);
      modal.close();
      clearSelection();
      toast.success('دسته به‌روزرسانی شد.');
      bus.emit(EVENTS.LIES_REFRESHED);
    } catch (err) { toast.error(err.message); }
  });
}

export async function bulkTogglePin(ids) {
  if (!ids.length) return;
  // Pin all if any is unpinned; otherwise unpin all
  const state = liesStore.getState();
  const items = state.items.filter((it) => ids.includes(it.id));
  const shouldPin = items.some((it) => !it.isPinned);
  try {
    await Promise.all(ids.map((id) => liesService.togglePin(id, shouldPin)));
    clearSelection();
    toast.success(shouldPin ? 'سنجاق شد.' : 'سنجاق برداشته شد.');
    bus.emit(EVENTS.LIES_REFRESHED);
  } catch (err) { toast.error(err.message); }
}

export async function bulkExport(ids) {
  if (!ids.length) return;
  const state = liesStore.getState();
  const items = state.items.filter((it) => ids.includes(it.id));
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lies-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`${toFaDigits(items.length)} مورد خروجی گرفته شد.`);
}

export default {
  bulkTrash, bulkArchive, bulkRestore, bulkHardDelete,
  bulkAddTag, bulkSetCategory, bulkTogglePin, bulkExport,
};