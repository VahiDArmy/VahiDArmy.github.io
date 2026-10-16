/* ============================================================
   js/features/lies/lies-context-menu.js
   Builds the item list for a lie's right-click menu + the two
   picker dialogs (tag picker, category picker).
   FIXED: removed the duplicate declaration of `openTagPicker`
          (was declared both as `export function` and as
          `async function` in the same file).
   ============================================================ */

import { liesStore, patchItem, removeItems } from './lies-store.js';
import * as liesService from '../../services/lies.service.js';
import * as tagsService from '../../services/tags.service.js';
import { toast } from '../../ui/toast.js';
import { confirm, confirmDanger } from '../../ui/confirm.js';
import { openLieEditor } from './lie-editor.js';
import { el } from '../../utils/dom.js';

/* ══════════════════════════════════════════════════════════
   Context menu builder
   ══════════════════════════════════════════════════════════ */

/**
 * Build menu items for a right-click on a lie.
 * @param {MouseEvent} ev
 * @param {any} lie
 * @param {{onRefresh?:()=>void}} ctx
 * @returns {Array<object>}
 */
export function buildLieContextMenu(ev, lie, ctx = {}) {
  const state = liesStore.getState();
  const selectedCount = state.selection.size;
  const isMulti = selectedCount > 1 && state.selection.has(lie.id);
  const isPinned = !!lie.isPinned;
  const isTrashed = lie.status === 'trashed';
  const isArchived = lie.status === 'archived';

  const targetIds = isMulti ? [...state.selection] : [lie.id];
  const targetLabel = isMulti ? `${selectedCount} مورد` : 'این دروغ';

  const items = [
    {
      label: 'باز کردن',
      icon: '↗',
      shortcut: 'Enter',
      action: () => { location.hash = `#/lie/${lie.id}`; },
    },
    {
      label: 'ویرایش',
      icon: '✎',
      shortcut: 'E',
      action: () => openLieEditor(lie, { onSaved: () => ctx.onRefresh?.() }),
    },
    {
      label: 'تکثیر',
      icon: '⎘',
      action: async () => {
        try {
          await liesService.duplicate(lie.id);
          toast.success('تکثیر شد.');
          ctx.onRefresh?.();
        } catch (err) {
          toast.error(err.message || 'خطا در تکثیر');
        }
      },
    },
    { divider: true },
    { label: targetLabel, group: 'عملیات' },
    {
      label: isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن',
      icon: '📌',
      checked: isPinned,
      action: async () => {
        try {
          await liesService.togglePin(lie.id, !isPinned);
          patchItem(lie.id, { isPinned: !isPinned });
          toast.success(isPinned ? 'سنجاق برداشته شد.' : 'سنجاق شد.');
        } catch (err) {
          toast.error(err.message);
        }
      },
    },
    {
      label: 'افزودن برچسب…',
      icon: '🏷️',
      action: () => openTagPicker(lie, () => ctx.onRefresh?.()),
    },
    {
      label: 'تغییر دسته…',
      icon: '📁',
      action: () => openCategoryPicker(lie, () => ctx.onRefresh?.()),
    },
    { divider: true },
    {
      label: isArchived ? 'خروج از بایگانی' : 'بایگانی',
      icon: '📦',
      action: async () => {
        try {
          if (isArchived) {
            await liesService.unarchive(lie.id);
          } else {
            await liesService.archive(lie.id);
          }
          removeItems([lie.id]);
          toast.success('انجام شد.');
          ctx.onRefresh?.();
        } catch (err) {
          toast.error(err.message);
        }
      },
    },
    {
      label: 'کپی متن',
      icon: '⧉',
      action: async () => {
        try {
          await navigator.clipboard.writeText(lie.body || lie.title);
          toast.success('متن کپی شد.');
        } catch {
          toast.error('کپی ناموفق بود.');
        }
      },
    },
    {
      label: 'خروجی JSON این مورد',
      icon: '📤',
      action: () => {
        const blob = new Blob([JSON.stringify(lie, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${String(lie.title || 'lie').replace(/\s+/g, '-').slice(0, 40)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    },
    { divider: true },
    isTrashed
      ? {
          label: 'بازگردانی',
          icon: '↺',
          action: async () => {
            try {
              await liesService.restore(lie.id);
              toast.success('بازگردانی شد.');
              ctx.onRefresh?.();
            } catch (err) {
              toast.error(err.message);
            }
          },
        }
      : {
          label: 'انتقال به سطل زباله',
          icon: '🗑️',
          danger: true,
          shortcut: 'Del',
          action: async () => {
            if (isMulti) {
              const ok = await confirm({
                title: 'انتقال گروهی',
                message: `${selectedCount} مورد به سطل زباله منتقل شود؟`,
                confirmLabel: 'انتقال',
                variant: 'danger',
              });
              if (!ok) return;
              try {
                await liesService.bulk(targetIds, 'trash');
                removeItems(targetIds);
                toast.success('منتقل شد.');
                ctx.onRefresh?.();
              } catch (err) {
                toast.error(err.message);
              }
            } else {
              try {
                await liesService.trash(lie.id);
                removeItems([lie.id]);
                toast.success('به سطل زباله منتقل شد.', {
                  action: {
                    label: 'بازگردانی',
                    onClick: async () => {
                      await liesService.restore(lie.id);
                      ctx.onRefresh?.();
                    },
                  },
                  duration: 6000,
                });
                ctx.onRefresh?.();
              } catch (err) {
                toast.error(err.message);
              }
            }
          },
        },
    isTrashed
      ? {
          label: 'حذف قطعی',
          icon: '✕',
          danger: true,
          action: async () => {
            const ok = await confirmDanger({
              title: 'حذف قطعی',
              message: 'این عمل قابل بازگشت نیست. برای همیشه حذف شود؟',
              phrase: 'حذف',
            });
            if (!ok) return;
            try {
              if (isMulti) await liesService.bulk(targetIds, 'hardDelete');
              else await liesService.hardDelete(lie.id);
              removeItems(targetIds);
              toast.success('حذف شد.');
              ctx.onRefresh?.();
            } catch (err) {
              toast.error(err.message);
            }
          },
        }
      : null,
  ].filter(Boolean);

  return items;
}

/* ══════════════════════════════════════════════════════════
   Tag picker
   ══════════════════════════════════════════════════════════ */

/**
 * Open a modal for choosing tags for a lie.
 * @param {any} lie
 * @param {() => void} [onDone]
 */
export async function openTagPicker(lie, onDone) {
  const state = liesStore.getState();
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');
  const { chipSelector } = await import('../../ui/chips.js');

  const current = new Set((lie.tags || []).map((t) => t.id));
  const body = el('div', { class: 'picker-body' });

  const selector = chipSelector({
    items: state.tags.map((t) => ({ id: t.id, label: t.name, color: t.color })),
    selectedIds: [...current],
    placeholder: 'افزودن برچسب…',
    creatable: true,
    onCreate: async (name) => {
      const tag = await tagsService.create({ name });
      // Add to local store so it appears next time
      state.tags.push(tag);
      return { id: tag.id, label: tag.name, color: tag.color };
    },
  });
  body.appendChild(selector);

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: ['ذخیره'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: 'برچسب‌ها',
    icon: '🏷️',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    const ids = selector._chipSelector?.getSelected?.() || [];
    try {
      await tagsService.setForLie(lie.id, ids);
      modal.close();
      toast.success('برچسب‌ها به‌روزرسانی شد.');
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'خطا در ذخیره');
    }
  });
}

/* ══════════════════════════════════════════════════════════
   Category picker
   ══════════════════════════════════════════════════════════ */

/**
 * Open a modal for choosing the category of a lie.
 * @param {any} lie
 * @param {() => void} [onDone]
 */
export async function openCategoryPicker(lie, onDone) {
  const state = liesStore.getState();
  const { openModal, MODAL_SIZES } = await import('../../ui/modal.js');

  const body = el('div', { class: 'picker-body' });
  const list = el('div', { class: 'picker-list' });

  let selected = lie.categoryId || null;

  // "No category" option
  const noneBtn = el('button', {
    class: ['picker-item', !lie.categoryId ? 'is-active' : ''].filter(Boolean),
    attrs: { type: 'button' },
  }, { children: ['— بدون دسته —'] });
  noneBtn.addEventListener('click', () => {
    selected = null;
    list.querySelectorAll('.picker-item').forEach((n) => n.classList.remove('is-active'));
    noneBtn.classList.add('is-active');
  });
  list.appendChild(noneBtn);

  // Existing categories
  for (const c of state.categories) {
    const item = el('button', {
      class: ['picker-item', lie.categoryId === c.id ? 'is-active' : ''].filter(Boolean),
      attrs: { type: 'button' },
    });
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

  const saveBtn = el('button', { class: 'btn btn--primary' }, { children: ['ذخیره'] });
  const cancelBtn = el('button', { class: 'btn btn--ghost' }, { children: ['لغو'] });
  const foot = el('div', { class: 'confirm-foot' }, { children: [cancelBtn, saveBtn] });

  const modal = openModal({
    title: 'انتخاب دسته',
    icon: '📁',
    size: MODAL_SIZES.SM,
    content: body,
    footer: foot,
  });

  cancelBtn.addEventListener('click', () => modal.close());
  saveBtn.addEventListener('click', async () => {
    try {
      await liesService.update(lie.id, { categoryId: selected });
      modal.close();
      toast.success('دسته به‌روزرسانی شد.');
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'خطا در ذخیره');
    }
  });
}

export default { buildLieContextMenu, openTagPicker, openCategoryPicker };