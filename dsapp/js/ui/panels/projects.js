import { el, clear, timeAgo } from '../dom.js';
import { toast } from '../toast.js';
import { openModal, confirmDialog } from '../modal.js';
import { listProjects, createProject, deleteProject } from '../../services/db.js';
import { state } from '../../state.js';

export async function renderProjects(root, ctx) {
  clear(root);
  root.appendChild(el('div', { class: 'panel-header' },
    el('h2', {}, 'Projects'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-primary btn-sm', onclick: () => showCreateModal(ctx) }, '+ New')
  ));

  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  let projects;
  try {
    projects = await listProjects();
    ctx.setProjects?.(projects);
  } catch (err) {
    scroll.appendChild(el('div', { class: 'empty' }, `Failed to load projects: ${err.message}`));
    return;
  }

  if (!projects.length) {
    scroll.appendChild(el('div', { class: 'empty' }, 'No projects yet. Create one to begin.'));
    return;
  }

  for (const p of projects) {
    const isCurrent = state.currentProject?.id === p.id;
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-title' }, p.name));
    if (p.description) card.appendChild(el('div', { class: 'card-meta mt-8' }, p.description));
    card.appendChild(el('div', { class: 'card-meta mt-8' },
      `${p.fs_mode === 'fsa' ? 'Local folder' : 'Virtual workspace'} · updated ${timeAgo(p.updated_at)}`));

    const actions = el('div', { class: 'row mt-16 gap-sm wrap' });
    if (!isCurrent) {
      actions.appendChild(el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => ctx.openProject(p.id),
      }, 'Open'));
    } else {
      actions.appendChild(el('button', {
        class: 'btn btn-sm',
        onclick: () => ctx.navigate('chat'),
      }, 'Chat'));
    }
    actions.appendChild(el('button', {
      class: 'btn btn-sm btn-ghost',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Delete project?',
          message: `"${p.name}" and all of its history will be permanently removed. Local files on your device are not affected.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteProject(p.id);
          toast('Project deleted', 'success');
          if (state.currentProject?.id === p.id) {
            state.currentProject = null;
            state.fs = null;
          }
          renderProjects(root, ctx);
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    }, 'Delete'));
    card.appendChild(actions);
    scroll.appendChild(card);
  }
}

function showCreateModal(ctx) {
  const nameInput = el('input', { class: 'input', type: 'text', placeholder: 'e.g. Weather Dashboard' });
  const descInput = el('textarea', { class: 'textarea', rows: 3, placeholder: 'What is this project about?' });
  const modeSelect = el('select', { class: 'select' },
    el('option', { value: 'virtual' }, 'Virtual workspace (works everywhere)'),
    el('option', { value: 'fsa' }, 'Local folder (Chromium desktop / Android)')
  );

  const body = el('div', {},
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Name'), nameInput),
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Description'), descInput),
    el('div', { class: 'form-group' }, el('label', { class: 'label' }, 'Workspace mode'), modeSelect)
  );

  openModal({
    title: 'New project',
    body,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Create',
        variant: 'primary',
        onClick: async () => {
          const name = nameInput.value.trim();
          if (!name) { toast('Name is required', 'error'); return false; }
          try {
            const p = await createProject({
              name,
              description: descInput.value.trim(),
              fsMode: modeSelect.value,
            });
            toast('Project created', 'success');
            await ctx.openProject(p.id);
          } catch (err) {
            toast(err.message, 'error');
            return false;
          }
        },
      },
    ],
  });
  setTimeout(() => nameInput.focus(), 60);
}
