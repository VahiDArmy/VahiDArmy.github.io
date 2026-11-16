/* ============================================================
   Bulk edit — change rating of multiple purchases at once
   ============================================================ */
import { el, formatNumber } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { notify } from './toast.js';
import { sb, Tables } from '../supabase.js';
import { store } from '../state.js';
import { refreshPurchases } from '../api.js';

export function openBulkEditModal({ ids } = {}) {
  if (!ids || !ids.length) return;

  let selectedRating = null;

  const ratingWrap = el('div', { class: 'rating-selector' });
  const opts = [
    { key: 'good', icon: '✓', label: 'خوب',    desc: 'خرید موفق',  cls: 'good' },
    { key: 'bad',  icon: '~', label: 'بد',     desc: 'نچندان خوب', cls: 'bad'  },
    { key: 'shit', icon: '✕', label: 'افتضاح', desc: 'پشیمان شدم', cls: 'shit' },
  ];

  function render() {
    ratingWrap.innerHTML = '';
    for (const o of opts) {
      const b = el('button', {
        type: 'button',
        class: `rating-selector__opt rating-selector__opt--${o.cls}${selectedRating === o.key ? ' is-active' : ''}`,
      }, [
        el('span', { class: 'rating-selector__icon', text: o.icon }),
        el('span', { class: 'rating-selector__label', text: o.label }),
        el('span', { class: 'rating-selector__desc', text: o.desc }),
      ]);
      b.addEventListener('click', () => { selectedRating = o.key; render(); });
      ratingWrap.appendChild(b);
    }
  }
  render();

  const body = el('div', { class: 'bulk-edit-body' }, [
    el('div', { class: 'bulk-edit-summary' }, [
      el('span', { class: 'bulk-edit-summary__num', text: formatNumber(ids.length) }),
      el('span', { class: 'bulk-edit-summary__label', text: 'خرید انتخاب شده' }),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: 'امتیاز جدید' }),
      ratingWrap,
    ]),
  ]);

  const saveBtn = el('button', {
    type: 'button', class: 'btn btn--primary btn--lg', text: 'اعمال تغییرات',
  });
  const cancelBtn = el('button', {
    type: 'button', class: 'btn btn--ghost btn--lg', text: 'انصراف',
  });

  const { close } = mountModal({
    title: 'ویرایش امتیاز گروهی',
    subtitle: 'امتیاز همهٔ خریدهای انتخاب‌شده تغییر می‌کند',
    size: 'md',
    body,
    footer: [cancelBtn, saveBtn],
  });

  cancelBtn.addEventListener('click', () => close());

  saveBtn.addEventListener('click', async () => {
    if (!selectedRating) {
      notify.error('یک امتیاز انتخاب کن');
      return;
    }
    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;
    try {
      const { error } = await sb
        .from(Tables.purchases)
        .update({ rating: selectedRating })
        .in('id', ids);
      if (error) throw error;

      // Update local state
      const idSet = new Set(ids);
      store.purchases.set(
        store.purchases.get().map((p) =>
          idSet.has(p.id) ? { ...p, rating: selectedRating } : p
        )
      );
      notify.success(`${formatNumber(ids.length)} خرید به‌روزرسانی شد`);
      close();
      // notify parent via custom event
      window.dispatchEvent(new CustomEvent('smyar:bulk-edited', { detail: { ids, rating: selectedRating } }));
    } catch (err) {
      notify.error(err?.message || 'خطا در اعمال تغییرات');
      saveBtn.classList.remove('is-loading');
      saveBtn.disabled = false;
    }
  });
}
