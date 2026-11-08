// Dashboard view — Paste textarea + live file viewer + interactive stat popovers.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe, getStats, getFileList, sortFiles } from '../core/state.js';
import { ingest } from '../core/ingest.js';
import { fmtTime, fmtBytes, fmtNum, basename, extLabel, fileKind } from '../utils/format.js';
import { logText } from '../core/log.js';
import { toast, toastOk } from '../ui/toast.js';
import { handleZipFile } from '../ui/zip-flow.js';
import { openPopover } from '../ui/popover.js';
import { navigate } from '../ui/router.js';

export function mountDashboard(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  // 1. Stats Bar
  const statsContainer = el('div');
  shell.appendChild(statsContainer);

  // 2. Paste Textarea
  const pasteCard = buildPasteCard();
  shell.appendChild(pasteCard);

  // 3. Files List / Unpack
  const modeContainer = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '200px' } });
  shell.appendChild(modeContainer);

  // 4. Log Card
  const logCard = buildLogCard();
  shell.appendChild(logCard);
  const logBody = logCard.querySelector('#dash-log-body');

  // Render Functions
  function renderStats() {
    clear(statsContainer);
    const stats = getStats();
    const bar = el('div', { class: 'stats-row' });
    
    // Files Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: (e) => showPopover(e.currentTarget, () => buildFilesPopover(stats)) }, [
      el('span', { class: 'stat-label', text: 'Files' }),
      el('span', { class: `stat-value ${stats.fileCount ? 'accent' : ''}`, text: String(stats.fileCount) })
    ]));
    
    // Size Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: (e) => showPopover(e.currentTarget, () => buildSizePopover(stats)) }, [
      el('span', { class: 'stat-label', text: 'Size' }),
      el('span', { class: 'stat-value blue', text: fmtBytes(stats.totalBytes) })
    ]));
    
    // Lines Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: (e) => showPopover(e.currentTarget, () => buildLinesPopover(stats)) }, [
      el('span', { class: 'stat-label', text: 'Lines' }),
      el('span', { class: 'stat-value purple', text: fmtNum(stats.totalLines) })
    ]));
    
    // Status Button
    const isHealthy = !stats.failed && stats.fileCount > 0;
    const isFail = stats.failed > 0;
    const statusCls = isFail ? 'bad' : (isHealthy ? 'ok' : '');
    const statusText = isFail ? 'Failed' : (isHealthy ? 'Healthy' : 'Empty');
    
    bar.appendChild(el('button', { class: 'stat-item', onClick: (e) => showPopover(e.currentTarget, () => buildStatusPopover(stats)) }, [
      el('span', { class: 'stat-label', text: 'Status' }),
      el('span', { class: `stat-value ${statusCls}`, text: statusText })
    ]));

    statsContainer.appendChild(bar);
  }

  function renderMode() {
    clear(modeContainer);
    if (State.ui.dashboardMode === 'pack') {
      modeContainer.appendChild(buildFilesCard());
    } else {
      modeContainer.appendChild(buildUnpackCard());
    }
  }

  function renderLog() {
    clear(logBody);
    if (!State.log.length) {
      logBody.appendChild(el('div', { class: 'empty', style: { padding: '20px' } }, [
        el('div', { class: 'empty-title', text: 'No pastes yet.' }),
        el('div', { class: 'empty-sub', text: 'Press Ctrl+V anywhere to begin.' })
      ]));
      return;
    }

    for (const entry of State.log) {
      const row = el('div', { class: 'log-row' });
      const time = entry.time instanceof Date ? fmtTime(entry.time) : '--:--:--';
      
      row.appendChild(el('span', { class: 'log-time', text: '[' + time + ']' }));
      
      let msg = '';
      let cls = '';
      if (entry.source === 'zip') {
        msg = 'ZIP unpacked: ' + entry.notes[0].text;
      } else {
        const replaced = entry.changed + entry.identical;
        msg = `Paste #${entry.n}: ${entry.fresh} new, ${replaced} replaced, ${entry.errors} errors`;
        if (entry.errors) cls = 'is-error';
        else if (entry.fresh) cls = 'is-ok';
      }
      
      row.appendChild(el('span', { class: 'log-msg ' + cls, text: msg }));
      logBody.appendChild(row);
    }
  }

  renderStats();
  renderMode();
  renderLog();

  const unsub = subscribe((type) => {
    if (type === 'log' || type === 'ingest' || type === 'files') {
      renderLog();
      renderStats();
      renderMode();
    }
    if (type === 'ui' && State.ui.dashboardMode) {
      renderMode();
    }
  });

  return () => unsub();
}

/* ==========================================================================
   Paste Textarea
   ========================================================================== */

function buildPasteCard() {
  const card = el('section', { class: 'tool-card is-input' });
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { background: 'var(--accent)' } }),
    el('span', { text: 'Paste FILE/END Blocks' })
  ]));

  const actions = el('div', { class: 'tool-actions' });
  const pasteBtn = el('button', { class: 'btn btn-sm', type: 'button', text: '📋 Paste' });
  const clearBtn = el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear' });
  actions.appendChild(pasteBtn);
  actions.appendChild(clearBtn);
  head.appendChild(actions);

  const textarea = el('textarea', {
    class: 'tool-textarea',
    spellcheck: false,
    placeholder: 'Press Ctrl+V or click Paste to ingest blocks...'
  });

  function processText(val, source = 'paste') {
    if (!val || !val.trim()) return;
    const entry = ingest(val, { source });
    textarea.value = '';
    if (entry) toastOk(`Ingested ${entry.fresh} new file(s)`);
  }

  textarea.addEventListener('paste', () => {
    setTimeout(() => processText(textarea.value), 10);
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast('Clipboard is empty');
      processText(text);
    } catch (err) {
      toast('Could not read clipboard. Please press Ctrl+V / Cmd+V.');
      textarea.focus();
    }
  });

  clearBtn.addEventListener('click', () => {
    textarea.value = '';
    textarea.focus();
  });

  card.appendChild(head);
  card.appendChild(textarea);
  return card;
}

/* ==========================================================================
   File Viewer
   ========================================================================== */

function buildFilesCard() {
  const card = el('section', { class: 'tool-card is-log' });
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }),
    el('span', { text: 'Workspace Files' })
  ]));

  const btn = el('button', {
    class: 'btn btn-sm btn-ghost',
    type: 'button',
    text: 'View all →',
    onClick: () => navigate('files')
  });
  head.appendChild(btn);

  const body = el('div', { class: 'tool-log-body' });
  
  if (!State.files.size) {
    body.appendChild(el('div', { class: 'empty', style: { padding: '30px 20px' } }, [
      el('div', { class: 'empty-icon', html: '▤' }),
      el('div', { class: 'empty-title', text: 'No files packed yet' }),
      el('div', { class: 'empty-sub', text: 'Paste a message with FILE/END blocks above.' })
    ]));
  } else {
    const files = sortFiles(getFileList());
    for (const file of files) {
      const row = el('div', { 
        class: 'file-row', 
        style: { padding: '8px 14px', cursor: 'pointer' },
        onClick: () => navigate('editor', { path: file.path })
      }, [
        el('div', { class: 'file-main' }, [
          el('span', { class: 'file-ext', dataset: { kind: fileKind(file.path) }, text: extLabel(file.path) }),
          el('span', { class: 'file-name', text: basename(file.path) })
        ]),
        el('span', { class: 'chip chip-' + file.status, text: file.status }),
        el('span', { class: 'file-size', text: fmtBytes(file.bytes.length) })
      ]);
      body.appendChild(row);
    }
  }

  card.appendChild(head);
  card.appendChild(body);
  return card;
}

function buildUnpackCard() {
  const card = el('section', { class: 'tool-card is-dropzone' });
  const content = el('div', { class: 'drop-content' }, [
    el('div', { class: 'drop-icon-large', text: '⤓' }),
    el('div', { class: 'drop-title-large', text: 'Unpack a ZIP' }),
    el('div', { class: 'drop-sub-large', text: 'Drop a file here, or click to browse.' })
  ]);
  card.appendChild(content);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip';
  input.style.display = 'none';
  document.body.appendChild(input);

  card.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) {
      handleZipFile(input.files[0]);
      import('../core/state.js').then((m) => m.setUI({ dashboardMode: 'pack' }));
    }
    input.value = '';
  });

  return card;
}

function buildLogCard() {
  const card = el('section', { class: 'tool-card is-log', style: { flex: '0 1 250px' } });
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }),
    el('span', { text: 'Activity Log' })
  ]));

  const copyBtn = el('button', {
    class: 'btn btn-sm btn-ghost',
    type: 'button',
    text: 'Copy Log',
    onClick: async () => {
      const ok = await copyToClipboard(logText());
      if (ok) toastOk('Log copied');
    }
  });
  head.appendChild(copyBtn);

  const body = el('div', { id: 'dash-log-body', class: 'tool-log-body' });
  
  card.appendChild(head);
  card.appendChild(body);
  return card;
}

/* ==========================================================================
   Popover Content Builders
   ========================================================================== */

function showPopover(anchor, contentFn) {
  openPopover(anchor, contentFn);
}

function row(label, value, color = 'var(--ink)') {
  return el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '4px 0', borderBottom: '1px solid var(--line-2)' } }, [
    el('span', { style: { color: 'var(--muted)' }, text: label }),
    el('span', { style: { color, fontWeight: '600', textShadow: `0 0 8px color-mix(in srgb, ${color} 40%, transparent)` }, text: value })
  ]);
}

function buildFilesPopover(stats) {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: '6px' }, text: 'File Types' }));
  
  const extList = Object.entries(stats.byExt).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!extList.length) {
    wrap.appendChild(el('div', { style: { color: 'var(--faint)' }, text: 'No files yet' }));
  } else {
    for (const [ext, count] of extList) {
      wrap.appendChild(row(ext === 'none' ? '(none)' : '.' + ext, String(count)));
    }
  }
  return wrap;
}

function buildSizePopover(stats) {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: '6px' }, text: 'Largest Files' }));
  
  const files = sortFiles(getFileList()).sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 3);
  if (!files.length) {
    wrap.appendChild(el('div', { style: { color: 'var(--faint)' }, text: 'No files yet' }));
  } else {
    for (const f of files) {
      wrap.appendChild(row(basename(f.path), fmtBytes(f.bytes.length), 'var(--accent-2)'));
    }
  }
  return wrap;
}

function buildLinesPopover(stats) {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: '6px' }, text: 'Code Volume' }));
  
  const pages = Math.max(1, Math.round(stats.totalLines / 50));
  wrap.appendChild(el('div', { style: { color: 'var(--ink-2)', marginBottom: '8px' }, text: `~${pages} printed pages` }));
  
  const files = sortFiles(getFileList()).sort((a, b) => (b.lineCount || 0) - (a.lineCount || 0)).slice(0, 3);
  for (const f of files) {
    wrap.appendChild(row(basename(f.path), `${fmtNum(f.lineCount || 0)} L`, 'var(--accent-3)'));
  }
  return wrap;
}

function buildStatusPopover(stats) {
  const wrap = el('div');
  const isHealthy = !stats.failed && stats.fileCount > 0;
  const color = stats.failed ? 'var(--bad)' : (isHealthy ? 'var(--ok)' : 'var(--muted)');
  
  wrap.appendChild(el('div', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: '6px' }, text: 'Workspace Health' }));
  wrap.appendChild(el('div', { style: { color, fontWeight: '600', fontSize: '14px', textShadow: `0 0 12px color-mix(in srgb, ${color} 60%, transparent)`, marginBottom: '8px' }, text: stats.failed ? 'Attention Required' : (isHealthy ? 'All Systems Nominal' : 'Workspace Empty') }));
  
  for (const [status, count] of Object.entries(stats.byStatus)) {
    if (count > 0) {
      const c = status === 'truncated' || status === 'corrupt' ? 'var(--bad)' : 
                status === 'changed' ? 'var(--warn)' : 
                status === 'new' ? 'var(--ok)' : 'var(--muted)';
      wrap.appendChild(row(status.toUpperCase(), String(count), c));
    }
  }
  return wrap;
}
