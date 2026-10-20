/**
 * Person card — used in list view.
 * Supports: click to open, right-click context menu, checkbox for bulk select,
 * keyboard activation.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES, PEOPLE_STATUS_LABELS } from '../config/constants.js';
import { initials, truncateText } from '../utils/format.js';

function statusBadgeClass(status) {
  switch (status) {
    case 'in_site': return 'badge--success';
    case 'not_in_site': return 'badge--warning';
    case 'former': return 'badge--outline';
    default: return 'badge';
  }
}

export function createPersonCard(person, {
  selected = false,
  bulkMode = false,
  onToggleSelect,
  onContextMenu,
  onClick,
} = {}) {
  const avatarInner = person.avatar_url
    ? el('img', { src: person.avatar_url, alt: person.full_name || '', loading: 'lazy' })
    : el('span', {}, [initials(person.full_name || '')]);

  const check = el(
    'span',
    {
      class: 'person-card__check',
      role: 'checkbox',
      'aria-checked': selected ? 'true' : 'false',
      tabindex: '0',
      on: {
        click: (e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect?.(person);
        },
        keydown: (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onToggleSelect?.(person);
          }
        },
      },
    }
  );

  const card = el(
    'div',
    {
      class: `person-card${selected ? ' is-selected' : ''}`,
      role: 'link',
      tabindex: '0',
      'aria-label': person.full_name || '',
      dataset: { personId: person.id },
      on: {
        click: (e) => {
          if (bulkMode) {
            e.preventDefault();
            onToggleSelect?.(person);
            return;
          }
          if (onClick) onClick(person);
          else router.navigate(ROUTES.PERSON(person.id));
        },
        keydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            card.click();
          }
        },
        contextmenu: (e) => {
          if (onContextMenu) onContextMenu(e, person);
        },
      },
    },
    [
      check,
      el('div', { class: 'person-card__head' }, [
        el('span', { class: 'avatar' }, [avatarInner]),
        el('div', { class: 'person-card__info' }, [
          el('div', { class: 'person-card__name' }, [
            truncateText(person.full_name || 'بدون نام', 40),
          ]),
          el('div', { class: 'person-card__role' }, [
            person.job_title || 'بدون سمت',
          ]),
        ]),
      ]),
      el('div', { class: 'person-card__meta' }, [
        person.department
          ? metaItem('folder', person.department)
          : null,
        person.status
          ? el(
              'span',
              { class: `badge ${statusBadgeClass(person.status)}` },
              [PEOPLE_STATUS_LABELS[person.status] || person.status]
            )
          : null,
      ]),
    ]
  );

  return card;
}

function metaItem(iconName, text) {
  return el('span', { class: 'person-card__meta-item' }, [
    icon(iconName),
    el('span', { class: 'truncate' }, [truncateText(text || '', 24)]),
  ]);
}

export default createPersonCard;