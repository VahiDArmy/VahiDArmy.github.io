/* ============================================================
   js/features/lie-detail/reflections.js
   Reflection timeline for a single lie (create/edit/delete)
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import * as reflectionsService from '../../services/reflections.service.js';
import { MOODS } from '../../config/app.config.js';
import { formatRelative, toFaDigits } from '../../utils/format.js';
import { toast } from '../../ui/toast.js';
import { confirm } from '../../ui/confirm.js';

/**
 * @param {string} lieId
 * @param {{
 *   reflections: any[],
 *   onCreated?: (r:any)=>void,
 *   onDeleted?: (id:string)=>void,
 *   onUpdated?: (r:any)=>void,
 * }} opts
 * @returns {HTMLElement}
 */
export function reflectionsPanel(lieId, opts = {}) {
  const { reflections = [], onCreated, onDeleted, onUpdated } = opts;

  const wrap = el('section', { class: 'reflections' });

  /* Head */
  const head = el('div', { class: 'reflections__head' });
  head.appendChild(el('h3', { class: 'reflections__title' }, {
    children: [
      el('span', { class: 'reflections__title-icon' }, { children: ['💭'] }),
      'بازتاب‌ها',
    ],
  }));
  head.appendChild(el('span', { class: 'reflections__count' }, { children: [toFaDigits(reflections.length) + ' مورد'] }));
  wrap.appendChild(head);

  /* Composer */
  const composer = el('div', { class: 'reflections__composer' });

  const textarea = el('textarea', {
    class: 'textarea reflections__input',
    attrs: {
      placeholder: 'چه چیزی در این لحظه به ذهنت می‌رسد؟ می‌توانی این دروغ را به چالش بکشی یا چیزی را که یاد گرفتی بنویسی…',
      rows: 3,
      maxlength: '4000',
    },
  });
  composer.appendChild(textarea);

  const composerFoot = el('div', { class: 'reflections__composer-foot' });

  const moodSelect = el('select', { class: 'select select--sm', attrs: { title: 'حال فعلی' } });
  moodSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['— حال —'] }));
  for (const m of MOODS) {
    moodSelect.appendChild(el('option', { attrs: { value: m.id } }, { children: [`${m.icon} ${m.label}`] }));
  }
  composerFoot.appendChild(moodSelect);

  const counter = el('span', { class: 'char-counter' }, { children: ['۰ / ۴۰۰۰'] });
  composerFoot.appendChild(counter);

  const submitBtn = el('button', {
    class: 'btn btn--primary btn--sm',
    attrs: { type: 'button' },
  }, { children: ['ثبت بازتاب'] });
  composerFoot.appendChild(submitBtn);

  composer.appendChild(composerFoot);
  wrap.appendChild(composer);

  /* List */
  const list = el('div', { class: 'reflections__list' });

  const render = () => {
    clear(list);
    if (!reflections.length) {
      list.appendChild(el('div', { class: 'reflections__empty' }, {
        children: ['هنوز بازتابی ثبت نشده. هر چه این دروغ را عمیق‌تر ببینی، رهایی از آن آسان‌تر است.'],
      }));
      return;
    }
    for (const r of reflections) list.appendChild(reflectionItem(r));
  };

  const reflectionItem = (r) => {
    const mood = r.mood ? MOODS.find((m) => m.id === r.mood) : null;
    const item = el('article', { class: 'reflection', dataset: { id: r.id } });

    const meta = el('div', { class: 'reflection__meta' });
    if (mood) {
      meta.appendChild(el('span', { class: 'reflection__mood', title: mood.label }, { children: [mood.icon] }));
    }
    meta.appendChild(el('span', { class: 'reflection__date' }, {
      children: [formatRelative(r.createdAt)],
      attrs: { title: r.createdAt },
    }));
    item.appendChild(meta);

    const body = el('p', { class: 'reflection__body' }, { children: [r.body] });
    item.appendChild(body);

    const actions = el('div', { class: 'reflection__actions' });
    const delBtn = el('button', {
      class: 'btn btn--ghost btn--xs',
      attrs: { type: 'button', title: 'حذف' },
    }, { children: ['🗑️ حذف'] });
    delBtn.addEventListener('click', async () => {
      const ok = await confirm({
        title: 'حذف بازتاب',
        message: 'این بازتاب حذف شود؟',
        confirmLabel: 'حذف',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        await reflectionsService.remove(r.id);
        const idx = reflections.findIndex((x) => x.id === r.id);
        if (idx >= 0) reflections.splice(idx, 1);
        render();
        onDeleted?.(r.id);
        toast.success('بازتاب حذف شد.');
      } catch (err) { toast.error(err.message); }
    });
    actions.appendChild(delBtn);
    item.appendChild(actions);

    return item;
  };

  /* Actions */
  textarea.addEventListener('input', () => {
    const n = textarea.value.length;
    counter.textContent = `${toFaDigits(n)} / ${toFaDigits(4000)}`;
    counter.classList.toggle('is-warning', n > 3200);
  });

  submitBtn.addEventListener('click', async () => {
    const body = textarea.value.trim();
    if (!body) { textarea.focus(); return; }
    submitBtn.disabled = true;
    try {
      const created = await reflectionsService.create(lieId, {
        body,
        mood: moodSelect.value || null,
      });
      reflections.unshift(created);
      textarea.value = '';
      counter.textContent = `۰ / ${toFaDigits(4000)}`;
      moodSelect.value = '';
      render();
      onCreated?.(created);
      toast.success('بازتاب ثبت شد.');
    } catch (err) {
      toast.error(err.message || 'خطا در ثبت');
    } finally {
      submitBtn.disabled = false;
    }
  });

  render();
  wrap.appendChild(list);

  return wrap;
}

export default { reflectionsPanel };