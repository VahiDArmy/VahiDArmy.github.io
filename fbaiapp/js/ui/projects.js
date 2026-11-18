// ---------------------------------------------------------------------------
// Projects list: create, import, open, export, rename, delete.
// ---------------------------------------------------------------------------

import { repo } from '../core/repo.js';
import { ProjectFS, Vault } from '../core/vault.js';
import { indexProject } from '../core/project.js';
import { readZipFile } from '../core/zip.js';
import { buildZipBlob } from '../core/zip.js';
import { downloadBlob, escapeHtml, formatBytes, timeAgo } from '../core/util.js';
import { openModal, promptDialog, confirmDialog, toast, icon, emptyState } from './dom.js';

const PENDING_KEY = 'fb:pending-prompt:';

function initials(name) {
  const clean = String(name || '?').trim();
  return (clean[0] || '?').toUpperCase();
}

function projectCard(project) {
  const meta = [
    project.stack,
    `${project.file_count || 0} files`,
    project.byte_count ? formatBytes(project.byte_count) : '',
    project.last_opened_at ? `opened ${timeAgo(project.last_opened_at)}` : 'never opened',
  ].filter(Boolean);
  return `<div class="project-card" data-project="${project.id}" role="button" tabindex="0">
    <div class="project-glyph">${escapeHtml(initials(project.name))}</div>
    <div class="project-main">
      <h3>${escapeHtml(project.name)}</h3>
      ${project.description ? `<div class="small muted truncate">${escapeHtml(project.description)}</div>` : ''}
      <div class="meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('<span>·</span>')}</div>
    </div>
    <button class="btn ghost icon small" data-menu="${project.id}" aria-label="Project actions">${icon('more')}</button>
  </div>`;
}

export async function renderProjects(root, ctx) {
  root.innerHTML = `
    <div class="page-head">
      <div style="flex:1">
        <h1>Projects</h1>
        <p>Each project keeps its own files, memory and roadmap.</p>
      </div>
      <button class="btn primary" id="new-project">${icon('plus')} New</button>
    </div>
    <div id="projects-body">
      <div class="skeleton" style="height:76px;margin-bottom:11px"></div>
      <div class="skeleton" style="height:76px"></div>
    </div>`;

  const body = root.querySelector('#projects-body');

  let projects = [];
  try {
    projects = await repo.listProjects();
  } catch (err) {
    body.innerHTML = `<div class="callout danger">Could not load projects: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const paint = () => {
    if (!projects.length) {
      body.innerHTML = emptyState({
        iconName: 'folderOpen',
        title: 'No projects yet',
        body: 'Describe what you want to build and the agent will scaffold it, or import an existing project as a ZIP archive.',
        actionLabel: 'Create your first project',
        actionId: 'empty-create',
      });
      body.querySelector('#empty-create')?.addEventListener('click', () => createFlow());
      const importBtn = document.createElement('button');
      importBtn.className = 'btn';
      importBtn.innerHTML = `${icon('upload')} Import ZIP`;
      importBtn.addEventListener('click', importFlow);
      body.querySelector('.empty')?.appendChild(importBtn);
      return;
    }
    body.innerHTML = `<div class="project-list">${projects.map(projectCard).join('')}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn" id="import-zip">${icon('upload')} Import ZIP</button>
        <span class="spacer"></span>
        <span class="tiny muted">${projects.length} project${projects.length === 1 ? '' : 's'}</span>
      </div>`;
    body.querySelector('#import-zip')?.addEventListener('click', importFlow);
  };

  paint();

  body.addEventListener('click', async (event) => {
    const menuBtn = event.target.closest('[data-menu]');
    if (menuBtn) {
      event.stopPropagation();
      const project = projects.find((p) => p.id === menuBtn.dataset.menu);
      if (project) await projectMenu(project);
      return;
    }
    const card = event.target.closest('[data-project]');
    if (card) ctx.navigate(`/p/${card.dataset.project}`);
  });

  body.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-project]');
    if (card) { event.preventDefault(); ctx.navigate(`/p/${card.dataset.project}`); }
  });

  root.querySelector('#new-project').addEventListener('click', () => createFlow());

  // ---- flows --------------------------------------------------------------

  async function createFlow(prefill = {}) {
    const name = await promptDialog({
      title: 'New project',
      label: 'Name',
      placeholder: 'My landing page',
      confirmLabel: 'Next',
      value: prefill.name || '',
    });
    if (!name) return;

    const description = await promptDialog({
      title: 'What should it be?',
      label: 'Brief (optional)',
      placeholder: 'A one-page site for my bakery with a menu and contact form.',
      multiline: true,
      hint: 'The agent reads this when you first ask it to plan. You can also start from an empty project.',
      confirmLabel: 'Create project',
    });
    if (description === null) return;

    try {
      const project = await repo.createProject({ name, description });
      if (description.trim()) sessionStorage.setItem(`${PENDING_KEY}${project.id}`, description.trim());
      toast('Project created', { kind: 'ok' });
      ctx.navigate(`/p/${project.id}`);
    } catch (err) {
      toast(`Could not create the project: ${err.message}`, { kind: 'bad' });
    }
  }

  function importFlow() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const overlay = document.createElement('div');
      overlay.className = 'busy-bar';
      document.body.appendChild(overlay);
      try {
        const parsed = await readZipFile(file);
        if (!parsed.entries.length) throw new Error('No importable files were found in that archive.');
        const name = file.name.replace(/\.zip$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported project';
        const project = await repo.createProject({
          name,
          description: `Imported from ${file.name}`,
        });
        const fs = new ProjectFS(project.id);
        await fs.init();
        let written = 0;
        for (const entry of parsed.entries) {
          try {
            await fs.write(entry.path, entry.content, { binary: entry.binary });
            written += 1;
          } catch (err) {
            console.warn('skipped', entry.path, err);
          }
        }
        await indexProject(project, fs);
        toast(`Imported ${written} files${parsed.strippedRoot ? ` from ${parsed.rootName}/` : ''}`, { kind: 'ok' });
        ctx.navigate(`/p/${project.id}`);
      } catch (err) {
        toast(`Import failed: ${err.message}`, { kind: 'bad' });
      } finally {
        overlay.remove();
      }
    });
    input.click();
  }

  async function projectMenu(project) {
    const choice = await openModal({
      title: project.name,
      body: `<p class="small muted">${escapeHtml(project.description || 'No description')}</p>
        <div class="row wrap" style="margin-top:10px;gap:6px">
          <span class="badge">${escapeHtml(project.stack || 'no stack detected')}</span>
          <span class="badge">${project.file_count || 0} files</span>
          <span class="badge">${formatBytes(project.byte_count || 0)}</span>
        </div>`,
      actions: [
        { label: 'Open', value: 'open', variant: 'primary' },
        { label: 'Rename', value: 'rename' },
        { label: 'Export ZIP', value: 'export' },
        { label: 'Delete', value: 'delete', variant: 'danger' },
      ],
    });
    if (!choice) return;
    await handleChoice(project, choice);
  }

  async function handleChoice(project, choice) {
    // The modal stays open behind the next dialog, so close it first.
    if (choice === 'open') { ctx.navigate(`/p/${project.id}`); return; }

    if (choice === 'rename') {
      const name = await promptDialog({ title: 'Rename project', label: 'Name', value: project.name });
      if (!name) return;
      try {
        const updated = await repo.updateProject(project.id, { name });
        projects = projects.map((p) => (p.id === project.id ? updated : p));
        paint();
        toast('Renamed', { kind: 'ok' });
      } catch (err) {
        toast(err.message, { kind: 'bad' });
      }
      return;
    }

    if (choice === 'export') {
      try {
        const fs = new ProjectFS(project.id);
        await fs.init();
        const files = await fs.list();
        const entries = [];
        for (const file of files) {
          const record = await fs.read(file.path).catch(() => null);
          if (record) entries.push(record);
        }
        const blob = await buildZipBlob(entries, { folder: project.name.replace(/[^\w.-]+/g, '-') });
        downloadBlob(blob, `${project.name.replace(/[^\w.-]+/g, '-')}.zip`);
        toast(`Exported ${entries.length} files`, { kind: 'ok' });
      } catch (err) {
        toast(`Export failed: ${err.message}`, { kind: 'bad' });
      }
      return;
    }

    if (choice === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this project?',
        message: `"${project.name}" and its chat history, memory and local file copy will be removed.`,
        details: 'If the project is linked to a folder on your computer, that folder is left untouched.',
        confirmLabel: 'Delete project',
        danger: true,
      });
      if (!ok) return;
      try {
        await Vault.get(project.id).wipe();
        await repo.deleteProject(project.id);
        projects = projects.filter((p) => p.id !== project.id);
        paint();
        toast('Project deleted', { kind: 'ok' });
      } catch (err) {
        toast(err.message, { kind: 'bad' });
      }
    }
  }

  return () => { /* listeners live on the replaced nodes */ };
}
