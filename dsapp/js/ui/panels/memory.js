import { el, clear, timeAgo } from '../dom.js';
import { toast } from '../toast.js';
import { promptDialog, confirmDialog } from '../modal.js';
import { listMemory, addMemory, deleteMemory } from '../../services/db.js';
import { state } from '../../state.js';

export async function renderMemory(root, ctx) {
  clear(root);
  if (!state.currentProject) {
    root.appendChild(el('div', { class: 'empty' }, 'Open a project first.'));
    return;
  }
  root.appendChild(el('div', { class: 'panel-header' },
    el('h2', {}, 'Memory'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => createNote(ctx) }, '+ Note')
  ));

  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  let items;
  try {
    items = await listMemory(state.currentProject.id, 300);
    state.memory = items;
  } catch (err) {
    scroll.appendChild(el('div', { class: 'empty' }, err.message));
    return;
  }
  if (!items.length) {
    scroll.appendChild(el('div', { class: 'empty' }, 'No memory yet. The AI stores decisions and constraints here as you work.'));
    return;
  }

  for (const m of items) {
    const card = el('div', { class: 'card' });
    const row = el('div', { class: 'row' });
    row.appendChild(el('span', { class: 'badge badge-pending' }, m.kind));
    row.appendChild(el('span', { class: 'muted small' }, `importance ${m.importance}`));
    row.appendChild(el('div', { class: 'spacer' }));
    row.appendChild(el('span', { class: 'muted small' }, timeAgo(m.created_at)));
    card.appendChild(row);
    const body = el('div', { class: 'mt-8' });
    body.textContent = m.content;
    card.appendChild(body);
    card.appendChild(el('div', { class: 'row mt-16' },
      el('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
        const ok = await confirmDialog({ title: 'Delete note?', message: 'This note will be removed.', confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        try { await deleteMemory(m.id); renderMemory(document.querySelector('.shell-main'), ctx); }
        catch (err) { toast(err.message, 'error'); }
      } }, 'Delete')
    ));
    scroll.appendChild(card);
  }
}

async function createNote(ctx) {
  const kind = prompt;
  const content = await promptDialog({
    title: 'Add memory note',
    label: 'Content',
    multiline: true,
  });
  if (!content) return;
  try {
    await addMemory(state.currentProject.id, { kind: 'note', content, importance: 3 });
    renderMemory(document.querySelector('.shell-main'), ctx);
  } catch (err) { toast(err.message, 'error'); }
}
