/**
 * Single entry (text box) in a Tell-all.
 * Renders title (if present) and content with parsed mentions.
 * Supports edit/delete for authorized users.
 */

import { el, icon } from '../utils/dom.js';
import { renderMentions } from '../utils/mentions.js';
import { formatDate, initials, timeAgo } from '../utils/format.js';
import { appStore } from '../core/store.js';

export function createTellallEntry(entry, { canEdit = false, onDelete, onEdit } = {}) {
  const user = appStore.get('user');
  const authorName = entry.profiles?.display_name || 'کاربر';
  const authorAvatar = entry.profiles?.avatar_url;

  // Parse content into safe HTML with mention links
  const htmlContent = renderMentions(entry.content);

  const contentNode = el('div', {
    class: 'tellall-entry__content',
    html: htmlContent,
  });

  // If title is provided, it gets a nice styled heading.
  // If not, we just don't render the heading element. The spacing is managed by CSS.
  const titleNode = entry.title 
    ? el('h3', { class: 'tellall-entry__title' }, [entry.title]) 
    : null;

  const deleteBtn = (canEdit || user?.id === entry.author_id)
    ? el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--icon btn--sm tellall-entry__action',
        title: 'حذف',
        style: { color: 'var(--danger-500)' },
        on: { click: () => onDelete?.(entry) }
      }, [icon('trash')])
    : null;

  const editBtn = (canEdit || user?.id === entry.author_id)
    ? el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--icon btn--sm tellall-entry__action',
        title: 'ویرایش',
        on: { click: () => onEdit?.(entry) }
      }, [icon('edit')])
    : null;

  return el('div', { class: 'tellall-entry', dataset: { id: entry.id } }, [
    el('div', { class: 'tellall-entry__header' }, [
      el('span', { class: 'avatar avatar--sm' }, [
        authorAvatar ? el('img', { src: authorAvatar }) : initials(authorName)
      ]),
      el('div', { class: 'tellall-entry__meta' }, [
        el('span', { class: 'tellall-entry__author' }, [authorName]),
        el('span', { class: 'tellall-entry__time', title: formatDate(entry.created_at, { withTime: true }) }, [timeAgo(entry.created_at)]),
      ]),
      el('div', { class: 'tellall-entry__actions' }, [editBtn, deleteBtn].filter(Boolean))
    ]),
    el('div', { class: 'tellall-entry__body' }, [
      titleNode,
      contentNode
    ])
  ]);
}