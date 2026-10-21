/**
 * People Tagger Component
 * Allows selecting multiple people and displaying them as chips.
 * Used in the Tellall creation form to tag involved people.
 */

import { el, icon } from '../utils/dom.js';
import { initials } from '../utils/format.js';

export function createPeopleTagger({ people = [], initialSelected = [], excludeId = null }) {
  const selectedIds = new Set(initialSelected);
  
  const wrap = el('div', { class: 'people-tagger' });
  const chipsContainer = el('div', { class: 'chip-list', style: { marginBottom: '10px' } });
  
  // Filter out the excluded person (the central person)
  const availablePeople = people.filter(p => p.id !== excludeId);

  const select = el('select', { class: 'select' },
    [
      el('option', { value: '' }, ['-- انتخاب فرد برای تگ --']),
      ...availablePeople.map((p) =>
        el('option', { value: p.id, disabled: selectedIds.has(p.id) }, [p.full_name])
      ),
    ]
  );

  const addBtn = el('button', {
    type: 'button',
    class: 'btn btn--secondary',
    on: {
      click: () => {
        const val = select.value;
        if (!val || selectedIds.has(val)) return;
        
        selectedIds.add(val);
        renderChips();
        updateSelectOptions();
        select.value = ''; // reset
      }
    }
  }, [icon('plus'), 'افزودن']);

  function renderChips() {
    chipsContainer.innerHTML = '';
    if (selectedIds.size === 0) {
      chipsContainer.appendChild(el('span', { class: 'text-muted text-sm' }, ['هیچ فردی تگ نشده است.']));
      return;
    }

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
            click: () => {
              selectedIds.delete(id);
              renderChips();
              updateSelectOptions();
            }
          }
        }, [icon('x')])
      ]);
      chipsContainer.appendChild(chip);
    }
  }

  function updateSelectOptions() {
    Array.from(select.options).forEach(opt => {
      if (opt.value) {
        opt.disabled = selectedIds.has(opt.value);
      }
    });
  }

  wrap.appendChild(chipsContainer);
  wrap.appendChild(el('div', { class: 'form-row' }, [select, addBtn]));

  renderChips();

  return {
    node: wrap,
    getValue: () => Array.from(selectedIds),
    setExclude: (id) => {
      excludeId = id;
      // Re-render options if central person changes
      const val = select.value;
      select.innerHTML = '';
      select.appendChild(el('option', { value: '' }, ['-- انتخاب فرد برای تگ --']));
      people.filter(p => p.id !== id).forEach(p => {
        select.appendChild(el('option', { value: p.id, disabled: selectedIds.has(p.id) }, [p.full_name]));
      });
      select.value = val;
    }
  };
}