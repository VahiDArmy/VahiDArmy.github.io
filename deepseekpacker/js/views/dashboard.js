// Dashboard view — tool-first layout with Pack/Unpack toggle and colorful stat cards.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe, getStats } from '../core/state.js';
import { ingest } from '../core/ingest.js';
import { fmtTime, fmtBytes, fmtNum } from '../utils/format.js';
import { logText } from '../core/log.js';
import { toast, toastOk } from '../ui/toast.js';
import { handleZipFile } from '../ui/zip-flow.js';

export function mountDashboard(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  // 1. Stats Bar (Grid of Cards)
  const statsContainer = el('div');
  shell.appendChild(statsContainer);

  // 2. Mode Container (Input or Dropzone)
  const modeContainer = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '0 0 auto' } });
  shell.appendChild(modeContainer);

  // 3. Log Card
  const logCard = buildLogCard();
  shell.appendChild(logCard);
  const logBody = logCard.querySelector('#dash-log-body');

  // Render Functions
  function renderStats() {
    clear(statsContainer);
    const stats = getStats();
    const grid = el('div', { class: 'stat-grid' });
    
    // Card 1: Files
    grid.appendChild(el('div', { class: 'stat accent' }, [
      el('div', { class: 'stat-label', text: 'Files' }),
      el('div', { class: 'stat-value accent', text: String(stats.fileCount) }),
      el('div', { class: 'stat-sub', text: 'packed' })
    ]));
    
    // Card 2: Size
    grid.appendChild(el('div', { class: 'stat blue' }, [
      el('div', { class: 'stat-label', text: 'Total Size' }),
      el('div', { class: 'stat-value blue', text: fmtBytes(stats.totalBytes) }),
      el('div', { class: 'stat-sub', text: 'on disk' })
    ]));
    
    // Card 3: Lines
    grid.appendChild(el('div', { class: 'stat purple' }, [
      el('div', { class: 'stat-label', text: 'Lines' }),
      el('div', { class: 'stat-value purple', text: fmtNum(stats.totalLines) }),
      el('div', { class: 'stat-sub', text: 'of code' })
    ]));
    
    // Card 4: Status
    const isHealthy = !stats.failed && stats.fileCount > 0;
    const isFail = stats.failed > 0;
    const statusCls = isFail ? 'bad' : (isHealthy ? 'ok' : '');
    const statusText = isFail ? 'Failed' : (isHealthy ? 'Healthy' : 'Empty');
    
    grid.appendChild(el('div', { class: `stat ${statusCls}` }, [
      el('div', { class: 'stat-label', text: 'Status' }),
      el('div', { class: `stat-value ${statusCls}`, text: statusText }),
      el('div', { class: 'stat-sub', text: isFail ? 'check log' : (isHealthy ? 'all good' : 'waiting') })
    ]));

    statsContainer.appendChild(grid);
  }

  function renderMode() {
    clear(modeContainer);
    if (State.ui.dashboardMode === 'pack') {
      modeContainer.appendChild(buildPackCard());
    } else {
      modeContainer.appendChild(buildUnpackCard());
    }
  }

  function renderLog() {
    clear(logBody);
    if (!State.log.length) {
      logBody.appendChild(el('div', { class: 'empty', style: { padding: '30px 20px' } }, [
        el('div', { class: 'empty-title', text: 'No pastes yet.' }),
        el('div', { class: 'empty-sub', text: 'Paste a message above to begin.' })
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

  // Initial renders
  renderStats();
  renderMode();
  renderLog();

  // Subscriptions
  const unsub = subscribe((type) => {
    if (type === 'log' || type === 'ingest' || type === 'files') {
      renderLog();
      renderStats();
    }
    if (type === 'ui' && State.ui.dashboardMode) {
      renderMode();
    }
  });

  return () => unsub();
}

function buildPackCard() {
  const card = el('section', { class: 'tool-card is-input' });
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' } }),
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

  // Logic
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

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('dragover');
  });
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
  const card = el('section', { class: 'tool-card is-log' });
  
  const head = el('div', { class: 'tool-head' });
  head.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-2)' } }),
    el('span', { text: 'Activity Log' })
  ]));

  const copyBtn = el('button', {
    class: 'btn btn-sm btn-ghost',
    type: 'button',
    text: 'Copy Log',
    onClick: async () => {
      const ok = await copyToClipboard(logText());
      if (ok) toastOk('Log copied');
      else toast('Copy failed');
    }
  });
  head.appendChild(copyBtn);

  const body = el('div', { id: 'dash-log-body', class: 'tool-log-body' });
  
  card.appendChild(head);
  card.appendChild(body);
  return card;
}
