// Snapshots view — save, load, rename, delete, and export named workspace states.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe } from '../core/state.js';
import {
  listSnapshots, saveSnapshot, deleteSnapshot, renameSnapshot,
  loadSnapshot, exportSnapshotAsJson, importSnapshotFromJson, clearAllSnapshots,
} from '../core/snapshots.js';
import { fmtBytes, fmtNum, fmtDateTime, fmtRelative } from '../utils/format.js';
import { toast, toastOk, toastWarn } from '../ui/toast.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { navigate, renderRoute } from '../ui/router.js';
import { downloadText } from '../ui/download.js';

export function mountSnapshots(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHead());
    shell.appendChild(buildCreateCard());
    shell.appendChild(buildListCard());
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'snapshots' || type === 'files') render();
  });

  return () => unsub();
}

function buildHead() {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Snapshots' }),
    el('p', { text: 'Save a named copy of the current pack and restore it anytime. Snapshots live in localStorage.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('dashboard'),
      text: '← Back',
    }),
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: async () => {
        const ok = await confirmDialog(
          'Delete every stored snapshot? Files in your current pack are unaffected.',
          { title: 'Clear snapshots', confirmLabel: 'Clear', variant: 'danger' }
        );
        if (!ok) return;
        clearAllSnapshots();
        toastOk('Snapshots cleared');
      },
      text: 'Clear all',
    }),
  ]));
  return head;
}

function buildCreateCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Create snapshot' })]),
    el('span', {
      style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
      text: State.files.size + ' files ready',
    }),
  ]));
  const body = el('div', { class: 'card-body', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });

  const input = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'Snapshot name (e.g. "before-refactor")',
    style: { flex: '1 1 240px' },
    spellcheck: false,
    maxLength: 80,
  });

  const saveBtn = el('button', {
    class: 'btn btn-primary',
    type: 'button',
    disabled: !State.files.size,
    onClick: () => {
      const result = saveSnapshot(input.value);
      if (!result.ok) {
        toastWarn(result.error || 'Save failed');
        return;
      }
      input.value = '';
      toastOk('Saved snapshot');
    },
    text: 'Save current pack',
  });

  body.appendChild(input);
  body.appendChild(saveBtn);

  body.appendChild(el('button', {
    class: 'btn',
    type: 'button',
    onClick: () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.onchange = () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = importSnapshotFromJson(reader.result);
          if (!result.ok) toastWarn(result.error);
          else toastOk('Imported snapshot');
        };
        reader.readAsText(file);
      };
      fileInput.click();
    },
    text: '⤒ Import JSON',
  }));

  card.appendChild(body);
  return card;
}

function buildListCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Stored snapshots' })]),
    el('span', {
      style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
      text: listSnapshots().length + ' total',
    }),
  ]));
  const body = el('div', { class: 'card-body flush' });

  const items = listSnapshots();
  if (!items.length) {
    body.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', html: '◫' }),
      el('div', { class: 'empty-title', text: 'No snapshots yet' }),
      el('div', { class: 'empty-sub', text: 'Save the current pack above to keep a restore point.' }),
    ]));
    card.appendChild(body);
    return card;
  }

  for (const snap of items) {
    body.appendChild(buildRow(snap));
  }

  card.appendChild(body);
  return card;
}

function buildRow(snap) {
  const row = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: '12px',
      padding: '12px 14px',
      borderBottom: '1px solid var(--line)',
      alignItems: 'center',
    },
  });

  const info = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '0' } });
  info.appendChild(el('div', {
    style: { fontSize: 'var(--fs-sm)', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    text: snap.name,
  }));
  info.appendChild(el('div', {
    style: { fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' },
    text: fmtNum(snap.fileCount || 0) + ' files · ' + fmtBytes(snap.totalBytes || 0) + ' · saved ' + fmtRelative(snap.at),
  }));
  info.appendChild(el('div', {
    style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
    text: fmtDateTime(snap.at),
  }));
  row.appendChild(info);

  const actions = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' } });

  actions.appendChild(actionBtn('↺', 'Load', 'Restore this snapshot into the current pack', async () => {
    const ok = await confirmDialog(
      'Load "' + snap.name + '"? This replaces the current pack.',
      { title: 'Load snapshot', confirmLabel: 'Load' }
    );
    if (!ok) return;
    const result = loadSnapshot(snap.id);
    if (!result.ok) { toastWarn(result.error); return; }
    toastOk('Loaded ' + snap.name);
    renderRoute('files');
  }));

  actions.appendChild(actionBtn('⇋', 'Merge', 'Merge this snapshot into the current pack', async () => {
    const result = loadSnapshot(snap.id, { merge: true });
    if (!result.ok) { toastWarn(result.error); return; }
    toastOk('Merged ' + snap.name);
  }));

  actions.appendChild(actionBtn('✎', 'Rename', 'Rename snapshot', () => {
    const input = el('input', { class: 'input', type: 'text', value: snap.name });
    const m = openModal({
      title: 'Rename snapshot',
      body: el('div', { class: 'field' }, [
        el('label', { class: 'field-label', text: 'Name' }),
        input,
      ]),
      buttons: [
        { label: 'Cancel' },
        {
          label: 'Rename',
          variant: 'primary',
          keepOpen: true,
          onClick: () => {
            if (!renameSnapshot(snap.id, input.value)) { toastWarn('Rename failed'); return; }
            m.close();
            toastOk('Renamed');
          },
        },
      ],
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }));

  actions.appendChild(actionBtn('⎘', 'Export', 'Download snapshot JSON', () => {
    const json = exportSnapshotAsJson(snap.id);
    if (!json) return toastWarn('Export failed');
    downloadText(json, 'snapshot-' + snap.name.replace(/[^a-z0-9-_]+/gi, '-') + '.json');
    toastOk('Exported');
  }));

  actions.appendChild(actionBtn('✕', 'Delete', 'Delete snapshot', async () => {
    const ok = await confirmDialog(
      'Delete snapshot "' + snap.name + '"?',
      { title: 'Delete snapshot', confirmLabel: 'Delete', variant: 'danger' }
    );
    if (!ok) return;
    deleteSnapshot(snap.id);
    toastOk('Deleted');
  }));

  row.appendChild(actions);
  return row;
}

function actionBtn(icon, label, tip, onClick) {
  const btn = el('button', {
    class: 'icon-btn',
    type: 'button',
    title: tip,
    'aria-label': label,
    html: icon,
    onClick,
  });
  return btn;
}
