// Keyboard shortcuts overlay — a searchable, sectioned reference sheet.

import { el, clear } from '../utils/dom.js';
import { openModal } from './modal.js';

const SECTIONS = [
  {
    name: 'Workspace',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Open the command palette' },
      { keys: ['/'], label: 'Focus the global search field' },
      { keys: ['Esc'], label: 'Dismiss any open dialog or overlay' },
      { keys: ['?'], label: 'Show this shortcuts reference' },
    ],
  },
  {
    name: 'Pack & export',
    items: [
      { keys: ['Ctrl', 'S'], label: 'Download the current pack as a ZIP' },
      { keys: ['Ctrl', 'Shift', 'S'], label: 'Download the pack under a new name' },
      { keys: ['Ctrl', 'O'], label: 'Open the ZIP picker to unpack' },
      { keys: ['Ctrl', 'L'], label: 'Copy the ingest log to the clipboard' },
      { keys: ['Ctrl', 'J'], label: 'Export the ingest log as JSON' },
    ],
  },
  {
    name: 'Editing',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'Undo the last file change' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo the last undone change' },
      { keys: ['Ctrl', 'Y'], label: 'Redo (alternative binding)' },
      { keys: ['Ctrl', 'Shift', 'Backspace'], label: 'Clear every file and log entry' },
    ],
  },
  {
    name: 'Navigation',
    items: [
      { keys: ['G', 'D'], label: 'Jump to the Dashboard' },
      { keys: ['G', 'F'], label: 'Jump to the Files view' },
      { keys: ['G', 'E'], label: 'Jump to the Editor' },
      { keys: ['G', 'L'], label: 'Jump to the Log' },
      { keys: ['G', 'I'], label: 'Jump to Insights' },
      { keys: ['G', 'S'], label: 'Jump to Settings' },
    ],
  },
  {
    name: 'Files view',
    items: [
      { keys: ['↑', '↓'], label: 'Move between file rows' },
      { keys: ['Space'], label: 'Toggle selection on the focused file' },
      { keys: ['Enter'], label: 'Open the focused file in the editor' },
      { keys: ['Shift', 'Click'], label: 'Select a range of rows' },
      { keys: ['Right-click'], label: 'Open the context menu for a file' },
    ],
  },
  {
    name: 'Editor',
    items: [
      { keys: ['Ctrl', 'S'], label: 'Save changes back into the pack' },
      { keys: ['Tab'], label: 'Insert two spaces' },
      { keys: ['Ctrl', '/'], label: 'Comment / uncomment the current line' },
    ],
  },
  {
    name: 'Palette',
    items: [
      { keys: ['↑', '↓'], label: 'Move through the filtered command list' },
      { keys: ['Enter'], label: 'Run the highlighted command' },
      { keys: ['Esc'], label: 'Close the palette without running anything' },
    ],
  },
  {
    name: 'Paste',
    items: [
      { keys: ['Ctrl', 'V'], label: 'Ingest FILE/END blocks anywhere on the page' },
      { keys: ['Drop', 'ZIP'], label: 'Unpack a ZIP back into pasteable text' },
      { keys: ['Drop', 'TXT'], label: 'Parse a text file as FILE/END blocks' },
    ],
  },
];

let root = null;

export function initShortcutsOverlay() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.palette-scrim')) return;
      e.preventDefault();
      openShortcutsOverlay();
    }
  });
}

export function openShortcutsOverlay() {
  const search = el('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Search shortcuts…',
    spellcheck: false,
    autocomplete: 'off',
    style: { width: '100%' },
  });

  const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
  body.appendChild(search);

  const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } });
  body.appendChild(host);

  function renderSections(query) {
    clear(host);
    const q = String(query || '').trim().toLowerCase();
    const matches = (item) => {
      if (!q) return true;
      const text = (item.keys.join(' ') + ' ' + item.label).toLowerCase();
      return text.includes(q);
    };

    let any = false;
    for (const section of SECTIONS) {
      const filtered = section.items.filter(matches);
      if (!filtered.length) continue;
      any = true;
      const block = el('section', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
      block.appendChild(el('div', {
        style: {
          fontSize: 'var(--fs-2xs)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        },
        text: section.name,
      }));
      const grid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '4px var(--sp-5)',
        },
      });
      for (const item of filtered) {
        const row = el('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '6px 0',
            borderBottom: '1px dashed var(--line)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--ink-2)',
          },
        }, [
          el('span', { text: item.label, style: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
          el('span', { style: { display: 'flex', gap: '4px', flex: '0 0 auto' } },
            item.keys.map((k) => el('kbd', { text: k }))),
        ]);
        grid.appendChild(row);
      }
      block.appendChild(grid);
      host.appendChild(block);
    }

    if (!any) {
      host.appendChild(el('div', {
        style: { padding: '24px', textAlign: 'center', color: 'var(--faint)', fontSize: 'var(--fs-sm)' },
        text: 'No matching shortcuts',
      }));
    }
  }

  search.addEventListener('input', () => renderSections(search.value));
  renderSections('');

  openModal({
    title: 'Keyboard shortcuts',
    wide: true,
    body,
    buttons: [
      { label: 'Close', variant: 'primary' },
    ],
  });
  setTimeout(() => search.focus(), 60);
}
