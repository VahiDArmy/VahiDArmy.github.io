/* ============================================================
   js/ui/switch.js
   Toggle switch with label and description
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * @param {{
 *   label?: string,
 *   description?: string,
 *   checked?: boolean,
 *   disabled?: boolean,
 *   size?: 'sm'|'md'|'lg',
 *   onChange?: (checked:boolean)=>void,
 *   name?: string,
 * }} opts
 * @returns {HTMLElement}
 */
export function switchControl(opts = {}) {
  const {
    label = '', description = '', checked = false,
    disabled = false, size = 'md', onChange, name,
  } = opts;

  const wrap = el('label', {
    class: ['switch', `switch--${size}`, disabled ? 'is-disabled' : ''].filter(Boolean),
  });

  const input = el('input', {
    attrs: { type: 'checkbox', ...(name ? { name } : {}) },
    props: { checked, disabled },
  });

  const track = el('span', { class: 'switch__track' });
  track.appendChild(el('span', { class: 'switch__thumb' }));

  wrap.appendChild(input);
  wrap.appendChild(track);

  if (label || description) {
    const text = el('span', { class: 'switch__text' });
    if (label) text.appendChild(el('span', { class: 'switch__label' }, { children: [label] }));
    if (description) text.appendChild(el('span', { class: 'switch__description' }, { children: [description] }));
    wrap.appendChild(text);
  }

  input.addEventListener('change', () => {
    wrap.classList.toggle('is-checked', input.checked);
    onChange?.(input.checked);
  });
  if (checked) wrap.classList.add('is-checked');

  wrap._switch = {
    get checked() { return input.checked; },
    set checked(v) {
      input.checked = !!v;
      wrap.classList.toggle('is-checked', input.checked);
    },
  };

  return wrap;
}

export default { switchControl };