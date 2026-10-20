/**
 * Related-list section used on detail pages (person, theory, ranking).
 *
 *   relatedSection({
 *     title: 'نظریه‌های مرتبط',
 *     iconName: 'lightbulb',
 *     items: [{ title, meta, href, id }],
 *     emptyText: 'نظریه‌ای مرتبط وجود ندارد.',
 *     viewAllHref: '/theories?person=...',
 *   });
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';

export function relatedSection({
  title,
  iconName = 'list',
  items = [],
  emptyText = 'موردی برای نمایش نیست.',
  viewAllHref,
} = {}) {
  const head = el('div', { class: 'related-section__head' }, [
    el('h2', { class: 'related-section__title' }, [
      icon(iconName),
      title,
      el('span', { class: 'related-section__count' }, [`(${items.length})`]),
    ]),
    viewAllHref
      ? el(
          'a',
          {
            class: 'btn btn--ghost btn--sm',
            href: router.href(viewAllHref),
          },
          ['همه', icon('arrow-left')]
        )
      : null,
  ]);

  let body;
  if (items.length) {
    body = el(
      'div',
      { class: 'related-list' },
      items.map((it) =>
        el(
          'a',
          {
            class: 'related-item',
            href: it.href ? router.href(it.href) : '#',
          },
          [
            el('div', { class: 'related-item__main' }, [
              el('div', { class: 'related-item__title' }, [it.title || '—']),
              it.meta ? el('div', { class: 'related-item__meta' }, [it.meta]) : null,
            ]),
            icon('chevron-left'),
          ]
        )
      )
    );
  } else {
    body = el(
      'div',
      {
        style: {
          padding: 'var(--space-6) var(--space-4)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
        },
      },
      [emptyText]
    );
  }

  return el('section', { class: 'related-section' }, [head, body]);
}

export default relatedSection;