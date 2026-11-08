// Settings view — themes, toggles, data tools.

import { el, clear } from '../utils/dom.js';
import {
  State, subscribe, setSettings, resetSettings,
  clearAll, persist, restore, getStats,
} from '../core/state.js';
import { fmtBytes, fmtNum } from '../utils/format.js';
import { toast, toastOk, toastWarn } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { navigate, renderRoute } from '../ui/router.js';

const THEMES = [
  { id: 'obsidian', name: 'Obsidian', colors: ['#07080a', '#0e1116', '#1d232b', '#7dd3a8'] },
  { id: 'graphite', name: 'Graphite', colors: ['#101113', '#191b1f', '#2a2d33', '#b8c7d9'] },
  { id: 'aurora', name: 'Aurora', colors: ['#080a12', '#10131f', '#212739', '#9db8ff'] },
  { id: 'paper', name: 'Paper', colors: ['#f4f5f2', '#ffffff', '#dfe2d9', '#2f7f5d'] },
];

export function mountSettings(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHead());
    const grid = el('div', { class: 'settings-grid' });
    grid.appendChild(buildAppearance());
    grid.appendChild(buildBehavior());
    grid.appendChild(buildData());
    grid.appendChild(buildShortcuts());
    shell.appendChild(grid);
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'settings' || type === 'files' || type === 'log') {
      render();
    }
  });

  return () => unsub();
}

function buildHead() {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Settings' }),
    el('p', { text: 'Tune appearance, behavior, and local data. Changes save immediately.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: async () => {
        const ok = await confirmDialog('Reset every setting to defaults?',
          { title: 'Reset settings', confirmLabel: 'Reset', variant: 'danger' });
        if (!ok) return;
        resetSettings();
        toastOk('Settings reset');
      },
      text: 'Reset defaults',
    }),
  ]));
  return head;
}

function buildAppearance() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Appearance' })]),
  ]));
  const body = el('div', { class: 'card-body' });

  body.appendChild(el('div', { class: 'field-label', style: { marginBottom: '8px' }, text: 'Theme' }));
  const grid = el('div', { class: 'theme-grid' });
  for (const theme of THEMES) {
    const active = State.settings.theme === theme.id;
    const swatch = el('button', {
      class: 'theme-swatch' + (active ? ' is-active' : ''),
      type: 'button',
      onClick: () => {
        setSettings({ theme: theme.id });
        toast('Theme: ' + theme.name);
      },
    }, [
      el('div', { class: 'theme-preview' }, theme.colors.map((c) => el('i', { style: { background: c } }))),
      el('div', { class: 'theme-name', text: theme.name }),
    ]);
    grid.appendChild(swatch);
  }
  body.appendChild(grid);

  body.appendChild(el('div', { class: 'divider' }));

  body.appendChild(settingRow(
    'List layout',
    'Toggle between list and grid for the Files view.',
    buildSegmented(['list', 'grid'], State.settings.viewMode, (v) => {
      setSettings({ viewMode: v });
      toast('Layout: ' + v);
    })
  ));

  body.appendChild(settingRow(
    'Compact rows',
    'Reduce row height in the Files list.',
    buildSwitch(State.settings.compact, (v) => setSettings({ compact: v }))
  ));

  card.appendChild(body);
  return card;
}

function buildBehavior() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Behavior' })]),
  ]));
  const body = el('div', { class: 'card-body' });

  body.appendChild(settingRow(
    'Persist files across sessions',
    'Keep packed files in localStorage so they survive a reload.',
    buildSwitch(State.settings.persistFiles, (v) => {
      setSettings({ persistFiles: v });
      if (!v) toastWarn('Persisted data will remain until you clear it');
      else persist();
    })
  ));

  body.appendChild(settingRow(
    'Confirm destructive actions',
    'Ask before clearing or deleting files.',
    buildSwitch(State.settings.confirmClear, (v) => setSettings({ confirmClear: v }))
  ));

  body.appendChild(settingRow(
    'Editor line numbers',
    'Show a line-number gutter in the Editor view.',
    buildSwitch(State.settings.lineNumbers, (v) => setSettings({ lineNumbers: v }))
  ));

  card.appendChild(body);
  return card;
}

function buildData() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Data' })]),
  ]));
  const body = el('div', { class: 'card-body' });

  const stats = getStats();
  const info = el('div', { style: { marginBottom: '10px' } });
  info.appendChild(el('div', { class: 'kv' }, [el('dt', { text: 'Files' }), el('dd', { text: fmtNum(stats.fileCount) })]));
  info.appendChild(el('div', { class: 'kv' }, [el('dt', { text: 'Total size' }), el('dd', { text: fmtBytes(stats.totalBytes) })]));
  info.appendChild(el('div', { class: 'kv' }, [el('dt', { text: 'Log entries' }), el('dd', { text: fmtNum(stats.logEntries) })]));
  info.appendChild(el('div', { class: 'kv' }, [el('dt', { text: 'Pastes' }), el('dd', { text: fmtNum(stats.pastes) })]));
  body.appendChild(info);

  body.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, [
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: () => {
        persist();
        toastOk('Saved to local storage');
      },
      text: 'Save now',
    }),
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: () => {
        const restored = restore();
        toastOk(restored ? 'Restored from storage' : 'Nothing to restore');
        renderRoute('settings');
      },
      text: 'Restore',
    }),
    el('button', {
      class: 'btn btn-danger',
      type: 'button',
      onClick: async () => {
        const ok = await confirmDialog(
          'Clear every packed file and the log? This cannot be undone.',
          { title: 'Clear all data', confirmLabel: 'Clear all', variant: 'danger' }
        );
        if (!ok) return;
        clearAll();
        renderRoute('settings');
        toastOk('Cleared');
      },
      text: 'Clear all data',
    }),
  ]));

  card.appendChild(body);
  return card;
}

function buildShortcuts() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Keyboard shortcuts' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => navigate('help'),
      text: 'All shortcuts →',
    }),
  ]));
  const body = el('div', { class: 'card-body' });
  const list = el('div', { class: 'shortcut-grid' });
  const items = [
    ['Ctrl/Cmd + K', 'Command palette'],
    ['Ctrl/Cmd + S', 'Download zip'],
    ['Ctrl/Cmd + O', 'Load .zip'],
    ['Ctrl/Cmd + L', 'Copy log'],
    ['/', 'Search files'],
    ['Ctrl+V', 'Paste blocks'],
    ['↑ ↓ ↵', 'Palette navigation'],
    ['Esc', 'Dismiss'],
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

function settingRow(title, description, control) {
  return el('div', { class: 'setting-row' }, [
    el('div', { class: 'setting-text' }, [
      el('strong', { text: title }),
      el('span', { text: description }),
    ]),
    control,
  ]);
}

function buildSwitch(initial, onChange) {
  const wrap = el('label', { class: 'switch' });
  const input = el('input', { type: 'checkbox', checked: !!initial });
  input.addEventListener('change', () => onChange(input.checked));
  wrap.appendChild(input);
  wrap.appendChild(el('span', { class: 'switch-track' }));
  return wrap;
}

function buildSegmented(options, initial, onChange) {
  const group = el('div', { class: 'segmented' });
  for (const opt of options) {
    const btn = el('button', {
      type: 'button',
      class: opt === initial ? 'is-active' : '',
      text: opt,
      onClick: () => {
        for (const child of group.children) child.classList.toggle('is-active', child === btn);
        onChange(opt);
      },
    });
    group.appendChild(btn);
  }
  return group;
}
