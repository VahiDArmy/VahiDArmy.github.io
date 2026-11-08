import { State, restore, persist, addLog } from './core/state.js';
import { ingest } from './core/ingest.js';
import { buildZip } from './core/zip-build.js';
import { readZip, summarizeRead } from './core/zip-read.js';
import { logText } from './core/log.js';

const els = {
  textarea: document.getElementById('paste-area'),
  logList: document.getElementById('log-list'),
  btnDownload: document.getElementById('btn-download'),
  btnLoadZip: document.getElementById('btn-load-zip'),
  btnPaste: document.getElementById('btn-paste'),
  btnClear: document.getElementById('btn-clear'),
  btnCopyLog: document.getElementById('btn-copy-log'),
  zipInput: document.getElementById('zip-input'),
  toast: document.getElementById('toast')
};

let toastTimer;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2500);
}

// --- Initialization ---

function init() {
  restore();
  renderLog();
  updateButtons();

  // Paste Handler
  els.textarea.addEventListener('paste', (e) => {
    // Let the default paste happen, but then auto-process after a tiny delay
    setTimeout(processText, 10);
  });

  els.btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return showToast('Clipboard is empty');
      els.textarea.value = text;
      processText();
    } catch (err) {
      showToast('Could not read clipboard. Please press Ctrl+V / Cmd+V instead.');
      els.textarea.focus();
    }
  });

  els.btnClear.addEventListener('click', () => {
    els.textarea.value = '';
    els.textarea.focus();
  });

  els.btnDownload.addEventListener('click', downloadZip);
  els.btnLoadZip.addEventListener('click', () => els.zipInput.click());
  els.zipInput.addEventListener('change', handleZipInput);
  els.btnCopyLog.addEventListener('click', copyLog);

  // Global Ctrl+V to focus textarea
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (document.activeElement !== els.textarea && document.activeElement !== els.zipInput) {
        els.textarea.focus();
      }
    }
  });
}

// --- Core Logic ---

function processText() {
  const text = els.textarea.value.trim();
  if (!text) return;

  // Ingest the text
  const entry = ingest(text, { source: 'paste' });
  
  // Clear textarea
  els.textarea.value = '';
  
  // Update UI
  renderLog();
  updateButtons();

  if (entry) {
    const summary = `${entry.fresh} new, ${entry.errors} errors`;
    showToast(`Pasted: ${summary}`);
  }
}

function downloadZip() {
  if (State.files.size === 0) return showToast('Nothing to download');
  
  const bytes = buildZip();
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project-pack.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  
  showToast('Downloaded project-pack.zip');
}

function handleZipInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  showToast('Reading ZIP...');
  const reader = new FileReader();
  
  reader.onload = async (ev) => {
    try {
      const results = await readZip(ev.target.result);
      const summary = summarizeRead(results);
      
      // Build text archive
      let text = '';
      for (const r of results) {
        if (r.skipped) continue;
        text += `{[[FILE: ${r.path}]]}\n${r.content}\n{[[END: ${r.path}]]}\n\n`;
      }
      
      // Download it
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project-pack.txt';
      a.click();
      URL.revokeObjectURL(url);
      
      // Add to log
      addLog({
        id: Date.now(),
        n: State.pastes + 1,
        time: new Date(),
        fresh: summary.included,
        errors: 0,
        source: 'zip',
        notes: [{ text: `ZIP unpacked: ${summary.included} files extracted, ${summary.skippedNoise + summary.skippedBinary} skipped.` }]
      });
      State.pastes++;
      
      renderLog();
      showToast('ZIP unpacked to project-pack.txt');
    } catch (err) {
      showToast('ZIP Error: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  els.zipInput.value = '';
}

function copyLog() {
  const text = logText();
  if (!text) return showToast('Log is empty');
  navigator.clipboard.writeText(text).then(() => showToast('Log copied to clipboard'));
}

// --- Rendering ---

function renderLog() {
  els.logList.innerHTML = '';
  
  if (State.log.length === 0) {
    els.logList.innerHTML = '<div class="empty-log">No pastes yet.</div>';
    return;
  }
  
  State.log.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-item ${entry.errors > 0 ? 'error' : 'success'}`;
    
    const time = entry.time instanceof Date ? entry.time.toLocaleTimeString() : '--:--:--';
    
    let msg = '';
    if (entry.source === 'zip') {
      msg = `<strong>ZIP:</strong> ${entry.notes[0].text}`;
    } else {
      const replaced = entry.changed + entry.identical;
      msg = `<strong>Paste #${entry.n}:</strong> ${entry.fresh} new, ${replaced} replaced, ${entry.errors} errors.`;
    }
    
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${msg}</span>`;
    els.logList.appendChild(div);
  });
}

function updateButtons() {
  els.btnDownload.disabled = State.files.size === 0;
  els.btnCopyLog.disabled = State.log.length === 0;
}

init();
