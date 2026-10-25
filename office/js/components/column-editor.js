/**
 * Column create/edit modal.
 * Uses the shared createColumnProperties component.
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { createColumnProperties } from './column-properties.js';

export function openColumnEditor({ column = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!column;

    const nameInput = el('input', {
      type: 'text',
      class: 'input',
      value: column?.name || '',
      placeholder: 'مثلاً: نام پروژه',
      maxlength: 80,
    });

    const propForm = createColumnProperties({
      initialType: column?.type || 'text',
      initialRequired: column?.required || false,
      initialChoices: column?.options?.choices || [],
    });

    const form = el('form', { class: 'column-editor-form' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['نام ستون ', el('span', { class: 'required' }, ['*'])]),
        nameInput,
      ]),
      propForm.node,
    ]);

    const submitBtn = el(
      'button',
      { 
        type: 'button', 
        class: 'btn btn--primary',
        on: { click: () => form.requestSubmit() }
      },
      [isEdit ? 'ذخیره' : 'افزودن ستون']
    );

    const cancelBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        on: { click: () => { handle.close(); resolve(null); } },
      },
      ['انصراف']
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const errors = validate({ name }, {
        name: [rules.required('نام ستون الزامی است'), rules.maxLength(80)],
      });
      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }
      
      const values = {
        name,
        ...propForm.getValue()
      };
      
      submitBtn.classList.add('is-loading');
      handle.close();
      resolve(values);
    });

    const handle = openModal({
      title: isEdit ? 'ویرایش ستون' : 'افزودن ستون',
      subtitle: isEdit ? null : 'نوع داده و گزینه‌های ستون را مشخص کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: nameInput,
      onClose: () => resolve(null),
    });
  });
}

export default openColumnEditor;