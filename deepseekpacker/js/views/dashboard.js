// Dashboard view — tool-first layout with interactive stats and live file viewer.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe, getStats, getFileList, sortFiles } from '../core/state.js';
import { ingest } from '../core/ingest.js';
import { fmtTime, fmtBytes, fmtNum, basename, extLabel, fileKind } from '../utils/format.js';
import { logText } from '../core/log.js';
import { toast, toastOk } from '../ui/toast.js';
import { handleZipFile } from '../ui/zip-flow.js';
import { openModal } from '../ui/modal.js';
import { navigate } from '../ui/router.js';

export function mountDashboard(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  // 1. Stats Bar (Clickable)
  const statsContainer = el('div');
  shell.appendChild(statsContainer);

  // 2. Mode Container (File List or Dropzone)
  const modeContainer = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '200px' } });
  shell.appendChild(modeContainer);

  // 3. Log Card
  const logCard = buildLogCard();
  shell.appendChild(logCard);
  const logBody = logCard.querySelector('#dash-log-body');

  // Render Functions
  function renderStats() {
    clear(statsContainer);
    const stats = getStats();
    const bar = el('div', { class: 'stats-row' });
    
    // Files Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: () => showFilesModal(stats) }, [
      el('span', { class: 'stat-label', text: 'Files' }),
      el('span', { class: `stat-value ${stats.fileCount ? 'accent' : ''}`, text: String(stats.fileCount) })
    ]));
    
    // Size Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: () => showSizeModal(stats) }, [
      el('span', { class: 'stat-label', text: 'Size' }),
      el('span', { class: 'stat-value blue', text: fmtBytes(stats.totalBytes) })
    ]));
    
    // Lines Button
    bar.appendChild(el('button', { class: 'stat-item', onClick: () => showLinesModal(stats) }, [
      el('span', { class: 'stat-label', text: 'Lines' }),
      el('span', { class: 'stat-value purple', text: fmtNum(stats.totalLines) })
    ]));
    
    // Status Button
    const isHealthy = !stats.failed && stats.fileCount > 0;
    const isFail = stats.failed > 0;
    const statusCls = isFail ? 'bad' : (isHealthy ? 'ok' : '');
    const statusText = isFail ? 'Failed' : (isHealthy ? 'Healthy' : 'Empty');
    
    bar.appendChild(el('button', { class: 'stat-item', onClick: () => showStatusModal(stats) }, [
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
      renderMode(); // Re-render files list
    }
    if (type === 'ui' && State.ui.dashboardMode) {
      renderMode();
    }
  });

  return () => unsub();
}

/* ==========================================================================
   File Viewer (Replaces Textarea)
   ========================================================================== */

function buildFilesCard() {
  const card = el('section', { class: 'tool-card is-log' }); // reuse is-log flex style
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { background: 'var(--accent)' } }),
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
      el('div', { class: 'empty-sub', text: 'Paste a message with FILE/END blocks to begin.' })
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

  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('dragover'); });
  card.addEventListener('dragleave', () => card.classList.remove('dragover'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip') || file.type === 'application/zip') {
        handleZipFile(file);
        import('../core/state.js').then((m) => m.setUI({ dashboardMode: 'pack' }));
      } else {
        toast('Please drop a .zip file');
      }
    }
  });
  return card;
}

function buildLogCard() {
  const card = el('section', { class: 'tool-card is-log', style: { flex: '0 1 250px' } }); // Smaller than file list
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }),
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
   Rich Modals (Stat Popups)
   ========================================================================== */

function modalRow(label, value, pct = null, color = 'var(--accent)') {
  const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--line)' } });
  row.appendChild(el('div', { style: { flex: '1 1 auto', fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }, text: label }));
  
  if (pct !== null) {
    const track = el('div', { style: { flex: '0 0 100px', height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' } });
    track.appendChild(el('div', { style: { height: '100%', width: `${Math.max(2, pct)}%`, background: color, borderRadius: '3px' } }));
    row.appendChild(track);
  }
  
  row.appendChild(el('div', { style: { flex: '0 0 auto', fontSize: 'var(--fs-sm)', color: 'var(--ink)', fontWeight: '600' }, text: value }));
  return row;
}

function showFilesModal(stats) {
  const body = el('div', { class: 'stack', style: { gap: '16px' } });
  
  body.appendChild(el('div', { style: { fontSize: '14px', color: 'var(--ink-2)' }, 
    text: 'Here is how your workspace is distributed by file type.' 
  }));

  const extList = Object.entries(stats.byExt).sort((a, b) => b[1] - a[1]);
  if (!extList.length) {
    body.appendChild(el('div', { text: 'No files yet.', style: { color: 'var(--faint)' } }));
  } else {
    const container = el('div');
    for (const [ext, count] of extList) {
      const pct = (count / stats.fileCount) * 100;
      container.appendChild(modalRow(`.${ext === 'none' ? '(no extension)' : ext}`, `${count} file${count > 1 ? 's' : ''}`, pct, 'var(--accent)'));
    }
    body.appendChild(container);
  }

  openModal({
    title: 'File Distribution',
    body,
    buttons: [{ label: 'Close', variant: 'primary' }]
  });
}

function showSizeModal(stats) {
  const body = el('div', { class: 'stack', style: { gap: '16px' } });
  
  body.appendChild(el('div', { style: { fontSize: '14px', color: 'var(--ink-2)' }, 
    text: `Total packed size is ${fmtBytes(stats.totalBytes)}. Here are the heaviest files.` 
  }));

  const files = sortFiles(getFileList()).sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 5);
  if (!files.length) {
    body.appendChild(el('div', { text: 'No files yet.', style: { color: 'var(--faint)' } }));
  } else {
    const container = el('div');
    for (const f of files) {
      const pct = stats.totalBytes ? (f.bytes.length / stats.totalBytes) * 100 : 0;
      container.appendChild(modalRow(basename(f.path), fmtBytes(f.bytes.length), pct, 'var(--accent-2)'));
    }
    body.appendChild(container);
  }

  openModal({
    title: 'Storage Breakdown',
    body,
    buttons: [{ label: 'Close', variant: 'primary' }]
  });
}

function showLinesModal(stats) {
  const body = el('div', { class: 'stack', style: { gap: '16px' } });
  
  const pages = Math.max(1, Math.round(stats.totalLines / 50)); // Assuming ~50 lines per page
  body.appendChild(el('div', { style: { fontSize: '14px', color: 'var(--ink-2)' }, 
    text: `You have ${fmtNum(stats.totalLines)} lines of code. That is roughly ${pages} printed pages.` 
  }));

  const files = sortFiles(getFileList()).sort((a, b) => (b.lineCount || 0) - (a.lineCount || 0)).slice(0, 5);
  if (!files.length) {
    body.appendChild(el('div', { text: 'No files yet.', style: { color: 'var(--faint)' } }));
  } else {
    const container = el('div');
    for (const f of files) {
      const pct = stats.totalLines ? ((f.lineCount || 0) / stats.totalLines) * 100 : 0;
      container.appendChild(modalRow(basename(f.path), `${fmtNum(f.lineCount || 0)} lines`, pct, 'var(--accent-3)'));
    }
    body.appendChild(container);
  }

  openModal({
    title: 'Code Volume',
    body,
    buttons: [{ label: 'Close', variant: 'primary' }]
  });
}

function showStatusModal(stats) {
  const body = el('div', { class: 'stack', style: { gap: '16px' } });
  
  const isHealthy = !stats.failed && stats.fileCount > 0;
  
  body.appendChild(el('div', { style: { textAlign: 'center', padding: '20px 0' } }, [
    el('div', { 
      style: { 
        fontSize: '32px', 
        fontWeight: 'bold', 
        color: stats.failed ? 'var(--bad)' : (isHealthy ? 'var(--ok)' : 'var(--faint)'),
        textShadow: `0 0 20px color-mix(in srgb, ${stats.failed ? 'var(--bad)' : (isHealthy ? 'var(--ok)' : 'var(--faint)')} 50%, transparent)`
      },
      text: stats.failed ? 'Attention Required' : (isHealthy ? 'All Systems Nominal' : 'Workspace Empty')
    }),
    el('div', { 
      style: { fontSize: '13px', color: 'var(--muted)', marginTop: '8px' },
      text: stats.failed ? `${stats.failed} file(s) have parsing errors.` : (isHealthy ? 'Every file parsed successfully.' : 'Paste some blocks to begin.')
    })
  ]));

  const container = el('div');
  for (const [status, count] of Object.entries(stats.byStatus)) {
    if (count > 0) {
      const color = status === 'truncated' || status === 'corrupt' ? 'var(--bad)' : 
                    status === 'changed' ? 'var(--warn)' : 
                    status === 'new' ? 'var(--ok)' : 'var(--muted)';
      container.appendChild(modalRow(status.toUpperCase(), String(count), null, color));
    }
  }
  body.appendChild(container);

  openModal({
    title: 'Workspace Health',
    body,
    buttons: [{ label: 'Close', variant: 'primary' }]
  });
}
