import { openModal, confirmDialog, toast } from '../ui.js';
import { getCategory, JOY_SCORE_LABELS, MOOD_MAP, getKarma } from '../config.js';
import {
  esc, faDigits, fmtMoney, fmtDuration, formatPersianDate, formatClock,
} from '../utils.js';
import { deleteEntry, toggleEntryFavorite } from '../db.js';
import { rerender } from '../router.js';

export function openEntryDetail(entry) {
  const cat = getCategory(entry.category);
  const moodBefore = MOOD_MAP[entry.mood_before];
  const moodAfter = MOOD_MAP[entry.mood_after];
  const karma = getKarma(entry.karma_score || 0);

  const body = `
    <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.25rem;padding:1rem;background:var(--bg-muted);border-radius:var(--radius-md)">
      <div style="width:62px;height:62px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--bg-card-solid);border-radius:var(--radius-md);box-shadow:var(--shadow-sm)">${esc(entry.emoji || '✨')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:1.05rem;line-height:1.3">${esc(entry.title)}</div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-top:.35rem;display:flex;gap:.6rem;flex-wrap:wrap">
          <span>${esc(cat.emoji)} ${esc(cat.label)}</span>
          <span>·</span>
          <span>${esc(formatPersianDate(entry.entry_date, { year: 'numeric', month: 'long', day: 'numeric' }))}</span>
          ${entry.entry_time ? `<span>·</span><span>${esc(formatClock(entry.entry_time))}</span>` : ''}
        </div>
      </div>
    </div>

    ${entry.description ? `<p style="line-height:1.85;margin-bottom:1.25rem;color:var(--text-secondary);font-size:.92rem">${esc(entry.description)}</p>` : ''}

    <div class="detail-row">
      <span class="detail-label">کارما</span>
      <span class="detail-value" style="color:${karma.color}">${esc(karma.icon)} ${esc(karma.label)}</span>
    </div>
    <div class="detail-row"><span class="detail-label">سطح شادی</span><span class="detail-value">${esc(JOY_SCORE_LABELS[entry.joy_score] || entry.joy_score)} (${faDigits(entry.joy_score)}/${faDigits(10)})</span></div>
    <div class="detail-row"><span class="detail-label">هزینه</span><span class="detail-value">${entry.money_spent > 0 ? esc(fmtMoney(entry.money_spent)) : 'رایگان'}</span></div>
    <div class="detail-row"><span class="detail-label">زمان</span><span class="detail-value">${entry.time_spent_minutes > 0 ? esc(fmtDuration(entry.time_spent_minutes)) : '—'}</span></div>
    ${moodBefore ? `<div class="detail-row"><span class="detail-label">حال قبل</span><span class="detail-value">${esc(moodBefore.emoji)} ${esc(moodBefore.label)}</span></div>` : ''}
    ${moodAfter ? `<div class="detail-row"><span class="detail-label">حال بعد</span><span class="detail-value">${esc(moodAfter.emoji)} ${esc(moodAfter.label)}</span></div>` : ''}
    ${entry.location ? `<div class="detail-row"><span class="detail-label">مکان</span><span class="detail-value">${esc(entry.location)}</span></div>` : ''}
    ${entry.with_people ? `<div class="detail-row"><span class="detail-label">همراه با</span><span class="detail-value">${esc(entry.with_people)}</span></div>` : ''}
    ${entry.tags?.length ? `<div class="detail-row"><span class="detail-label">برچسب‌ها</span><span class="detail-value">${entry.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(' ')}</span></div>` : ''}
  `;

  const footer = `
    <button type="button" class="btn btn-ghost" data-action="favorite">${entry.is_favorite ? '⭐ حذف از موردعلاقه' : '☆ موردعلاقه'}</button>
    <button type="button" class="btn btn-danger btn-sm" data-action="delete">حذف</button>
    <button type="button" class="btn btn-primary" data-action="close">بستن</button>
  `;

  openModal({
    title: 'جزئیات شادی',
    body,
    footer,
    size: 'lg',
    onMount: (m) => {
      m.footer.querySelector('[data-action="close"]')?.addEventListener('click', () => m.close());
      m.footer.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'حذف شادی',
          message: 'این شادی برای همیشه پاک می‌شود. مطمئنی؟',
          confirmText: 'حذف کن',
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteEntry(entry.id);
          toast('شادی حذف شد', 'success');
          m.close();
          rerender();
        } catch (err) {
          toast(err.message || 'خطا در حذف', 'error');
        }
      });
      m.footer.querySelector('[data-action="favorite"]')?.addEventListener('click', async () => {
        try {
          await toggleEntryFavorite(entry.id, !entry.is_favorite);
          toast(entry.is_favorite ? 'از موردعلاقه حذف شد' : 'به موردعلاقه اضافه شد', 'success');
          m.close();
          rerender();
        } catch (err) {
          toast(err.message || 'خطا', 'error');
        }
      });
    },
  });
}
