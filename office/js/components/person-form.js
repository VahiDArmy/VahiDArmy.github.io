/**
 * Person Form Component (Create/Edit)
 * Opens a modal to create or edit a person's profile in the office.
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { peopleService } from '../services/people.service.js';
import { PEOPLE_STATUS_LABELS } from '../config/constants.js';

export function openPersonForm({ person = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!person;

    const nameInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: 'نام و نام خانوادگی',
      value: person?.full_name || '',
      maxlength: 100,
    });

    const jobInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: 'سمت شغلی (مثلاً: مدیر فروش)',
      value: person?.job_title || '',
      maxlength: 100,
    });

    const deptInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: 'دپارتمان (مثلاً: فروش)',
      value: person?.department || '',
      maxlength: 100,
    });

    const statusSelect = el(
      'select',
      { class: 'select' },
      Object.entries(PEOPLE_STATUS_LABELS).map(([k, v]) =>
        el('option', { value: k, selected: k === (person?.status || 'not_in_site') }, [v])
      )
    );

    const emailInput = el('input', {
      type: 'email',
      class: 'input',
      dir: 'ltr',
      placeholder: 'name@example.com',
      value: person?.email || '',
    });

    const phoneInput = el('input', {
      type: 'text',
      class: 'input',
      dir: 'ltr',
      placeholder: '09123456789',
      value: person?.phone || '',
    });

    const bioInput = el('textarea', {
      class: 'textarea',
      rows: 3,
      placeholder: 'توضیحات یا سابقه (اختیاری)',
      maxlength: 1000,
    });
    bioInput.value = person?.bio || '';

    const submitBtn = el(
      'button',
      { type: 'submit', class: 'btn btn--primary' },
      [isEdit ? 'ذخیره تغییرات' : 'افزودن فرد']
    );

    const cancelBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        on: { click: () => { handle.close(); resolve(false); } },
      },
      ['انصراف']
    );

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['نام کامل ', el('span', { class: 'required' }, ['*'])]),
        nameInput,
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['سمت شغلی']),
          jobInput,
        ]),
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['دپارتمان']),
          deptInput,
        ]),
      ]),
      el('div', { class: 'form-grid form-grid--2' }, [
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['وضعیت حضور']),
          statusSelect,
        ]),
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['شماره تماس']),
          phoneInput,
        ]),
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['ایمیل']),
        emailInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['بیوگرافی']),
        bioInput,
      ]),
    ]);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = {
        full_name: nameInput.value.trim(),
        job_title: jobInput.value.trim(),
        department: deptInput.value.trim(),
        status: statusSelect.value,
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        bio: bioInput.value.trim(),
      };

      const errors = validate(values, {
        full_name: [rules.required('نام کامل الزامی است'), rules.maxLength(100)],
        email: [rules.email()],
      });

      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        if (isEdit) {
          await peopleService.update(person.id, values);
          toast.success('اطلاعات فرد به‌روز شد.');
        } else {
          await peopleService.create({ ...values, created_by: 'CURRENT_USER' }); // The service handles current user
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
      size: 'md',
      initialFocus: nameInput,
      onClose: () => resolve(false),
    });
  });
}

export default openPersonForm;