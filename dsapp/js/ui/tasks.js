// js/ui/tasks.js
import { el, clear, statusBadge, timeAgo } from './dom.js';

export function renderTasks(items) {
  const list = document.getElementById('task-list');
  if (!list) return;
  clear(list);

  if (!items || !items.length) {
    list.appendChild(el('div', { class: 'empty' },
      el('h3', {}, 'No tasks yet'),
      el('p', { class: 'muted small' }, 'Every agent run is recorded here with its status and result.')
    ));
    return;
  }

  for (const task of items) {
    const summary = task.result_summary || '';
    list.appendChild(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, task.title),
        summary ? el('div', { class: 'row-desc' }, summary.length > 400 ? `${summary.slice(0, 400)}…` : summary) : null,
        el('div', { class: 'row-meta' },
          statusBadge(task.status),
          task.model ? el('span', {}, task.model) : null,
          el('span', {}, timeAgo(task.created_at))
        )
      )
    ));
  }
}
