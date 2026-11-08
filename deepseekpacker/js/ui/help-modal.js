// Format help modal triggered from sidebar.

import { openModal } from './modal.js';
import { el } from '../utils/dom.js';

export function initHelpButton() {
  const btn = document.getElementById('help-btn');
  if (!btn) return;
  btn.addEventListener('click', () => openHelpModal());
}

export function openHelpModal() {
  const body = el('div', { class: 'help-block' }, [
    el('p', { text: 'Paste blocks of source files here — every FILE/END pair is merged into the pack. Prose outside the markers is ignored.' }),
    el('pre', { class: 'code-block', html:
      '<span class="c">// one file per block</span>\n' +
      '<span class="m">{[[FILE: src/app.js]]}</span>\n' +
      'function main() {\n  return 42;\n}\n' +
      '<span class="m">{[[END: src/app.js]]}</span>\n\n' +
      '<span class="c">// the path in FILE and END must match exactly</span>'
    }),
    el('p', { text: 'Drag and drop a .zip anywhere to unpack it into a paste-ready .txt file. Drop a .txt file to parse it directly.' }),
    el('p', { text: 'Ctrl/Cmd+S downloads the current pack. Ctrl/Cmd+O opens the ZIP picker. Ctrl/Cmd+K opens the command palette.' }),
  ]);
  openModal({
    title: 'Format & shortcuts',
    wide: true,
    body,
    buttons: [
      { label: 'Got it', variant: 'primary', onClick: () => {} },
    ],
  });
}
