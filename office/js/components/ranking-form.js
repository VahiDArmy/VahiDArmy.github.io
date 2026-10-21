/**
 * Create / edit ranking modal.
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { slugify } from '../utils/format.js';

export function openRankingForm({ ranking = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!ranking;

    const titleInput = el('input', { type: 'text', class: 'input', placeholder: 'مثلاً: بهترین همکار سال', value: ranking?.title || '', maxlength: 120 });
    const criteriaInput = el('input', { type: 'text', class: 'input', placeholder: 'مثلاً: خلاقیت، همکاری، تعهد', value: ranking?.criteria || '', maxlength: 200 });
    const descInput = el('textarea', { class: 'textarea', rows: 3, placeholder: 'توضیح کوتاه درباره معیارها و هدف این رتبه‌بندی...', maxlength: 500 });
    descInput.value = ranking?.description || '';
    const slugInput = el('input', { type: 'text', class: 'input', dir: 'ltr', placeholder: 'auto-generated', value: ranking?.slug || '' });

    titleInput.addEventListener('input', () => {
      if (!slugInput.value || slugInput.value === slugify(ranking?.title || '')) {
        slugInput.placeholder = slugify(titleInput.value) || 'auto-generated';
      }
    });

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['عنوان ', el('span', { class: 'required' }, ['*'])]), titleInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['معیار']), criteriaInput, el('p', { class: 'form-help' }, ['مثلاً «خلاقیت، همکاری، تعهد»'])]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['توضیحات']), descInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['شناسه (slug)']), slugInput, el('p', { class: 'form-help' }, ['آدرس‌پذیر — فقط حروف، عدد و خط تیره.'])]),
    ]);

    const submitBtn = el('button', { 
      type: 'button', 
      class: 'btn btn--primary',
      on: { click: () => form.requestSubmit() }
    }, [isEdit ? 'ذخیره تغییرات' : 'ایجاد']);

    const cancelBtn = el('button', { 
      type: 'button', 
      class: 'btn btn--secondary', 
      on: { click: () => { handle.close(); resolve(null); } } 
    }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {
        title: titleInput.value.trim(),
        criteria: criteriaInput.value.trim(),
        description: descInput.value.trim(),
        slug: slugInput.value.trim() || slugify(titleInput.value),
      };
      const errors = validate(values, {
        title: [rules.required('عنوان الزامی است'), rules.maxLength(120)],
        criteria: [rules.maxLength(200)],
        description: [rules.maxLength(500)],
      });
      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }
      submitBtn.classList.add('is-loading');
      handle.close();
      resolve(values);
    });

    const handle = openModal({
      title: isEdit ? 'ویرایش رتبه‌بندی' : 'رتبه‌بندی جدید',
      subtitle: isEdit ? null : 'معیارها و هدف این فهرست را مشخص کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: titleInput,
      onClose: () => resolve(null),
    });
  });
}

export default openRankingForm;