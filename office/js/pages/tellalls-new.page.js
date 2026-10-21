/**
 * Full Page Form for creating a new Tellall.
 * Features a large text editor, central person selection, and tagging.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { peopleService } from '../services/people.service.js';
import { tellallsService } from '../services/tellalls.service.js';
import { createPeopleTagger } from '../components/people-tagger.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from '../components/page-header.js';

export default async function tellallsNewPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const user = session.user;
  const profile = appStore.get('profile');

  outlet.innerHTML = '';
  const page = el('div', { class: 'container container--narrow' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block', style: { height: '400px' } })
    ])
  ]);
  outlet.appendChild(page);

  // Fetch people
  let peopleList = [];
  try {
    const res = await peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' });
    peopleList = res.items;
  } catch (err) {
    toast.error('خطا در دریافت لیست افراد.');
  }

  const myPerson = peopleList.find((p) => p.user_id === user.id);
  const defaultPersonId = myPerson ? myPerson.id : (peopleList[0]?.id || '');

  // --- Build UI ---
  
  const backBtn = el('a', { class: 'btn btn--ghost btn--sm', href: router.href('/tellalls'), style: { marginBottom: '16px' } }, [
    icon('chevron-right'), 'بازگشت به بگایی‌ها'
  ]);

  const titleInput = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'عنوان بگایی (مثلاً: ماجرای خراب شدن پرینتر)',
    maxlength: 150,
    style: { fontSize: '1.25rem', fontWeight: 'bold' } // Make it look like a title
  });

  const personSelect = el('select', { class: 'select' },
    peopleList.map((p) => el('option', { value: p.id, selected: p.id === defaultPersonId }, [
      p.full_name + (p.user_id === user.id ? ' (من)' : '')
    ]))
  );

  const tagger = createPeopleTagger({ 
    people: peopleList, 
    excludeId: defaultPersonId 
  });

  // Update tagger when central person changes
  personSelect.addEventListener('change', (e) => {
    tagger.setExclude(e.target.value);
  });

  const contentInput = el('textarea', {
    class: 'textarea',
    rows: 15,
    placeholder: 'جزئیات بگایی را با ذکر تمام موارد اینجا بنویسید...',
    style: { 
      minHeight: '400px', 
      fontSize: '1rem', 
      lineHeight: '1.8',
      fontFamily: 'var(--font-sans)'
    },
  });

  const submitBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary btn--lg',
    on: {
      click: async () => {
        const title = titleInput.value.trim();
        const personId = personSelect.value;
        const content = contentInput.value.trim();
        const relatedPeople = tagger.getValue();

        const errors = validate({ title, content, personId }, {
          title: [rules.required('عنوان الزامی است'), rules.maxLength(150)],
          content: [rules.required('متن بگایی الزامی است')],
          personId: [rules.required('انتخاب شخص محوری الزامی است')]
        });

        if (hasErrors(errors)) {
          toast.error(Object.values(errors)[0]);
          return;
        }

        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        try {
          await tellallsService.create({
            title,
            description: content,
            person_id: personId,
            related_people: relatedPeople,
            first_entry_content: content
          });
          
          toast.success('بگایی با موفقیت ثبت شد.');
          router.navigate('/tellalls');
        } catch (err) {
          toast.error(err?.message || 'خطا در ثبت بگایی.');
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    }
  }, ['ثبت نهایی بگایی']);

  // Layout
  const formLayout = el('div', { class: 'form-grid', style: { gap: '24px', marginTop: '24px' } }, [
    
    // Title
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['عنوان ', el('span', { class: 'required' }, ['*'])]),
      titleInput
    ]),

    // Two columns for people
    el('div', { class: 'form-grid form-grid--2' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['شخص محوری (این بگایی درباره کیست؟)']),
        personSelect,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['تگ کردن افراد دیگر']),
        tagger.node
      ])
    ]),

    // Content
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['متن و جزئیات بگایی ', el('span', { class: 'required' }, ['*'])]),
      contentInput,
      el('p', { class: 'form-help' }, ['شما می‌توانید متن طولانی خود را در این بخش بنویسید.'])
    ]),

    // Actions
    el('div', { class: 'form-actions', style: { borderTop: 'none', paddingTop: '0' } }, [
      el('a', { class: 'btn btn--secondary', href: router.href('/tellalls') }, ['انصراف']),
      submitBtn
    ])
  ]);

  const pageHeaderNode = pageHeader({
    eyebrow: 'ایجاد موضوع',
    title: 'ثبت بگایی جدید',
    subtitle: 'اطلاعات کامل و تمام جزئیات را وارد کنید.'
  });

  page.innerHTML = '';
  page.appendChild(backBtn);
  page.appendChild(pageHeaderNode);
  page.appendChild(formLayout);

  return () => {};
}