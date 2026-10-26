/**
 * Person Form Component (Create/Edit)
 */

import { el } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { peopleService } from '../services/people.service.js';
import { PEOPLE_STATUS_LABELS } from '../config/constants.js';
import { createMentionTextarea } from './mention-textarea.js';

export function openPersonForm({ person = null } = {}) {
  return new Promise(async (resolve) => {
    const isEdit = !!person;

    let allPeople = [];
    try {
      const res = await peopleService.list({ limit: 500 });
      allPeople = res.items;
    } catch (e) { console.warn('Could not load people for mentions'); }

    const nameInput = el('input', { type: 'text', class: 'input', placeholder: 'نام و نام خانوادگی', value: person?.full_name || '', maxlength: 100 });
    const jobInput = el('input', { type: 'text', class: 'input', placeholder: 'سمت شغلی', value: person?.job_title || '', maxlength: 100 });
    const deptInput = el('input', { type: 'text', class: 'input', placeholder: 'دپارتمان', value: person?.department || '', maxlength: 100 });
    const statusSelect = el('select', { class: 'select' }, Object.entries(PEOPLE_STATUS_LABELS).map(([k, v]) => el('option', { value: k, selected: k === (person?.status || 'not_in_site') }, [v])));
    const emailInput = el('input', { type: 'email', class: 'input', dir: 'ltr', placeholder: 'name@example.com', value: person?.email || '' });
    const phoneInput = el('input', { type: 'text', class: 'input', dir: 'ltr', placeholder: '09123456789', value: person?.phone || '' });
    
    const bioEditor = createMentionTextarea({
      people: allPeople,
      placeholder: 'توضیحات یا سابقه (اختیاری)',
      rows: 4,
      minHeight: '100px'
    });
    bioEditor.setValue(person?.bio || '');

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['نام کامل ', el('span', { class: 'required' }, ['*'])]), nameInput]),
      el('div', { class: 'form-grid form-grid--2' }, [
        el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['سمت شغلی']), jobInput]),
        el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['دپارتمان']), deptInput]),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['وضعیت حضور']), statusSelect]),
        el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['شماره تماس']), phoneInput]),
      ]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['ایمیل']), emailInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['بیوگرافی']), bioEditor.node]),
    ]);

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary', on: { click: () => form.requestSubmit() } }, [isEdit ? 'ذخیره تغییرات' : 'افزودن فرد']);
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => { handle.close(); resolve(false); } } }, ['انصراف']);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = {
        full_name: nameInput.value.trim(),
        job_title: jobInput.value.trim() || null,
        department: deptInput.value.trim() || null,
        status: statusSelect.value,
        phone: phoneInput.value.trim() || null,
        email: emailInput.value.trim() || null,
        bio: bioEditor.getValue().trim() || null,
      };

      const errors = validate(values, { full_name: [rules.required('نام کامل الزامی است'), rules.maxLength(100)], email: [rules.email()] });
      if (hasErrors(errors)) { toast.error(Object.values(errors)[0]); return; }

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        if (isEdit) {
          await peopleService.update(person.id, values);
          toast.success('اطلاعات فرد به‌روز شد.');
        } else {
          await peopleService.create(values);
          toast.success('فرد جدید اضافه شد.');
        }
        handle.close();
        resolve(true);
      } catch (err) {
        toast.error(err?.message || 'خطا در ذخیره اطلاعات.');
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    });

    const handle = openModal({
      title: isEdit ? 'ویرایش فرد' : 'افزودن فرد جدید',
      subtitle: isEdit ? null : 'اطلاعات همکار جدید را وارد کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'lg',
      initialFocus: nameInput,
      onClose: () => resolve(false),
    });
  });
}

export default openPersonForm;