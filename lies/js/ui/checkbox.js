/* ============================================================
   js/ui/checkbox.js
   Custom checkbox (with indeterminate support)
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * @param {{
 *   label?: string,
 *   checked?: boolean,
 *   indeterminate?: boolean,
 *   disabled?: boolean,
 *   size?: 'sm'|'md'|'lg',
 *   onChange?: (checked:boolean)=>void,
 *   name?: string,
 *   value?: string,
 * }} opts
 * @returns {HTMLElement}
 */
export function checkbox(opts = {}) {
  const {
    label = '', checked = false, indeterminate = false,
    disabled = false, size = 'md', onChange, name, value,
  } = opts;

  const wrap = el('label', {
    class: ['checkbox', `checkbox--${size}`, disabled ? 'is-disabled' : ''].filter(Boolean),
  });

  const input = el('input', {
    attrs: {
      type: 'checkbox',
      ...(name ? { name } : {}),
      ...(value !== undefined ? { value } : {}),
    },
    props: { checked, disabled, indeterminate },
  });

  const box = el('span', { class: 'checkbox__box' });
  box.appendChild(el('span', { class: 'checkbox__check', attrs: { 'aria-hidden': 'true' } }, { children: ['✓'] }));
  box.appendChild(el('span', { class: 'checkbox__indeterminate', attrs: { 'aria-hidden': 'true' } }));

  wrap.appendChild(input);
  wrap.appendChild(box);
  if (label) wrap.appendChild(el('span', { class: 'checkbox__label' }, { children: [label] }));

  input.addEventListener('change', () => {
    wrap.classList.toggle('is-checked', input.checked);
    if (input.indeterminate) input.indeterminate = false;
    onChange?.(input.checked);
  });

  if (indeterminate) wrap.classList.add('is-indeterminate');
  if (checked) wrap.classList.add('is-checked');

  wrap._checkbox = {
    get checked() { return input.checked; },
    set checked(v) {
      input.checked = !!v;
      wrap.classList.toggle('is-checked', input.checked);
    },
    setIndeterminate(v) {
      input.indeterminate = !!v;
      wrap.classList.toggle('is-indeterminate', !!v);
    },
  };

  return wrap;
}

export default { checkbox };