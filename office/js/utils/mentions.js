/**
 * Mention utilities — parsing and rendering user mentions inside text.
 * Format: [@Display Name](user_id)
 */

import { escapeHtml } from './dom.js';

/**
 * Safely parses text containing [@Name](uuid) mentions into HTML links.
 * @param {string} text Raw text from database
 * @returns {string} Safe HTML string
 */
export function renderMentions(text) {
  if (!text) return '';

  // 1. Escape HTML to prevent XSS
  const escaped = escapeHtml(text);

  // 2. Replace mentions [@Name](uuid) with links
  // Regex looks for [@ ... ]( ... )
  const withLinks = escaped.replace(/\[@([^\]]+)\]\(([a-zA-Z0-9-]+)\)/g, (match, name, id) => {
    return `<a href="#/people/${id}" class="mention-link">@${name}</a>`;
  });

  // 3. Convert newlines to <br>
  return withLinks.replace(/\n/g, '<br>');
}

/**
 * Extracts all user IDs mentioned in a text block.
 * @param {string} text
 * @returns {string[]} Array of UUIDs
 */
export function extractMentionIds(text) {
  if (!text) return [];
  const regex = /\[@([^\]]+)\]\(([a-zA-Z0-9-]+)\)/g;
  const ids = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}