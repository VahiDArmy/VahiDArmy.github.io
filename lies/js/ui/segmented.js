/* ============================================================
   js/ui/segmented.js
   Segmented control (like iOS segmented)
   ============================================================ */

import { el } from '../utils/dom.js';
import { uuid } from '../utils/id.js';

/**
 * @param {{
 *   items: Array<{id:string, label?:string, icon?:string, title?:string}>,
 *   active?: string,
 *   onChange?: (id:string)=>void,
 *   size?: 'sm'|'md',
 *   full?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function segmented(opts = {}) {
  const { items = [], active, onChange, size = 'md', full = false } = opts;
  let current = active || items[0]?.id;

  const id = `seg_${uuid().slice(0, 6)}`;
  const root = el('div', {
    class: ['segmented', `segmented--${size}`, full ? 'segmented--full' : ''].filter(Boolean),
    attrs: { role: 'radiogroup' },
    dataset: { segId: id },
  });

  const btns = new Map();

  for (const item of items) {
    const btn = el('button', {
      class: 'segmented__btn',
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        title: item.title || item.label || '',
      },
    });
    if (item.icon) btn.appendChild(el('span', { class: 'segmented__icon' }, { children: [item.icon] }));
    if (item.label) btn.appendChild(el('span', { class: 'segmented__label' }, { children: [item.label] }));
    btn.addEventListener('click', () => setActive(item.id));
    root.appendChild(btn);
    btns.set(item.id, btn);
  }

  function setActive(next) {
    if (next === current) return;
    current = next;
    for (const [k, btn] of btns) {
      const on = k === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', String(on));
    }
    onChange?.(current);
  }

  requestAnimationFrame(() => {
    for (const [k, btn] of btns) {
      if (k === current) { btn.classList.add('is-active'); btn.setAttribute('aria-checked', 'true'); }
    }
  });

  root._segmented = { getActive: () => current, setActive };
  return root;
}

export default { segmented };