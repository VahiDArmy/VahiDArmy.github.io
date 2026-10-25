/**
 * Shared Column Properties Form
 * Renders the inputs for a column's data type, required status, and options.
 */

import { el, icon } from '../utils/dom.js';
import { COLUMN_TYPE_LABELS } from '../config/constants.js';

export function createColumnProperties({ initialType = 'text', initialRequired = false, initialChoices = [] } = {}) {
  const typeSelect = el('select', { class: 'select' },
    Object.entries(COLUMN_TYPE_LABELS).map(([k, label]) =>
      el('option', { value: k, selected: k === initialType }, [label])
    )
  );

  const requiredCheck = el('input', { type: 'checkbox', checked: initialRequired });
  const optionsWrap = el('div', { class: 'form-field', hidden: true });
  let choices = [...initialChoices];

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
        const input = el('input', {
          type: 'text',
          class: 'input',
          value: choice,
          placeholder: `گزینه ${idx + 1}`,
          on: { input: (e) => { choices[idx] = e.target.value; } },
        });
        const removeBtn = el(
          'button',
          {
            type: 'button',
            class: 'btn btn--ghost btn--icon btn--sm',
            style: { color: 'var(--danger-500)' },
            on: {
              click: () => {
                choices.splice(idx, 1);
                redraw();
              },
            },
          },
          [icon('x')]
        );
        editor.appendChild(el('div', { class: 'form-row', style: { alignItems: 'center', marginBottom: '6px' } }, [input, removeBtn]));
      });

      const addBtn = el(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          style: { alignSelf: 'flex-start' },
          on: {
            click: () => {
              choices.push('');
              redraw();
            },
          },
        },
        [icon('plus'), 'افزودن گزینه']
      );
      editor.appendChild(addBtn);
    }

    redraw();
    optionsWrap.appendChild(editor);
  }

  typeSelect.addEventListener('change', renderOptions);
  renderOptions();

  const node = el('div', { class: 'form-grid' }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['نوع داده']),
      typeSelect,
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'checkbox' }, [
        requiredCheck,
        el('span', { class: 'checkbox__box' }),
        el('span', {}, ['الزامی']),
      ]),
    ]),
    optionsWrap,
  ]);

  return {
    node,
    getValue: () => ({
      type: typeSelect.value,
      required: requiredCheck.checked,
      options: ['select', 'multi_select'].includes(typeSelect.value)
        ? { choices: choices.filter(Boolean) }
        : {},
    }),
  };
}