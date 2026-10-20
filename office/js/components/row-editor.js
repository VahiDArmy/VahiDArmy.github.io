/**
 * Row create/edit modal — renders inputs for every column type.
 *
 *   const result = await openRowEditor({ columns, values, people });
 *   // returns { [columnId]: value } or null
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { COLUMN_TYPES } from '../config/constants.js';
import { toFaDigits } from '../utils/format.js';

function renderField(col, value, allValues, { people = [] } = {}) {
  const id = `col-${col.id}`;
  const label = el(
    'label',
    { class: 'form-label', for: id },
    [col.name, col.required ? el('span', { class: 'required' }, ['*']) : null]
  );

  let input;
  switch (col.type) {
    case COLUMN_TYPES.NUMBER:
      input = el('input', {
        type: 'number',
        class: 'input',
        id,
        dir: 'ltr',
        value: value != null ? String(value) : '',
        step: 'any',
      });
      break;

    case COLUMN_TYPES.DATE:
      input = el('input', {
        type: 'date',
        class: 'input',
        id,
        dir: 'ltr',
        value: value || '',
      });
      break;

    case COLUMN_TYPES.CHECKBOX:
      input = el(
        'label',
        { class: 'checkbox' },
        [
          el('input', { type: 'checkbox', id, checked: !!value }),
          el('span', { class: 'checkbox__box' }),
          el('span', {}, ['بله']),
        ]
      );
      break;

    case COLUMN_TYPES.LONG_TEXT:
      input = el('textarea', {
        class: 'textarea',
        id,
        rows: 4,
        placeholder: '',
      });
      input.value = value || '';
      break;

    case COLUMN_TYPES.URL:
      input = el('input', {
        type: 'url',
        class: 'input',
        id,
        dir: 'ltr',
        value: value || '',
        placeholder: 'https://...',
      });
      break;

    case COLUMN_TYPES.SELECT: {
      const choices = col.options?.choices || [];
      input = el(
        'select',
        { class: 'select', id },
        [
          el('option', { value: '' }, ['— انتخاب نشده —']),
          ...choices.map((c) =>
            el('option', { value: c, selected: c === value }, [c])
          ),
        ]
      );
      break;
    }

    case COLUMN_TYPES.MULTI_SELECT: {
      const choices = col.options?.choices || [];
      const selectedSet = new Set(Array.isArray(value) ? value : []);
      input = el(
        'div',
        { class: 'options-editor', id },
        choices.map((c) =>
          el(
            'label',
            { class: 'checkbox' },
            [
              el('input', {
                type: 'checkbox',
                value: c,
                checked: selectedSet.has(c),
                dataset: { multiSelect: col.id },
              }),
              el('span', { class: 'checkbox__box' }),
              el('span', {}, [c]),
            ]
          )
        )
      );
      break;
    }

    case COLUMN_TYPES.PERSON_REF: {
      input = el(
        'select',
        { class: 'select', id },
        [
          el('option', { value: '' }, ['— انتخاب نشده —']),
          ...people.map((p) =>
            el('option', { value: p.id, selected: p.id === value }, [p.full_name || 'بدون نام'])
          ),
        ]
      );
      break;
    }

    case COLUMN_TYPES.TEXT:
    default:
      input = el('input', {
        type: 'text',
        class: 'input',
        id,
        value: value || '',
        maxlength: 500,
      });
      break;
  }

  return el('div', { class: 'form-field' }, [label, input]);
}

export function openRowEditor({ columns, values = {}, people = [] } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!values && Object.keys(values).length > 0;

    const fields = columns.map((col) =>
      renderField(col, values[col.id], values, { people })
    );

    const submitBtn = el(
      'button',
      { type: 'submit', class: 'btn btn--primary' },
      [isEdit ? 'ذخیره' : 'افزودن ردیف']
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

    const form = el('form', { class: 'row-editor-form' }, fields);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};

      for (const col of columns) {
        const id = `col-${col.id}`;
        const node = form.querySelector(`#${CSS.escape(id)}`);
        if (!node) continue;

        let value;
        switch (col.type) {
          case COLUMN_TYPES.NUMBER: {
            const num = node.value === '' ? null : Number(node.value);
            value = num;
            break;
          }
          case COLUMN_TYPES.CHECKBOX: {
            const cb = node.querySelector('input[type="checkbox"]');
            value = cb ? cb.checked : false;
            break;
          }
          case COLUMN_TYPES.MULTI_SELECT: {
            const checked = Array.from(
              node.querySelectorAll(`input[data-multi-select="${col.id}"]:checked`)
            ).map((n) => n.value);
            value = checked;
            break;
          }
          case COLUMN_TYPES.LONG_TEXT:
            value = node.value.trim();
            break;
          default:
            value = node.value != null ? String(node.value).trim() : '';
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
      resolve(out);
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