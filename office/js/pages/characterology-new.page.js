/**
 * Characterology Create Page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { characterologyService } from '../services/characterology.service.js';
import { peopleService } from '../services/people.service.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from '../components/page-header.js';
import { ROUTES } from '../config/constants.js';

export default async function characterologyNewPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [el('div', { class: 'page-loading' }, [el('div', { class: 'skeleton skeleton--title' }), el('div', { class: 'skeleton skeleton--block' })])]));

  let allPeople = [];
  try {
    const res = await peopleService.list({ limit: 500 });
    allPeople = res.items;
  } catch (e) {
    console.warn('Could not fetch people for mentions');
  }

  const titleInput = el('input', { type: 'text', class: 'input', placeholder: 'مثلاً: آتش‌سوزی در آشپزخانه', maxlength: 150, style: { fontSize: '1.25rem', fontWeight: 'bold' } });
  
  const descEditor = createMentionTextarea({
    people: allPeople,
    placeholder: 'جزئیات موقعیت را دقیقاً توصیف کنید...',
    rows: 6,
    minHeight: '150px'
  });

  const resultEditor = createMentionTextarea({
    people: allPeople,
    placeholder: 'نتیجه نهایی چه شد؟ (اختیاری)',
    rows: 3,
    minHeight: '100px'
  });

  const submitBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary btn--lg',
    on: {
      click: async () => {
        const title = titleInput.value.trim();
        const description = descEditor.getValue().trim();
        const result = resultEditor.getValue().trim();

        const errors = validate({ title, description }, {
          title: [rules.required('عنوان الزامی است'), rules.maxLength(150)],
          description: [rules.required('توضیحات الزامی است')]
        });
        if (hasErrors(errors)) return toast.error(Object.values(errors)[0]);

        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        try {
          const created = await characterologyService.createScenario({ title, description, result: result || null });
          toast.success('سناریو ایجاد شد.');
          router.navigate(ROUTES.CHARACTEROLOGY_DETAIL(created.id));
        } catch (err) {
          toast.error(err?.message || 'خطا در ایجاد سناریو.');
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    }
  }, ['ثبت سناریو']);

  const formLayout = el('div', { class: 'form-grid', style: { gap: '24px', marginTop: '24px' } }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['عنوان موقعیت ', el('span', { class: 'required' }, ['*'])]),
      titleInput
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['شرح موقعیت ', el('span', { class: 'required' }, ['*'])]),
      descEditor.node
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['نتیجه (اختیاری)']),
      resultEditor.node,
      el('p', { class: 'form-help' }, ['اگر این سناریو در واقعیت اتفاق افتاده و نتیجه مشخصی داشته، آن را اینجا بنویسید.'])
    ]),
    el('div', { class: 'form-actions', style: { borderTop: 'none', paddingTop: '0' } }, [
      el('a', { class: 'btn btn--secondary', href: router.href(ROUTES.CHARACTEROLOGY) }, ['انصراف']),
      submitBtn
    ])
  ]);

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [
    el('a', { class: 'btn btn--ghost btn--sm', href: router.href(ROUTES.CHARACTEROLOGY), style: { marginBottom: '16px' } }, [icon('chevron-right'), 'بازگشت']),
    pageHeader({ eyebrow: 'ایجاد', title: 'سناریوی جدید', subtitle: 'یک موقعیت فرضی برای تحلیل شخصیت‌ها ایجاد کنید.' }),
    formLayout
  ]));

  return () => {};
}