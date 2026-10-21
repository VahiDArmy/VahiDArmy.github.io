/**
 * Full Page Form for editing an existing Theory.
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

export default async function theoriesEditPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) {
    router.navigate(ROUTES.THEORIES, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block', style: { height: '400px' } })
    ])
  ]));

  let theory, peopleList = [];
  try {
    const [theoryRes, peopleRes] = await Promise.all([
      theoriesService.getById(id),
      peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' })
    ]);
    theory = theoryRes;
    peopleList = peopleRes.items;
    if (!theory) throw new Error('نظریه یافت نشد');
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(el('div', { class: 'container' }, [el('div', { class: 'empty-state' }, ['نظریه پیدا نشد.'])]));
    return () => {};
  }

  // --- Build UI ---
  
  const backBtn = el('a', { class: 'btn btn--ghost btn--sm', href: router.href(ROUTES.THEORY(theory.id)), style: { marginBottom: '16px' } }, [
    icon('chevron-right'), 'بازگشت به نظریه'
  ]);

  const titleInput = el('input', {
    type: 'text',
    class: 'input',
    value: theory.title || '',
    maxlength: 150,
    style: { fontSize: '1.25rem', fontWeight: 'bold' }
  });

  const summaryInput = el('textarea', {
    class: 'textarea',
    rows: 2,
    maxlength: 300
  });
  summaryInput.value = theory.summary || '';

  const statusSelect = el('select', { class: 'select' },
    Object.entries(THEORY_STATUS_LABELS).map(([k, v]) =>
      el('option', { value: k, selected: k === theory.status }, [v])
    )
  );

  const peopleTagger = createTagInput({ 
    people: peopleList, 
    initialValues: theory.related_people || [],
    placeholder: 'افراد مرتبط...' 
  });

  const stringTagger = createStringTagInput({ 
    initialValues: theory.tags || [],
    placeholder: 'برچسب‌ها...' 
  });

  const editor = createMentionTextarea({
    people: peopleList,
    rows: 12
  });
  editor.setValue(theory.body || '');

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
          await theoriesService.update(theory.id, {
            title,
            summary,
            body,
            status: statusSelect.value,
            related_people,
            tags
          });
          
          toast.success('نظریه با موفقیت ویرایش شد.');
          router.navigate(ROUTES.THEORY(theory.id));
        } catch (err) {
          toast.error(err?.message || 'خطا در ویرایش نظریه.');
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    }
  }, ['ذخیره تغییرات']);

  // Layout
  const formLayout = el('div', { class: 'form-grid', style: { gap: '24px', marginTop: '24px' } }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['عنوان ', el('span', { class: 'required' }, ['*'])]),
      titleInput
    ]),
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
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['متن و جزئیات نظریه ', el('span', { class: 'required' }, ['*'])]),
      editor.node,
    ]),
    el('div', { class: 'form-actions', style: { borderTop: 'none', paddingTop: '0' } }, [
      el('a', { class: 'btn btn--secondary', href: router.href(ROUTES.THEORY(theory.id)) }, ['انصراف']),
      submitBtn
    ])
  ]);

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [
    backBtn,
    pageHeader({ eyebrow: 'ویرایش', title: 'ویرایش نظریه', subtitle: 'تغییرات مورد نظر را اعمال کنید.' }),
    formLayout
  ]));

  return () => {};
}