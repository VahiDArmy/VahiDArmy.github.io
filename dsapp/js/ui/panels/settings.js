import { el, clear } from '../dom.js';
import { toast } from '../toast.js';
import { confirmDialog, openModal } from '../modal.js';
import { state } from '../../state.js';
import {
  getOpenRouterKey, setOpenRouterKey, syncModels, loadModelsAndPrefs,
} from '../../services/models.js';
import { signOut } from '../../services/auth.js';
import { listCheckpointRows, deleteCheckpointRow } from '../../services/db.js';
import { listCheckpoints, restoreCheckpoint, deleteCheckpoint } from '../../services/checkpoints.js';

export async function renderSettings(root, ctx) {
  clear(root);
  root.appendChild(el('div', { class: 'panel-header' }, el('h2', {}, 'Settings')));
  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  // --- API key
  scroll.appendChild(el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'OpenRouter API key'),
    el('div', { class: 'card-meta mt-8' }, 'Stored locally in this browser. Never sent to Supabase.'),
    (() => {
      const input = el('input', { class: 'input mt-8', type: 'password', placeholder: 'sk-or-…' });
      input.value = getOpenRouterKey();
      const save = el('button', { class: 'btn btn-primary btn-sm mt-8', onclick: () => {
        setOpenRouterKey(input.value.trim());
        toast('Key saved', 'success');
      } }, 'Save');
      return el('div', { class: 'mt-8' }, input, save);
    })(),
    el('div', { class: 'row gap-sm wrap mt-16' },
      el('button', { class: 'btn btn-sm', onclick: async () => {
        try {
          toast('Syncing…');
          await syncModels();
          const { models, prefs } = await loadModelsAndPrefs();
          state.models = models;
          state.modelPrefs = prefs;
          toast(`Synced ${models.length} models`, 'success');
        } catch (err) { toast(err.message, 'error'); }
      } }, 'Sync model registry'),
    )
  ));

  // --- User
  scroll.appendChild(el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Account'),
    el('div', { class: 'card-meta mt-8' }, state.user?.email || 'Signed in'),
    el('button', { class: 'btn btn-sm btn-danger mt-16', onclick: async () => {
      const ok = await confirmDialog({ title: 'Sign out?', message: 'You can sign back in anytime.', confirmLabel: 'Sign out', danger: true });
      if (!ok) return;
      try { await signOut(); location.reload(); }
      catch (err) { toast(err.message, 'error'); }
    } }, 'Sign out')
  ));

  // --- Checkpoints
  const cpCard = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Checkpoints'),
    el('div', { class: 'card-meta mt-8' }, 'Snapshots of project files. Stored in this browser.'),
  );
  scroll.appendChild(cpCard);
  const cps = state.currentProject ? await listCheckpoints(state.currentProject.id).catch(() => []) : [];
  if (!cps.length) {
    cpCard.appendChild(el('div', { class: 'muted small mt-8' }, 'No checkpoints yet.'));
  } else {
    for (const cp of cps.slice().reverse()) {
      const row = el('div', { class: 'row mt-8 gap-sm' });
      row.appendChild(el('div', { class: 'small', style: 'flex:1' },
        el('div', {}, cp.label),
        el('div', { class: 'muted small' },
          `${Object.keys(cp.files).length} files · ${new Date(cp.createdAt).toLocaleString()}`)
      ));
      row.appendChild(el('button', { class: 'btn btn-sm', onclick: async () => {
        const ok = await confirmDialog({ title: 'Restore checkpoint?', message: 'Files will be overwritten with the snapshot contents.', confirmLabel: 'Restore' });
        if (!ok) return;
        try {
          if (!state.fs) throw new Error('No filesystem');
          const res = await restoreCheckpoint(state.fs, cp.id);
          toast(`Restored ${res.restored} files`, 'success');
        } catch (err) { toast(err.message, 'error'); }
      } }, 'Restore'));
      row.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
        try { await deleteCheckpoint(cp.id); renderSettings(root, ctx); }
        catch (err) { toast(err.message, 'error'); }
      } }, '✕'));
      cpCard.appendChild(row);
    }
  }

  // --- About
  scroll.appendChild(el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'About'),
    el('div', { class: 'card-meta mt-8' }, 'DevSpace — browser-only AI development workspace. Your files stay on your device.')
  ));
}
