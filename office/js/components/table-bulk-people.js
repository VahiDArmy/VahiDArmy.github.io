/**
 * Bulk Add People to Table
 * Allows selecting all or specific people and adding them as rows or columns.
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { peopleService } from '../services/people.service.js';
import { createTagInput } from './tag-input.js';
import { COLUMN_TYPES, COLUMN_TYPE_LABELS } from '../config/constants.js';

export function openBulkPeopleForm({ hasColumns = false, columns = [] } = {}) {
  return new Promise(async (resolve) => {
    let peopleList = [];
    try {
      const res = await peopleService.list({ limit: 1000, sort: 'full_name', direction: 'asc' });
      peopleList = res.items;
    } catch (err) {
      toast.error('خطا در دریافت لیست افراد.');
      return resolve(null);
    }

    if (!peopleList.length) {
      toast.warning('هیچ فردی در سیستم ثبت نشده است.');
      return resolve(null);
    }

    // --- UI Elements ---
    let mode = 'columns'; // default

    const radioCol = el('input', { type: 'radio', name: 'bulk_mode', value: 'columns', checked: true });
    const radioRow = el('input', { type: 'radio', name: 'bulk_mode', value: 'rows', disabled: !hasColumns });

    const colOptions = el('div', { class: 'form-field', style: { marginTop: '12px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' } }, [
      el('label', { class: 'form-label' }, ['نوع داده برای ستون‌های جدید']),
      el('select', { class: 'select' },
        Object.entries(COLUMN_TYPE_LABELS)
          .filter(([k]) => [COLUMN_TYPES.TEXT, COLUMN_TYPES.NUMBER, COLUMN_TYPES.SELECT].includes(k))
          .map(([k, v]) => el('option', { value: k, selected: k === COLUMN_TYPES.NUMBER }, [v]))
      ),
      el('p', { class: 'form-help' }, ['اگر قصد ثبت امتیاز دارید، «عدد» را انتخاب کنید.'])
    ]);

    // Find best column for row names
    const personRefCol = columns.find(c => c.type === COLUMN_TYPES.PERSON_REF);
    const textCol = columns.find(c => c.type === COLUMN_TYPES.TEXT);
    const bestRowColId = personRefCol ? personRefCol.id : (textCol ? textCol.id : (columns[0]?.id || ''));

    const rowOptions = el('div', { class: 'form-field', style: { display: 'none', marginTop: '12px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' } }, [
      el('label', { class: 'form-label' }, ['نام افراد در کدام ستون ثبت شود؟']),
      el('select', { class: 'select' },
        columns.map(c => el('option', { value: c.id, selected: c.id === bestRowColId }, [c.name + (c.type === COLUMN_TYPES.PERSON_REF ? ' (ارجاع به فرد)' : '')]))
      ),
      el('p', { class: 'form-help' }, ['نام فرد در این ستون قرار می‌گیرد.'])
    ]);

    // If no columns exist yet, we must create one
    const noColumnsMsg = el('div', { class: 'form-help', style: { color: 'var(--warning-700)', display: hasColumns ? 'none' : 'block', marginTop: '8px' } }, [
      'برای افزودن به عنوان ردیف، ابتدا باید حداقل یک ستون بسازید.'
    ]);

    radioCol.addEventListener('change', () => {
      if (radioCol.checked) {
        mode = 'columns';
        colOptions.style.display = 'block';
        rowOptions.style.display = 'none';
      }
    });
    radioRow.addEventListener('change', () => {
      if (radioRow.checked) {
        mode = 'rows';
        colOptions.style.display = 'none';
        rowOptions.style.display = 'block';
      }
    });

    // Tagger for manual selection
    const tagger = createTagInput({ 
      people: peopleList, 
      placeholder: 'نام افراد را جستجو و انتخاب کنید...' 
    });

    // Select All Toggle
    const selectAllCheckbox = el('input', { type: 'checkbox' });
    const selectAllToggle = el('label', { class: 'switch switch--label-start', style: { marginBottom: '12px' } }, [
      selectAllCheckbox,
      el('span', { class: 'switch__track' }, [el('span', { class: 'switch__thumb' })]),
      el('span', { style: { fontWeight: 'bold' } }, ['انتخاب همه افراد سیستم'])
    ]);
    
    const taggerWrapper = el('div', {}, [tagger.node]);

    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        taggerWrapper.style.opacity = '0.5';
        taggerWrapper.style.pointerEvents = 'none';
      } else {
        taggerWrapper.style.opacity = '1';
        taggerWrapper.style.pointerEvents = 'auto';
      }
    });

    // --- Form Layout ---
    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['حالت افزودن']),
        el('div', { style: { display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' } }, [
          el('label', { class: 'radio' }, [
            radioCol, el('span', { class: 'radio__box' }),
            el('span', {}, ['به عنوان ستون'])
          ]),
          el('label', { class: 'radio' }, [
            radioRow, el('span', { class: 'radio__box' }),
            el('span', { style: hasColumns ? {} : { opacity: 0.5 } }, ['به عنوان ردیف'])
          ])
        ]),
        noColumnsMsg,
        colOptions,
        rowOptions
      ]),
      el('div', { class: 'form-field', style: { borderTop: '1px solid var(--border-default)', paddingTop: '16px' } }, [
        el('label', { class: 'form-label' }, ['انتخاب افراد']),
        selectAllToggle,
        taggerWrapper
      ]),
    ]);

    const submitBtn = el(
      'button',
      { 
        type: 'button', 
        class: 'btn btn--primary',
        on: { click: () => form.requestSubmit() }
      },
      ['افزودن به جدول']
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
      
      let targetPeople = [];
      if (selectAllCheckbox.checked) {
        targetPeople = peopleList;
      } else {
        const ids = tagger.getValue();
        if (!ids.length) {
          toast.warning('حداقل یک فرد را انتخاب کنید (یا گزینه «انتخاب همه» را بزنید).');
          return;
        }
        targetPeople = ids.map(id => peopleList.find(p => p.id === id)).filter(Boolean);
      }
      
      const result = {
        mode,
        people: targetPeople,
        colType: mode === 'columns' ? colOptions.querySelector('select').value : null,
        rowTargetColId: mode === 'rows' ? rowOptions.querySelector('select').value : null
      };
      
      handle.close();
      resolve(result);
    });

    const handle = openModal({
      title: 'افزودن افراد به جدول',
      subtitle: 'می‌توانید همه افراد یا تعدادی از آن‌ها را همزمان اضافه کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
    });
  });
}

export default openBulkPeopleForm;