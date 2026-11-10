import { state } from '../state.js';
import { navigate } from '../router.js';
import { CATEGORIES, PRIORITIES, getCategory } from '../config.js';
import { esc, faDigits, fmtCompactMoney, fmtMoney } from '../utils.js';
import { emptyState, openModal, toast, confirmDialog, confetti } from '../ui.js';
import { createWish, updateWish, deleteWish } from '../db.js';

let filter = 'all';

export function render(container) {
  const wishes = Array.isArray(state.wishes) ? state.wishes : [];
  const active = wishes.filter((w) => !w.is_done);
  const done = wishes.filter((w) => w.is_done);
  const totalCost = active.reduce((acc, w) => acc + Number(w.estimated_cost || 0), 0);

  const visible = filter === 'all' ? active : active.filter((w) => w.priority === filter);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">آرزوهای من</div>
        <div class="page-subtitle">${faDigits(active.length)} آرزو · ${esc(fmtCompactMoney(totalCost))} تخمین هزینه</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="new-wish-btn">➕ آرزوی جدید</button>
      </div>
    </div>

    <div class="journal-filters">
      <button type="button" class="chip ${filter === 'all' ? 'active' : ''}" data-filter="all">همه</button>
      ${PRIORITIES.map((p) => `<button type="button" class="chip ${filter === p.id ? 'active' : ''}" data-filter="${esc(p.id)}"><span class="wish-priority priority-${esc(p.id)}"></span> ${esc(p.label)}</button>`).join('')}
    </div>

    <div class="journal-list stagger">
      ${visible.length ? visible.map((w) => wishItem(w)).join('') : emptyState({ emoji: '🎁', title: 'آرزویی با این فیلتر نیست', desc: 'یک آرزوی جدید برای خودت ثبت کن.', actionLabel: 'آرزوی جدید', actionView: '' })}
    </div>

    ${done.length ? `
      <div style="margin-top:2rem">
        <h3 style="margin-bottom:1rem;font-size:1.15rem;font-weight:800">✅ خریداری‌شده</h3>
        <div class="journal-list stagger">
          ${done.map((w) => wishItem(w)).join('')}
        </div>
      </div>
    ` : ''}
  `;

  container.querySelector('#new-wish-btn')?.addEventListener('click', () => openWishEditor(null, container));
  container.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      render(container);
    });
  });
  container.querySelectorAll('[data-wish-check]').forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = el.dataset.wishCheck;
      const wish = wishes.find((w) => w.id === id);
      if (!wish) return;
      try {
        const updated = await updateWish(wish.id, { is_done: !wish.is_done });
        state.wishes = state.wishes.map((w) => (w.id === updated.id ? updated : w));
        if (updated.is_done) { confetti(50); toast('آرزو محقق شد! 🎉', 'success'); }
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
  container.querySelectorAll('[data-wish-delete]').forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.stopPropagation();
      const ok = await confirmDialog({ title: 'حذف آرزو', message: 'این آرزو حذف شود؟', confirmText: 'حذف', danger: true });
      if (!ok) return;
      try {
        await deleteWish(el.dataset.wishDelete);
        state.wishes = state.wishes.filter((w) => w.id !== el.dataset.wishDelete);
        toast('آرزو حذف شد', 'success');
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
  container.querySelectorAll('[data-wish-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const wish = wishes.find((w) => w.id === el.dataset.wishId);
      if (wish) openWishEditor(wish, container);
    });
  });
}

function wishItem(w) {
  const cat = getCategory(w.category);
  const priority = PRIORITIES.find((p) => p.id === (w.priority || 'medium')) || PRIORITIES[1];
  return `
    <div class="wish-item ${w.is_done ? 'done' : ''}" data-wish-id="${esc(w.id)}" style="cursor:pointer">
      <div class="wish-check" data-wish-check="${esc(w.id)}" role="button" aria-label="تغییر وضعیت">✓</div>
      <div class="wish-body">
        <div class="wish-title">${esc(cat.emoji)} ${esc(w.title)}</div>
        <div class="wish-meta">
          <span><span class="wish-priority priority-${esc(priority.id)}" style="display:inline-block;margin-left:.25rem"></span>${esc(priority.label)}</span>
          ${w.estimated_cost > 0 ? `<span>💰 ${esc(fmtMoney(w.estimated_cost))}</span>` : '<span>🎁 رایگان</span>'}
          <span>${esc(cat.label)}</span>
        </div>
      </div>
      <button type="button" class="icon-btn-sm" data-wish-delete="${esc(w.id)}" title="حذف">✕</button>
    </div>
  `;
}

function openWishEditor(wish, container) {
  const isEdit = !!wish;
  const model = wish || { title: '', description: '', estimated_cost: 0, priority: 'medium', url: '', category: 'other' };

  const body = `
    <div class="field">
      <label for="wish-title">چه آرزویی داری؟</label>
      <input type="text" class="input" id="wish-title" value="${esc(model.title)}" placeholder="مثلاً: یک کتاب جدید" maxlength="100" required>
    </div>
    <div class="field">
      <label for="wish-desc">توضیح (اختیاری)</label>
      <textarea class="textarea" id="wish-desc" placeholder="جزئیات...">${esc(model.description || '')}</textarea>
    </div>
    <div class="add-row" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="field">
        <label for="wish-cost">هزینهٔ تخمینی</label>
        <input type="number" class="input" id="wish-cost" min="0" step="1000" value="${model.estimated_cost || 0}" inputmode="numeric">
      </div>
      <div class="field">
        <label for="wish-priority">اولویت</label>
        <select class="select" id="wish-priority">
          ${PRIORITIES.map((p) => `<option value="${esc(p.id)}" ${model.priority === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field">
      <label for="wish-category">دسته</label>
      <select class="select" id="wish-category">
        ${CATEGORIES.map((c) => `<option value="${esc(c.id)}" ${model.category === c.id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.label)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="wish-url">لینک (اختیاری)</label>
      <input type="url" class="input" id="wish-url" value="${esc(model.url || '')}" placeholder="https://...">
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-ghost" data-close>انصراف</button>
    <button type="button" class="btn btn-primary" data-save>${isEdit ? 'ذخیره' : 'افزودن'}</button>
  `;

  openModal({
    title: isEdit ? 'ویرایش آرزو' : 'آرزوی جدید',
    body,
    footer,
    onMount: (m) => {
      m.footer.querySelector('[data-close]').addEventListener('click', () => m.close());
      m.footer.querySelector('[data-save]').addEventListener('click', async () => {
        const payload = {
          title: m.el.querySelector('#wish-title').value.trim(),
          description: m.el.querySelector('#wish-desc').value.trim() || null,
          estimated_cost: Math.max(0, Number(m.el.querySelector('#wish-cost').value) || 0),
          priority: m.el.querySelector('#wish-priority').value,
          category: m.el.querySelector('#wish-category').value,
          url: m.el.querySelector('#wish-url').value.trim() || null,
        };
        if (!payload.title) { toast('عنوان لازم است', 'warning'); return; }
        const btn = m.footer.querySelector('[data-save]');
        btn.disabled = true;
        try {
          if (isEdit) {
            const updated = await updateWish(wish.id, payload);
            state.wishes = state.wishes.map((w) => (w.id === updated.id ? updated : w));
            toast('آرزو به‌روز شد', 'success');
          } else {
            const created = await createWish(payload);
            state.wishes = [created, ...state.wishes];
            toast('آرزو اضافه شد', 'success');
          }
          m.close();
          render(container);
        } catch (err) {
          toast(err.message || 'خطا', 'error');
          btn.disabled = false;
        }
      });
    },
  });
}
