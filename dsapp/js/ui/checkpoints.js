// js/ui/checkpoints.js
import { el, clear, timeAgo } from './dom.js';

export function renderCheckpoints(items, handlers = {}) {
  const list = document.getElementById('cp-list');
  if (!list) return;
  clear(list);

  if (!items || !items.length) {
    list.appendChild(el('div', { class: 'empty' },
      el('h3', {}, 'No checkpoints'),
      el('p', { class: 'muted small' }, 'Checkpoints snapshot text files locally. The agent creates them before risky writes.')
    ));
    return;
  }

  const sorted = items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const cp of sorted) {
    const fileCount = cp.files ? Object.keys(cp.files).length : 0;
    list.appendChild(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, cp.label || 'Checkpoint'),
        el('div', { class: 'row-meta' },
          el('span', {}, `${fileCount} file${fileCount === 1 ? '' : 's'}`),
          el('span', {}, cp.createdAt ? timeAgo(cp.createdAt) : '')
        )
      ),
      el('div', { class: 'row-actions' },
        el('button', {
          class: 'btn ghost small',
          onclick: () => handlers.onRestore?.(cp),
        }, 'Restore'),
        el('button', {
          class: 'btn icon tiny',
          title: 'Delete checkpoint',
          onclick: () => handlers.onDelete?.(cp),
        }, '×')
      )
    ));
  }
}
