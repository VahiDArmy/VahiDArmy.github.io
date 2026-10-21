/**
 * Tellall (Bugayi) creation form — Modal.
 * Allows selecting the "central person" (defaults to current user).
 */

import { el, icon } from '../utils/dom.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { peopleService } from '../services/people.service.js';
import { tellallsService } from '../services/tellalls.service.js';
import { supabase } from '../services/supabase.client.js';
import { appStore } from '../core/store.js';

export function openTellallForm() {
  return new Promise(async (resolve) => {
    const user = appStore.get('user');
    if (!user) {
      toast.error('برای ایجاد بگایی باید وارد شوید.');
      return resolve(null);
    }

    // 1. Fetch people for the dropdown
    let peopleList = [];
    try {
      const res = await peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' });
      peopleList = res.items;
    } catch (err) {
      toast.error('خطا در دریافت لیست افراد.');
      return resolve(null);
    }

    if (peopleList.length === 0) {
      toast.warning('هیچ فردی در سیستم ثبت نشده است. ابتدا یک فرد اضافه کنید.');
      return resolve(null);
    }

    // Find current user's person_id to set as default
    const myPerson = peopleList.find((p) => p.user_id === user.id);
    const defaultPersonId = myPerson ? myPerson.id : peopleList[0].id;

    // 2. Build form elements
    const titleInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: 'مثلاً: ماجرای پرینتر طبقه سوم',
      maxlength: 150,
    });

    const personSelect = el(
      'select',
      { class: 'select' },
      peopleList.map((p) =>
        el('option', { value: p.id, selected: p.id === defaultPersonId }, [
          p.full_name + (p.user_id === user.id ? ' (من)' : '')
        ])
      )
    );

    const contentInput = el('textarea', {
      class: 'textarea',
      rows: 5,
      placeholder: 'جزئیات بگایی یا موضوعی که شنیده‌اید را اینجا بنویسید...',
      maxlength: 5000,
    });

    const submitBtn = el(
      'button',
      { type: 'submit', class: 'btn btn--primary' },
      ['ثبت بگایی']
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

    // 3. Build form layout
    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['عنوان بگایی ', el('span', { class: 'required' }, ['*'])]),
        titleInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['شخص محوری (این بگایی درباره کیست؟)']),
        personSelect,
        el('p', { class: 'form-help' }, ['به صورت پیش‌فرض خودتان انتخاب شده‌اید. می‌توانید شخص دیگری را انتخاب کنید.']),
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['جزئیات ', el('span', { class: 'required' }, ['*'])]),
        contentInput,
      ]),
    ]);

    // 4. Handle submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = titleInput.value.trim();
      const personId = personSelect.value;
      const content = contentInput.value.trim();

      const errors = validate({ title, content }, {
        title: [rules.required('عنوان الزامی است'), rules.maxLength(150)],
        content: [rules.required('جزئیات الزامی است'), rules.maxLength(5000)],
      });

      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        // Insert into tellalls
        const { data: tellallData, error: tellallError } = await supabase
          .from('tellalls')
          .insert({
            title,
            person_id: personId,
            created_by: user.id,
            description: content // Using description as initial content for the tellall itself
          })
          .select()
          .single();

        if (tellallError) throw tellallError;

        // Insert first entry into tellall_entries
        const { error: entryError } = await supabase
          .from('tellall_entries')
          .insert({
            tellall_id: tellallData.id,
            person_id: personId,
            content: content,
            author_id: user.id
          });

        if (entryError) throw entryError;

        toast.success('بگایی با موفقیت ثبت شد.');
        handle.close();
        resolve(tellallData);
        
      } catch (err) {
        console.error('[TellallForm]', err);
        toast.error(err?.message || 'خطا در ثبت بگایی.');
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }
    });

    // 5. Open Modal
    const handle = openModal({
      title: 'ثبت بگایی جدید',
      subtitle: 'اطلاعات این موضوع را وارد کنید.',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: titleInput,
      onClose: () => resolve(null),
    });
  });
}

export default openTellallForm;