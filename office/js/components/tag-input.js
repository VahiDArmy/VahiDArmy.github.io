/**
 * Person Tag Input Component
 * A searchable input that shows a dropdown of people and turns selected ones into chips.
 */

import { el, icon } from '../utils/dom.js';
import { initials } from '../utils/format.js';

export function createTagInput({ people = [], placeholder = 'افزودن تگ...', initialValues = [] } = {}) {
  const selectedIds = new Set(initialValues);
  
  const wrapper = el('div', { class: 'tag-input-wrapper' });
  const container = el('div', { 
    class: 'tag-input-container',
    on: { click: () => input.focus() }
  });
  
  const input = el('input', {
    type: 'text',
    class: 'tag-input__field',
    placeholder: selectedIds.size === 0 ? placeholder : '',
    autocomplete: 'off',
  });

  const dropdown = el('div', { class: 'tag-dropdown', hidden: true });
  
  let activeIndex = 0;
  let filteredPeople = [];

  function renderChips() {
    container.querySelectorAll('.chip').forEach(c => c.remove());
    
    for (const id of selectedIds) {
      const person = people.find(p => p.id === id);
      if (!person) continue;
      
      const chip = el('span', { class: 'chip chip--brand' }, [
        el('span', { class: 'chip__avatar' }, [
          person.avatar_url 
            ? el('img', { src: person.avatar_url, alt: person.full_name })
            : initials(person.full_name)
        ]),
        el('span', { class: 'chip__label' }, [person.full_name]),
        el('button', {
          type: 'button',
          class: 'chip__close',
          on: {
            click: (e) => {
              e.stopPropagation();
              selectedIds.delete(id);
              renderChips();
              input.focus();
            }
          }
        }, [icon('x')])
      ]);
      
      container.insertBefore(chip, input);
    }
    
    input.placeholder = selectedIds.size === 0 ? placeholder : '';
  }

  function renderDropdown() {
    const query = input.value.trim().toLowerCase();
    
    filteredPeople = people.filter(p => 
      !selectedIds.has(p.id) && 
      (p.full_name || '').toLowerCase().includes(query)
    );

    if (filteredPeople.length === 0) {
      dropdown.innerHTML = '';
      dropdown.appendChild(el('div', { class: 'tag-dropdown__empty' }, ['فردی یافت نشد.']));
      dropdown.hidden = false;
      return;
    }

    activeIndex = Math.max(0, Math.min(activeIndex, filteredPeople.length - 1));
    
    dropdown.innerHTML = '';
    filteredPeople.forEach((person, idx) => {
      const item = el('div', {
        class: `tag-dropdown__item${idx === activeIndex ? ' is-active' : ''}`,
        on: {
          mousedown: (e) => {
            e.preventDefault();
            selectPerson(person);
          }
        }
      }, [
        el('span', { class: 'avatar' }, [
          person.avatar_url 
            ? el('img', { src: person.avatar_url, alt: person.full_name })
            : initials(person.full_name)
        ]),
        el('span', { class: 'tag-dropdown__name' }, [person.full_name]),
        person.job_title ? el('span', { class: 'tag-dropdown__job' }, [person.job_title]) : null
      ]);
      dropdown.appendChild(item);
    });

    dropdown.hidden = false;
  }

  function selectPerson(person) {
    selectedIds.add(person.id);
    input.value = '';
    dropdown.hidden = true;
    renderChips();
    input.focus();
  }

  input.addEventListener('focus', () => {
    container.classList.add('is-focused');
    renderDropdown();
  });

  input.addEventListener('blur', () => {
    container.classList.remove('is-focused');
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderDropdown();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && input.value === '' && selectedIds.size > 0) {
      const ids = Array.from(selectedIds);
      selectedIds.delete(ids[ids.length - 1]);
      renderChips();
      return;
    }

    if (dropdown.hidden) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filteredPeople.length - 1);
      renderDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderDropdown();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPeople[activeIndex]) {
        selectPerson(filteredPeople[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
    }
  });

  container.appendChild(input);
  wrapper.appendChild(container);
  wrapper.appendChild(dropdown);

  renderChips();

  return {
    node: wrapper,
    getValue: () => Array.from(selectedIds),
  };
}