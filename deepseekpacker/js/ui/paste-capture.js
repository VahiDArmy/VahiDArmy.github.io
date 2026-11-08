// Capture every paste anywhere in the document (except inside inputs).

import { ingest } from '../core/ingest.js';
import { toastBad, flashPaste } from './toast.js';
import { renderRoute } from './router.js';
import { State } from '../core/state.js';
import { setStatusMessage } from './statusbar.js';

export function initPasteCapture() {
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
      return;
    }
    if (target && target.tagName === 'TEXTAREA' && target.dataset.allowPaste === 'true') {
      return;
    }

    let text = '';
    try {
      const data = e.clipboardData || window.clipboardData;
      if (data) {
        text = data.getData('text/plain') || data.getData('Text') || '';
      }
    } catch (err) {
      text = '';
    }

    if (!text) {
      if (e.clipboardData) {
        toastBad('Clipboard has no text');
      }
      return;
    }

    e.preventDefault();
    flashPaste();
    const entry = ingest(text, { source: 'paste' });
    if (entry) {
      const summary = entry.fresh + ' new · ' +
        (entry.changed + entry.identical) + ' replaced · ' +
        entry.errors + ' error' + (entry.errors === 1 ? '' : 's');
      setStatusMessage('Ingested paste #' + entry.n + ' — ' + summary);
      if (State.ui.activeView !== 'log' && State.ui.activeView !== 'files' && State.ui.activeView !== 'dashboard') {
        renderRoute(State.ui.activeView);
      }
    }
  }, true);
}
