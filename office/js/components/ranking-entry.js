/**
 * Ranking entry row — used on ranking detail page.
 * Supports inline score editing, up/down reorder, context menu, delete.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES } from '../config/constants.js';
import { initials, formatNumber, toEnDigits } from '../utils/format.js';

export function createRankingEntry(entry, {
  rank,
  canEdit = false,
  onScoreChange,
  onDelete,
  onContextMenu,
} = {}) {
  const person = entry.people || {};
  const rankClass = rank <= 3 ? ` is-${rank}` : '';

  const rankNode = el('span', { class: `ranking-entry__rank${rankClass}` }, [
    formatNumber(rank),
  ]);

  const personLink = el(
    'a',
    {
      class: 'ranking-entry__person',
      href: router.href(ROUTES.PERSON(person.id || entry.person_id)),
    },
    [
      el('span', { class: 'avatar' }, [
        person.avatar_url
          ? el('img', { src: person.avatar_url, alt: person.full_name || '', loading: 'lazy' })
          : initials(person.full_name || ''),
      ]),
      el('div', { class: 'ranking-entry__person-main' }, [
        el('div', { class: 'ranking-entry__name' }, [person.full_name || 'بدون نام']),
        person.job_title
          ? el('div', { class: 'ranking-entry__job' }, [person.job_title])
          : null,
        entry.notes
          ? el('div', { class: 'ranking-entry__notes' }, [entry.notes])
          : null,
      ]),
    ]
  );

  // Score is click-to-edit
  const scoreNode = el('span', {
    class: 'ranking-entry__score',
    role: 'button',
    tabindex: canEdit ? '0' : '-1',
    'aria-label': 'ویرایش امتیاز',
    title: canEdit ? 'برای ویرایش کلیک کنید' : String(entry.score),
    on: {
      click: () => { if (canEdit) startScoreEdit(); },
      keydown: (e) => {
        if (!canEdit) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startScoreEdit();
        }
      },
    },
  }, [formatNumber(entry.score)]);

  function startScoreEdit() {
    const input = el('input', {
      type: 'text',
      class: 'data-grid__cell-input',
      dir: 'ltr',
      value: String(entry.score),
      style: { textAlign: 'center', minWidth: '56px' },
    });
    scoreNode.replaceWith(input);
    input.focus();
    input.select();

    const commit = async () => {
      const parsed = Number(toEnDigits(input.value));
      if (Number.isNaN(parsed)) {
        input.replaceWith(scoreNode);
        return;
      }
      input.replaceWith(scoreNode);
      if (parsed === entry.score) return;
      try {
        await onScoreChange?.(entry, parsed);
        entry.score = parsed;
        scoreNode.textContent = formatNumber(parsed);
      } catch (err) {
        // Revert on error — parent handles toast
      }
    };

    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = String(entry.score); input.blur(); }
    });
  }

  const upBtn = canEdit
    ? el(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost btn--icon btn--sm',
          'aria-label': 'بالا',
          title: 'جابجایی با بالا',
          on: { click: () => onScoreChange?.(entry, entry.score + 1, { swap: 'up' }) },
        },
        [icon('chevron-up')]
      )
    : null;

  const downBtn = canEdit
    ? el(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost btn--icon btn--sm',
          'aria-label': 'پایین',
          title: 'جابجایی با پایین',
          on: { click: () => onScoreChange?.(entry, entry.score - 1, { swap: 'down' }) },
        },
        [icon('chevron-down')]
      )
    : null;

  const deleteBtn = canEdit
    ? el(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost btn--icon btn--sm',
          'aria-label': 'حذف',
          title: 'حذف',
          style: { color: 'var(--danger-500)' },
          on: { click: () => onDelete?.(entry) },
        },
        [icon('trash')]
      )
    : null;

  const actions = el(
    'div',
    { class: 'ranking-entry__actions' },
    [upBtn, downBtn, deleteBtn].filter(Boolean)
  );

  const row = el(
    'div',
    {
      class: 'ranking-entry',
      dataset: { entryId: entry.id },
      on: {
        contextmenu: (e) => {
          if (onContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e, entry);
          }
        },
      },
    },
    [rankNode, personLink, scoreNode, actions]
  );

  return row;
}

export default createRankingEntry;