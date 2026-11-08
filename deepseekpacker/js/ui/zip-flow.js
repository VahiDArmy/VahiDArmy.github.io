// ZIP import orchestration.

import { readZip, summarizeRead } from '../core/zip-read.js';
import { buildPackText } from '../core/pack-text.js';
import { State, addLog, persist } from '../core/state.js';
import { toast, toastBad, toastOk } from './toast.js';
import { downloadText } from './download.js';
import { renderRoute } from './router.js';
import { setStatusMessage } from './statusbar.js';

export function openZipPicker() {
  const input = document.getElementById('zip-input');
  if (!input) return;
  input.value = '';
  input.click();
}

export function initZipInput() {
  const input = document.getElementById('zip-input');
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) {
      handleZipFile(input.files[0]);
    }
  });
}

export function handleZipFile(file) {
  if (!file) return;
  const isZip = /\.zip$/i.test(file.name) ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed';

  if (!isZip) {
    toastBad('Not a ZIP file: ' + file.name);
    return;
  }

  toast('Reading ' + file.name + '…');
  const reader = new FileReader();
  reader.onload = () => {
    readZip(reader.result)
      .then((results) => {
        const summary = summarizeRead(results);
        const text = buildPackText(results);

        downloadText(text, 'project-pack.txt');

        const entry = {
          id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          n: State.pastes + 1,
          time: new Date(),
          fresh: summary.included,
          changed: 0,
          identical: 0,
          errors: summary.included === 0 ? 1 : 0,
          source: 'zip',
          notes: [],
        };
        State.pastes = entry.n;
        entry.notes.push({
          kind: 'outside',
          text: 'ZIP → text: ' + summary.included + ' text files packed · ' +
            summary.skippedNoise + ' noise skipped · ' +
            summary.skippedBinary + ' binary skipped' +
            (summary.skippedOther ? ' · ' + summary.skippedOther + ' other skipped' : ''),
        });
        if (summary.included === 0) {
          entry.notes.push({
            kind: 'nomarkers',
            text: 'no usable text files found in the ZIP',
          });
        }
        addLog(entry);
        persist();
        toastOk('Downloaded project-pack.txt · ' + summary.included + ' files');
        setStatusMessage('Unpacked ' + file.name);
        renderRoute(State.ui.activeView);
      })
      .catch((err) => {
        console.error('[zip] failed', err);
        toastBad('ZIP error: ' + (err && err.message ? err.message : err));
        const entry = {
          id: 'log-' + Date.now(),
          n: State.pastes + 1,
          time: new Date(),
          fresh: 0,
          changed: 0,
          identical: 0,
          errors: 1,
          source: 'zip',
          notes: [{ kind: 'nomarkers', text: 'ZIP failed: ' + (err && err.message ? err.message : String(err)) }],
        };
        State.pastes = entry.n;
        addLog(entry);
        persist();
        renderRoute(State.ui.activeView);
      });
  };
  reader.onerror = () => {
    toastBad('Could not read ' + file.name);
  };
  reader.readAsArrayBuffer(file);
}
