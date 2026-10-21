/**
 * Column create/edit modal for dynamic tables.
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { COLUMN_TYPES, COLUMN_TYPE_LABELS } from '../config/constants.js';

export function openColumnEditor({ column = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!column;

    const nameInput = el('input', { type: 'text', class: 'input', value: column?.name || '', placeholder: 'مثلاً: نام پروژه', maxlength: 80 });
    const typeSelect = el('select', { class: 'select' }, Object.entries(COLUMN_TYPE_LABELS).map(([k, label]) => el('option', { value: k, selected: k === (column?.type || 'text') }, [label])));
    const requiredCheck = el('input', { type: 'checkbox', checked: !!column?.required });
    const optionsWrap = el('div', { class: 'form-field', hidden: true });
    let choices = Array.isArray(column?.options?.choices) ? [...column.options.choices] : [];

    function renderOptions() {
      optionsWrap.innerHTML = '';
      if (!['select', 'multi_select'].includes(typeSelect.value)) {
        optionsWrap.hidden = true;
        return;
      }
      optionsWrap.hidden = false;
      optionsWrap.appendChild(el('label', { class: 'form-label' }, ['گزینه‌ها']));
      const editor = el('div', { class: 'options-editor' });

      function redraw() {
        editor.innerHTML = '';
        choices.forEach((choice, idx) => {
          const input = el('input', { type: 'text', class: 'input', value: choice, placeholder: `گزینه ${idx + 1}`, on: { input: (e) => { choices[idx] = e.target.value; } } });
          const removeBtn = el('button', { type: 'button', 'aria-label': 'حذف گزینه', on: { click: () => { choices.splice(idx, 1); redraw(); } } }, [icon('x')]);
          editor.appendChild(el('div', { class: 'options-editor__row' }, [input, removeBtn]));
        });
        const addBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', style: { alignSelf: 'flex-start' }, on: { click: () => { choices.push(''); redraw(); } } }, [icon('plus'), 'افزودن گزینه']);
        editor.appendChild(addBtn);
      }

      redraw();
      optionsWrap.appendChild(editor);
      optionsWrap.appendChild(el('p', { class: 'form-help' }, ['هر گزینه در یک خط — قابل ویرایش پس از ذخیره.']));
    }

    typeSelect.addEventListener('change', renderOptions);
    renderOptions();

    const form = el('form', { class: 'column-editor-form' }, [
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['نام ستون ', el('span', { class: 'required' }, ['*'])]), nameInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['نوع داده']), typeSelect]),
      el('div', { class: 'form-field' }, [el('label', { class: 'checkbox' }, [requiredCheck, el('span', { class: 'checkbox__box' }), el('span', {}, ['الزامی'])])]),
      optionsWrap,
    ]);

    const submitBtn = el('button', { 
      type: 'button', 
      class: 'btn btn--primary',
      on: { click: () => form.requestSubmit() }
    }, [isEdit ? 'ذخیره' : 'افزودن ستون']);

    const cancelBtn = el('button', { 
      type: 'button', 
      class: 'btn btn--secondary', 
      on: { click: () => { handle.close(); resolve(null); } } 
    }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const errors = validate({ name }, { name: [rules.required('نام ستون الزامی است'), rules.maxLength(80)] });
      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }
      const values = {
        name,
        type: typeSelect.value,
        required: requiredCheck.checked,
        options: ['select', 'multi_select'].includes(typeSelect.value) ? { choices: choices.filter(Boolean) } : {},
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