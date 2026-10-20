/**
 * Tell-all detail page.
 * Shows the subject, list of entries, and a form to add a new entry.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { tellallsService } from '../services/tellalls.service.js';
import { emptyState } from '../components/empty-state.js';
import { createTellallEntry } from '../components/tellall-entry.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { canEditContent } from '../components/auth-guard.js';
import { formatDate, formatNumber } from '../utils/format.js';

export default async function tellallPage(info, outlet) {
  const id = info?.params?.id;
  if (!id) {
    router.navigate(ROUTES.TELLALLS, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let tellall, entries;
  try {
    tellall = await tellallsService.getById(id);
    if (!tellall) {
      outlet.innerHTML = '';
      outlet.appendChild(
        el('div', { class: 'container' }, [
          emptyState({
            iconName: 'message',
            title: 'موضوع پیدا نشد',
            description: 'این موضوع وجود ندارد یا حذف شده است.',
            actions: [
              el('a', { class: 'btn btn--primary', href: router.href(ROUTES.TELLALLS) }, ['بازگشت']),
            ],
          }),
        ])
      );
      return () => {};
    }
    entries = await tellallsService.listEntries(id);
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'اطلاعات بارگذاری نشد.',
        }),
      ])
    );
    return () => {};
  }

  const user = appStore.get('user');
  const canEdit = canEditContent() || user?.id === tellall.created_by;

  outlet.innerHTML = '';
  outlet.appendChild(buildView(tellall, entries, canEdit));

  return () => {};
}

function buildLoading() {
  return el('div', { class: 'container' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block' }),
    ]),
  ]);
}

function buildView(tellall, entries, canEdit) {
  const back = el(
    'a',
    { class: 'tellall-back', href: router.href(ROUTES.TELLALLS) },
    [icon('chevron-right'), 'بازگشت به لیست']
  );

  const actions = el('div', { class: 'tellall-hero__actions' }, [
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger btn--sm',
            on: { click: () => deleteTellall() },
          },
          [icon('trash'), 'حذف موضوع']
        )
      : null,
  ].filter(Boolean));

  const hero = el('div', { class: 'tellall-hero' }, [
    el('div', { class: 'tellall-hero__icon' }, [icon('message')]),
    el('div', { class: 'tellall-hero__main' }, [
      el('h1', { class: 'tellall-hero__title' }, [tellall.title]),
      tellall.description ? el('p', { class: 'tellall-hero__desc' }, [tellall.description]) : null,
      el('div', {
        style: { display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexWrap: 'wrap' }
      }, [
        el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
          icon('list'),
          `${formatNumber(entries.length)} بگایی`,
        ]),
        tellall.created_at ? el('span', {}, [`ایجاد: ${formatDate(tellall.created_at)}`]) : null,
      ]),
    ]),
    actions,
  ]);

  const entriesList = el('div', { class: 'tellall-entries-list' });
  
  function renderEntries() {
    entriesList.innerHTML = '';
    if (entries.length === 0) {
      entriesList.appendChild(
        el('div', { class: 'empty-state', style: { padding: 'var(--space-8)' } }, [
          el('p', { style: { color: 'var(--text-tertiary)' } }, ['هنوز هیچ بگایی‌ای برای این موضوع ثبت نشده است.'])
        ])
      );
      return;
    }
    entries.forEach(entry => {
      entriesList.appendChild(
        createTellallEntry(entry, {
          canEdit,
          onDelete: handleDeleteEntry,
          onEdit: handleEditEntry
        })
      );
    });
  }
  renderEntries();

  /* ---- New Entry Form ---- */
  let composerNode = null;
  if (appStore.get('user')) {
    const titleInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: 'عنوان (اختیاری)',
      style: { marginBottom: 'var(--space-2)' }
    });
    
    const mentionTextarea = createMentionTextarea({
      placeholder: 'متن بگایی خود را اینجا بنویسید. برای منشن کردن افراد از @ استفاده کنید.',
    });

    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: {
        click: async () => {
          const content = mentionTextarea.getValue().trim();
          if (!content) {
            toast.warning('متن بگایی نمی‌تواند خالی باشد.');
            return;
          }
          submitBtn.classList.add('is-loading');
          submitBtn.disabled = true;
          try {
            const newEntry = await tellallsService.addEntry(tellall.id, {
              title: titleInput.value.trim(),
              content,
            });
            entries.push(newEntry);
            renderEntries();
            titleInput.value = '';
            mentionTextarea.setValue('');
            toast.success('بگایی شما ثبت شد.');
          } catch (err) {
            toast.error(err?.message || 'ثبت ناموفق بود.');
          } finally {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
          }
        }
      }
    }, ['ثبت بگایی']);

    composerNode = el('div', { class: 'tellall-composer' }, [
      el('h3', { class: 'tellall-composer__title' }, ['بگایی جدید اضافه کنید']),
      titleInput,
      mentionTextarea.node,
      el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' } }, [submitBtn])
    ]);
  } else {
    composerNode = el('div', { class: 'tellall-composer', style: { textAlign: 'center' } }, [
      el('span', {}, ['برای ثبت بگایی جدید ']),
      el('a', { href: router.href(ROUTES.LOGIN), class: 'link' }, ['وارد شوید']),
      el('span', {}, ['.']),
    ]);
  }

  async function deleteTellall() {
    await confirmAndDelete({
      title: 'حذف موضوع',
      message: `«${tellall.title}» و همه بگایی‌های آن حذف شوند؟`,
      onConfirm: () => tellallsService.remove(tellall.id),
      successMessage: 'موضوع حذف شد.',
      onDeleted: () => router.navigate(ROUTES.TELLALLS, { replace: true }),
    });
  }

  async function handleDeleteEntry(entry) {
    await confirmAndDelete({
      title: 'حذف بگایی',
      message: 'این متن حذف شود؟',
      onConfirm: () => tellallsService.removeEntry(entry.id),
      successMessage: 'حذف شد.',
      onDeleted: () => {
        entries = entries.filter(e => e.id !== entry.id);
        renderEntries();
      }
    });
  }

  async function handleEditEntry(entry) {
    // Simple inline edit modal
    const titleInput = el('input', { type: 'text', class: 'input', value: entry.title || '', placeholder: 'عنوان (اختیاری)' });
    const mentionTextarea = createMentionTextarea({ value: entry.content });
    
    const saveBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: {
        click: async () => {
          const content = mentionTextarea.getValue().trim();
          if (!content) {
            toast.warning('متن نمی‌تواند خالی باشد.');
            return;
          }
          saveBtn.classList.add('is-loading');
          try {
            await tellallsService.updateEntry(entry.id, { title: titleInput.value.trim(), content });
            entry.title = titleInput.value.trim();
            entry.content = content;
            renderEntries();
            handle.close();
            toast.success('ویرایش شد.');
          } catch (err) {
            toast.error(err?.message || 'ویرایش ناموفق بود.');
          } finally {
            saveBtn.classList.remove('is-loading');
          }
        }
      }
    }, ['ذخیره']);

    const handle = openModal({
      title: 'ویرایش بگایی',
      body: el('div', { class: 'form-grid' }, [
        titleInput,
        mentionTextarea.node
      ]),
      footer: el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
        el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => handle.close() } }, ['انصراف']),
        saveBtn
      ]),
      size: 'md'
    });
  }

  return el('div', { class: 'container' }, [
    el('div', { class: 'tellall-detail' }, [
      back,
      hero,
      el('div', { class: 'tellall-content-wrapper' }, [
        entriesList,
        composerNode
      ])
    ]),
  ]);
}