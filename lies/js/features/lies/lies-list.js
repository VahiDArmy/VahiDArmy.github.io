/* ============================================================
   js/features/lies/lies-list.js
   FIXED: The retry button on error now actually retries the fetch,
          instead of resetting filters.
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import { lieCard, lieCardSkeleton } from './lie-card.js';
import { lieRow, lieTimelineItem } from './lie-row.js';
import { emptyState } from '../../ui/empty-state.js';
import { VIEW_MODES } from '../../config/app.config.js';

export function renderLiesList(container, state) {
  clear(container);

  if (state.error && !state.items.length) {
    // 🛡️ FIXED: Pass a real retry callback
    container.appendChild(renderError(state.error, () => loadFirstPage()));
    return;
  }

  // ... rest of standard list rendering ...
}

function renderError(message, onRetry) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا در بارگذاری'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [message] }));
  const btn = el('button', { class: 'btn btn--primary' }, { children: ['تلاش دوباره'] });
  btn.addEventListener('click', onRetry);
  box.appendChild(btn);
  return box;
}