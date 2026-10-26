/**
 * Characterology Detail Page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { characterologyService } from '../services/characterology.service.js';
import { peopleService } from '../services/people.service.js';
import { emptyState } from '../components/empty-state.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { renderMentions } from '../utils/render-mentions.js';
import { toast } from '../ui/toast.js';
import { open as openModal } from '../ui/modal.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { formatDate, initials, timeAgo } from '../utils/format.js';

export default async function characterologyDetailPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) { router.navigate(ROUTES.CHARACTEROLOGY, { replace: true }); return () => {}; }

  outlet.innerHTML = '';
  outlet.appendChild(el('div', { class: 'container' }, [el('div', { class: 'page-loading' }, [el('div', { class: 'skeleton skeleton--title' }), el('div', { class: 'skeleton skeleton--block' })])]));

  let scenario, peopleList = [], answers = [];
  try {
    const [scenRes, peopleRes] = await Promise.all([
      characterologyService.getScenarioById(id),
      peopleService.list({ limit: 500, sort: 'full_name', direction: 'asc' })
    ]);
    scenario = scenRes;
    peopleList = peopleRes.items;
    if (!scenario) throw new Error('سناریو یافت نشد');
    answers = await characterologyService.listAnswers(id);
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(el('div', { class: 'container' }, [emptyState({ iconName: 'alert-circle', title: 'خطا', description: err?.message, actions: [el('a', { class: 'btn btn--primary', href: router.href(ROUTES.CHARACTEROLOGY) }, ['بازگشت'])] })]));
    return () => {};
  }

  const user = appStore.get('user');
  const profile = appStore.get('profile');
  const canEditScenario = canEditContent() || user?.id === scenario.author_id;

  outlet.innerHTML = '';
  
  const back = el('a', { class: 'btn btn--ghost btn--sm', href: router.href(ROUTES.CHARACTEROLOGY), style: { marginBottom: '16px' } }, [icon('chevron-right'), 'بازگشت به شخصیت شناسی']);

  // Scenario Hero
  const heroActions = canEditScenario ? el('div', { style: { display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' } }, [
    el('button', { 
      type: 'button', 
      class: 'btn btn--secondary btn--sm', 
      on: { click: () => editScenarioAction() } 
    }, [icon('edit'), 'ویرایش سناریو']),
    el('button', { 
      type: 'button', 
      class: 'btn btn--danger btn--sm', 
      on: { click: () => deleteScenarioAction() } 
    }, [icon('trash'), 'حذف سناریو'])
  ]) : null;

  const hero = el('div', { class: 'scenario-hero' }, [
    el('h1', { class: 'scenario-hero__title' }, [scenario.title]),
    el('div', { class: 'scenario-hero__desc', html: renderMentions(scenario.description, peopleList) }),
    el('div', { class: 'scenario-hero__meta' }, [
      el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
        icon('user', { style: { width: '14px', height: '14px' } }), 
        `سازنده: ${scenario.author?.display_name || 'کاربر'}`
      ]),
      el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
        icon('clock', { style: { width: '14px', height: '14px' } }), 
        formatDate(scenario.created_at, { withTime: true })
      ])
    ]),
    heroActions
  ]);

  // Result Box (Optional)
  let resultBox = null;
  if (scenario.result || canEditScenario) {
    const resultContent = el('div', { class: 'scenario-result-box__content', html: scenario.result ? renderMentions(scenario.result, peopleList) : 'هنوز نتیجه‌ای برای این سناریو ثبت نشده است.' });
    
    const editResultBtn = canEditScenario ? el('button', {
      type: 'button',
      class: 'btn btn--sm',
      style: { marginInlineStart: 'auto', fontSize: '11px', height: '24px', padding: '0 8px' },
      on: { 
        click: () => editResultAction() 
      }
    }, [icon('edit'), 'ویرایش نتیجه']) : null;

    resultBox = el('div', { class: 'scenario-result-box', style: scenario.result ? {} : { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' } }, [
      el('div', { class: 'scenario-result-box__title', style: scenario.result ? {} : { color: 'var(--text-secondary)' } }, [
        icon('check-circle'), 
        'نتیجه نهایی',
        editResultBtn
      ]),
      resultContent
    ]);
  }

  // Answer Form
  const personSelect = el('select', { class: 'select' }, [
    el('option', { value: '' }, ['--- شخص مورد نظر را انتخاب کنید ---']),
    ...peopleList.map(p => el('option', { value: p.id }, [p.full_name]))
  ]);
  
  const answerEditor = createMentionTextarea({
    people: peopleList,
    placeholder: 'به نظر شما این شخص چه واکنشی نشان می‌دهد؟',
    rows: 3,
    minHeight: '80px'
  });

  const submitAnswerBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    on: {
      click: async () => {
        const personId = personSelect.value;
        const content = answerEditor.getValue().trim();
        if (!personId || !content) return toast.warning('لطفاً شخص و متن پاسخ را وارد کنید.');

        submitAnswerBtn.classList.add('is-loading');
        try {
          const newAnswer = await characterologyService.addAnswer(scenario.id, personId, content);
          
          const p = peopleList.find(x => x.id === personId);
          newAnswer.author = { display_name: profile?.display_name || user?.email?.split('@')[0], avatar_url: profile?.avatar_url };
          newAnswer.person = { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, job_title: p.job_title };
          
          answers.unshift(newAnswer);
          renderAnswers();
          personSelect.value = '';
          answerEditor.setValue('');
          toast.success('پاسخ شما ثبت شد.');
        } catch (err) {
          toast.error(err?.message || 'خطا در ثبت پاسخ.');
        } finally {
          submitAnswerBtn.classList.remove('is-loading');
        }
      }
    }
  }, ['ارسال پاسخ']);

  const formCard = el('div', { class: 'answer-form-card' }, [
    el('div', { class: 'answer-form-card__title' }, [icon('edit'), 'پاسخ خود را ثبت کنید']),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['انتخاب شخص']),
      personSelect
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label' }, ['پاسخ / واکنش']),
      answerEditor.node
    ]),
    el('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, [submitAnswerBtn])
  ]);

  // Answers List
  const answersWrap = el('div', { class: 'answers-list' });

  function renderAnswers() {
    answersWrap.innerHTML = '';
    if (!answers.length) {
      answersWrap.appendChild(el('div', { class: 'text-center text-muted', style: { padding: '32px' } }, ['هنوز پاسخی ثبت نشده است. اولین نفر باشید!']));
      return;
    }

    answers.forEach(answer => {
      const isAuthor = user?.id === answer.author_id;
      const canDelete = isAuthor || canEditContent();
      const htmlContent = renderMentions(answer.content, peopleList);

      const deleteBtn = canDelete ? el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--icon btn--sm',
        style: { color: 'var(--danger-500)', marginInlineStart: 'auto' },
        on: {
          click: () => {
            confirmAndDelete({
              title: 'حذف پاسخ',
              message: 'این پاسخ حذف شود؟',
              onConfirm: () => characterologyService.removeAnswer(answer.id),
              successMessage: 'پاسخ حذف شد.',
              onDeleted: () => {
                answers = answers.filter(a => a.id !== answer.id);
                renderAnswers();
              }
            });
          }
        }
      }, [icon('trash')]) : null;

      answersWrap.appendChild(
        el('div', { class: 'answer-card' }, [
          el('div', { class: 'answer-card__avatar' }, [
            el('span', { class: 'avatar' }, [answer.author?.avatar_url ? el('img', { src: answer.author.avatar_url }) : initials(answer.author?.display_name || 'کاربر')])
          ]),
          el('div', { class: 'answer-card__main' }, [
            el('div', { class: 'answer-card__head' }, [
              el('span', { class: 'answer-card__author' }, [answer.author?.display_name || 'کاربر']),
              el('span', { class: 'answer-card__time' }, [timeAgo(answer.created_at)]),
              el('span', { style: { fontSize: '12px', color: 'var(--text-secondary)' } }, ['درباره:']),
              el('span', { class: 'answer-card__target' }, [
                answer.person?.avatar_url ? el('img', { src: answer.person.avatar_url, style: { width: '16px', height: '16px', borderRadius: '50%' } }) : null,
                answer.person?.full_name || 'نامشخص'
              ]),
              deleteBtn
            ]),
            el('div', { class: 'answer-card__body', html: htmlContent })
          ])
        ])
      );
    });
  }

  renderAnswers();

  const finalLayout = el('div', { class: 'container container--narrow characterology-detail' }, [
    back,
    hero,
    resultBox,
    formCard,
    el('div', { style: { marginTop: '16px' } }, [
      el('h2', { style: { fontSize: 'var(--text-lg)', fontWeight: 'bold', marginBottom: '16px' } }, ['پاسخ‌های ثبت شده']),
      answersWrap
    ])
  ]);

  outlet.appendChild(finalLayout);
  return () => {};

  /* ================= actions ================= */

  function deleteScenarioAction() {
    confirmAndDelete({
      title: 'حذف سناریو',
      message: `«${scenario.title}» و تمام پاسخ‌های آن حذف شوند؟`,
      onConfirm: () => characterologyService.removeScenario(scenario.id),
      successMessage: 'سناریو حذف شد.',
      onDeleted: () => router.navigate(ROUTES.CHARACTEROLOGY, { replace: true })
    });
  }

  function editScenarioAction() {
    const titleInput = el('input', { type: 'text', class: 'input', value: scenario.title, maxlength: 150 });
    const descEditor = createMentionTextarea({ people: peopleList, rows: 6 });
    descEditor.setValue(scenario.description);

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['عنوان']),
        titleInput
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['شرح موقعیت']),
        descEditor.node
      ])
    ]);

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary', on: { click: () => form.requestSubmit() } }, ['ذخیره']);
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => handle.close() } }, ['انصراف']);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const description = descEditor.getValue().trim();
      
      const errors = validate({ title, description }, {
        title: [rules.required('عنوان الزامی است')],
        description: [rules.required('توضیحات الزامی است')]
      });
      
      if (hasErrors(errors)) return toast.error(Object.values(errors)[0]);

      submitBtn.classList.add('is-loading');
      try {
        await characterologyService.updateScenario(scenario.id, { title, description });
        toast.success('سناریو ویرایش شد.');
        handle.close();
        window.location.reload();
      } catch (err) {
        toast.error(err?.message || 'خطا در ویرایش سناریو.');
        submitBtn.classList.remove('is-loading');
      }
    });

    const handle = openModal({
      title: 'ویرایش سناریو',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: titleInput
    });
  }

  function editResultAction() {
    const editor = createMentionTextarea({ people: peopleList, rows: 3 });
    editor.setValue(scenario.result || '');
    
    const saveBtn = el('button', { type: 'button', class: 'btn btn--primary', on: {
      click: async () => {
        try {
          await characterologyService.updateScenario(scenario.id, { result: editor.getValue() });
          toast.success('نتیجه به‌روز شد.');
          window.location.reload();
        } catch (e) { toast.error(e.message); }
      }
    }}, ['ذخیره']);
    
    openModal({
      title: 'ثبت / ویرایش نتیجه',
      body: el('div', { class: 'form-field' }, [editor.node]),
      footer: saveBtn,
      size: 'md',
      initialFocus: editor.textareaNode
    });
  }
}