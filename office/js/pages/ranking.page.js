/**
 * Ranking detail page — ordered entries, add/edit score, add/remove members.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { rankingsService } from '../services/rankings.service.js';
import { peopleService } from '../services/people.service.js';
import { emptyState } from '../components/empty-state.js';
import { createRankingEntry } from '../components/ranking-entry.js';
import { openRankingForm } from '../components/ranking-form.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { open as openModal } from '../ui/modal.js';
import { openContextMenu } from '../ui/context-menu.js';
import { toast } from '../ui/toast.js';
import { canEditContent } from '../components/auth-guard.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { csv, downloadCsv } from '../utils/csv.js';

export default async function rankingPage(info, outlet) {
  const id = info?.params?.id;
  if (!id) {
    router.navigate(ROUTES.RANKINGS, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let ranking;
  let entries = [];
  try {
    ranking = await rankingsService.getById(id);
    if (!ranking) {
      outlet.innerHTML = '';
      outlet.appendChild(
        el('div', { class: 'container' }, [
          emptyState({
            iconName: 'trophy',
            title: 'رتبه‌بندی پیدا نشد',
            description: 'این رتبه‌بندی وجود ندارد یا حذف شده است.',
            actions: [
              el('a', { class: 'btn btn--primary', href: router.href(ROUTES.RANKINGS) }, ['بازگشت']),
            ],
          }),
        ])
      );
      return () => {};
    }
    entries = await rankingsService.getEntries(id);
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'این رتبه‌بندی بارگذاری نشد.',
        }),
      ])
    );
    return () => {};
  }

  const canEdit =
    canEditContent() || appStore.get('user')?.id === ranking.created_by;

  outlet.innerHTML = '';
  outlet.appendChild(buildView(ranking, entries, canEdit));

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

function buildView(ranking, entries, canEdit) {
  const back = el(
    'a',
    { class: 'ranking-back', href: router.href(ROUTES.RANKINGS) },
    [icon('chevron-right'), 'بازگشت به رتبه‌بندی‌ها']
  );

  const actions = el('div', { class: 'ranking-hero__actions' }, [
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary btn--sm',
            on: { click: () => addEntry() },
          },
          [icon('plus'), 'افزودن عضو']
        )
      : null,
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary btn--sm',
            on: { click: () => editRanking() },
          },
          [icon('edit'), 'ویرایش']
        )
      : null,
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary btn--sm',
        on: { click: () => exportCsv() },
      },
      [icon('download'), 'خروجی CSV']
    ),
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger btn--sm',
            on: { click: () => deleteRanking() },
          },
          [icon('trash'), 'حذف']
        )
      : null,
  ].filter(Boolean));

  const hero = el('div', { class: 'ranking-hero' }, [
    el('div', { class: 'ranking-hero__icon' }, [icon('trophy')]),
    el('div', { class: 'ranking-hero__main' }, [
      el('h1', { class: 'ranking-hero__title' }, [ranking.title || 'بدون عنوان']),
      ranking.criteria
        ? el('span', { class: 'ranking-hero__criteria' }, [
            icon('award'),
            ranking.criteria,
          ])
        : null,
      ranking.description
        ? el('p', { class: 'ranking-hero__desc' }, [ranking.description])
        : null,
      el('div', {
        style: {
          display: 'flex',
          gap: 'var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          flexWrap: 'wrap',
        },
      }, [
        el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
          icon('users'),
          `${formatNumber(entries.length)} عضو`,
        ]),
        ranking.created_at
          ? el('span', {}, [`ایجاد: ${formatDate(ranking.created_at)}`])
          : null,
      ]),
    ]),
    actions,
  ]);

  /* Entries list */
  const sortedEntries = [...entries].sort((a, b) => Number(b.score) - Number(a.score));

  const entriesCard = el('div', { class: 'ranking-entries-card' }, [
    el('div', { class: 'ranking-entries-head' }, [
      el('div', { class: 'ranking-entries-head__title' }, [
        icon('award'),
        'اعضا',
        el('span', { class: 'ranking-entries-head__count' }, [`(${formatNumber(entries.length)})`]),
      ]),
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--ghost btn--sm',
              on: { click: () => addEntry() },
            },
            [icon('plus'), 'افزودن']
          )
        : null,
    ]),
    buildEntriesList(sortedEntries),
  ]);

  /* Top-level */
  return el('div', { class: 'container' }, [
    el('div', { class: 'ranking-detail' }, [back, hero, entriesCard]),
  ]);

  /* ---------- helpers (closures) ---------- */

  function buildEntriesList(list) {
    const wrap = el('div', { class: 'ranking-entries-list' });
    if (!list.length) {
      wrap.appendChild(
        el(
          'div',
          {
            style: {
              padding: 'var(--space-10) var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
            },
          },
          ['هنوز عضوی به این رتبه‌بندی اضافه نشده است.']
        )
      );
      return wrap;
    }

    list.forEach((entry, index) => {
      wrap.appendChild(
        createRankingEntry(entry, {
          rank: index + 1,
          canEdit,
          onScoreChange: handleScoreChange,
          onDelete: handleDelete,
          onContextMenu: (e, en) => openEntryContext(e, en),
        })
      );
    });
    return wrap;
  }

  function refreshEntries() {
    const updated = [...entries].sort((a, b) => Number(b.score) - Number(a.score));
    const headCount = entriesCard.querySelector('.ranking-entries-head__count');
    if (headCount) headCount.textContent = `(${formatNumber(entries.length)})`;
    const oldList = entriesCard.querySelector('.ranking-entries-list');
    oldList.replaceWith(buildEntriesList(updated));
  }

  async function handleScoreChange(entry, newScore, opts = {}) {
    try {
      await rankingsService.upsertEntry(ranking.id, {
        person_id: entry.person_id,
        score: newScore,
        notes: entry.notes,
      });
      entry.score = newScore;
      refreshEntries();
    } catch (err) {
      toast.error(err?.message || 'تغییر امتیاز ناموفق بود.');
      throw err;
    }
  }

  async function handleDelete(entry) {
    await confirmAndDelete({
      title: 'حذف عضو',
      message: 'این عضو از رتبه‌بندی حذف شود؟',
      onConfirm: () => rankingsService.removeEntry(entry.id),
      successMessage: 'عضو حذف شد.',
      onDeleted: () => {
        entries = entries.filter((e) => e.id !== entry.id);
        refreshEntries();
      },
    });
  }

  function openEntryContext(e, entry) {
    const items = [
      {
        label: 'مشاهده فرد',
        icon: 'user',
        onClick: () => router.navigate(ROUTES.PERSON(entry.person_id)),
      },
      {
        label: 'ویرایش یادداشت',
        icon: 'edit',
        onClick: () => editEntryNotes(entry),
      },
    ];
    if (canEdit) {
      items.push({ divider: true });
      items.push({
        label: 'حذف از رتبه‌بندی',
        icon: 'trash',
        danger: true,
        onClick: () => handleDelete(entry),
      });
    }
    openContextMenu(e.clientX, e.clientY, items);
  }

  async function editEntryNotes(entry) {
    const notesInput = el('textarea', {
      class: 'textarea',
      rows: 3,
      placeholder: 'یادداشت (اختیاری)',
      maxlength: 500,
    });
    notesInput.value = entry.notes || '';

    const saveBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      on: {
        click: async () => {
          try {
            await rankingsService.upsertEntry(ranking.id, {
              person_id: entry.person_id,
              score: entry.score,
              notes: notesInput.value.trim() || null,
            });
            entry.notes = notesInput.value.trim() || null;
            toast.success('یادداشت ذخیره شد.');
            handle.close();
            refreshEntries();
          } catch (err) {
            toast.error(err?.message || 'ذخیره ناموفق بود.');
          }
        },
      },
    }, ['ذخیره']);

    const handle = openModal({
      title: 'ویرایش یادداشت',
      body: el('div', { class: 'form-field' }, [notesInput]),
      footer: el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
        el('button', {
          type: 'button',
          class: 'btn btn--secondary',
          on: { click: () => handle.close() },
        }, ['انصراف']),
        saveBtn,
      ]),
      size: 'sm',
      initialFocus: notesInput,
    });
  }

  async function addEntry() {
    let people = [];
    try {
      const res = await peopleService.list({ limit: 200, sort: 'full_name', direction: 'asc' });
      people = res.items.filter(
        (p) => !entries.some((e) => e.person_id === p.id)
      );
    } catch (err) {
      toast.error('بارگذاری افراد ناموفق بود.');
      return;
    }

    if (!people.length) {
      toast.warning('همه افراد قبلاً اضافه شده‌اند.');
      return;
    }

    const personSelect = el(
      'select',
      { class: 'select' },
      people.map((p) => el('option', { value: p.id }, [p.full_name || 'بدون نام']))
    );
    const scoreInput = el('input', {
      type: 'number',
      class: 'input',
      value: '1',
      dir: 'ltr',
      step: '1',
    });
    const notesInput = el('textarea', {
      class: 'textarea',
      rows: 2,
      placeholder: 'یادداشت (اختیاری)',
      maxlength: 500,
    });

    const saveBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        on: {
          click: async () => {
            try {
              const created = await rankingsService.upsertEntry(ranking.id, {
                person_id: personSelect.value,
                score: Number(scoreInput.value) || 0,
                notes: notesInput.value.trim() || null,
              });
              const person = people.find((p) => p.id === personSelect.value);
              entries.push({ ...created, people: person });
              toast.success('عضو اضافه شد.');
              handle.close();
              refreshEntries();
            } catch (err) {
              toast.error(err?.message || 'افزودن ناموفق بود.');
            }
          },
        },
      },
      ['افزودن']
    );

    const handle = openModal({
      title: 'افزودن عضو به رتبه‌بندی',
      body: el('div', { class: 'form-grid' }, [
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['فرد']),
          personSelect,
        ]),
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['امتیاز']),
          scoreInput,
        ]),
        el('div', { class: 'form-field' }, [
          el('label', { class: 'form-label' }, ['یادداشت']),
          notesInput,
        ]),
      ]),
      footer: el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
        el('button', {
          type: 'button',
          class: 'btn btn--secondary',
          on: { click: () => handle.close() },
        }, ['انصراف']),
        saveBtn,
      ]),
      size: 'md',
      initialFocus: personSelect,
    });
  }

  async function editRanking() {
    const values = await openRankingForm({ ranking });
    if (!values) return;
    try {
      const updated = await rankingsService.update(ranking.id, values);
      Object.assign(ranking, updated);
      toast.success('رتبه‌بندی به‌روز شد.');
      // Simple re-render of hero
      const newHero = buildView(ranking, entries, canEdit);
      // Replace main content
      const container = hero.closest('.container');
      if (container) container.replaceWith(newHero);
    } catch (err) {
      toast.error(err?.message || 'ویرایش ناموفق بود.');
    }
  }

  async function deleteRanking() {
    await confirmAndDelete({
      title: 'حذف رتبه‌بندی',
      message: `«${ranking.title}» حذف شود؟`,
      onConfirm: () => rankingsService.remove(ranking.id),
      successMessage: 'رتبه‌بندی حذف شد.',
      onDeleted: () => router.navigate(ROUTES.RANKINGS, { replace: true }),
    });
  }

  function exportCsv() {
    const headers = ['رتبه', 'نام', 'سمت', 'امتیاز', 'یادداشت'];
    const rows = sortedEntries.map((e, i) => [
      i + 1,
      e.people?.full_name || '',
      e.people?.job_title || '',
      e.score,
      e.notes || '',
    ]);
    const csvString = csv.rowsToCsv(headers, rows);
    downloadCsv(`${ranking.slug || 'ranking'}.csv`, csvString);
    toast.success('فایل CSV دانلود شد.');
  }
}