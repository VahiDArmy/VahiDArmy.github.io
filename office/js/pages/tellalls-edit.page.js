/**
 * Full Page Form for editing an existing Tellall.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { peopleService } from '../services/people.service.js';
import { tellallsService } from '../services/tellalls.service.js';
import { createTagInput } from '../components/tag-input.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from '../components/page-header.js';

export default async function tellallsEditPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) {
    router.navigate('/tellalls', { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block', style: { height: '400px' } })
    ])
  ]));

  let tellall, peopleList = [];
  try {
    const [tellallRes, peopleRes] = await Promise.all([
      tellallsService.getById(id),
      peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' })
    ]);
    tellall = tellallRes;
    peopleList = peopleRes.items;
    if (!tellall) throw new Error('بگایی یافت نشد');
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(el('div', { class: 'container' }, [el('div', { class: 'empty-state' }, ['بگایی پیدا نشد.'])]));
    return () => {};
  }

  // --- Build UI ---
  
  const backBtn = el('a', { class: 'btn btn--ghost btn--sm', href: router.href(`/tellalls/${tellall.id}`), style: { marginBottom: '16px' } }, [
    icon('chevron-right'), 'بازگشت به بگایی'
  ]);

  const titleInput = el('input', {
    type: 'text',
    class: 'input',
    value: tellall.title || '',
    maxlength: 150,
    style: { fontSize: '1.25rem', fontWeight: 'bold' }
  });

  const personSelect = el('select', { class: 'select' },
    peopleList.map((p) => el('option', { value: p.id, selected: p.id === tellall.person_id }, [p.full_name]))
  );

  const tagger = createTagInput({ 
    people: peopleList, 
    initialValues: tellall.related_people || [],
    placeholder: 'تگ کردن افراد...' 
  });

  const editor = createMentionTextarea({
    people: peopleList,
    rows: 15,
    minHeight: '400px'
  });
  editor.setValue(tellall.description || '');

  const submitBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary btn--lg',
    on: {
      click: async () => {
        const title = titleInput.value.trim();
        const personId = personSelect.value;
        const content = editor.getValue().trim();
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
          await tellallsService.update(tellall.id, {
            title,
            description: content,
            person_id: personId,
            related_people: relatedPeople
          });
          
          toast.success('بگایی با موفقیت ویرایش شد.');
          router.navigate(`/tellalls/${tellall.id}`);
        } catch (err) {
          toast.error(err?.message || 'خطا در ویرایش بگایی.');
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
        el('label', { class: 'form-label' }, ['شخص محوری']),
        personSelect,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['تگ کردن افراد']),
        tagger.node
      ])
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['متن و جزئیات بگایی ', el('span', { class: 'required' }, ['*'])]),
      editor.node,
    ]),
    el('div', { class: 'form-actions', style: { borderTop: 'none', paddingTop: '0' } }, [
      el('a', { class: 'btn btn--secondary', href: router.href(`/tellalls/${tellall.id}`) }, ['انصراف']),
      submitBtn
    ])
  ]);

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container container--narrow' }, [
    backBtn,
    pageHeader({ eyebrow: 'ویرایش', title: 'ویرایش بگایی', subtitle: 'تغییرات مورد نظر را اعمال کنید.' }),
    formLayout
  ]));

  return () => {};
}