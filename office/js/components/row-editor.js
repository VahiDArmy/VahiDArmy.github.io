/**
 * Row create/edit modal.
 * Accepts `disabledCols` to enforce cell-level read-only state.
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { COLUMN_TYPES } from '../config/constants.js';

function renderField(col, value, allValues, { people = [], disabledCols = [] } = {}) {
  const id = `col-${col.id}`;
  const isDisabled = disabledCols.includes(col.id);
  
  const label = el('label', { class: 'form-label', for: id, style: isDisabled ? { opacity: 0.6 } : {} }, [
    col.name, 
    col.required ? el('span', { class: 'required' }, ['*']) : null,
    isDisabled ? el('span', { class: 'badge badge--outline', style: { marginRight: '8px', fontSize: '10px' } }, ['فقط خواندنی']) : null
  ]);

  let input;
  switch (col.type) {
    case COLUMN_TYPES.NUMBER:
      input = el('input', { type: 'number', class: 'input', id, dir: 'ltr', value: value != null ? String(value) : '', step: 'any', disabled: isDisabled });
      break;
    case COLUMN_TYPES.DATE:
      input = el('input', { type: 'date', class: 'input', id, dir: 'ltr', value: value || '', disabled: isDisabled });
      break;
    case COLUMN_TYPES.CHECKBOX:
      input = el('label', { class: 'checkbox', style: isDisabled ? { opacity: 0.6 } : {} }, [
        el('input', { type: 'checkbox', id, checked: !!value, disabled: isDisabled }), 
        el('span', { class: 'checkbox__box' }), 
        el('span', {}, ['بله'])
      ]);
      break;
    case COLUMN_TYPES.LONG_TEXT:
      input = el('textarea', { class: 'textarea', id, rows: 4, placeholder: '', disabled: isDisabled });
      input.value = value || '';
      break;
    case COLUMN_TYPES.URL:
      input = el('input', { type: 'url', class: 'input', id, dir: 'ltr', value: value || '', placeholder: 'https://...', disabled: isDisabled });
      break;
    case COLUMN_TYPES.SELECT: {
      const choices = col.options?.choices || [];
      input = el('select', { class: 'select', id, disabled: isDisabled }, [
        el('option', { value: '' }, ['— انتخاب نشده —']), 
        ...choices.map((c) => el('option', { value: c, selected: c === value }, [c]))
      ]);
      break;
    }
    case COLUMN_TYPES.MULTI_SELECT: {
      const choices = col.options?.choices || [];
      const selectedSet = new Set(Array.isArray(value) ? value : []);
      input = el('div', { class: 'options-editor', id, style: isDisabled ? { opacity: 0.6, pointerEvents: 'none' } : {} }, 
        choices.map((c) => el('label', { class: 'checkbox' }, [
          el('input', { type: 'checkbox', value: c, checked: selectedSet.has(c), dataset: { multiSelect: col.id }, disabled: isDisabled }), 
          el('span', { class: 'checkbox__box' }), 
          el('span', {}, [c])
        ]))
      );
      break;
    }
    case COLUMN_TYPES.PERSON_REF: {
      input = el('select', { class: 'select', id, disabled: isDisabled }, [
        el('option', { value: '' }, ['— انتخاب نشده —']), 
        ...people.map((p) => el('option', { value: p.id, selected: p.id === value }, [p.full_name || 'بدون نام']))
      ]);
      break;
    }
    case COLUMN_TYPES.TEXT:
    default:
      input = el('input', { type: 'text', class: 'input', id, value: value || '', maxlength: 500, disabled: isDisabled });
      break;
  }

  return el('div', { class: 'form-field' }, [label, input]);
}

export function openRowEditor({ columns, values = {}, people = [], tablePermissionType = 'public', isOwnerDetermining = false, disabledCols = [] } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!values && Object.keys(values).length > 0;
    const fields = columns.map((col) => renderField(col, values[col.id], values, { people, disabledCols }));
    
    const ownerCheck = el('input', { type: 'checkbox', checked: isOwnerDetermining });
    const ownerWrap = el('div', { class: 'form-field', style: { display: tablePermissionType === 'private_row' && !disabledCols.includes('owner') ? 'block' : 'none', marginTop: '12px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' } }, [
      el('label', { class: 'checkbox' }, [
        ownerCheck,
        el('span', { class: 'checkbox__box' }),
        el('span', { style: { fontWeight: 'bold' } }, ['این ردیف تعیین‌کننده مالک ستون است'])
      ]),
      el('p', { class: 'form-help' }, ['در حالت مالکیت خصوصی، هر ستون متعلق به شخصی است که نامش در این ردیف نوشته شده است.'])
    ]);

    const form = el('form', { class: 'row-editor-form' }, [...fields, ownerWrap]);

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary', on: { click: () => form.requestSubmit() } }, [isEdit ? 'ذخیره' : 'افزودن ردیف']);
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => { handle.close(); resolve(null); } } }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};

      for (const col of columns) {
        // Skip disabled columns as they haven't been modified
        if (disabledCols.includes(col.id)) {
          out[col.id] = values[col.id];
          continue;
        }
        
        const id = `col-${col.id}`;
        const node = form.querySelector(`#${CSS.escape(id)}`);
        if (!node) continue;

        let value;
        switch (col.type) {
          case COLUMN_TYPES.NUMBER: value = node.value === '' ? null : Number(node.value); break;
          case COLUMN_TYPES.CHECKBOX:
            const cb = node.querySelector('input[type="checkbox"]');
            value = cb ? cb.checked : false;
            break;
          case COLUMN_TYPES.MULTI_SELECT: value = Array.from(node.querySelectorAll(`input[data-multi-select="${col.id}"]:checked`)).map((n) => n.value); break;
          case COLUMN_TYPES.LONG_TEXT: value = node.value.trim(); break;
          default: value = node.value != null ? String(node.value).trim() : '';
        }

        if (col.required && (value === '' || value == null || (Array.isArray(value) && !value.length))) {
          toast.error(`«${col.name}» الزامی است.`);
          node.focus?.();
          return;
        }
        out[col.id] = value;
      }

      submitBtn.classList.add('is-loading');
      handle.close();
      resolve({ values: out, isOwnerDetermining: ownerCheck.checked });
    });

    const handle = openModal({
      title: isEdit ? 'ویرایش ردیف' : 'افزودن ردیف',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'lg',
      onClose: () => resolve(null),
    });
  });
}

export default openRowEditor;