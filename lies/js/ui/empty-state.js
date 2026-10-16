/* ============================================================
   js/ui/empty-state.js
   Reusable empty state component
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * @param {{
 *   icon?:string,
 *   title:string,
 *   message?:string,
 *   action?:{label:string, onClick:()=>void, icon?:string, variant?:string},
 *   secondaryAction?:{label:string, onClick:()=>void},
 *   variant?:'default'|'compact'|'panel',
 *   illustration?:HTMLElement,
 * }} opts
 * @returns {HTMLElement}
 */
export function emptyState(opts) {
  const {
    icon = '🗒️',
    title = 'هنوز چیزی اینجا نیست',
    message = '',
    action = null,
    secondaryAction = null,
    variant = 'default',
    illustration = null,
  } = opts;

  const root = el('div', { class: ['empty-state', `empty-state--${variant}`] });

  if (illustration) {
    root.appendChild(el('div', { class: 'empty-state__illustration' }, { children: [illustration] }));
  } else {
    root.appendChild(el('div', { class: 'empty-state__icon' }, { children: [icon] }));
  }

  root.appendChild(el('h3', { class: 'empty-state__title' }, { children: [title] }));
  if (message) {
    root.appendChild(el('p', { class: 'empty-state__message' }, { children: [message] }));
  }

  if (action || secondaryAction) {
    const actions = el('div', { class: 'empty-state__actions' });
    if (action) {
      const btn = el('button', {
        class: ['btn', action.variant === 'ghost' ? 'btn--ghost' : action.variant === 'outline' ? 'btn--outline' : 'btn--primary'],
        attrs: { type: 'button' },
        on: { click: action.onClick },
      });
      if (action.icon) btn.appendChild(el('span', { class: 'btn__icon' }, { children: [action.icon] }));
      btn.appendChild(el('span', { class: 'btn__label' }, { children: [action.label] }));
      actions.appendChild(btn);
    }
    if (secondaryAction) {
      const btn = el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        on: { click: secondaryAction.onClick },
      }, { children: [secondaryAction.label] });
      actions.appendChild(btn);
    }
    root.appendChild(actions);
  }

  return root;
}

export default emptyState;