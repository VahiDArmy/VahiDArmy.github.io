/**
 * Reusable delete-flow helper.
 *
 *   await confirmAndDelete({
 *     title: 'حذف فرد',
 *     message: (item) => `آیا «${item.full_name}» حذف شود؟`,
 *     item,
 *     onConfirm: () => peopleService.remove(item.id),
 *     successMessage: 'فرد حذف شد.',
 *     onDeleted: () => reload(),
 *   });
 */

import { confirm } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

export async function confirmAndDelete({
  title = 'حذف',
  message = 'آیا از حذف این مورد مطمئن هستید؟',
  item,
  onConfirm,
  successMessage = 'با موفقیت حذف شد.',
  errorMessage = 'حذف ناموفق بود.',
  onDeleted,
} = {}) {
  const text = typeof message === 'function' ? message(item) : message;

  const ok = await confirm({
    title,
    message: text,
    confirmLabel: 'حذف',
    cancelLabel: 'انصراف',
    variant: 'danger',
  });
  if (!ok) return false;

  try {
    await onConfirm?.();
    toast.success(successMessage);
    onDeleted?.();
    return true;
  } catch (err) {
    toast.error(err?.message || errorMessage);
    return false;
  }
}

export default confirmAndDelete;