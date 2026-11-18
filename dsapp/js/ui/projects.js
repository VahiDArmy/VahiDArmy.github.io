// js/ui/projects.js
import { el, clear, timeAgo } from './dom.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';

export function renderProjects(projects, currentId, { onOpen, onDelete }) {
  const list = document.getElementById('project-list');
  clear(list);

  if (!projects.length) {
    list.appendChild(el('p', { class: 'muted small pad' }, 'No projects yet. Create one to begin.'));
    return;
  }

  for (const p of projects) {
    const row = el('div', {
      class: `project-row ${p.id === currentId ? 'active' : ''}`,
      title: p.description || p.name,
      onclick: () => onOpen(p.id),
    },
      el('div', { class: 'project-name' }, p.name),
      el('div', { class: 'muted small' }, `${p.fs_mode === 'fsa' ? 'local folder' : 'virtual'} · ${timeAgo(p.updated_at)}`)
    );

    row.appendChild(el('button', {
      class: 'btn icon tiny',
      title: 'Delete project',
      onclick: (e) => { e.stopPropagation(); onDelete(p); },
    }, '×'));

    list.appendChild(row);
  }
}

export function openNewProjectModal({ onCreate }) {
  const name = el('input', { class: 'input', placeholder: 'My app' });
  const desc = el('textarea', { class: 'input', rows: 3, placeholder: 'What are we building?' });
  const mode = el('select', { class: 'input' },
    el('option', { value: 'virtual' }, 'Virtual workspace — works in every browser'),
    el('option', { value: 'fsa' }, 'Local folder — Chromium desktop & Android only')
  );

  const body = el('div', { class: 'form' },
    el('label', {}, 'Name', name),
    el('label', {}, 'Description', desc),
    el('label', {}, 'Workspace mode', mode)
  );

  const modal = openModal({
    title: 'New project',
    body,
    actions: [
      { label: 'Cancel' },
      {
        label: 'Create',
        variant: 'primary',
        onClick: async (close) => {
          const n = name.value.trim();
          if (!n) { toast('A project name is required.', 'error'); return; }
          try {
            await onCreate({ name: n, description: desc.value.trim(), fsMode: mode.value });
            close();
          } catch (e) {
            toast(`Could not create project: ${e.message}`, 'error');
          }
        },
      },
    ],
  });

  setTimeout(() => name.focus(), 40);
  return modal;
}
