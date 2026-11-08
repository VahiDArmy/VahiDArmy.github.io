// Dashboard view — tool-first layout. The main paste box and log fill the screen.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe } from '../core/state.js';
import { ingest } from '../core/ingest.js';
import { fmtTime } from '../utils/format.js';
import { logText } from '../core/log.js';
import { toast, toastOk } from '../ui/toast.js';

export function mountDashboard(root) {
  // The parent root needs to be flex to prevent page scrolling and fill height
  const shell = el('div', { class: 'tool-layout' });
  root.appendChild(shell);

  // 1. Build the input card
  const inputCard = el('section', { class: 'tool-card is-input' });
  
  const inputHead = el('div', { class: 'tool-head' });
  inputHead.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' } }),
    el('span', { text: 'Paste FILE/END Blocks' })
  ]));

  const inputActions = el('div', { class: 'tool-actions' });
  const pasteBtn = el('button', { class: 'btn btn-sm', type: 'button', text: '📋 Paste' });
  const clearBtn = el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear' });
  inputActions.appendChild(pasteBtn);
  inputActions.appendChild(clearBtn);
  inputHead.appendChild(inputActions);

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

  inputCard.appendChild(inputHead);
  inputCard.appendChild(textarea);
  shell.appendChild(inputCard);

  // 2. Build the log card
  const logCard = el('section', { class: 'tool-card is-log' });
  
  const logHead = el('div', { class: 'tool-head' });
  logHead.appendChild(el('div', { class: 'tool-title' }, [
    el('span', { class: 'dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-2)' } }),
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
  logHead.appendChild(copyBtn);

  const logBody = el('div', { class: 'tool-log-body' });
  logCard.appendChild(logHead);
  logCard.appendChild(logBody);
  shell.appendChild(logCard);

  // Render Logic
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

  renderLog();

  const unsub = subscribe((type) => {
    if (type === 'log' || type === 'ingest') renderLog();
  });

  return () => unsub();
}
