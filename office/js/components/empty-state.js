/**
 * Reusable empty state used across list pages.
 */

import { el, icon } from '../utils/dom.js';

export function emptyState({ iconName = 'info', title, description, actions, compact = false } = {}) {
  return el('div', { class: `empty-state${compact ? ' empty-state--compact' : ''}` }, [
    el('div', { class: 'empty-state__icon' }, [icon(iconName)]),
    title ? el('h3', { class: 'empty-state__title' }, [title]) : null,
    description ? el('p', { class: 'empty-state__description' }, [description]) : null,
    actions && actions.length
      ? el('div', { class: 'empty-state__actions' }, actions)
      : null,
  ]);
}

export default emptyState;