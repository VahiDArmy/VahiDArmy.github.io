/**
 * String Tag Input Component
 * A simple input that turns text into chips when Enter or comma is pressed.
 * Used for generic text tags (not people).
 */

import { el, icon } from '../utils/dom.js';

export function createStringTagInput({ placeholder = 'افزودن برچسب...' } = {}) {
  const selectedTags = new Set();
  
  const wrapper = el('div', { class: 'tag-input-wrapper' });
  const container = el('div', { 
    class: 'tag-input-container',
    on: { click: () => input.focus() }
  });
  
  const input = el('input', {
    type: 'text',
    class: 'tag-input__field',
    placeholder: selectedTags.size === 0 ? placeholder : '',
    autocomplete: 'off',
  });

  function renderChips() {
    container.querySelectorAll('.chip').forEach(c => c.remove());
    
    for (const tag of selectedTags) {
      const chip = el('span', { class: 'chip chip--brand' }, [
        el('span', { class: 'chip__label' }, [tag]),
        el('button', {
          type: 'button',
          class: 'chip__close',
          on: {
            click: (e) => {
              e.stopPropagation();
              selectedTags.delete(tag);
              renderChips();
              input.focus();
            }
          }
        }, [icon('x')])
      ]);
      
      container.insertBefore(chip, input);
    }
    
    input.placeholder = selectedTags.size === 0 ? placeholder : '';
  }

  function addTag() {
    const val = input.value.trim().replace(/,/g, '');
    if (val && !selectedTags.has(val)) {
      selectedTags.add(val);
      input.value = '';
      renderChips();
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && input.value === '' && selectedTags.size > 0) {
      const tags = Array.from(selectedTags);
      selectedTags.delete(tags[tags.length - 1]);
      renderChips();
    }
  });

  // Add tag on blur if something was typed
  input.addEventListener('blur', () => {
    addTag();
  });

  container.appendChild(input);
  wrapper.appendChild(container);

  return {
    node: wrapper,
    getValue: () => Array.from(selectedTags),
  };
}