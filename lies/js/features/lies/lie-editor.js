/* ============================================================
   js/features/lies/lie-editor.js
   UPDATED: Added dynamic description and example hints below
            the Type and Mood selects.
   ============================================================ */

import { el } from '../../utils/dom.js';
import { openModal, MODAL_SIZES } from '../../ui/modal.js';
import { chipSelector } from '../../ui/chips.js';
import { toast } from '../../ui/toast.js';
import { setButtonLoading } from '../../ui/loader.js';
import { liesStore, prependItem, upsertItem } from './lies-store.js';
import * as liesService from '../../services/lies.service.js';
import * as tagsService from '../../services/tags.service.js';
import { LIMITS } from '../../config/app.config.js';
import { toFaDigits, charCount } from '../../utils/format.js';

export function openLieEditor(existing = null, opts = {}) {
  const isEdit = !!existing;
  const state = liesStore.getState();
  const types = state.lieTypes || [];
  const moods = state.moods || [];

  const form = el('form', { class: 'lie-editor' });

  /* ── Row: title ─────────────────────────────────────── */
  const titleField = el('div', { class: 'field' });
  titleField.appendChild(el('label', { class: 'field__label' }, { children: ['عنوان', el('span', { class: 'req' }, { children: ['*'] })] }));
  const titleInput = el('input', {
    class: 'input input--lg',
    attrs: { type: 'text', placeholder: 'مثلاً: «من به اندازهٔ کافی خوب نیستم»', maxlength: String(LIMITS.titleMax), required: 'true', autocomplete: 'off' },
  });
  titleInput.value = existing?.title || '';
  titleField.appendChild(titleInput);
  const titleCounter = el('span', { class: 'char-counter' }, { children: [toFaDigits(charCount(titleInput.value)) + ' / ' + toFaDigits(LIMITS.titleMax)] });
  titleField.appendChild(titleCounter);
  const titleError = el('p', { class: 'field__error' });
  titleField.appendChild(titleError);
  form.appendChild(titleField);

  /* ── Row: type + mood ───────────────────────────────── */
  const row1 = el('div', { class: 'lie-editor__row' });

  const typeField = el('div', { class: 'field' });
  typeField.appendChild(el('label', { class: 'field__label' }, { children: ['نوع'] }));
  const typeSelect = el('select', { class: 'select' });
  for (const t of types) {
    const opt = el('option', { attrs: { value: t.id } }, { children: [`${t.icon} ${t.label}`] });
    if ((existing?.type || types[0]?.id) === t.id) opt.selected = true;
    typeSelect.appendChild(opt);
  }
  typeField.appendChild(typeSelect);
  
  // 🛡️ Hint Box for Type
  const typeHint = el('div', { class: 'field__hint', style: { marginTop: '6px', lineHeight: '1.6', minHeight: '20px' } });
  typeField.appendChild(typeHint);
  
  const updateTypeHint = () => {
    const selected = types.find(t => t.id === typeSelect.value);
    typeHint.innerHTML = '';
    if (selected) {
      if (selected.description) typeHint.appendChild(el('div', {}, { children: [selected.description] }));
      if (selected.example) typeHint.appendChild(el('div', { style: { fontStyle: 'italic', marginTop: '4px', color: 'var(--text-quaternary)' } }, { children: [`مثال: «${selected.example}»`] }));
    }
  };
  typeSelect.addEventListener('change', updateTypeHint);
  updateTypeHint();

  row1.appendChild(typeField);

  const moodField = el('div', { class: 'field' });
  moodField.appendChild(el('label', { class: 'field__label' }, { children: ['حال و احساس'] }));
  const moodSelect = el('select', { class: 'select' });
  moodSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['— انتخاب کنید —'] }));
  for (const m of moods) {
    const opt = el('option', { attrs: { value: m.id } }, { children: [`${m.icon} ${m.label}`] });
    if (existing?.mood === m.id) opt.selected = true;
    moodSelect.appendChild(opt);
  }
  moodField.appendChild(moodSelect);

  // 🛡️ Hint Box for Mood
  const moodHint = el('div', { class: 'field__hint', style: { marginTop: '6px', lineHeight: '1.6', minHeight: '20px' } });
  moodField.appendChild(moodHint);

  const updateMoodHint = () => {
    const selected = moods.find(m => m.id === moodSelect.value);
    moodHint.innerHTML = '';
    if (selected && selected.description) {
      moodHint.appendChild(el('div', {}, { children: [selected.description] }));
    }
  };
  moodSelect.addEventListener('change', updateMoodHint);
  updateMoodHint();

  row1.appendChild(moodField);

  form.appendChild(row1);

  /* ── Row: category ──────────────────────────────────── */
  const catField = el('div', { class: 'field' });
  catField.appendChild(el('label', { class: 'field__label' }, { children: ['دسته‌بندی'] }));
  const catSelect = el('select', { class: 'select' });
  catSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['— بدون دسته —'] }));
  for (const c of state.categories) {
    const opt = el('option', { attrs: { value: c.id } }, { children: [`${c.icon || '📁'} ${c.name}`] });
    if (existing?.categoryId === c.id) opt.selected = true;
    catSelect.appendChild(opt);
  }
  catField.appendChild(catSelect);
  form.appendChild(catField);

  /* ── Row: body ──────────────────────────────────────── */
  const bodyField = el('div', { class: 'field' });
  bodyField.appendChild(el('label', { class: 'field__label' }, { children: ['متن دروغ'] }));
  const bodyInput = el('textarea', {
    class: 'textarea',
    attrs: { placeholder: 'وقتی این جمله را به خودت گفتی، در چه موقعیتی بودی؟', rows: 5, maxlength: String(LIMITS.bodyMax) },
  });
  bodyInput.value = existing?.body || '';
  bodyField.appendChild(bodyInput);
  const bodyCounter = el('span', { class: 'char-counter' }, { children: [toFaDigits(charCount(bodyInput.value)) + ' / ' + toFaDigits(LIMITS.bodyMax)] });
  bodyField.appendChild(bodyCounter);
  form.appendChild(bodyField);

  /* ── Row: truth ─────────────────────────────────────── */
  const truthField = el('div', { class: 'field lie-editor__truth' });
  truthField.appendChild(el('label', { class: 'field__label' }, { children: ['✦ حقیقت مقابل آن'] }));
  truthField.appendChild(el('p', { class: 'field__hint' }, { children: ['اگر می‌خواهی، جملهٔ راستینی که این دروغ پنهانش می‌کند را اینجا بنویس.'] }));
  const truthInput = el('textarea', {
    class: 'textarea textarea--truth',
    attrs: { placeholder: 'مثلاً: «من در حال تلاش هستم و همین کافی است.»', rows: 3, maxlength: String(LIMITS.truthMax) },
  });
  truthInput.value = existing?.truth || '';
  truthField.appendChild(truthInput);
  const truthCounter = el('span', { class: 'char-counter' }, { children: [toFaDigits(charCount(truthInput.value)) + ' / ' + toFaDigits(LIMITS.truthMax)] });
  truthField.appendChild(truthCounter);
  form.appendChild(truthField);

  /* ── Row: intensity + belief ───────────────────────── */
  const row2 = el('div', { class: 'lie-editor__row lie-editor__row--sliders' });

  row2.appendChild(sliderField({
    id: 'intensity',
    label: 'شدت احساس',
    description: 'چقدر این جمله در لحظه فشار می‌آورد؟',
    value: existing?.intensity ?? 5,
    icon: '⚡',
  }));
  row2.appendChild(sliderField({
    id: 'belief',
    label: 'میزان باور',
    description: 'چقدر به این جمله باور داشتی؟',
    value: existing?.belief ?? 5,
    icon: '◉',
  }));

  form.appendChild(row2);

  /* ── Row: tags ─────────────────────────────────────── */
  const tagsField = el('div', { class: 'field' });
  tagsField.appendChild(el('label', { class: 'field__label' }, { children: ['برچسب‌ها'] }));
  const tagSel = chipSelector({
    items: state.tags.map((t) => ({ id: t.id, label: t.name, color: t.color })),
    selectedIds: (existing?.tags || []).map((t) => t.id),
    placeholder: 'افزودن برچسب…',
    creatable: true,
    maxItems: LIMITS.maxTagsPerLie,
    onCreate: async (name) => {
      const tag = await tagsService.create({ name });
      state.tags.push(tag);
      return { id: tag.id, label: tag.name, color: tag.color };
    },
  });
  tagsField.appendChild(tagSel);
  form.appendChild(tagsField);

  /* ── Row: occurred at ──────────────────────────────── */
  const dateField = el('div', { class: 'field' });
  dateField.appendChild(el('label', { class: 'field__label' }, { children: ['تاریخ رخداد (اختیاری)'] }));
  const dateInput = el('input', { class: 'input', attrs: { type: 'date' } });
  if (existing?.occurredAt) dateInput.value = existing.occurredAt.slice(0, 10);
  dateField.appendChild(dateInput);
  form.appendChild(dateField);

  /* ── Actions ───────────────────────────────────────── */
  const saveBtn = el('button', {
    class: 'btn btn--primary btn--lg',
    attrs: { type: 'submit' },
  }, { children: [isEdit ? 'ذخیره تغییرات' : 'ثبت دروغ'] });

  const cancelBtn = el('button', {
    class: 'btn btn--ghost btn--lg',
    attrs: { type: 'button' },
  }, { children: ['انصراف'] });

  const foot = el('div', { class: 'lie-editor__foot' }, { children: [cancelBtn, saveBtn] });

  /* ── Modal ─────────────────────────────────────────── */
  const modal = openModal({
    title: isEdit ? 'ویرایش دروغ' : 'ثبت دروغ جدید',
    icon: isEdit ? '✎' : '🎭',
    size: MODAL_SIZES.LG,
    content: form,
    footer: foot,
    className: 'modal--editor',
  });

  cancelBtn.addEventListener('click', () => modal.close());

  /* ── Char counters ─────────────────────────────────── */
  const updateCounter = (input, counter, max) => () => {
    const n = charCount(input.value);
    counter.textContent = `${toFaDigits(n)} / ${toFaDigits(max)}`;
    counter.classList.toggle('is-warning', n > max * 0.8);
    counter.classList.toggle('is-danger', n >= max);
  };
  titleInput.addEventListener('input', updateCounter(titleInput, titleCounter, LIMITS.titleMax));
  bodyInput.addEventListener('input', updateCounter(bodyInput, bodyCounter, LIMITS.bodyMax));
  truthInput.addEventListener('input', updateCounter(truthInput, truthCounter, LIMITS.truthMax));

  /* ── Submit ────────────────────────────────────────── */
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    titleError.textContent = '';
    titleError.classList.remove('is-visible');
    titleField.classList.remove('has-error');

    const title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = 'عنوان الزامی است.';
      titleError.classList.add('is-visible');
      titleField.classList.add('has-error');
      titleInput.focus();
      return;
    }

    const payload = {
      title,
      body: bodyInput.value.trim(),
      truth: truthInput.value.trim(),
      type: typeSelect.value,
      mood: moodSelect.value || null,
      categoryId: catSelect.value || null,
      intensity: Number(form.querySelector('[data-slider="intensity"]')?.value || 5),
      belief: Number(form.querySelector('[data-slider="belief"]')?.value || 5),
      occurredAt: dateInput.value ? new Date(dateInput.value + 'T12:00:00').toISOString() : null,
    };
    const tagIds = tagSel._chipSelector.getSelected();

    setButtonLoading(saveBtn, true, 'در حال ذخیره…');
    try {
      let saved;
      if (isEdit) {
        saved = await liesService.update(existing.id, payload, { tagIds });
        upsertItem(saved);
      } else {
        saved = await liesService.create({ ...payload, tagIds });
        prependItem(saved);
      }
      toast.success(isEdit ? 'تغییرات ذخیره شد.' : 'ثبت شد ✨');
      modal.close();
      opts.onSaved?.(saved);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'خطا در ذخیره');
      setButtonLoading(saveBtn, false);
    }
  });

  requestAnimationFrame(() => {
    titleInput.focus();
    titleInput.select();
  });

  return modal;
}

function sliderField({ id, label, description, value, icon }) {
  const field = el('div', { class: 'field lie-editor__slider' });
  const head = el('div', { class: 'lie-editor__slider-head' });
  head.appendChild(el('span', { class: 'lie-editor__slider-icon' }, { children: [icon] }));
  const labelWrap = el('div', { style: { flex: '1', minWidth: '0' } });
  labelWrap.appendChild(el('span', { class: 'field__label', style: { margin: '0' } }, { children: [label] }));
  if (description) labelWrap.appendChild(el('p', { class: 'field__hint', style: { margin: '2px 0 0' } }, { children: [description] }));
  head.appendChild(labelWrap);
  const valueEl = el('span', { class: 'lie-editor__slider-value' }, { children: [toFaDigits(value)] });
  head.appendChild(valueEl);
  field.appendChild(head);

  const slider = el('input', {
    class: 'range',
    attrs: { type: 'range', min: '0', max: '10', step: '1', value: String(value) },
    dataset: { slider: id },
  });
  const ticks = el('div', { class: 'lie-editor__ticks' });
  for (let i = 0; i <= 10; i += 5) ticks.appendChild(el('span', {}, { children: [toFaDigits(i)] }));
  slider.addEventListener('input', () => { valueEl.textContent = toFaDigits(slider.value); });

  field.appendChild(slider);
  field.appendChild(ticks);

  return field;
}

export default { openLieEditor };