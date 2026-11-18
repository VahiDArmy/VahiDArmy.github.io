// js/ui/roadmap.js
import { el, clear, statusBadge } from './dom.js';

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'failed'];

export function renderRoadmap(items, handlers = {}) {
  const list = document.getElementById('roadmap-list');
  if (!list) return;
  clear(list);

  if (!items || !items.length) {
    list.appendChild(el('div', { class: 'empty' },
      el('h3', {}, 'No roadmap yet'),
      el('p', { class: 'muted small' }, 'Add items above, or ask the agent to plan the work.')
    ));
    return;
  }

  const phases = new Map();
  for (const item of items) {
    const phase = item.phase || 'General';
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase).push(item);
  }

  for (const [phase, phaseItems] of phases) {
    list.appendChild(el('div', { class: 'phase-head' }, phase));

    for (const item of phaseItems) {
      const statusSelect = el('select', { class: 'input small' },
        ...STATUSES.map((s) => {
          const opt = el('option', { value: s }, s.replace('_', ' '));
          if (s === item.status) opt.selected = true;
          return opt;
        })
      );
      statusSelect.addEventListener('change', () => handlers.onStatus?.(item, statusSelect.value));

      list.appendChild(el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title' }, item.title),
          item.description ? el('div', { class: 'row-desc' }, item.description) : null,
          el('div', { class: 'row-meta' }, statusBadge(item.status))
        ),
        el('div', { class: 'row-actions' },
          statusSelect,
          el('button', {
            class: 'btn icon tiny',
            title: 'Delete item',
            onclick: () => handlers.onDelete?.(item),
          }, '×')
        )
      ));
    }
  }
}
