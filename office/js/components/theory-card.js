/**
 * Theory card — vote widget + title + summary + tags + meta.
 * Supports right-click context menu and keyboard nav.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES, THEORY_STATUS_LABELS } from '../config/constants.js';
import { formatNumber, timeAgo, truncateText } from '../utils/format.js';

function statusBadgeClass(status) {
  switch (status) {
    case 'published': return 'badge--success';
    case 'draft':     return 'badge--warning';
    case 'archived':  return 'badge--outline';
    default: return 'badge';
  }
}

export function createTheoryCard(theory, {
  myVote = 0,
  onVote,
  onOpen,
  onContextMenu,
} = {}) {
  const score = theory.score || 0;
  const upBtn = el(
    'button',
    {
      type: 'button',
      class: `theory-card__vote-btn is-up${myVote === 1 ? ' is-active' : ''}`,
      'aria-label': 'رأی مثبت',
      'aria-pressed': myVote === 1 ? 'true' : 'false',
      on: {
        click: (e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote?.(theory, myVote === 1 ? 0 : 1);
        },
      },
    },
    [icon('chevron-up')]
  );

  const downBtn = el(
    'button',
    {
      type: 'button',
      class: `theory-card__vote-btn is-down${myVote === -1 ? ' is-active' : ''}`,
      'aria-label': 'رأی منفی',
      'aria-pressed': myVote === -1 ? 'true' : 'false',
      on: {
        click: (e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote?.(theory, myVote === -1 ? 0 : -1);
        },
      },
    },
    [icon('chevron-down')]
  );

  const scoreNode = el(
    'span',
    {
      class: `theory-card__score${score > 0 ? ' is-positive' : score < 0 ? ' is-negative' : ''}`,
    },
    [formatNumber(score)]
  );

  const voteCol = el('div', { class: 'theory-card__vote' }, [upBtn, scoreNode, downBtn]);

  const tags = (theory.tags || []).slice(0, 4).map((t) =>
    el('span', { class: 'chip chip--brand' }, [truncateText(t, 24)])
  );

  const metaItems = [
    theory.created_at
      ? el('span', { class: 'theory-card__meta-item' }, [icon('clock'), timeAgo(theory.created_at)])
      : null,
    theory.comments_count != null
      ? el('span', { class: 'theory-card__meta-item' }, [
          icon('message'),
          formatNumber(theory.comments_count),
        ])
      : null,
    theory.status
      ? el(
          'span',
          { class: `badge ${statusBadgeClass(theory.status)}` },
          [THEORY_STATUS_LABELS[theory.status] || theory.status]
        )
      : null,
  ].filter(Boolean);

  const card = el(
    'div',
    {
      class: 'theory-card',
      role: 'link',
      tabindex: '0',
      dataset: { theoryId: theory.id },
      on: {
        click: () => (onOpen ? onOpen(theory) : router.navigate(ROUTES.THEORY(theory.id))),
        keydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            card.click();
          }
        },
        contextmenu: (e) => {
          if (onContextMenu) onContextMenu(e, theory);
        },
      },
    },
    [
      voteCol,
      el('div', { class: 'theory-card__main' }, [
        el('div', { class: 'theory-card__title' }, [truncateText(theory.title || '', 120)]),
        theory.summary
          ? el('div', { class: 'theory-card__summary' }, [theory.summary])
          : null,
        tags.length ? el('div', { class: 'theory-card__tags' }, tags) : null,
        el('div', { class: 'theory-card__meta' }, metaItems),
      ]),
    ]
  );

  return card;
}

export default createTheoryCard;