// Command definitions shared by the palette and keyboard shortcuts.

import { State, clearAll, getStats, setSettings, resetSettings } from '../core/state.js';
import { buildZip } from '../core/zip-build.js';
import { downloadBlob } from './download.js';
import { toast, toastOk, toastWarn } from './toast.js';
import { confirmDialog } from './modal.js';
import { navigate, renderRoute } from './router.js';
import { copyToClipboard } from '../utils/dom.js';
import { logText, resendText, logAsJson } from '../core/log.js';
import { openZipPicker } from './zip-flow.js';
import { setStatusMessage } from './statusbar.js';
import { undo, redo, canUndo, canRedo, undoLabel, redoLabel } from '../core/undo.js';
import { exportAsJson, exportAsManifest, exportAsMarkdown, exportAsHtml } from '../core/export.js';
import { saveSnapshot } from '../core/snapshots.js';

export function buildCommands() {
  const stats = getStats();
  const hasFiles = stats.fileCount > 0;
  const cmds = [];

  cmds.push({
    group: 'Actions',
    label: 'Download project-pack.zip',
    hint: 'Ctrl+S',
    icon: '⤓',
    run: downloadCurrentPack,
    disabled: !hasFiles,
  });
  cmds.push({
    group: 'Actions',
    label: 'Load .zip → text',
    hint: 'Ctrl+O',
    icon: '⤒',
    run: openZipPicker,
  });
  cmds.push({
    group: 'Actions',
    label: 'Copy log to clipboard',
    hint: 'Ctrl+L',
    icon: '⎘',
    run: copyLog,
    disabled: State.log.length === 0,
  });
  cmds.push({
    group: 'Actions',
    label: 'Copy resend request',
    icon: '⇄',
    run: copyResend,
    disabled: State.failures.size === 0,
  });
  cmds.push({
    group: 'Actions',
    label: 'Save snapshot of current pack',
    icon: '◫',
    run: promptSnapshot,
    disabled: !hasFiles,
  });
  cmds.push({
    group: 'Actions',
    label: 'Clear all data',
    hint: 'Ctrl+Shift+Backspace',
    icon: '✕',
    run: clearAllData,
    disabled: !hasFiles && State.log.length === 0,
  });

  if (canUndo()) {
    cmds.push({
      group: 'Edit',
      label: 'Undo: ' + undoLabel(),
      hint: 'Ctrl+Z',
      icon: '↶',
      run: () => { if (undo()) toastOk('Undone'); },
    });
  }
  if (canRedo()) {
    cmds.push({
      group: 'Edit',
      label: 'Redo: ' + redoLabel(),
      hint: 'Ctrl+Shift+Z',
      icon: '↷',
      run: () => { if (redo()) toastOk('Redone'); },
    });
  }

  const exporters = [
    { label: 'Export as JSON', icon: '{}', run: () => exportAndDownload('json') },
    { label: 'Export as manifest', icon: '≡', run: () => exportAndDownload('manifest') },
    { label: 'Export as Markdown', icon: '▤', run: () => exportAndDownload('md') },
    { label: 'Export as HTML', icon: '◈', run: () => exportAndDownload('html') },
  ];
  for (const e of exporters) {
    cmds.push({ group: 'Export', ...e, disabled: !hasFiles });
  }

  cmds.push(
    { group: 'Navigate', label: 'Go to Dashboard', icon: '◈', run: () => navigate('dashboard') },
    { group: 'Navigate', label: 'Go to Files', icon: '▤', run: () => navigate('files') },
    { group: 'Navigate', label: 'Go to Editor', icon: '✎', run: () => navigate('editor') },
    { group: 'Navigate', label: 'Go to Log', icon: '≡', run: () => navigate('log') },
    { group: 'Navigate', label: 'Go to Insights', icon: '◔', run: () => navigate('stats') },
    { group: 'Navigate', label: 'Go to Compare', icon: '⇄', run: () => navigate('diff') },
    { group: 'Navigate', label: 'Go to Snapshots', icon: '◫', run: () => navigate('snapshots') },
    { group: 'Navigate', label: 'Go to Templates', icon: '⌗', run: () => navigate('templates') },
    { group: 'Navigate', label: 'Go to Welcome', icon: '✦', run: () => navigate('onboarding') },
    { group: 'Navigate', label: 'Go to Settings', icon: '⚙', run: () => navigate('settings') },
    { group: 'Navigate', label: 'Go to Format & help', icon: '?', run: () => navigate('help') }
  );

  cmds.push(
    { group: 'Theme', label: 'Theme: Obsidian', icon: '◐', run: () => setSettings({ theme: 'obsidian' }) },
    { group: 'Theme', label: 'Theme: Graphite', icon: '◐', run: () => setSettings({ theme: 'graphite' }) },
    { group: 'Theme', label: 'Theme: Aurora', icon: '◐', run: () => setSettings({ theme: 'aurora' }) },
    { group: 'Theme', label: 'Theme: Paper (light)', icon: '◐', run: () => setSettings({ theme: 'paper' }) },
    { group: 'View', label: 'Toggle list / grid layout', icon: '▥', run: toggleLayout },
    { group: 'View', label: 'Toggle compact rows', icon: '≡', run: () => setSettings({ compact: !State.settings.compact }) },
    { group: 'View', label: 'Toggle persistence', icon: '◫', run: () => setSettings({ persistFiles: !State.settings.persistFiles }) },
    { group: 'View', label: 'Reset all settings', icon: '↺', run: resetSettings }
  );

  return cmds;
}

export async function downloadCurrentPack() {
  const bytes = buildZip();
  if (!bytes || !bytes.length) {
    toastWarn('Nothing to download yet');
    return;
  }
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'project-pack.zip');
  toastOk('Downloaded project-pack.zip');
  setStatusMessage('Exported ZIP');
}

export async function copyLog() {
  if (!State.log.length) return;
  const ok = await copyToClipboard(logText());
  if (ok) toastOk('Log copied');
  else toastWarn('Copy failed — log is visible in the Log view');
}

export async function copyResend() {
  if (!State.failures.size) return;
  const ok = await copyToClipboard(resendText());
  if (ok) toastOk('Resend request copied');
  else toastWarn('Copy failed');
}

export async function clearAllData() {
  if (!State.settings.confirmClear) { doClear(); return; }
  const ok = await confirmDialog(
    'Clear every packed file, the log, and all local state? This cannot be undone.',
    { title: 'Clear all data?', confirmLabel: 'Clear all', variant: 'danger' }
  );
  if (ok) doClear();
}

function doClear() {
  clearAll();
  renderRoute(State.ui.activeView);
  toastOk('Cleared');
}

function toggleLayout() {
  const next = State.settings.viewMode === 'grid' ? 'list' : 'grid';
  setSettings({ viewMode: next });
  toast('Layout: ' + next);
}

function promptSnapshot() {
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.placeholder = 'Snapshot name';
  input.value = 'snapshot-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  import('./modal.js').then((m) => {
    const ref = m.openModal({
      title: 'Save snapshot',
      body: input,
      buttons: [
        { label: 'Cancel' },
        {
          label: 'Save',
          variant: 'primary',
          keepOpen: true,
          onClick: () => {
            const result = saveSnapshot(input.value);
            if (!result.ok) { toastWarn(result.error || 'Save failed'); return; }
            ref.close();
            toastOk('Snapshot saved');
          },
        },
      ],
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

function exportAndDownload(kind) {
  const files = Array.from(State.files.values());
  if (!files.length) { toastWarn('Nothing to export'); return; }
  let content = '';
  let filename = 'project-pack';
  let type = 'text/plain;charset=utf-8';
  switch (kind) {
    case 'json':
      content = exportAsJson(files);
      filename += '.json';
      type = 'application/json;charset=utf-8';
      break;
    case 'manifest':
      content = exportAsManifest(files);
      filename += '-manifest.json';
      type = 'application/json;charset=utf-8';
      break;
    case 'md':
      content = exportAsMarkdown(files);
      filename += '.md';
      type = 'text/markdown;charset=utf-8';
      break;
    case 'html':
      content = exportAsHtml(files);
      filename += '.html';
      type = 'text/html;charset=utf-8';
      break;
    default:
      return;
  }
  downloadBlob(new Blob([content], { type }), filename);
  toastOk('Exported ' + filename);
}

export function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        if (redo()) toastOk('Redone');
      } else {
        if (undo()) toastOk('Undone');
      }
      return;
    }

    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (redo()) toastOk('Redone');
      return;
    }

    if (!mod) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const input = document.getElementById('global-search');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
      return;
    }

    const tag = (e.target && e.target.tagName) || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 's' && !inField) {
      e.preventDefault();
      downloadCurrentPack();
      return;
    }
    if (e.key === 'o') {
      e.preventDefault();
      openZipPicker();
      return;
    }
    if (e.key === 'Backspace' && e.shiftKey) {
      e.preventDefault();
      clearAllData();
      return;
    }
    if (e.key === 'l' && !inField) {
      e.preventDefault();
      copyLog();
      return;
    }
    if (e.key === 'j' && !inField) {
      e.preventDefault();
      downloadBlob(
        new Blob([logAsJson()], { type: 'application/json' }),
        'project-pack-log.json'
      );
      toastOk('Log exported');
      return;
    }
  });
}
