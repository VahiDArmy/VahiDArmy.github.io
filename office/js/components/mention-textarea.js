/**
 * Mention Textarea Component
 * A textarea that detects the "@" character, shows a dropdown of people,
 * and inserts their name into the text.
 */

import { el } from '../utils/dom.js';
import { initials } from '../utils/format.js';

export function createMentionTextarea({ 
  people = [], 
  placeholder = 'متن خود را بنویسید...', 
  rows = 15,
  minHeight = '400px',
  className = '' // Added className support
} = {}) {
  
  const wrapper = el('div', { class: 'mention-wrapper' });
  
  const textarea = el('textarea', {
    class: `textarea ${className}`.trim(),
    placeholder,
    rows,
    style: { minHeight, fontSize: '1rem', lineHeight: '1.8', fontFamily: 'var(--font-sans)' }
  });

  const dropdown = el('div', { class: 'mention-dropdown', hidden: true });
  
  let mentionStart = -1;
  let mentionQuery = '';
  let activeIndex = 0;
  let filteredPeople = [];

  function renderDropdown() {
    filteredPeople = people.filter(p => 
      (p.full_name || '').toLowerCase().includes(mentionQuery.toLowerCase())
    );

    if (!filteredPeople.length) {
      dropdown.hidden = true;
      return;
    }

    activeIndex = Math.max(0, Math.min(activeIndex, filteredPeople.length - 1));
    dropdown.innerHTML = '';

    filteredPeople.forEach((person, idx) => {
      const item = el('div', {
        class: `mention-item${idx === activeIndex ? ' is-active' : ''}`,
        on: {
          mousedown: (e) => {
            e.preventDefault(); // Prevent textarea blur
            insertMention(person);
          }
        }
      }, [
        el('span', { class: 'mention-item__avatar' }, [
          person.avatar_url 
            ? el('img', { src: person.avatar_url, alt: person.full_name })
            : initials(person.full_name)
        ]),
        el('span', { class: 'mention-item__name' }, [person.full_name])
      ]);
      dropdown.appendChild(item);
    });

    dropdown.hidden = false;
  }

  function insertMention(person) {
    const textBefore = textarea.value.substring(0, mentionStart);
    const textAfter = textarea.value.substring(textarea.selectionStart);
    const insertText = `@${person.full_name} `;
    
    textarea.value = textBefore + insertText + textAfter;
    textarea.focus();
    
    // Set cursor after the inserted name
    const newCursorPos = mentionStart + insertText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    dropdown.hidden = true;
  }

  textarea.addEventListener('input', () => {
    const val = textarea.value;
    const cursor = textarea.selectionStart;
    const lastAt = val.lastIndexOf('@', cursor - 1);

    if (lastAt !== -1 && !val.substring(lastAt, cursor).includes(' ')) {
      // We are in a mention query
      mentionStart = lastAt;
      mentionQuery = val.substring(lastAt + 1, cursor);
      activeIndex = 0;
      renderDropdown();
    } else {
      dropdown.hidden = true;
    }
  });

  textarea.addEventListener('keydown', (e) => {
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
        insertMention(filteredPeople[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
    }
  });

  textarea.addEventListener('blur', () => {
    // Delay to allow mousedown on dropdown to fire
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });

  wrapper.appendChild(textarea);
  wrapper.appendChild(dropdown);

  return {
    node: wrapper,
    textareaNode: textarea, // Exposed for custom styling if needed
    getValue: () => textarea.value,
    setValue: (val) => { textarea.value = val; }
  };
}