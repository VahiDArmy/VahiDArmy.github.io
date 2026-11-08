// Format & help view.

import { el, clear } from '../utils/dom.js';
import { navigate } from '../ui/router.js';
import { openHelpModal } from '../ui/help-modal.js';

export function mountHelp(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Format & help' }),
    el('p', { text: 'Everything you need to know about packing, unpacking, and shortcuts.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: () => openHelpModal(),
      text: 'Open quick reference',
    }),
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('dashboard'),
      text: '← Back',
    }),
  ]));
  shell.appendChild(head);

  const grid = el('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-4)' },
  });

  grid.appendChild(buildFormatCard());
  grid.appendChild(buildReverseCard());
  grid.appendChild(buildShortcutsCard());
  grid.appendChild(buildTipsCard());

  shell.appendChild(grid);
  return () => {};
}

function buildFormatCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Paste format' })]),
  ]));
  const body = el('div', { class: 'card-body help-block' });
  body.appendChild(el('p', { text: 'Wrap each file in a FILE/END pair. Every matching pair becomes a file in the pack. Anything outside the markers is ignored.' }));
  body.appendChild(el('pre', { class: 'code-block', html:
    '<span class="m">{[[FILE: src/app.js]]}</span>\n' +
    'function main() {\n  return 42;\n}\n' +
    '<span class="m">{[[END: src/app.js]]}</span>\n\n' +
    '<span class="m">{[[FILE: styles/theme.css]]}</span>\n' +
    ':root { --bg: #07080a; }\n' +
    '<span class="m">{[[END: styles/theme.css]]}</span>'
  }));
  body.appendChild(el('ul', {}, [
    el('li', { text: 'Markers must appear on their own lines, at the start of the line.' }),
    el('li', { text: 'The path in FILE and END must match exactly.' }),
    el('li', { text: 'Paths are relative and use forward slashes.' }),
    el('li', { text: 'Duplicate blocks: the last one wins.' }),
    el('li', { text: 'A missing END marker marks the file as truncated.' }),
  ]));
  card.appendChild(body);
  return card;
}

function buildReverseCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'ZIP → text' })]),
  ]));
  const body = el('div', { class: 'card-body help-block' });
  body.appendChild(el('p', { text: 'Drop any .zip file anywhere on the page, or use the Load .zip button. Project Packer reads every text file in the archive and emits a single paste-ready .txt.' }));
  body.appendChild(el('ul', {}, [
    el('li', { text: 'Binary files are detected by content and skipped.' }),
    el('li', { text: 'Common noise (node_modules, .git, build, dist, lockfiles) is skipped.' }),
    el('li', { text: 'Non-UTF-8 files are skipped.' }),
    el('li', { text: 'The resulting .txt opens with a short header explaining the format.' }),
  ]));
  card.appendChild(body);
  return card;
}

function buildShortcutsCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Keyboard shortcuts' })]),
  ]));
  const body = el('div', { class: 'card-body' });
  const list = el('div', { class: 'shortcut-grid' });
  const items = [
    ['Ctrl/Cmd + K', 'Open command palette'],
    ['Ctrl/Cmd + S', 'Download current pack as .zip'],
    ['Ctrl/Cmd + O', 'Open .zip picker'],
    ['Ctrl/Cmd + L', 'Copy the log'],
    ['Ctrl/Cmd + Shift + Backspace', 'Clear all data'],
    ['/', 'Focus search field'],
    ['Ctrl+V', 'Paste FILE/END blocks anywhere'],
    ['↑ / ↓', 'Move through palette'],
    ['Enter', 'Run active palette item'],
    ['Esc', 'Dismiss dialog, palette, or drawer'],
  ];
  for (const [keys, label] of items) {
    list.appendChild(el('div', { class: 'shortcut-row' }, [
      el('span', { text: label }),
      el('span', { class: 'keys' }, keys.split(' + ').map((k) => el('kbd', { text: k }))),
    ]));
  }
  body.appendChild(list);
  card.appendChild(body);
  return card;
}

function buildTipsCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Workflow tips' })]),
  ]));
  const body = el('div', { class: 'card-body help-block' });
  body.appendChild(el('ul', {}, [
    el('li', { text: 'Paste entire conversations — prose between blocks is ignored, so nothing is lost.' }),
    el('li', { text: 'Pasting the same file twice updates it only if content differs. Otherwise it is marked identical.' }),
    el('li', { text: 'Use the Log view to see the exact errors for truncated or corrupt blocks, then Copy resend request to ask for a retry.' }),
    el('li', { text: 'Enable Persist files in Settings to survive reloads. Turn it off for a one-shot session.' }),
    el('li', { text: 'The Themes menu changes color only — every theme keeps the same layout.' }),
    el('li', { text: 'For big projects, unpack a ZIP, edit any file inline, then download a new ZIP.' }),
  ]));
  card.appendChild(body);
  return card;
}
