/**
 * MentionTextarea — A custom textarea that supports @mentions.
 * Listens for @ keystrokes, fetches people, shows a dropdown, and inserts
 * markdown-like syntax [@Name](id).
 */

import { el } from '../utils/dom.js';
import { peopleService } from '../services/people.service.js';
import { debounce } from '../utils/debounce.js';

export function createMentionTextarea({ placeholder = 'متن خود را بنویسید...', value = '', people = [] } = {}) {
  const wrap = el('div', { class: 'mention-textarea-wrap' });
  const textarea = el('textarea', {
    class: 'textarea',
    rows: 4,
    placeholder,
    style: { minHeight: '120px' },
  });
  textarea.value = value;

  const dropdown = el('div', { class: 'mention-dropdown', hidden: true });

  wrap.appendChild(textarea);
  wrap.appendChild(dropdown);

  let isDropdownOpen = false;
  let currentQuery = '';
  let searchStartIndex = -1;
  let localPeople = [...people]; // Cache fetched people

  function closeDropdown() {
    dropdown.hidden = true;
    isDropdownOpen = false;
    searchStartIndex = -1;
    currentQuery = '';
  }

  function openDropdown(query, startIndex, rect) {
    isDropdownOpen = true;
    currentQuery = query;
    searchStartIndex = startIndex;
    dropdown.hidden = false;

    // Position relative to caret (simplified: top of textarea for now, or just below cursor)
    // A robust implementation requires a mirror div to calculate caret position,
    // but for simplicity and performance, we'll anchor it to the textarea's bottom-left.
    // However, a true inline dropdown is better. Let's use fixed positioning based on textarea rect.
    const wrapRect = wrap.getBoundingClientRect();
    dropdown.style.top = `${textarea.offsetTop + textarea.offsetHeight}px`;
    dropdown.style.left = '0px';
    dropdown.style.width = `${textarea.offsetWidth}px`;

    renderOptions();
  }

  async function ensurePeopleLoaded() {
    if (localPeople.length > 0) return;
    try {
      const res = await peopleService.list({ limit: 200 });
      localPeople = res.items;
    } catch (err) {
      console.error('Failed to load people for mentions', err);
    }
  }

  function renderOptions() {
    dropdown.innerHTML = '';
    const q = currentQuery.toLowerCase();
    const filtered = localPeople.filter(p => 
      (p.full_name && p.full_name.toLowerCase().includes(q))
    );

    if (filtered.length === 0) {
      dropdown.appendChild(el('div', { class: 'mention-dropdown__empty' }, ['فردی یافت نشد']));
      return;
    }

    filtered.slice(0, 5).forEach(person => {
      const item = el('button', {
        type: 'button',
        class: 'mention-dropdown__item',
        on: {
          click: (e) => {
            e.preventDefault();
            insertMention(person);
          }
        }
      }, [
        el('span', { class: 'avatar avatar--xs' }, [
          person.avatar_url ? el('img', { src: person.avatar_url }) : person.full_name.charAt(0)
        ]),
        el('span', { class: 'mention-dropdown__name' }, [person.full_name])
      ]);
      dropdown.appendChild(item);
    });
  }

  function insertMention(person) {
    const value = textarea.value;
    const before = value.slice(0, searchStartIndex);
    const after = value.slice(textarea.selectionStart);
    
    // Insert [@Name](id) followed by a space
    const insertedText = `[@${person.full_name}](${person.id}) `;
    
    textarea.value = before + insertedText + after;
    
    // Move caret
    const newPos = before.length + insertedText.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();

    closeDropdown();
  }

  textarea.addEventListener('input', async (e) => {
    const value = textarea.value;
    const cursor = textarea.selectionStart;

    // Check if user just typed '@'
    const textBeforeCursor = value.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1) {
      // Check if there's a space before @ (to avoid emails)
      const charBeforeAt = textBeforeCursor[lastAt - 1];
      if (lastAt === 0 || charBeforeAt === ' ' || charBeforeAt === '\n') {
        const query = textBeforeCursor.slice(lastAt + 1);
        // Only trigger if query has no spaces (or is empty) and no closing bracket
        if (!query.includes(' ') && !query.includes(']')) {
          await ensurePeopleLoaded();
          openDropdown(query, lastAt);
          return;
        }
      }
    }

    if (isDropdownOpen) closeDropdown();
  });

  textarea.addEventListener('keydown', (e) => {
    if (!isDropdownOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Select first option
      const firstItem = dropdown.querySelector('.mention-dropdown__item');
      if (firstItem) firstItem.click();
    }
  });

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (isDropdownOpen && !wrap.contains(e.target)) {
      closeDropdown();
    }
  });

  return {
    node: wrap,
    input: textarea,
    getValue: () => textarea.value,
    setValue: (val) => { textarea.value = val; },
    focus: () => textarea.focus(),
  };
}