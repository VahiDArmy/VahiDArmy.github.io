import { el, clear, statusBadge } from '../dom.js';
import { toast } from '../toast.js';
import { promptDialog, confirmDialog, openModal } from '../modal.js';
import { listRoadmap, upsertRoadmapItem, deleteRoadmapItem } from '../../services/db.js';
import { state } from '../../state.js';

export async function renderRoadmap(root, ctx) {
  clear(root);
  if (!state.currentProject) {
    root.appendChild(el('div', { class: 'empty' }, 'Open a project first.'));
    return;
  }
  root.appendChild(el('div', { class: 'panel-header' },
    el('h2', {}, 'Roadmap'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => editItem(null, ctx) }, '+ Item')
  ));

  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  let items;
  try {
    items = await listRoadmap(state.currentProject.id);
    state.roadmap = items;
  } catch (err) {
    scroll.appendChild(el('div', { class: 'empty' }, err.message));
    return;
  }
  if (!items.length) {
    scroll.appendChild(el('div', { class: 'empty' }, 'No roadmap items yet. Ask the AI to create a plan, or add one manually.'));
    return;
  }

  // Group by phase
  const phases = new Map();
  for (const it of items) {
    if (!phases.has(it.phase)) phases.set(it.phase, []);
    phases.get(it.phase).push(it);
  }
  for (const [phase, list] of phases) {
    scroll.appendChild(el('div', { class: 'muted small mt-16' }, phase));
    for (const it of list) {
      const card = el('div', { class: 'card' });
      const row = el('div', { class: 'row' });
      row.appendChild(el('div', { class: 'card-title', style: 'flex:1' }, it.title));
      row.appendChild(statusBadge(it.status));
      card.appendChild(row);
      if (it.description) card.appendChild(el('div', { class: 'card-meta mt-8' }, it.description));

      const actions = el('div', { class: 'row mt-16 gap-sm wrap' });
      actions.appendChild(el('button', { class: 'btn btn-sm', onclick: () => cycleStatus(it, ctx) }, 'Advance status'));
      actions.appendChild(el('button', { class: 'btn btn-sm btn-ghost', onclick: () => editItem(it, ctx) }, 'Edit'));
      actions.appendChild(el('button', { class: 'btn btn-sm btn-ghost', onclick: async () => {
        const ok = await confirmDialog({ title: 'Delete item?', message: it.title, confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        try {
          await deleteRoadmapItem(it.id);
          renderRoadmap(root, ctx);
        } catch (err) { toast(err.message, 'error'); }
      } }, 'Delete'));
      card.appendChild(actions);
      scroll.appendChild(card);
    }
  }
}

async function cycleStatus(item, ctx) {
  const next = {
    pending: 'in_progress',
    in_progress: 'completed',
    completed: 'pending',
    blocked: 'in_progress',
    failed: 'in_progress',
  }[item.status] || 'pending';
  try {
    await upsertRoadmapItem(state.currentProject.id, { ...item, status: next });
    renderRoadmap(document.querySelector('.shell-main'), ctx);
  } catch (err) { toast(err.message, 'error'); }
}

function editItem(existing, ctx) {
  const titleInput = el('input', { class: 'input', type: 'text' });
  titleInput.value = existing?.title || '';
  const phaseInput = el('input', { class: 'input', type: 'text', placeholder: 'e.g. Setup' });
  phaseInput.value = existing?.phase || 'General';
  const descInput = el('textarea', { class: 'textarea', rows: 3 });
  descInput.value = existing?.description || '';
  const statusSelect = el('select', { class: 'select' });
  for (const s of ['pending', 'in_progress', 'completed', 'blocked', 'failed']) {
    const o = el('option', { value: s }, s);
    if (existing?.status === s) o.selected = true;
    statusSelect.appendChild(o);
  }
  const body = el('div', {},
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Title'), titleInput),
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Phase'), phaseInput),
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Description'), descInput),
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Status'), statusSelect)
  );
  openModal({
    title: existing ? 'Edit roadmap item' : 'New roadmap item',
    body,
    actions: [
      { label: 'Cancel' },
      { label: 'Save', variant: 'primary', onClick: async () => {
        if (!titleInput.value.trim()) { toast('Title required', 'error'); return false; }
        try {
          await upsertRoadmapItem(state.currentProject.id, {
            id: existing?.id,
            title: titleInput.value.trim(),
            phase: phaseInput.value.trim() || 'General',
            description: descInput.value.trim(),
            status: statusSelect.value,
            order_index: existing?.order_index ?? 0,
          });
          renderRoadmap(document.querySelector('.shell-main'), ctx);
        } catch (err) { toast(err.message, 'error'); return false; }
      } },
    ],
  });
}
