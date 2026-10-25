/**
 * Bulk Add People to Table
 * A modal to select multiple people and add them as rows or columns to a dynamic table.
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { peopleService } from '../services/people.service.js';
import { createTagInput } from './tag-input.js';

export function openBulkPeopleForm({ hasColumns = false } = {}) {
  return new Promise(async (resolve) => {
    let peopleList = [];
    try {
      const res = await peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' });
      peopleList = res.items;
    } catch (err) {
      toast.error('خطا در دریافت لیست افراد.');
      return resolve(null);
    }

    if (!peopleList.length) {
      toast.warning('هیچ فردی در سیستم ثبت نشده است.');
      return resolve(null);
    }

    const tagger = createTagInput({ 
      people: peopleList, 
      placeholder: 'نام افراد را جستجو و انتخاب کنید...' 
    });

    let mode = 'columns'; // default

    const radioCol = el('input', { type: 'radio', name: 'bulk_mode', value: 'columns', checked: true });
    const radioRow = el('input', { type: 'radio', name: 'bulk_mode', value: 'rows', disabled: !hasColumns });

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['حالت افزودن']),
        el('div', { style: { display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' } }, [
          el('label', { class: 'radio' }, [
            radioCol, el('span', { class: 'radio__box' }),
            el('span', {}, ['به عنوان ستون (نام افراد سرستون می‌شود)'])
          ]),
          el('label', { class: 'radio' }, [
            radioRow, el('span', { class: 'radio__box' }),
            el('span', { style: hasColumns ? {} : { opacity: 0.5 } }, ['به عنوان ردیف'])
          ])
        ]),
        !hasColumns ? el('p', { class: 'form-help' }, ['برای افزودن به عنوان ردیف، ابتدا باید حداقل یک ستون بسازید.']) : null
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['انتخاب افراد']),
        tagger.node,
      ]),
    ]);

    radioCol.addEventListener('change', () => { if (radioCol.checked) mode = 'columns'; });
    radioRow.addEventListener('change', () => { if (radioRow.checked) mode = 'rows'; });

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
      const selectedIds = tagger.getValue();
      if (!selectedIds.length) {
        toast.warning('حداقل یک فرد را انتخاب کنید.');
        return;
      }
      
      const selectedPeople = selectedIds.map(id => peopleList.find(p => p.id === id)).filter(Boolean);
      
      handle.close();
      resolve({ mode, people: selectedPeople });
    });

    const handle = openModal({
      title: 'افزودن گروهی افراد',
      subtitle: 'می‌توانید چندین نفر را همزمان به جدول اضافه کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
    });
  });
}

export default openBulkPeopleForm;