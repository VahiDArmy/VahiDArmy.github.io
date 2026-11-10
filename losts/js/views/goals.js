import { state } from '../state.js';
import { navigate } from '../router.js';
import { CATEGORIES, GOAL_PERIODS, getCategory } from '../config.js';
import { esc, faDigits, fmtCompactMoney, fmtDurationShort, formatPersianDate, todayISO, addDaysISO, sumBy, clamp } from '../utils.js';
import { emptyState, openModal, toast, confirmDialog, confetti } from '../ui.js';
import { createGoal, updateGoal, deleteGoal } from '../db.js';

export function render(container) {
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status === 'done');

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">هدف‌های شادی</div>
        <div class="page-subtitle">${faDigits(active.length)} هدف فعال · ${faDigits(done.length)} انجام‌شده</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="new-goal-btn">➕ هدف جدید</button>
      </div>
    </div>

    ${active.length ? `<div class="grid grid-auto stagger">${active.map((g) => goalCard(g, goals)).join('')}</div>` : `<div class="card">${emptyState({ emoji: '🎯', title: 'هنوز هدفی نساختی', desc: 'اهدافی برای شادی و خودمراقبتی بساز تا پیشرفتت را ببینی.', actionLabel: 'ساخت هدف', actionView: '' })}</div>`}

    ${done.length ? `
      <div style="margin-top:2rem">
        <h3 style="margin-bottom:1rem;font-size:1.15rem;font-weight:800">✅ انجام‌شده</h3>
        <div class="grid grid-auto stagger">
          ${done.map((g) => goalCard(g, goals)).join('')}
        </div>
      </div>
    ` : ''}
  `;

  container.querySelector('#new-goal-btn')?.addEventListener('click', () => openGoalEditor(null, container));
  container.querySelectorAll('[data-goal-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const goal = goals.find((g) => g.id === el.dataset.goalId);
      if (goal) openGoalEditor(goal, container);
    });
  });
  container.querySelectorAll('[data-goal-progress]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const goalId = btn.dataset.goalProgress;
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      await incrementGoal(goal);
    });
  });
  container.querySelectorAll('[data-goal-complete]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const goalId = btn.dataset.goalComplete;
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      try {
        const updated = await updateGoal(goal.id, { status: 'done' });
        state.goals = state.goals.map((g) => (g.id === updated.id ? updated : g));
        confetti(60);
        toast('هدف تکمیل شد! 🎉', 'success');
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
  container.querySelectorAll('[data-goal-delete]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const goalId = btn.dataset.goalDelete;
      const ok = await confirmDialog({ title: 'حذف هدف', message: 'این هدف حذف شود؟', confirmText: 'حذف', danger: true });
      if (!ok) return;
      try {
        await deleteGoal(goalId);
        state.goals = state.goals.filter((g) => g.id !== goalId);
        toast('هدف حذف شد', 'success');
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
}

function goalCard(goal, allGoals) {
  const pct = goal.target_value > 0 ? clamp((goal.current_value / goal.target_value) * 100, 0, 100) : 0;
  const cat = goal.category ? getCategory(goal.category) : null;
  const unit = goal.target_type === 'money' ? (state.settings?.currency || 'تومان') : goal.target_type === 'time' ? 'دقیقه' : 'عدد';
  const isComplete = goal.status === 'done' || pct >= 100;
  const periodLabel = GOAL_PERIODS.find((p) => p.id === goal.period)?.label || '';

  return `
    <div class="goal-card ${isComplete ? 'goal-complete' : ''}" data-goal-id="${esc(goal.id)}" style="cursor:pointer">
      <div class="goal-head">
        <div style="flex:1;min-width:0">
          <div class="goal-title">${cat ? esc(cat.emoji) + ' ' : ''}${esc(goal.title)}</div>
          <div class="goal-meta">${esc(periodLabel)}${goal.deadline ? ' · تا ' + esc(formatPersianDate(goal.deadline, { month: 'long', day: 'numeric' })) : ''}</div>
        </div>
        <button type="button" class="icon-btn-sm" data-goal-delete="${esc(goal.id)}" title="حذف">✕</button>
      </div>
      <div>
        <div class="goal-progress-text">
          <span>${formatProgress(goal, unit)}</span>
          <span class="goal-progress-value">${faDigits(Math.round(pct))}٪</span>
        </div>
        <div class="progress">
          <div class="progress-fill" style="width:${pct}%;${isComplete ? 'background:linear-gradient(90deg,var(--emerald-400),var(--emerald-600))' : ''}"></div>
        </div>
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap">
        ${!isComplete ? `<button type="button" class="btn btn-secondary btn-sm" data-goal-progress="${esc(goal.id)}">➕ پیشرفت</button>` : ''}
        ${!isComplete ? `<button type="button" class="btn btn-ghost btn-sm" data-goal-complete="${esc(goal.id)}">✓ تکمیل</button>` : `<span class="badge badge-emerald">✅ انجام شد</span>`}
      </div>
    </div>
  `;
}

function formatProgress(goal, unit) {
  const cur = Number(goal.current_value) || 0;
  const target = Number(goal.target_value) || 0;
  if (goal.target_type === 'money') return `${esc(fmtCompactMoney(cur))} از ${esc(fmtCompactMoney(target))}`;
  if (goal.target_type === 'time') return `${esc(fmtDurationShort(cur))} از ${esc(fmtDurationShort(target))}`;
  return `${faDigits(cur)} از ${faDigits(target)} ${esc(unit)}`;
}

async function incrementGoal(goal) {
  const step = goal.target_type === 'money' ? 50000 : goal.target_type === 'time' ? 15 : 1;
  const current = Number(goal.current_value) || 0;
  const target = Number(goal.target_value) || 1;
  const next = Math.min(target, current + step);
  try {
    const updated = await updateGoal(goal.id, { current_value: next });
    state.goals = state.goals.map((g) => (g.id === updated.id ? updated : g));
    if (next >= target) {
      confetti(70);
      toast('🎉 به هدف رسیدی!', 'success');
    } else {
      toast('پیشرفت ثبت شد', 'success', 1500);
    }
    const container = document.getElementById('view-goals');
    if (container) render(container);
  } catch (err) {
    toast(err.message || 'خطا', 'error');
  }
}

function openGoalEditor(goal, container) {
  const isEdit = !!goal;
  const model = goal || {
    title: '',
    description: '',
    target_type: 'count',
    target_value: 7,
    current_value: 0,
    period: 'week',
    category: '',
    deadline: '',
    status: 'active',
  };

  const body = `
    <div class="field">
      <label for="goal-title">عنوان هدف</label>
      <input type="text" class="input" id="goal-title" value="${esc(model.title)}" placeholder="مثلاً: هر هفته ۳ شادی" maxlength="100" required>
    </div>
    <div class="field">
      <label for="goal-desc">توضیح (اختیاری)</label>
      <textarea class="textarea" id="goal-desc" placeholder="چرا این هدف برایت مهم است؟">${esc(model.description || '')}</textarea>
    </div>
    <div class="add-row" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="field">
        <label for="goal-type">نوع هدف</label>
        <select class="select" id="goal-type">
          <option value="count" ${model.target_type === 'count' ? 'selected' : ''}>تعداد</option>
          <option value="money" ${model.target_type === 'money' ? 'selected' : ''}>هزینه</option>
          <option value="time" ${model.target_type === 'time' ? 'selected' : ''}>زمان</option>
          <option value="score" ${model.target_type === 'score' ? 'selected' : ''}>امتیاز</option>
        </select>
      </div>
      <div class="field">
        <label for="goal-period">بازه</label>
        <select class="select" id="goal-period">
          ${GOAL_PERIODS.map((p) => `<option value="${esc(p.id)}" ${model.period === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="add-row" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="field">
        <label for="goal-target">مقدار هدف</label>
        <input type="number" class="input" id="goal-target" min="0" step="1" value="${model.target_value || 1}" inputmode="numeric">
      </div>
      <div class="field">
        <label for="goal-current">پیشرفت فعلی</label>
        <input type="number" class="input" id="goal-current" min="0" step="1" value="${model.current_value || 0}" inputmode="numeric">
      </div>
    </div>
    <div class="add-row" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="field">
        <label for="goal-category">دسته (اختیاری)</label>
        <select class="select" id="goal-category">
          <option value="">—</option>
          ${CATEGORIES.map((c) => `<option value="${esc(c.id)}" ${model.category === c.id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="goal-deadline">مهلت (اختیاری)</label>
        <input type="date" class="input" id="goal-deadline" value="${esc(model.deadline || '')}">
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-ghost" data-close>انصراف</button>
    <button type="button" class="btn btn-primary" data-save>${isEdit ? 'ذخیره' : 'ساخت هدف'}</button>
  `;

  openModal({
    title: isEdit ? 'ویرایش هدف' : 'هدف جدید',
    body,
    footer,
    onMount: (m) => {
      m.footer.querySelector('[data-close]').addEventListener('click', () => m.close());
      m.footer.querySelector('[data-save]').addEventListener('click', async () => {
        const payload = {
          title: m.el.querySelector('#goal-title').value.trim(),
          description: m.el.querySelector('#goal-desc').value.trim() || null,
          target_type: m.el.querySelector('#goal-type').value,
          target_value: Math.max(0, Number(m.el.querySelector('#goal-target').value) || 0),
          current_value: Math.max(0, Number(m.el.querySelector('#goal-current').value) || 0),
          period: m.el.querySelector('#goal-period').value,
          category: m.el.querySelector('#goal-category').value || null,
          deadline: m.el.querySelector('#goal-deadline').value || null,
        };
        if (!payload.title) { toast('عنوان هدف لازم است', 'warning'); return; }
        if (payload.target_value <= 0) { toast('مقدار هدف باید بیشتر از صفر باشد', 'warning'); return; }
        const btn = m.footer.querySelector('[data-save]');
        btn.disabled = true;
        try {
          if (isEdit) {
            const updated = await updateGoal(goal.id, payload);
            state.goals = state.goals.map((g) => (g.id === updated.id ? updated : g));
            toast('هدف به‌روز شد', 'success');
          } else {
            const created = await createGoal(payload);
            state.goals = [created, ...state.goals];
            toast('هدف ساخته شد', 'success');
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
