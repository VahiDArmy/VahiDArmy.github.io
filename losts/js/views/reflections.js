import { state } from '../state.js';
import { navigate } from '../router.js';
import { MOODS, MOOD_MAP } from '../config.js';
import {
  esc, faDigits, formatPersianDate, todayISO, relativeTime, pickPrompt,
} from '../utils.js';
import { emptyState, openModal, toast, confirmDialog } from '../ui.js';
import { createReflection, updateReflection, deleteReflection } from '../db.js';

export function render(container) {
  const reflections = Array.isArray(state.reflections) ? state.reflections : [];
  const todayHas = reflections.some((r) => r.entry_date === todayISO());
  const prompt = pickPrompt(new Date().getDate() + 3);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">تأمل‌های شب</div>
        <div class="page-subtitle">${faDigits(reflections.length)} یادداشت ثبت‌شده</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" id="new-reflection-btn">${todayHas ? '➕ یادداشت جدید' : '🌙 تأمل امشب'}</button>
      </div>
    </div>

    <div class="prompt-card anim-fade-up" style="margin-bottom:1.5rem">
      <div class="prompt-label">✨ سؤال امشب</div>
      <div class="prompt-text">${esc(prompt)}</div>
      <div class="prompt-actions">
        <button type="button" class="btn btn-sm" id="reflect-prompt-btn">می‌نویسم</button>
      </div>
    </div>

    <div class="stagger">
      ${reflections.length ? reflections.map((r) => reflectionCard(r)).join('') : `<div class="card">${emptyState({ emoji: '🌙', title: 'هنوز تأملی ننوشتی', desc: 'هر شب چند دقیقه با خودت خلوت کن و احساست را بنویس.' })}</div>`}
    </div>
  `;

  container.querySelector('#new-reflection-btn')?.addEventListener('click', () => openReflectionEditor(null, container));
  container.querySelector('#reflect-prompt-btn')?.addEventListener('click', () => openReflectionEditor(null, container, prompt));
  container.querySelectorAll('[data-reflect-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const ref = reflections.find((r) => r.id === el.dataset.reflectId);
      if (ref) openReflectionEditor(ref, container);
    });
  });
  container.querySelectorAll('[data-reflect-delete]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const ok = await confirmDialog({ title: 'حذف تأمل', message: 'این یادداشت حذف شود؟', confirmText: 'حذف', danger: true });
      if (!ok) return;
      try {
        await deleteReflection(btn.dataset.reflectDelete);
        state.reflections = state.reflections.filter((r) => r.id !== btn.dataset.reflectDelete);
        toast('حذف شد', 'success');
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
}

function reflectionCard(r) {
  const mood = MOOD_MAP[r.mood] || MOOD_MAP.neutral;
  const gratitude = Array.isArray(r.gratitude) ? r.gratitude : [];
  return `
    <div class="reflection-card" data-reflect-id="${esc(r.id)}" style="cursor:pointer">
      <div class="reflection-date">
        <span>🗓️ ${esc(formatPersianDate(r.entry_date))}</span>
        <span>·</span>
        <span>${esc(relativeTime(r.created_at))}</span>
        <span style="flex:1"></span>
        <button type="button" class="icon-btn-sm" data-reflect-delete="${esc(r.id)}" title="حذف">✕</button>
      </div>
      <div class="reflection-content">${esc(r.content)}</div>
      ${gratitude.length ? `<div class="tag-cloud" style="margin-top:.75rem">${gratitude.map((g) => `<span class="tag-item">🙏 ${esc(g)}</span>`).join('')}</div>` : ''}
      <span class="reflection-mood">${esc(mood.emoji)} ${esc(mood.label)}</span>
    </div>
  `;
}

function openReflectionEditor(reflection, container, presetContent) {
  const isEdit = !!reflection;
  const model = reflection || {
    entry_date: todayISO(),
    mood: 'neutral',
    content: presetContent || '',
    gratitude: [],
  };
  const gratitude = Array.isArray(model.gratitude) ? [...model.gratitude] : [];

  const body = `
    <div class="field">
      <label for="reflect-date">تاریخ</label>
      <input type="date" class="input" id="reflect-date" value="${esc(model.entry_date)}">
    </div>
    <div class="field">
      <label>حال امروزت چطور بود؟</label>
      <div class="emoji-picker" id="mood-picker">
        ${MOODS.map((m) => `<button type="button" class="emoji-btn ${m.id === model.mood ? 'active' : ''}" data-mood="${esc(m.id)}" title="${esc(m.label)}">${esc(m.emoji)}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label for="reflect-content">تأملت</label>
      <textarea class="textarea" id="reflect-content" rows="7" placeholder="امروز چه چیزی یاد گرفتی؟ چه احساسی داشتی؟">${esc(model.content)}</textarea>
    </div>
    <div class="field">
      <label for="gratitude-input">چیزهایی که امروز بابتشان شکرگزاری (Enter)</label>
      <div class="tag-input" id="gratitude-wrap">
        ${gratitude.map((g) => `<span class="tag-pill">🙏 ${esc(g)}<button type="button" data-remove-grat="${esc(g)}">✕</button></span>`).join('')}
        <input type="text" id="gratitude-input" placeholder="مثلاً: سلامتی" maxlength="40">
      </div>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-ghost" data-close>انصراف</button>
    <button type="button" class="btn btn-primary" data-save>${isEdit ? 'ذخیره' : 'ثبت تأمل'}</button>
  `;

  openModal({
    title: isEdit ? 'ویرایش تأمل' : 'تأمل امشب',
    body,
    footer,
    size: 'lg',
    onMount: (m) => {
      let mood = model.mood;
      m.el.querySelectorAll('[data-mood]').forEach((btn) => {
        btn.addEventListener('click', () => {
          mood = btn.dataset.mood;
          m.el.querySelectorAll('[data-mood]').forEach((b) => b.classList.toggle('active', b.dataset.mood === mood));
        });
      });

      const gratInput = m.el.querySelector('#gratitude-input');
      const gratWrap = m.el.querySelector('#gratitude-wrap');
      const refresh = () => {
        gratWrap.querySelectorAll('.tag-pill').forEach((p) => p.remove());
        const frag = document.createDocumentFragment();
        gratitude.forEach((g) => {
          const span = document.createElement('span');
          span.className = 'tag-pill';
          span.innerHTML = `🙏 ${esc(g)}<button type="button" data-remove-grat="${esc(g)}">✕</button>`;
          frag.appendChild(span);
        });
        gratWrap.insertBefore(frag, gratInput);
      };
      gratInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = gratInput.value.trim();
          if (!value) return;
          if (gratitude.includes(value)) { gratInput.value = ''; return; }
          if (gratitude.length >= 10) { toast('حداکثر ۱۰ مورد', 'warning'); return; }
          gratitude.push(value);
          gratInput.value = '';
          refresh();
        }
      });
      gratWrap?.addEventListener('click', (event) => {
        const rm = event.target.closest('[data-remove-grat]');
        if (rm) {
          const val = rm.dataset.removeGrat;
          const idx = gratitude.indexOf(val);
          if (idx >= 0) gratitude.splice(idx, 1);
          refresh();
        }
      });

      m.footer.querySelector('[data-close]').addEventListener('click', () => m.close());
      m.footer.querySelector('[data-save]').addEventListener('click', async () => {
        const content = m.el.querySelector('#reflect-content').value.trim();
        if (!content) { toast('متن تأمل را بنویس', 'warning'); return; }
        const payload = {
          entry_date: m.el.querySelector('#reflect-date').value || todayISO(),
          mood,
          content,
          gratitude: gratitude.slice(),
        };
        const btn = m.footer.querySelector('[data-save]');
        btn.disabled = true;
        try {
          if (isEdit) {
            const updated = await updateReflection(reflection.id, payload);
            state.reflections = state.reflections.map((r) => (r.id === updated.id ? updated : r));
            toast('تأمل به‌روز شد', 'success');
          } else {
            const created = await createReflection(payload);
            state.reflections = [created, ...state.reflections];
            toast('تأمل ثبت شد 🌙', 'success');
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
