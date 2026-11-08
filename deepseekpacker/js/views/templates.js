// Templates view — bootstrap a new pack from a starter template.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State } from '../core/state.js';
import { TEMPLATES } from '../core/templates.js';
import { ingest } from '../core/ingest.js';
import { bytesFromText, countLines } from '../utils/bytes.js';
import { extname, fileKind, basename } from '../utils/format.js';
import { fmtBytes, fmtNum } from '../utils/format.js';
import { toast, toastOk, toastWarn } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { navigate, renderRoute } from '../ui/router.js';

export function mountTemplates(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHead());
    const grid = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--sp-3)',
      },
    });
    for (const t of TEMPLATES) grid.appendChild(buildCard(t));
    shell.appendChild(grid);
  }

  render();

  const unsub = () => {};
  return unsub;
}

function buildHead() {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Templates' }),
    el('p', { text: 'Bootstrap the pack from a starter. Choose "Replace" to start fresh, or "Merge" to add to what you already have.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('dashboard'),
      text: '← Back',
    }),
  ]));
  return head;
}

function buildCard(tpl) {
  const card = el('section', {
    class: 'card',
    style: { display: 'flex', flexDirection: 'column', height: '100%' },
  });

  const head = el('div', { class: 'card-head' });
  head.appendChild(el('div', { class: 'card-title' }, [
    el('span', { class: 'dot' }),
    el('span', { text: tpl.name }),
  ]));
  head.appendChild(el('span', {
    style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
    text: tpl.files.length + ' file' + (tpl.files.length === 1 ? '' : 's'),
  }));
  card.appendChild(head);

  const body = el('div', { class: 'card-body', style: { flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: '8px' } });
  body.appendChild(el('div', {
    style: { fontSize: 'var(--fs-xs)', color: 'var(--muted)', lineHeight: '1.6' },
    text: tpl.description,
  }));

  const totalBytes = tpl.files.reduce((acc, f) => acc + bytesFromText(f.content).length, 0);
  body.appendChild(el('div', {
    style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' },
    text: 'Total: ' + fmtBytes(totalBytes) + ' · ' + fmtNum(tpl.files.reduce((acc, f) => acc + countLines(f.content), 0)) + ' lines',
  }));

  body.appendChild(buildFileList(tpl.files));
  card.appendChild(body);

  const foot = el('div', {
    class: 'card-foot',
    style: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  });

  foot.appendChild(el('button', {
    class: 'btn btn-primary btn-sm',
    type: 'button',
    onClick: () => applyTemplate(tpl, { merge: false }),
    text: 'Replace pack',
  }));

  foot.appendChild(el('button', {
    class: 'btn btn-sm',
    type: 'button',
    onClick: () => applyTemplate(tpl, { merge: true }),
    text: 'Merge',
  }));

  foot.appendChild(el('button', {
    class: 'btn btn-sm',
    type: 'button',
    onClick: async () => {
      const text = tpl.files
        .map((f) => '{[[FILE: ' + f.path + ']]}\n' + f.content + '\n{[[END: ' + f.path + ']]}')
        .join('\n\n');
      const ok = await copyToClipboard(text);
      toastOk(ok ? 'Copied template as paste blocks' : 'Copy failed');
    },
    text: '⎘ Copy',
  }));

  card.appendChild(foot);
  return card;
}

function buildFileList(files) {
  const list = el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      marginTop: '4px',
      maxHeight: '140px',
      overflowY: 'auto',
    },
  });
  for (const f of files) {
    list.appendChild(el('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--fs-2xs)',
        color: 'var(--muted)',
        fontVariantNumeric: 'tabular-nums',
      },
    }, [
      el('span', {
        class: 'file-ext',
        dataset: { kind: fileKind(f.path) },
        style: { width: '22px', height: '22px', fontSize: '9px' },
        text: (extname(f.path) || 'txt').slice(0, 4),
      }),
      el('span', {
        style: { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        text: f.path,
      }),
      el('span', { text: fmtBytes(bytesFromText(f.content).length) }),
    ]));
  }
  return list;
}

async function applyTemplate(tpl, options) {
  if (!options.merge && State.files.size) {
    const ok = await confirmDialog(
      'Replace the current pack with ' + tpl.files.length + ' template file' + (tpl.files.length === 1 ? '' : 's') + '?',
      { title: 'Replace pack', confirmLabel: 'Replace', variant: 'danger' }
    );
    if (!ok) return;
  }

  const text = tpl.files
    .map((f) => '{[[FILE: ' + f.path + ']]}\n' + f.content + '\n{[[END: ' + f.path + ']]}')
    .join('\n\n');

  if (!options.merge) {
    State.files.clear();
    State.failures.clear();
    State.ui.selected.clear();
  }

  const entry = ingest(text, { source: 'template' });
  if (!entry) {
    toastWarn('Template application failed');
    return;
  }

  toastOk((options.merge ? 'Merged ' : 'Replaced with ') + tpl.name);
  renderRoute('files');
}
