/**
 * Full Page Form for creating a new Theory.
 * Reuses components to maintain UI consistency with Tellalls.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { peopleService } from '../services/people.service.js';
import { theoriesService } from '../services/theories.service.js';
import { createTagInput } from '../components/tag-input.js';
import { createStringTagInput } from '../components/string-tag-input.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from '../components/page-header.js';
import { ROUTES, THEORY_STATUS_LABELS } from '../config/constants.js';

export default async function theoriesNewPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  outlet.innerHTML = '';
  const page = el('div', { class: 'container container--narrow' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block', style: { height: '400px' } })
    ])
  ]);
  outlet.appendChild(page);

  // Fetch people for mentions and tags
  let peopleList = [];
  try {
    const res = await peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' });
    peopleList = res.items;
  } catch (err) {
    toast.error('خطا در دریافت لیست افراد.');
  }

  // --- Build UI ---
  
  const backBtn = el('a', { class: 'btn btn--ghost btn--sm', href: router.href(ROUTES.THEORIES), style: { marginBottom: '16px' } }, [
    icon('chevron-right'), 'بازگشت به نظریه‌ها'
  ]);

  const titleInput = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'عنوان نظریه (مثلاً: چرا پرینتر همیشه خراب است؟)',
    maxlength: 150,
    style: { fontSize: '1.25rem', fontWeight: 'bold' }
  });

  const summaryInput = el('textarea', {
    class: 'textarea',
    rows: 2,
    placeholder: 'خلاصه‌ای کوتاه از نظریه (در فهرست نمایش داده می‌شود)',
    maxlength: 300
  });

  const statusSelect = el('select', { class: 'select' },
    [
      el('option', { value: 'draft' }, [THEORY_STATUS_LABELS.draft]),
      el('option', { value: 'published', selected: true }, [THEORY_STATUS_LABELS.published]),
    ]
  );

  const peopleTagger = createTagInput({ 
    people: peopleList, 
    placeholder: 'افراد مرتبط با این نظریه را انتخاب کنید...' 
  });

  const stringTagger = createStringTagInput({ 
    placeholder: 'برچسب بزنید (Enter بزنید)...' 
  });

  const editor = createMentionTextarea({
    people: peopleList,
    placeholder: 'متن کامل نظریه خود را اینجا بنویسید...\n\nنکته: برای لینک دادن به یک فرد، از علامت @ استفاده کنید (مثلاً @نام_فرد)',
    rows: 12
  });

  const submitBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary btn--lg',
    on: {
      click: async () => {
        const title = titleInput.value.trim();
        const summary = summaryInput.value.trim();
        const body = editor.getValue().trim();
        const related_people = peopleTagger.getValue();
        const tags = stringTagger.getValue();

        const errors = validate({ title, body }, {
          title: [rules.required('عنوان الزامی است'), rules.maxLength(150)],
          body: [rules.required('متن نظریه الزامی است')],
        });

        if (hasErrors(errors)) {
          toast.error(Object.values(errors)[0]);
          return;
        }

        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        try {
          const created = await theoriesService.create({
            title,
            summary,
            body,
            status: statusSelect.value,
            related_people,
            tags
          });
          
          toast.success('نظریه با موفقیت ثبت شد.');
          router.navigate(ROUTES.THEORY(created.id));
        } catch (err) {
          toast.error(err?.message || 'خطا در ثبت نظریه.');
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    }
  }, ['ثبت نهایی نظریه']);

  // Layout
  const formLayout = el('div', { class: 'form-grid', style: { gap: '24px', marginTop: '24px' } }, [
    
    // Title
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['عنوان ', el('span', { class: 'required' }, ['*'])]),
      titleInput
    ]),

    // Summary & Status
    el('div', { class: 'form-grid form-grid--2' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['خلاصه']),
        summaryInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['وضعیت انتشار']),
        statusSelect,
      ])
    ]),

    // Tags & People
    el('div', { class: 'form-grid form-grid--2' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['افراد مرتبط']),
        peopleTagger.node
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['برچسب‌ها']),
        stringTagger.node
      ])
    ]),

    // Body
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['متن و جزئیات نظریه ', el('span', { class: 'required' }, ['*'])]),
      editor.node,
    ]),

    // Actions
    el('div', { class: 'form-actions', style: { borderTop: 'none', paddingTop: '0' } }, [
      el('a', { class: 'btn btn--secondary', href: router.href(ROUTES.THEORIES) }, ['انصراف']),
      submitBtn
    ])
  ]);

  const pageHeaderNode = pageHeader({
    eyebrow: 'ایجاد موضوع',
    title: 'ثبت نظریه جدید',
    subtitle: 'اطلاعات کامل و تمام جزئیات را وارد کنید.'
  });

  page.innerHTML = '';
  page.appendChild(backBtn);
  page.appendChild(pageHeaderNode);
  page.appendChild(formLayout);

  return () => {};
}