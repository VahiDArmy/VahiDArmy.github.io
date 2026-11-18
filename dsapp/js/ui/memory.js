// js/ui/memory.js
import { el, clear, timeAgo } from './dom.js';

export function renderMemory(items, handlers = {}) {
  const list = document.getElementById('memory-list');
  if (!list) return;
  clear(list);

  if (!items || !items.length) {
    list.appendChild(el('div', { class: 'empty' },
      el('h3', {}, 'No memory yet'),
      el('p', { class: 'muted small' }, 'Decisions, constraints and architecture notes the agent should remember.')
    ));
    return;
  }

  for (const item of items) {
    list.appendChild(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-desc' }, item.content),
        el('div', { class: 'row-meta' },
          el('span', { class: 'badge badge-neutral' }, item.kind),
          el('span', {}, `importance ${item.importance}`),
          el('span', {}, timeAgo(item.created_at))
        )
      ),
      el('div', { class: 'row-actions' },
        el('button', {
          class: 'btn icon tiny',
          title: 'Delete memory',
          onclick: () => handlers.onDelete?.(item),
        }, '×')
      )
    ));
  }
}
