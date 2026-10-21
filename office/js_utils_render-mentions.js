/**
 * Utility to render text with @mentions converted to links.
 * Used in the detail views to make names clickable.
 */

import { escapeHtml } from './dom.js';

export function renderMentions(text, people = []) {
  if (!text) return '';
  
  // 1. Escape HTML to prevent XSS
  let safeText = escapeHtml(text);

  // 2. Sort people by name length descending to avoid replacing "Ali" inside "Ali Reza"
  const sortedPeople = [...people].sort((a, b) => (b.full_name || '').length - (a.full_name || '').length);

  // 3. Replace @Name with a link
  for (const person of sortedPeople) {
    if (!person.full_name) continue;
    
    // Escape regex special characters in the name
    const escapedName = person.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`@${escapedName}`, 'g');
    
    // Removed the @ symbol from the visible link text
    const link = `<a href="#/people/${person.id}" class="mention-link">${person.full_name}</a>`;
    safeText = safeText.replace(regex, link);
  }

  // 4. Convert newlines to <br>
  return safeText.replace(/\n/g, '<br>');
}