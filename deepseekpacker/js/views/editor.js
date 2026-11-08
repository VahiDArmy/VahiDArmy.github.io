// Editor view — edit a single file's content with line-numbered textarea.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe, getFileList, sortFiles } from '../core/state.js';
import { fmtBytes, fmtNum, basename, dirname, extLabel, fileKind } from '../utils/format.js';
import { updateFileContent } from '../core/ingest.js';
import { navigate } from '../ui/router.js';
import { toast, toastOk, toastWarn } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';

export function mountEditor(root, params = {}) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  let currentPath = params.path || State.ui.editingPath || null;
  if (!currentPath && State.files.size) {
    const first = sortFiles(getFileList())[0];
    if (first) currentPath = first.path;
  }
  State.ui.editingPath = currentPath;

  function render() {
    clear(shell);
    shell.appendChild(buildHeader());
    if (!State.files.size) {
      shell.appendChild(buildEmpty());
      return;
    }
    if (!currentPath || !State.files.has(currentPath)) {
      const first = sortFiles(getFileList())[0];
      currentPath = first ? first.path : null;
      State.ui.editingPath = currentPath;
    }
    if (!currentPath) {
      shell.appendChild(buildEmpty());
      return;
    }
    shell.appendChild(buildEditor(currentPath));
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'files' || type === 'settings') {
      if (currentPath && !State.files.has(currentPath)) {
        currentPath = sortFiles(getFileList())[0] ? sortFiles(getFileList())[0].path : null;
        State.ui.editingPath = currentPath;
      }
      render();
    }
  });

  return () => unsub();
}

function buildHeader() {
  const head = el('div', { class: 'view-head' });
  const title = el('div', { class: 'view-title' }, [
    el('h1', { text: 'Editor' }),
    el('p', {
      text: State.files.size
        ? 'Edit content and changes will be saved to the pack immediately.'
        : 'Pack a file first to edit its content.',
    }),
  ]);
  head.appendChild(title);
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('files'),
      text: '← Back to files',
    }),
  ]));
  return head;
}

function buildEmpty() {
  return el('div', { class: 'card' }, [
    el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', html: '✎' }),
      el('div', { class: 'empty-title', text: 'Nothing to edit' }),
      el('div', { class: 'empty-sub', text: 'Paste FILE/END blocks first, or drop a .zip file to unpack it.' }),
      el('div', { class: 'empty-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          type: 'button',
          onClick: () => navigate('help'),
        }, ['View format']),
      ]),
    ]),
  ]);
}

function buildEditor(path) {
  const file = State.files.get(path);
  const wrap = el('div', { class: 'editor-shell' });

  const main = el('div', { class: 'editor-main' });
  const card = el('section', { class: 'card' });

  const head = el('div', { class: 'card-head' });
  head.appendChild(el('div', { class: 'card-title' }, [
    el('span', { class: 'dot' }),
    el('span', { text: path }),
  ]));
  const headActions = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });

  const filePicker = el('select', { class: 'select', style: { minWidth: '180px', maxWidth: '260px' } });
  const allFiles = sortFiles(getFileList());
  for (const f of allFiles) {
    const opt = el('option', { value: f.path, text: f.path });
    if (f.path === path) opt.selected = true;
    filePicker.appendChild(opt);
  }
  filePicker.addEventListener('change', () => {
    navigate('editor', { path: filePicker.value });
  });
  headActions.appendChild(filePicker);

  head.appendChild(headActions);
  card.appendChild(head);

  const gutter = el('div', { class: 'editor-gutter' });
  const lineNo = el('div', { class: 'editor-lines' });
  const area = el('textarea', {
    class: 'editor-area',
    spellcheck: false,
    autocomplete: 'off',
    autocapitalize: 'off',
    dataset: { allowPaste: 'true' },
  });
  area.value = file.content;

  function updateLines() {
    const count = area.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= count; i++) html += i + '\n';
    lineNo.textContent = html;
    lineNo.scrollTop = area.scrollTop;
  }
  updateLines();

  area.addEventListener('input', () => updateLines());
  area.addEventListener('scroll', () => { lineNo.scrollTop = area.scrollTop; });
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = area.selectionStart;
      const end = area.selectionEnd;
      const value = area.value;
      area.value = value.slice(0, start) + '  ' + value.slice(end);
      area.selectionStart = area.selectionEnd = start + 2;
      updateLines();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  gutter.appendChild(lineNo);
  gutter.appendChild(area);
  card.appendChild(gutter);

  const foot = el('div', { class: 'card-foot', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } });
  foot.appendChild(el('button', {
    class: 'btn btn-primary',
    type: 'button',
    onClick: () => save(),
    text: 'Save changes',
  }));
  foot.appendChild(el('button', {
    class: 'btn',
    type: 'button',
    onClick: () => {
      area.value = file.content;
      updateLines();
      toast('Reverted');
    },
    text: 'Revert',
  }));
  foot.appendChild(el('button', {
    class: 'btn',
    type: 'button',
    onClick: async () => {
      const text = '{[[FILE: ' + path + ']]}\n' + area.value + '\n{[[END: ' + path + ']]}';
      const ok = await copyToClipboard(text);
      toastOk(ok ? 'Copied markers' : 'Copy failed');
    },
    text: '⎘ Copy markers',
  }));
  foot.appendChild(el('span', {
    style: { marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--muted)' },
    text: 'Ctrl+S saves',
  }));
  card.appendChild(foot);

  main.appendChild(card);
  wrap.appendChild(main);

  const side = el('aside', { class: 'editor-side' });
  side.appendChild(buildMetaCard(file, area));
  side.appendChild(buildStatusCard(file));
  wrap.appendChild(side);

  function save() {
    const value = area.value;
    if (value === file.content) {
      toast('No changes to save');
      return;
    }
    updateFileContent(path, value);
    toastOk('Saved ' + basename(path));
  }

  return wrap;
}

function buildMetaCard(file, area) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Metadata' })]),
  ]));
  const body = el('div', { class: 'card-body' });
  const dl = el('dl', { style: { margin: 0 } });

  function kv(k, v) {
    dl.appendChild(el('div', { class: 'kv' }, [
      el('dt', { text: k }),
      el('dd', { text: v }),
    ]));
  }

  kv('Path', file.path);
  kv('Dir', dirname(file.path) || '—');
  kv('Extension', file.ext || 'none');
  kv('Kind', file.kind || 'other');
  kv('Size', fmtBytes(file.bytes.length));
  kv('Lines', fmtNum(file.lineCount || 0));
  kv('Status', file.status);
  if (file.failure) kv('Failure', file.failure);
  kv('Edited', file.edited ? 'yes' : 'no');
  kv('CRC32', (file.crc >>> 0).toString(16).padStart(8, '0'));

  body.appendChild(dl);
  card.appendChild(body);
  return card;
}

function buildStatusCard(file) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Danger zone' })]),
  ]));
  const body = el('div', { class: 'card-body', style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  body.appendChild(el('p', {
    style: { fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 },
    text: 'Removing a file is immediate. There is no undo.',
  }));

  body.appendChild(el('button', {
    class: 'btn btn-danger btn-block',
    type: 'button',
    onClick: async () => {
      const ok = await confirmDialog(
        'Delete ' + file.path + ' from the pack?',
        { title: 'Delete file', confirmLabel: 'Delete', variant: 'danger' }
      );
      if (!ok) return;
      const { deleteFile } = await import('../core/state.js');
      deleteFile(file.path);
      toastOk('Deleted');
    },
    text: 'Delete this file',
  }));

  card.appendChild(body);
  return card;
}
