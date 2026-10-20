/**
 * Reusable page header. Optionally takes `actions` (array of nodes) that
 * will sit inline with the title on wide screens.
 */

import { el } from '../utils/dom.js';

export function pageHeader({ eyebrow, title, subtitle, actions } = {}) {
  const head = el('div', { class: 'page-header' }, [
    eyebrow ? el('span', { class: 'page-header__eyebrow' }, [eyebrow]) : null,
    el('h1', { class: 'page-header__title' }, [title || '']),
    subtitle ? el('p', { class: 'page-header__subtitle' }, [subtitle]) : null,
  ]);

  if (!actions || !actions.length) return head;

  return el(
    'div',
    {
      class: 'page-header-row',
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      },
    },
    [
      head,
      el(
        'div',
        {
          style: {
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            alignItems: 'center',
          },
        },
        actions
      ),
    ]
  );
}

export default pageHeader;